import 'server-only';

import { assertStaffAuthorized } from '@thats-life/core';
import { motivoInativacaoValido } from '@/lib/inativacaoVinculo';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import type { AutorDaSessao } from './autorGestao';
import { nomeDoUsuario } from './autorGestao';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { inativarVinculo, reativarVinculo, type AutorInativacao, type ResultadoInativacao } from './inativacaoVinculo';
import { executarListaDeEsperaSemFalhar } from './listaEsperaExecucao';
import type { TriagemPacienteRecord } from './persistence';
import { getApplicationStore, persistApplicationState } from './store';

/**
 * Inativação do vínculo pelo psicólogo responsável e pela Gestão, e reativação
 * pela Gestão (especificação final, 6.05 e 13.01).
 *
 * O registro (motivo, data, autor) mora no pedido da captação, que é o que o
 * contador de vagas lê. O cadastro clínico acompanha: inativo vira `paused`,
 * que some da agenda manual e do contador de ativos da carteira.
 */

const ERROS: Record<Exclude<ResultadoInativacao['situacao'], 'inativado' | 'reativado'>, [string, number]> = {
  nao_encontrado: ['O vínculo deste paciente não foi encontrado.', 404],
  nao_ativo: ['Só um vínculo ativo pode ser inativado.', 409],
  nao_inativo: ['Este vínculo não está inativo.', 409],
  psicologo_indisponivel: ['O psicólogo do vínculo não está mais aprovado. Encaminhe o paciente a outro profissional.', 409],
  justificativa_obrigatoria: ['Informe a justificativa para exceder o limite de pacientes do psicólogo.', 400],
  limite_atingido: ['O psicólogo atingiu o limite de pacientes ativos.', 409],
};

function falha(resultado: Exclude<ResultadoInativacao, { lead: TriagemPacienteRecord }>): never {
  if (resultado.situacao === 'limite_atingido') {
    throw new ApplicationError(
      'LIMITE_ATINGIDO',
      `O psicólogo atingiu o limite (${resultado.ativos} de ${resultado.limite}). Autorize a exceção com justificativa para reativar mesmo assim.`,
      409
    );
  }
  const [mensagem, status] = ERROS[resultado.situacao];
  throw new ApplicationError('INVALID_STATE', mensagem, status);
}

async function aplicar(
  localizar: (leads: readonly TriagemPacienteRecord[]) => TriagemPacienteRecord | undefined,
  operacao: (snapshotLeadId: string, state: Parameters<typeof captureStateAsSnapshot>[0]) => ResultadoInativacao
): Promise<TriagemPacienteRecord> {
  const resultado = await getCaptureRepository().mutate((state) => {
    const lead = localizar(state.triagensPacientes);
    if (!lead) return { next: state, result: { situacao: 'nao_encontrado', snapshot: captureStateAsSnapshot(state) } as ResultadoInativacao };
    const handled = operacao(lead.id, state);
    return {
      next: handled.situacao === 'inativado' || handled.situacao === 'reativado'
        ? {
            ...state,
            triagensPacientes: handled.snapshot.triagensPacientes ?? [],
            cadastrosPsicologos: handled.snapshot.cadastrosPsicologos ?? [],
          }
        : state,
      result: handled,
    };
  });
  if ('lead' in resultado) return resultado.lead;
  return falha(resultado);
}

async function sincronizarCadastroClinico(organizationId: string, patientId: string | undefined, status: 'active' | 'paused') {
  if (!patientId) return;
  const store = getApplicationStore();
  const patient = await store.identities.getPatient(organizationId, patientId);
  if (patient && patient.status !== status) {
    await store.identities.savePatient({ ...patient, status, updatedAt: new Date().toISOString() });
    await persistApplicationState();
  }
}

