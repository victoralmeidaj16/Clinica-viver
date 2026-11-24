import { dataHoraSessao, FUSO_CLINICA } from './sessionReference';

export interface EstadoAuditavel {
  inicio?: string;
  fim?: string;
  modalidade?: string;
  status?: string;
  custeadoPelaEmpresa?: boolean;
  valorCentavos?: number;
  venceEm?: string;
}

export interface MudancaAgendamento {
  campo: 'horario' | 'formato' | 'situacao' | 'pagador' | 'valor' | 'vencimento';
  rotulo: string;
  de: string;
  para: string;
}

export interface AlteracaoAgendamento {
  id: string;
  agendamentoId: string;
  profissionalRef: string;
  alteradoPorNome?: string;
  alteradoEm: string;
  mudancas: MudancaAgendamento[];
}

export interface AlteracaoAgendamentoComPaciente extends AlteracaoAgendamento {
  pacienteNome: string;
  inicio: string;
}

const formatos: Record<string, string> = { online: 'On-line', presencial: 'Presencial', telefone: 'Telefone' };
const situacoes: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado',
};
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_CLINICA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function horario({ inicio, fim }: EstadoAuditavel) {
  if (!inicio) return 'Não informado';
  return fim ? `${dataHoraSessao(inicio)} – ${hora.format(new Date(fim))}` : dataHoraSessao(inicio);
}

function pagador(empresa?: boolean) {
  return empresa ? 'Empresa (convênio)' : 'Paciente';
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function valor(centavos?: number) {
  return centavos == null ? 'Não informado' : moeda.format(centavos / 100);
}

export function diferencasDoAgendamento(antes: EstadoAuditavel, depois: EstadoAuditavel): MudancaAgendamento[] {
  const mudancas: MudancaAgendamento[] = [];
  const comparar = (campo: MudancaAgendamento['campo'], rotulo: string, de: string, para: string) => {
    if (de !== para) mudancas.push({ campo, rotulo, de, para });
  };
  if (depois.inicio !== undefined || depois.fim !== undefined) {
    comparar('horario', 'Data e horário', horario(antes), horario({ inicio: depois.inicio ?? antes.inicio, fim: depois.fim ?? antes.fim }));
  }
  if (depois.modalidade !== undefined) {
    comparar('formato', 'Formato', formatos[antes.modalidade ?? ''] ?? 'Não informado', formatos[depois.modalidade] ?? depois.modalidade);
  }
  if (depois.status !== undefined) {
    comparar('situacao', 'Situação', situacoes[antes.status ?? ''] ?? 'Não informado', situacoes[depois.status] ?? depois.status);
  }
  if (depois.custeadoPelaEmpresa !== undefined) {
    comparar('pagador', 'Responsável pelo pagamento', pagador(antes.custeadoPelaEmpresa), pagador(depois.custeadoPelaEmpresa));
  }
  if (depois.valorCentavos !== undefined) {
    comparar('valor', 'Valor da sessão', valor(antes.valorCentavos), valor(depois.valorCentavos));
  }
  if (depois.venceEm !== undefined) {
    comparar('vencimento', 'Vencimento da cobrança', antes.venceEm ? dataHoraSessao(antes.venceEm) : 'Não informado', dataHoraSessao(depois.venceEm));
  }
  return mudancas;
}
