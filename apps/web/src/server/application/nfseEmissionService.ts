import 'server-only';

import { gunzipSync } from 'node:zlib';
import { gerarDpsPsicologia } from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getNfsePreview } from './clinicFinanceService';
import { getApplicationStore } from './store';
import { exigirCertificadoNfseApto } from '@/server/fiscal/certificadoNfse';
import { NfseRepository, exigirPersistenciaFiscal, type EmissaoNfse } from '@/server/fiscal/nfseRepository';
import { PRESTADOR_NFSE, SERVICO_NFSE } from '@/server/fiscal/prestador';
import {
  ambienteNfse, CODIGO_TP_AMB, consultarChavePorDps, dpsJaGerouNfse, enviarDps,
  SefinNacionalError, type RespostaSefin,
} from '@/server/fiscal/sefinNacional';
import { assinarXmlFiscal } from '@/server/fiscal/assinaturaXmlFiscal';
import { validarDpsAssinada } from '@/server/fiscal/validacaoDps';

function serieDps(): string {
  const numero = Number(process.env.NFSE_DPS_SERIE?.trim() || '1');
  if (!Number.isInteger(numero) || numero < 1 || numero > 49_999) {
    throw new ApplicationError('INVALID_FISCAL_CONFIG', 'NFSE_DPS_SERIE deve estar entre 1 e 49999.', 500);
  }
  return String(numero).padStart(5, '0');
}

