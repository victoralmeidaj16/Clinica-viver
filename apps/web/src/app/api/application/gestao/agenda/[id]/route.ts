import { resolveRequestContext } from '@/server/application/context';
import { editGestaoAppointment, updateGestaoChargeDue, updateGestaoMonthlyCoverage } from '@/server/application/gestaoAgendaService';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import type { UpdateAppointmentInput } from '@/server/scheduling/agendaRepository';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    const body = await readJson(request);
    if (body.action === 'update_charge_due') {
      return success(await updateGestaoChargeDue(context, id, String(body.dueAt ?? '')));
    }
    if (body.action === 'update_monthly_coverage') {
      if (typeof body.custeioCota !== 'number') throw new ApplicationError('INVALID_INPUT', 'Informe a quantidade de sessões.', 400);
      return success(await updateGestaoMonthlyCoverage(context, id, body.custeioCota));
    }
    if ((body.modalidade !== undefined && !['online', 'presencial'].includes(String(body.modalidade)))
      || (body.status !== undefined && !['agendado', 'confirmado', 'realizado'].includes(String(body.status)))
      || (body.custeadoPelaEmpresa !== undefined && typeof body.custeadoPelaEmpresa !== 'boolean')) {
      throw new ApplicationError('INVALID_INPUT', 'Dados de edição inválidos.', 400);
    }
    return success(await editGestaoAppointment(context, id, {
      startsAt: body.startsAt === undefined ? undefined : String(body.startsAt),
      endsAt: body.endsAt === undefined ? undefined : String(body.endsAt),
      expectedStartsAt: body.expectedStartsAt === undefined ? undefined : String(body.expectedStartsAt),
      expectedEndsAt: body.expectedEndsAt === undefined ? undefined : String(body.expectedEndsAt),
      expectedVersion: body.expectedVersion === undefined ? undefined : Number(body.expectedVersion),
      modalidade: body.modalidade as UpdateAppointmentInput['modalidade'],
      status: body.status as UpdateAppointmentInput['status'],
      custeadoPelaEmpresa: body.custeadoPelaEmpresa as boolean | undefined,
    }));
  } catch (error) { return failure(error); }
}
