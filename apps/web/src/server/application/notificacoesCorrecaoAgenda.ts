import type { AlteracaoAgendamentoComPaciente } from '@/lib/alteracoesAgendamento';
import { comFoco, focoSessao } from '@/lib/focoNotificacao';
import { dataHoraSessao } from '@/lib/sessionReference';
import type { NotificacaoDerivada } from './notificacoes';

export function notificacoesDeCorrecaoDaGestao(
  alteracoes: readonly AlteracaoAgendamentoComPaciente[]
): NotificacaoDerivada[] {
  return alteracoes.map(({ agendamentoId, alteradoEm, pacienteNome, inicio, mudancas }) => ({
    chave: `agenda-corrigida:${agendamentoId}:${alteradoEm}`,
    tipo: 'agenda-corrigida',
    titulo: 'Atendimento alterado pela Gestão',
    descricao: `${pacienteNome} — ${dataHoraSessao(inicio)}: ${mudancas.map((m) => `${m.rotulo}: ${m.de} → ${m.para}`).join('; ')}.`,
    ocorridoEm: alteradoEm,
    severidade: 'ATENCAO',
    href: comFoco('/agenda', focoSessao(agendamentoId)),
    pendente: false,
  }));
}