function dataHoraDps(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === tipo)?.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}T${parte('hour')}:${parte('minute')}:${parte('second')}-03:00`;
}

function valorDaTag(xml: string, tag: string): string | undefined {
  const encontrado = xml.match(new RegExp(`<(?:(?:\\w+:)?${tag})[^>]*>\\s*([^<]+?)\\s*</(?:(?:\\w+:)?${tag})>`, 'i'));
  return encontrado?.[1]?.trim();
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

function interpretarNota(resposta: RespostaSefin): { chaveAcesso?: string; numeroNfse?: string; nfseXml?: string } {
  const conteudo = objeto(resposta.json);
  const chave = typeof conteudo.chaveAcesso === 'string'
    ? conteudo.chaveAcesso
    : resposta.corpo.match(/(?<!\d)\d{50}(?!\d)/)?.[0];
  let nfseXml: string | undefined;
  if (typeof conteudo.nfseXmlGZipB64 === 'string') {
    try { nfseXml = gunzipSync(Buffer.from(conteudo.nfseXmlGZipB64, 'base64')).toString('utf8'); }
    catch { throw new Error('A SEFIN retornou uma NFS-e compactada inválida.'); }
  }
  return {
    chaveAcesso: chave,
    numeroNfse: nfseXml ? valorDaTag(nfseXml, 'nNFSe') : undefined,
    nfseXml,
  };
}

function codigoDaFalha(corpo: string): string | undefined {
  try {
    const payload = objeto(JSON.parse(corpo));
    const erro = objeto(payload.erro);
    if (typeof erro.codigo === 'string') return erro.codigo;
    const erros = Array.isArray(payload.erros) ? objeto(payload.erros[0]) : {};
    if (typeof erros.codigo === 'string') return erros.codigo;
  } catch { /* a resposta pode não ser JSON */ }
  return valorDaTag(corpo, 'codigo') ?? corpo.match(/\bE\d{4}\b/)?.[0];
}

function resultado(emissao: EmissaoNfse) {
  return {
    status: emissao.status,
    numeroNfse: emissao.numeroNfse,
    // A chave fica persistida para consulta fiscal, mas não é exibida nem
    // copiada no fluxo administrativo solicitado pela clínica.
    ambiente: emissao.ambiente,
  };
}

/** Uma emissão só começa depois da confirmação explícita no modal administrativo. */
export async function emitirNfse(context: RequestContext, chargeId: string, confirmou: unknown) {
  if (confirmou !== true) {
    throw new ApplicationError('CONFIRMATION_REQUIRED', 'Confirme a emissão da NFS-e antes de enviar a DPS.', 400);
  }
  if (!context.idempotencyKey) {
    throw new ApplicationError('IDEMPOTENCY_REQUIRED', 'A emissão exige uma chave de idempotência.', 400);
  }

  const previa = await getNfsePreview(context, chargeId);
  if (previa.camposPendentes.length) {
    throw new ApplicationError('INVALID_FISCAL_STATE', `Complete antes de emitir: ${previa.camposPendentes.join(', ')}.`, 422);
  }
  if (!previa.integracaoConfigurada) {
    throw new ApplicationError('INVALID_FISCAL_CONFIG', 'O certificado fiscal não está apto para emissão.', 422);
  }

  const store = getApplicationStore();
  const ledger = await store.financial.getLedger({ organizationId: context.actor.organizationId });
  const charge = ledger.charges.find((item) => item.id === chargeId);
  if (!charge || charge.status !== 'paid') {
    throw new ApplicationError('INVALID_FISCAL_STATE', 'A NFS-e só pode ser emitida para uma cobrança integralmente quitada.', 422);
  }

  exigirPersistenciaFiscal();
  const ambiente = ambienteNfse();
  // Esta entrega está sendo homologada exclusivamente na Produção Restrita.
  // Produção exige uma liberação posterior e explícita, depois de conferir a
  // primeira resposta da SEFIN; uma variável de ambiente trocada não pode
  // transformar o botão de teste em documento fiscal com validade jurídica.
  if (ambiente !== 'producao_restrita') {
    throw new ApplicationError('NFSE_PRODUCTION_NOT_RELEASED', 'A emissão está liberada somente no ambiente restrito durante a homologação.', 422);
  }
  const repositorio = new NfseRepository();
  const emissao = await repositorio.reservar({
    organizationId: context.actor.organizationId, chargeId, patientId: charge.patientId,
    cnpjPrestador: PRESTADOR_NFSE.cnpj, serie: serieDps(), ambiente,
    valorCents: previa.valorCents, competencia: previa.competencia,
    idempotencyKey: context.idempotencyKey, usuarioId: context.actor.userId,
  });

  if (emissao.status === 'issued') return resultado(emissao);
  if (emissao.status === 'cancelled') {
    throw new ApplicationError('INVALID_FISCAL_STATE', 'Esta DPS foi cancelada e não pode ser reenviada.', 409);
  }
  if (!(await repositorio.iniciarProcessamento(emissao.id))) {
    throw new ApplicationError('NFSE_IN_PROGRESS', 'Já existe uma emissão desta NFS-e em andamento. Aguarde alguns instantes.', 409);
  }

  try {
    let xmlAssinado = emissao.dpsXml;
    let dpsId = emissao.dpsId;
    if (!xmlAssinado) {
      const dps = gerarDpsPsicologia({
        ambiente: CODIGO_TP_AMB[ambiente], serie: emissao.serie, numeroDps: emissao.numeroDps,
        competencia: previa.competencia, emitidoEm: dataHoraDps(),
        versaoAplicativo: process.env.NFSE_VERSAO_APLICATIVO?.trim() || 'viver-mais-1.0',
        prestador: {
          cnpj: PRESTADOR_NFSE.cnpj, inscricaoMunicipal: PRESTADOR_NFSE.inscricaoMunicipal,
          codigoMunicipioIbge: PRESTADOR_NFSE.codigoMunicipioIbge, opcaoSimplesNacional: '3',
          regimeApuracaoSimples: '1', regimeEspecialTributacao: '0',
        },
        tomador: { cpfOuCnpj: previa.paciente.cpf!, nome: previa.paciente.nome, email: previa.paciente.email },
        valorCents: previa.valorCents, descricaoServico: SERVICO_NFSE.descricaoPadrao,
        codigoTributacaoNacional: SERVICO_NFSE.codigoTributacaoNacional, codigoNbs: SERVICO_NFSE.codigoNbs,
        codigoMunicipioPrestacao: PRESTADOR_NFSE.codigoMunicipioIbge,
      });
      dpsId = dps.id;
      xmlAssinado = assinarXmlFiscal(dps.xml, exigirCertificadoNfseApto(), { idDoElemento: dps.id, nomeDoElemento: 'infDPS' });
      validarDpsAssinada(xmlAssinado, exigirCertificadoNfseApto());
      await repositorio.salvarDps(emissao.id, dps.id, xmlAssinado);
    }

    const identificadorDps = dpsId.replace(/^DPS/, '');
    if (await dpsJaGerouNfse(identificadorDps)) {
      const consulta = await consultarChavePorDps(identificadorDps);
      const nota = interpretarNota(consulta);
      await repositorio.registrarNota(emissao.id, { status: consulta.status, corpo: consulta.corpo, ...nota });
      return { status: 'issued' as const, numeroNfse: nota.numeroNfse, ambiente };
    }

    const resposta = await enviarDps(xmlAssinado);
    const nota = interpretarNota(resposta);
    await repositorio.registrarNota(emissao.id, { status: resposta.status, corpo: resposta.corpo, ...nota });
    return { status: 'issued' as const, numeroNfse: nota.numeroNfse, ambiente };
  } catch (error) {
    const sefin = error instanceof SefinNacionalError ? error : undefined;
    await repositorio.registrarFalha(emissao.id, {
      status: sefin?.status, corpo: sefin?.corpo, codigo: sefin ? codigoDaFalha(sefin.corpo) : undefined,
      mensagem: error instanceof Error ? error.message : 'Falha desconhecida na emissão da NFS-e.',
    });
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError('NFSE_EMISSION_FAILED', error instanceof Error ? error.message : 'Não foi possível emitir a NFS-e.', sefin?.status && sefin.status < 500 ? 422 : 502);
  }
}
