import 'server-only';

import { assertStaffAuthorized } from '@thats-life/core';
import { pacienteMenorDeIdade, validarResponsavelFinanceiro, type ResponsavelFinanceiro } from '@/lib/responsavelFinanceiro';
import { tipoColetivoDoPedido, validarVinculoColetivo, type TipoVinculoColetivo, type VinculoColetivo } from '@/lib/vinculoColetivo';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import type { TriagemPacienteRecord } from './persistence';
import { getApplicationStore } from './store';

/**
 * Responsável financeiro e participantes do vínculo (especificação final, 6.03
 * e 6.04), editáveis pelo psicólogo responsável e pela Gestão.
 *
 * O registro mora no pedido da captação — o vínculo — e é dele que a cobrança
 * e a nota tiram o pagador. Assim um responsável trocado aqui vale para a
 * próxima cobrança sem segunda cópia no cadastro clínico.
 */

export interface VinculoDoPaciente {
  leadId: string;
  menorDeIdade: boolean;
  /** Casal, família ou grupo pelo serviço/público do pedido, mesmo sem participantes salvos. */
  tipoColetivoSugerido?: TipoVinculoColetivo;
  possuiCpfProprio: boolean;
  identificadoPeloResponsavel: boolean;
  responsavelFinanceiro?: ResponsavelFinanceiro;
  vinculoColetivo?: VinculoColetivo;
}

function resumo(lead: TriagemPacienteRecord): VinculoDoPaciente {
  return {
    leadId: lead.id,
    menorDeIdade: pacienteMenorDeIdade(lead),
    tipoColetivoSugerido: lead.vinculoColetivo?.tipo ?? tipoColetivoDoPedido(lead),
    possuiCpfProprio: Boolean(lead.cpf),
    identificadoPeloResponsavel: Boolean(lead.identificadoPeloResponsavel && !lead.cpf),
    ...(lead.responsavelFinanceiro ? { responsavelFinanceiro: lead.responsavelFinanceiro } : {}),
    ...(lead.vinculoColetivo ? { vinculoColetivo: lead.vinculoColetivo } : {}),
  };
}

/** O vínculo atual do paciente: o mais recente que não foi encerrado. */
function vinculoAtual(leads: readonly TriagemPacienteRecord[], patientId: string): TriagemPacienteRecord | undefined {
  const doPaciente = leads.filter((lead) => lead.pacienteRef === patientId);
  return [...doPaciente].reverse().find((lead) => lead.status !== 'DESISTENTE' && lead.status !== 'FINALIZADO')
    ?? doPaciente[doPaciente.length - 1];
}

async function autorizar(context: RequestContext, patientId: string, permissao: 'patients.read' | 'patients.write') {
  const patient = await getApplicationStore().identities.getPatient(context.actor.organizationId, patientId);
  if (!patient) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  assertStaffAuthorized(context.actor, permissao, {
    organizationId: context.actor.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  return patient;
}

export async function getPatientBond(context: RequestContext, patientId: string): Promise<VinculoDoPaciente> {
  await autorizar(context, patientId, 'patients.read');
  const lead = vinculoAtual((await getCaptureRepository().read()).triagensPacientes, patientId);
  if (!lead) throw new ApplicationError('NOT_FOUND', 'Este paciente não tem um vínculo de encaminhamento registrado.', 404);
  return resumo(lead);
}

/**
 * Atualiza responsável e participantes. `null` remove; campo ausente mantém.
 * Coletivo exige e-mail e endereço do responsável (cobrança e NFS-e); menor
 * sem CPF próprio exige responsável e não pode perdê-lo.
 */
export async function updatePatientBond(
  context: RequestContext,
  patientId: string,
  body: Record<string, unknown>
): Promise<VinculoDoPaciente> {
  await autorizar(context, patientId, 'patients.write');

  return getCaptureRepository().mutate((state) => {
    const lead = vinculoAtual(state.triagensPacientes, patientId);
    if (!lead) throw new ApplicationError('NOT_FOUND', 'Este paciente não tem um vínculo de encaminhamento registrado.', 404);

    let vinculoColetivo = lead.vinculoColetivo;
    if ('vinculoColetivo' in body) {
      if (body.vinculoColetivo === null) vinculoColetivo = undefined;
      else {
        const validado = validarVinculoColetivo(body.vinculoColetivo, { minimoParticipantes: 2 });
        if (!validado.ok) throw new ApplicationError('INVALID_INPUT', validado.erro, 400);
        vinculoColetivo = validado.vinculo;
      }
    }

    let identificadoPeloResponsavel = Boolean(lead.identificadoPeloResponsavel);
    if (typeof body.identificadoPeloResponsavel === 'boolean') {
      if (body.identificadoPeloResponsavel && lead.cpf) {
        throw new ApplicationError('INVALID_INPUT', 'O paciente já tem CPF próprio cadastrado.', 400);
      }
      if (body.identificadoPeloResponsavel && !pacienteMenorDeIdade(lead)) {
        throw new ApplicationError('INVALID_INPUT', 'Só criança ou adolescente pode ser identificado pelo CPF do responsável.', 400);
      }
      identificadoPeloResponsavel = body.identificadoPeloResponsavel;
    }

    let responsavelFinanceiro = lead.responsavelFinanceiro;
    if ('responsavelFinanceiro' in body) {
      if (body.responsavelFinanceiro === null) responsavelFinanceiro = undefined;
      else {
        const validado = validarResponsavelFinanceiro(body.responsavelFinanceiro, {
          email: Boolean(vinculoColetivo),
          endereco: Boolean(vinculoColetivo),
        });
        if (!validado.ok) throw new ApplicationError('INVALID_INPUT', validado.erro, 400);
        responsavelFinanceiro = validado.responsavel;
      }
    }
    if (identificadoPeloResponsavel && !lead.cpf && !responsavelFinanceiro) {
      throw new ApplicationError('INVALID_INPUT', 'O menor sem CPF é identificado pelo responsável: informe nome e CPF dele.', 400);
    }
    if (responsavelFinanceiro && lead.cpf && responsavelFinanceiro.cpf === lead.cpf && !vinculoColetivo) {
      throw new ApplicationError('INVALID_INPUT', 'O CPF do responsável deve ser diferente do CPF do paciente.', 400);
    }

    const atualizado: TriagemPacienteRecord = {
      ...lead,
      responsavelFinanceiro,
      identificadoPeloResponsavel: identificadoPeloResponsavel && !lead.cpf ? true : undefined,
      vinculoColetivo,
    };
    return {
      next: { ...state, triagensPacientes: state.triagensPacientes.map((item) => (item.id === lead.id ? atualizado : item)) },
      result: resumo(atualizado),
    };
  });
}
