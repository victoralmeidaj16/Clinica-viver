import 'server-only';
import type { FinalidadeMensagem } from '@/server/application/viverMaisWhatsApp';
import type { ContatosDaSessao } from './agendaRepository';
import type { ValoresDoModelo } from '@/lib/avisos/modelo';
import {
  textoCancelamentoPaciente, textoConfirmacaoPaciente, textoConfirmacaoPsicologo,
  textoRecusaReagendamentoPaciente, textoSolicitacaoReagendamentoPsicologo, textosRemarcacao,
  variaveisDaSessao, variaveisRemarcacao, variaveisSolicitacaoReagendamento,
} from './agendaAvisos';

export type DadosAvisoReenvio = { inicioAnterior?: string; inicioSolicitado?: string;
  inicioNovo?: string; fimNovo?: string; modalidade?: ContatosDaSessao['modalidade'] };
type Mensagem = { telefone: string | null; texto: string; finalidade: FinalidadeMensagem; variaveis: ValoresDoModelo };

/** Reconstrói o aviso sem persistir texto ou telefone na fila. */
export function avisoParaReenvio(tipo: string, sessao: ContatosDaSessao, dados: DadosAvisoReenvio): Mensagem | null {
  const mensagem = montar(tipo, sessao, dados);
  if (!mensagem) return null;
  const variaveis = tipo.startsWith('remarcacao_') && dados.inicioAnterior
    ? variaveisRemarcacao(sessao, dados.inicioAnterior)
    : tipo === 'solicitacao_reagendamento_psicologo' && dados.inicioSolicitado
      ? variaveisSolicitacaoReagendamento(sessao, dados.inicioSolicitado)
      : variaveisDaSessao(sessao);
  return { ...mensagem, variaveis };
}

function montar(tipo: string, sessao: ContatosDaSessao, dados: DadosAvisoReenvio): Omit<Mensagem, 'variaveis'> | null {
  switch (tipo) {
    case 'confirmacao_paciente': return { telefone: sessao.pacienteTelefone, texto: textoConfirmacaoPaciente(sessao), finalidade: 'agenda_confirmacao_paciente' };
    case 'confirmacao_psicologo': return { telefone: sessao.profissionalTelefone, texto: textoConfirmacaoPsicologo(sessao), finalidade: 'agenda_confirmacao_psicologo' };
    case 'cancelamento_paciente': return { telefone: sessao.pacienteTelefone, texto: textoCancelamentoPaciente(sessao), finalidade: 'agenda_cancelamento_paciente' };
    case 'remarcacao_paciente':
    case 'remarcacao_psicologo': {
      if (!dados.inicioAnterior) return null;
      const textos = textosRemarcacao(sessao, dados.inicioAnterior);
      return tipo === 'remarcacao_paciente'
        ? { telefone: sessao.pacienteTelefone, texto: textos.paciente, finalidade: 'agenda_remarcacao_paciente' }
        : { telefone: sessao.profissionalTelefone, texto: textos.profissional, finalidade: 'agenda_remarcacao_psicologo' };
    }
    case 'solicitacao_reagendamento_psicologo':
      return dados.inicioSolicitado ? { telefone: sessao.profissionalTelefone, texto: textoSolicitacaoReagendamentoPsicologo(sessao, dados.inicioSolicitado), finalidade: 'agenda_solicitacao_reagendamento_psicologo' } : null;
    case 'recusa_reagendamento_paciente': return { telefone: sessao.pacienteTelefone, texto: textoRecusaReagendamentoPaciente(sessao), finalidade: 'agenda_recusa_reagendamento_paciente' };
    default: return null;
  }
}
