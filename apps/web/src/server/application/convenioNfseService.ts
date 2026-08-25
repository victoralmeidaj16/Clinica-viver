import 'server-only';

import { gerarDpsPsicologia } from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { exigirAdminFiscal } from './clinicFinanceService';
import { codigoDaFalha, dataHoraDps, interpretarNota, serieDps } from './nfseEmissionService';
import { obterConvenio, obterFatura } from '@/server/persistence/mysql/convenioRepository';
import { statusCertificadoNfse } from '@/server/fiscal/certificadoNfse';
import { exigirCertificadoNfseApto } from '@/server/fiscal/certificadoNfse';
import { NfseRepository, exigirPersistenciaFiscal } from '@/server/fiscal/nfseRepository';
import { PRESTADOR_NFSE, SERVICO_NFSE } from '@/server/fiscal/prestador';
import {
  ambienteNfse, CODIGO_TP_AMB, consultarChavePorDps, dpsJaGerouNfse,
  enviarDps, SefinNacionalError,
} from '@/server/fiscal/sefinNacional';
import { assinarXmlFiscal } from '@/server/fiscal/assinaturaXmlFiscal';
import { validarDpsAssinada } from '@/server/fiscal/validacaoXmlFiscal';

async function dados(context: RequestContext, convenioId: string, faturaId: string) {
  exigirAdminFiscal(context);
  const organizationId = context.actor.organizationId;
  const [convenio, fatura] = await Promise.all([
    obterConvenio(organizationId, convenioId), obterFatura(organizationId, convenioId, faturaId),
  ]);
  if (!convenio || !fatura) throw new ApplicationError('NOT_FOUND', 'Convênio ou fatura não encontrado.', 404);
  return { organizationId, convenio, fatura };
}

export async function previaNfseFatura(context: RequestContext, convenioId: string, faturaId: string) {
  const { convenio, fatura } = await dados(context, convenioId, faturaId);
  const camposPendentes: string[] = [];
  if (!convenio.cnpj) camposPendentes.push('CNPJ do tomador');
  if (!convenio.emailFaturamento) camposPendentes.push('e-mail de faturamento');
  const certificado = statusCertificadoNfse();
  return {
    faturaId, convenio: { id: convenio.id, nome: convenio.razaoSocial ?? convenio.nome, cnpj: convenio.cnpj, email: convenio.emailFaturamento },
    competencia: `${fatura.competencia}-01`,
    descricaoServico: `Atendimentos psicoterápicos - ${fatura.competencia} - ${fatura.totalSessoes} sessões`,
    valorCents: fatura.valorCents, totalSessoes: fatura.totalSessoes,
    statusFatura: fatura.status, camposPendentes,
    integracaoConfigurada: certificado.apto, ambiente: ambienteNfse(), certificado,
  };
}

