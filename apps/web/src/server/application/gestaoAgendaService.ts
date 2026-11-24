import 'server-only';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { editAgendaAppointment, updateAgendaAppointmentChargeDue } from './agendaService';
import { nomeDoUsuario } from './autorGestao';
import { diferencasDoAgendamento } from '@/lib/alteracoesAgendamento';
import { alteracoesDoAgendamento, registrarAlteracaoAgendamento } from '@/server/persistence/mysql/agendamentoAlteracoesRepository';
import { getMysqlPool } from '@/server/oci/runtime';
import { updatePatientConvenio } from './convenioService';
import {
  listarAgendaGestao,
  profissionalDoAgendamentoGestao,
  convenioDoAgendamentoGestao,
  type FiltroStatusAgendaGestao,
  type PeriodoAgendaGestao,
} from '@/server/scheduling/gestaoAgendaRepository';
import { toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import type { UpdateAppointmentInput } from '@/server/scheduling/agendaRepository';

const STATUS_FILTRO_VALIDOS: readonly FiltroStatusAgendaGestao[] = ['abertas', 'realizado', 'cancelado', 'todas'];

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte as datas do filtro (dias do calendário de Brasília) nos limites em
 * UTC do início da sessão: de 00h do primeiro dia até 00h do dia seguinte ao
 * último. Brasília está em UTC−3 o ano todo desde o fim do horário de verão.
 */
export function periodoDaAgenda(desde?: string, ate?: string): PeriodoAgendaGestao {
  const valida = (data: string) => DATA.test(data) && !Number.isNaN(Date.parse(`${data}T00:00:00-03:00`));
  if ((desde && !valida(desde)) || (ate && !valida(ate))) {
    throw new ApplicationError('INVALID_INPUT', 'Data do filtro inválida.', 400);
  }
  if (desde && ate && desde > ate) {
    throw new ApplicationError('INVALID_INPUT', 'A data inicial do filtro é posterior à final.', 400);
  }
  const periodo: PeriodoAgendaGestao = {};
  if (desde) periodo.inicioDesde = toSqlTimestamp(`${desde}T00:00:00-03:00`);
  if (ate) {
    const diaSeguinte = new Date(Date.parse(`${ate}T00:00:00-03:00`) + 86_400_000);
    periodo.inicioAntesDe = toSqlTimestamp(diaSeguinte.toISOString());
  }
  return periodo;
}

function exigirAdmin(context: RequestContext) {
  if (!context.actor.roles.some((role) => role === 'admin' || role === 'owner')) {
    throw new ApplicationError('FORBIDDEN', 'A agenda da clínica é exclusiva da administração.', 403);
  }
}

export async function getGestaoAgenda(
  context: RequestContext,
  busca = '',
  pagina = 0,
  statusFiltro?: string,
  filtroData: { desde?: string; ate?: string } = {}
) {
  exigirAdmin(context);
  if (!Number.isSafeInteger(pagina) || pagina < 0 || pagina > 100000) {
    throw new ApplicationError('INVALID_INPUT', 'Página inválida.', 400);
  }
  if (statusFiltro !== undefined && !STATUS_FILTRO_VALIDOS.includes(statusFiltro as FiltroStatusAgendaGestao)) {
    throw new ApplicationError('INVALID_INPUT', 'Filtro de status inválido.', 400);
  }
  const termo = busca.trim().slice(0, 150);
  const periodo = periodoDaAgenda(filtroData.desde || undefined, filtroData.ate || undefined);
  if (periodo.inicioDesde || periodo.inicioAntesDe) {
    return listarAgendaGestao(context.actor.organizationId, termo, pagina,
      (statusFiltro ?? 'abertas') as FiltroStatusAgendaGestao, periodo);
  }
  return statusFiltro && statusFiltro !== 'abertas'
    ? listarAgendaGestao(context.actor.organizationId, termo, pagina, statusFiltro as FiltroStatusAgendaGestao)
    : listarAgendaGestao(context.actor.organizationId, termo, pagina);
}

export async function editGestaoAppointment(context: RequestContext, id: string, input: UpdateAppointmentInput) {
  exigirAdmin(context);
  if (input.startsAt !== undefined || input.endsAt !== undefined) {
    const start = Date.parse(input.startsAt ?? '');
    const end = Date.parse(input.endsAt ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new ApplicationError('INVALID_INPUT', 'Informe início e término válidos para o atendimento.', 400);
    }
  }
  const professionalId = await profissionalDoAgendamentoGestao(context.actor.organizationId, id);
  if (!professionalId) throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  // O profissional vem do agendamento da organização autenticada, nunca do cliente.
  await editAgendaAppointment({ ...context, actor: { ...context.actor, professionalProfileId: professionalId } },
    id, input, { permitirCorrecaoAdministrativa: true, permitirHorarioPassado: true,
      registrarAlteracaoGestao: { usuarioRef: context.actor.userId, nome: await nomeDoUsuario(context.actor.userId) } });
  return { updated: true };
}

export async function updateGestaoChargeDue(context: RequestContext, id: string, dueAt: string) {
  exigirAdmin(context);
  const { organizationId, userId } = context.actor;
  const professionalId = await profissionalDoAgendamentoGestao(organizationId, id);
  if (!professionalId) throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  const resultado = await updateAgendaAppointmentChargeDue({ ...context,
    actor: { ...context.actor, professionalProfileId: professionalId } }, id, dueAt, async (anterior) => {
    try {
      const mudancas = diferencasDoAgendamento({ venceEm: anterior.venceEm }, { venceEm: dueAt });
      if (mudancas.length) {
        await registrarAlteracaoAgendamento(getMysqlPool(), {
          organizacaoRef: organizationId, agendamentoId: anterior.agendamentoId, profissionalRef: anterior.profissionalRef,
          usuarioRef: userId, nome: await nomeDoUsuario(userId), alteradoEm: new Date(), mudancas,
        });
      }
    } catch {
      console.error('[agenda] Falha ao registrar a alteração de vencimento.');
    }
  });
  return resultado.pending ? { updated:false,pending:true } : { updated:true };
}

export async function updateGestaoMonthlyCoverage(context: RequestContext, id: string, cota: number) {
  exigirAdmin(context);
  if (!Number.isInteger(cota) || cota < 1 || cota > 65535) {
    throw new ApplicationError('INVALID_INPUT', 'Informe uma quantidade de sessões entre 1 e 65535.', 400);
  }
  const vinculo = await convenioDoAgendamentoGestao(context.actor.organizationId, id);
  if (!vinculo) throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  if (!vinculo.convenioId) throw new ApplicationError('INVALID_INPUT', 'Vincule o paciente a um convênio antes de definir o limite mensal.', 400);
  if (vinculo.pacoteSessoes) {
    throw new ApplicationError('CONVENIO_PACKAGE_DEFINED', 'A quantidade de sessões é definida pelo pacote do convênio. Altere o pacote em Convênios.', 409);
  }
  return updatePatientConvenio(context, vinculo.pacienteId, {
    convenioId: vinculo.convenioId, custeadoPelaEmpresa: true, custeioCota: cota, custeioCiclo: 'mensal',
  });
}

export async function historicoGestaoAppointment(context: RequestContext, id: string) {
  exigirAdmin(context);
  const { organizationId } = context.actor;
  if (!await profissionalDoAgendamentoGestao(organizationId, id)) {
    throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  }
  return { alteracoes: await alteracoesDoAgendamento(organizationId, id) };
}