/** Psicólogo responsável inativando um paciente da própria carteira. */
export async function inactivateOwnPatient(
  context: RequestContext,
  body: Record<string, unknown>
): Promise<TriagemPacienteRecord> {
  const professionalId = context.actor.professionalProfileId;
  const isProfessional = context.actor.roles.includes('professional')
    && !context.actor.roles.some((role) => role === 'owner' || role === 'admin');
  if (!isProfessional || !professionalId) {
    throw new ApplicationError('FORBIDDEN', 'Somente o psicólogo responsável pode inativar o vínculo nesta página.', 403);
  }
  const patientId = String(body.patientId ?? '').trim();
  const motivo = motivoInativacaoValido(body.motivo);
  if (!patientId || !motivo) {
    throw new ApplicationError('INVALID_INPUT', 'Informe o motivo da inativação (pelo menos 5 caracteres).', 400);
  }

  const store = getApplicationStore();
  const patient = await store.identities.getPatient(context.actor.organizationId, patientId);
  if (!patient) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  assertStaffAuthorized(context.actor, 'patients.write', {
    organizationId: context.actor.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  if (!patient.assignedProfessionalIds.includes(professionalId)) {
    throw new ApplicationError('FORBIDDEN', 'Este paciente não pertence à sua carteira.', 403);
  }

  const autor: AutorInativacao = {
    usuarioRef: context.actor.userId,
    nome: (await store.identities.getProfessional(context.actor.organizationId, professionalId))?.displayName
      ?? await nomeDoUsuario(context.actor.userId),
    perfil: 'PSICOLOGO',
  };
  const lead = await aplicar(
    (leads) => leads.find((item) => item.pacienteRef === patient.id && item.status !== 'INATIVO')
      ?? leads.find((item) => item.pacienteRef === patient.id),
    (leadId, state) => inativarVinculo(captureStateAsSnapshot(state), leadId, motivo, autor)
  );
  await sincronizarCadastroClinico(context.actor.organizationId, patient.id, 'paused');
  await executarListaDeEsperaSemFalhar();
  return lead;
}

function localizador(referencia: { patientId?: string; leadId?: string }) {
  return (leads: readonly TriagemPacienteRecord[]) => referencia.leadId
    ? leads.find((item) => item.id === referencia.leadId)
    : leads.find((item) => item.pacienteRef === referencia.patientId);
}

/** Inativação pela Gestão, com o mesmo registro de motivo, data e autor. */
export async function inativarPelaGestao(
  organizationId: string,
  autorSessao: AutorDaSessao,
  referencia: { patientId?: string; leadId?: string },
  motivoBruto: unknown
): Promise<TriagemPacienteRecord> {
  const motivo = motivoInativacaoValido(motivoBruto);
  if (!motivo) throw new ApplicationError('INVALID_INPUT', 'Informe o motivo da inativação (pelo menos 5 caracteres).', 400);
  if (!referencia.patientId && !referencia.leadId) throw new ApplicationError('INVALID_INPUT', 'Selecione o paciente.', 400);
  const autor: AutorInativacao = { ...autorSessao, perfil: 'GESTAO' };
  const lead = await aplicar(localizador(referencia), (leadId, state) =>
    inativarVinculo(captureStateAsSnapshot(state), leadId, motivo, autor));
  await sincronizarCadastroClinico(organizationId, lead.pacienteRef, 'paused');
  await executarListaDeEsperaSemFalhar();
  return lead;
}

/** Reativação pela Gestão, com a regra de excesso de capacidade do 6.08. */
export async function reativarPelaGestao(
  organizationId: string,
  autorSessao: AutorDaSessao,
  referencia: { patientId?: string; leadId?: string },
  opcoes: { justificativa?: string; excederLimite?: boolean }
): Promise<TriagemPacienteRecord> {
  if (!referencia.patientId && !referencia.leadId) throw new ApplicationError('INVALID_INPUT', 'Selecione o paciente.', 400);
  const autor: AutorInativacao = { ...autorSessao, perfil: 'GESTAO' };
  const lead = await aplicar(localizador(referencia), (leadId, state) =>
    reativarVinculo(captureStateAsSnapshot(state), leadId, opcoes, autor));
  await sincronizarCadastroClinico(organizationId, lead.pacienteRef, 'active');
  return lead;
}