export async function emitirNfseFatura(context: RequestContext, convenioId: string, faturaId: string, confirmou: unknown) {
  if (confirmou !== true) throw new ApplicationError('CONFIRMATION_REQUIRED', 'Confirme a emissão da NFS-e antes de enviar a DPS.', 400);
  if (!context.idempotencyKey) throw new ApplicationError('IDEMPOTENCY_REQUIRED', 'A emissão exige uma chave de idempotência.', 400);
  const previa = await previaNfseFatura(context, convenioId, faturaId);
  const { organizationId, convenio, fatura } = await dados(context, convenioId, faturaId);
  if (fatura.status !== 'paga') throw new ApplicationError('INVALID_FISCAL_STATE', 'A NFS-e PJ só pode ser emitida depois da baixa integral do boleto.', 422);
  if (previa.camposPendentes.length) throw new ApplicationError('INVALID_FISCAL_STATE', `Complete antes de emitir: ${previa.camposPendentes.join(', ')}.`, 422);
  if (!previa.integracaoConfigurada) throw new ApplicationError('INVALID_FISCAL_CONFIG', 'O certificado fiscal não está apto para emissão.', 422);

  exigirPersistenciaFiscal();
  const ambiente = ambienteNfse();
  const repository = new NfseRepository();
  const emission = await repository.reservar({
    organizationId, chargeId: faturaId, convenioId, cnpjPrestador: PRESTADOR_NFSE.cnpj,
    serie: serieDps(), ambiente, valorCents: fatura.valorCents,
    competencia: `${fatura.competencia}-01`, idempotencyKey: context.idempotencyKey,
    usuarioId: context.actor.userId,
  });
  if (emission.status === 'issued') return { status: 'issued' as const, numeroNfse: emission.numeroNfse, ambiente: emission.ambiente };
  if (emission.status === 'cancelled') throw new ApplicationError('INVALID_FISCAL_STATE', 'Esta DPS foi cancelada e não pode ser reenviada.', 409);
  if (!(await repository.iniciarProcessamento(emission.id))) throw new ApplicationError('NFSE_IN_PROGRESS', 'Já existe uma emissão em andamento.', 409);

  try {
    let xmlAssinado = emission.dpsXml;
    let dpsId = emission.dpsId;
    if (!xmlAssinado) {
      const dps = gerarDpsPsicologia({
        ambiente: CODIGO_TP_AMB[ambiente], serie: emission.serie, numeroDps: emission.numeroDps,
        competencia: previa.competencia, emitidoEm: dataHoraDps(),
        versaoAplicativo: process.env.NFSE_VERSAO_APLICATIVO?.trim() || 'viver-mais-1.0',
        prestador: {
          cnpj: PRESTADOR_NFSE.cnpj, inscricaoMunicipal: PRESTADOR_NFSE.inscricaoMunicipal,
          codigoMunicipioIbge: PRESTADOR_NFSE.codigoMunicipioIbge, opcaoSimplesNacional: '3',
          regimeApuracaoSimples: '1', regimeEspecialTributacao: '0',
        },
        tomador: { cpfOuCnpj: convenio.cnpj!, nome: convenio.razaoSocial ?? convenio.nome, email: convenio.emailFaturamento },
        valorCents: fatura.valorCents, descricaoServico: previa.descricaoServico,
        codigoTributacaoNacional: SERVICO_NFSE.codigoTributacaoNacional, codigoNbs: SERVICO_NFSE.codigoNbs,
        codigoMunicipioPrestacao: PRESTADOR_NFSE.codigoMunicipioIbge,
      });
      dpsId = dps.id;
      xmlAssinado = assinarXmlFiscal(dps.xml, exigirCertificadoNfseApto(), { idDoElemento: dps.id, nomeDoElemento: 'infDPS' });
      validarDpsAssinada(xmlAssinado, exigirCertificadoNfseApto());
      await repository.salvarDps(emission.id, dps.id, xmlAssinado);
    }
    const identificador = dpsId.replace(/^DPS/, '');
    const response = await dpsJaGerouNfse(identificador)
      ? await consultarChavePorDps(identificador)
      : await enviarDps(xmlAssinado);
    const nota = interpretarNota(response);
    await repository.registrarNota(emission.id, { status: response.status, corpo: response.corpo, ...nota });
    return { status: 'issued' as const, numeroNfse: nota.numeroNfse, ambiente };
  } catch (error) {
    const sefin = error instanceof SefinNacionalError ? error : undefined;
    await repository.registrarFalha(emission.id, {
      status: sefin?.status, corpo: sefin?.corpo, codigo: sefin ? codigoDaFalha(sefin.corpo) : undefined,
      mensagem: error instanceof Error ? error.message : 'Falha desconhecida na emissão da NFS-e PJ.',
    });
    throw error instanceof ApplicationError ? error : new ApplicationError(
      'NFSE_EMISSION_FAILED', error instanceof Error ? error.message : 'Não foi possível emitir a NFS-e PJ.',
      sefin?.status && sefin.status < 500 ? 422 : 502
    );
  }
}
