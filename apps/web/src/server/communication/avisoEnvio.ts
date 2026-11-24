import 'server-only';

import { avisoDoCatalogo, usaWhatsApp, type DestinatarioAviso } from '@/lib/avisos/catalogo';
import type { ValoresDoModelo } from '@/lib/avisos/modelo';
import { avisoAtivo, modeloVigente } from '@/server/application/modelosAvisos';
import { registrarEnvioDeAviso, type SituacaoEnvioAviso } from './avisosEnviosRepository';

/**
 * O que acontece em volta de cada envio de WhatsApp: escolher o texto (padrão
 * ou versão da Gestão), respeitar o canal e a ativação, e deixar o registro.
 * Nada aqui lança: o aviso é consequência de uma operação já gravada.
 */

export interface OpcoesDoAviso {
  /** Campos do modelo. Sem eles, vale o texto padrão montado pelo chamador. */
  variaveis?: ValoresDoModelo;
  /** Protocolo, agendamento ou cadastro que originou o aviso, para a tela de envios. */
  referencia?: string;
  /** Reenvio pela Gestão: o texto já é o final; não aplica modelo, canal nem ativação. */
  reenvio?: { de: string; autor: { usuarioRef: string; nome?: string } };
}

export interface AvisoPreparado {
  texto: string;
  versao: number;
  /** A Gestão escolheu outro canal ou o complementar está desligado. */
  desligado: boolean;
}

/** Finalidades fora do catálogo também entram no registro. */
const DESTINATARIO_FORA_DO_CATALOGO: Record<string, DestinatarioAviso> = {
  alerta_coordenacao: 'gestao',
  resposta_psicologo: 'psicologo',
};

export async function prepararAviso(finalidade: string, texto: string, opcoes: OpcoesDoAviso): Promise<AvisoPreparado> {
  if (opcoes.reenvio) return { texto, versao: 0, desligado: false };
  try {
    const vigente = await modeloVigente(finalidade, opcoes.variaveis, texto);
    if (!vigente) return { texto, versao: 0, desligado: false };
    const aviso = avisoDoCatalogo(finalidade);
    // A ativação dos avisos de turma mora na tela de turmas; quem chama já a conferiu.
    const inativo = aviso && !aviso.essencial && !aviso.ativacaoEm && !(await avisoAtivo(finalidade));
    return {
      texto: vigente.texto,
      versao: vigente.configuracao.versao,
      desligado: Boolean(inativo) || !usaWhatsApp(vigente.configuracao.canal),
    };
  } catch {
    return { texto, versao: 0, desligado: false };
  }
}

export interface ResultadoParaRegistro {
  finalidade: string;
  chaveDedupe: string;
  telefone: string;
  texto: string;
  versao: number;
  situacao: string;
  reenvioSeguro?: boolean;
  opcoes: OpcoesDoAviso;
}

export async function registrarResultadoDoAviso(resultado: ResultadoParaRegistro): Promise<void> {
  // Canal desligado não é envio: não há o que registrar como tentativa.
  if (resultado.situacao === 'canal_desligado') return;
  const aviso = avisoDoCatalogo(resultado.finalidade);
  await registrarEnvioDeAviso({
    finalidade: resultado.finalidade,
    chaveDedupe: resultado.chaveDedupe,
    canal: 'whatsapp',
    destinatarioTipo: aviso?.destinatario ?? DESTINATARIO_FORA_DO_CATALOGO[resultado.finalidade] ?? 'gestao',
    destino: resultado.telefone,
    referencia: resultado.opcoes.referencia,
    situacao: resultado.situacao as SituacaoEnvioAviso,
    reenvioSeguro: resultado.reenvioSeguro,
    modeloVersao: resultado.versao,
    // Link de ativação é segredo: o registro existe, o texto não fica guardado.
    conteudo: aviso?.reenviavel === false ? undefined : { destino: resultado.telefone, texto: resultado.texto },
    reenvioDe: resultado.opcoes.reenvio?.de,
    autor: resultado.opcoes.reenvio?.autor,
  });
}
