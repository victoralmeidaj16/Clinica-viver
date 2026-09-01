import 'server-only';

import { ensurePatientFromExternalSource } from '@thats-life/core';
import type { CaptureRepository, CaptureState } from '@/server/persistence/captureRepository';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import type { PatientContact, PatientContactCapable } from '@/server/persistence/mysql/identityRepository';
import { getApplicationStore, persistApplicationState } from './store';

/**
 * Promoção de lead a paciente.
 *
 * O sistema tinha duas bases de paciente que nunca se falavam: a triagem, em
 * `clinica_triagens_pacientes`, e o cadastro clínico, em `clinica_pacientes`.
 * Um lead confirmado morria na primeira; o paciente da segunda só nascia se
 * alguém o digitasse de novo, à mão. Prontuário, sessões e financeiro pendem do
 * cadastro clínico — então, na prática, ninguém que chegava pelo site chegava a
 * ter um.
 *
 * A promoção acontece na confirmação de contato, que é o momento em que a
 * clínica sabe que aquele encaminhamento virou atendimento de verdade.
 *
 * Fora da transação de captação, deliberadamente: `captureRepository.mutate` é
 * dono da própria conexão, e uma transação atravessando os dois repositórios
 * exigiria fundi-los. O preço dessa escolha é a janela entre confirmar e
 * promover — coberta por `reconciliarPacientes`, e não por otimismo.
 */

const contatos = (identities: unknown): PatientContactCapable | null => {
  const candidato = identities as Partial<PatientContactCapable>;
  return typeof candidato.savePatientContact === 'function' ? (candidato as PatientContactCapable) : null;
};

function organizacaoDoStore(): string {
  return process.env.ORGANIZATION_ID?.trim() || process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || 'org-demo';
}

/**
 * Id derivado do lead, e não aleatório: é o que torna a promoção idempotente
 * sem precisar de tabela de controle. Chamar duas vezes encontra o mesmo
 * registro e para.
 */
export function idDoPacientePromovido(leadId: string): string {
  return `paciente-${leadId}`;
}

/**
 * A ponte entre o roster do rodízio e o cadastro clínico é `profissionalRef`,
 * gravado por `provisionPsychologistAccess` na aprovação. Sem ele o profissional
 * existe para a captação e não existe para a agenda — e o paciente ficaria sem
 * responsável.
 */
function profissionalDoLead(
  lead: TriagemPacienteRecord,
  psicologos: readonly CadastroPsicologoRecord[]
): string | null {
  if (!lead.psicologoAlocadoId) return null;
  const cadastro = psicologos.find((psi) => psi.id === lead.psicologoAlocadoId);
  return cadastro?.profissionalRef ?? null;
}

/**
 * Cria o paciente clínico correspondente ao lead. Devolve a referência criada,
 * ou `null` quando ainda não há como criar — sem lançar: uma confirmação de
 * contato não deve falhar porque o cadastro clínico do profissional está
 * incompleto. O lead fica sem `pacienteRef` e a reconciliação tenta de novo.
 */
export async function promoverLeadEmPaciente(
  lead: TriagemPacienteRecord,
  psicologos: readonly CadastroPsicologoRecord[]
): Promise<string | null> {
  const professionalId = profissionalDoLead(lead, psicologos);
  if (!professionalId) {
    console.warn(
      `[promoção] Lead ${lead.id} confirmado sem profissional clínico vinculado. ` +
        'O psicólogo precisa ter acesso provisionado (aprovação) para receber pacientes.'
    );
    return null;
  }

  const store = getApplicationStore();
  const organizationId = organizacaoDoStore();
  const id = idDoPacientePromovido(lead.id);

  // `ensurePatientFromExternalSource` lança se o profissional não existir ou
  // estiver inativo no cadastro clínico. Aqui isso não pode virar erro para
  // quem clicou no link do WhatsApp: a confirmação é dele e já é válida. O lead
  // fica sem `pacienteRef` e a reconciliação tenta de novo depois que a gestão
  // arrumar o vínculo.
  let paciente;
  try {
    paciente = await ensurePatientFromExternalSource({ repository: store.identities }, {
      id,
      organizationId,
      // O protocolo é o que a pessoa recebeu por WhatsApp e é por ele que ela se
      // identifica ao ligar para a clínica.
      externalReference: lead.protocolo,
      displayName: lead.nomePaciente,
      primaryProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId],
      createdAt: lead.confirmadoEm ?? new Date().toISOString(),
    });
  } catch (erro) {
    console.warn(`[promoção] Lead ${lead.id} não pôde virar paciente agora:`, erro);
    return null;
  }

  const contato = contatos(store.identities);
  if (contato) {
    await contato.savePatientContact(paciente.id, {
      phone: lead.telefone,
      email: lead.email,
      legalName: lead.nomePaciente,
      documento: lead.cpf,
      cep: lead.cep,
      logradouro: lead.logradouro,
      numero: lead.numeroResidencia,
      complemento: lead.complemento,
      bairro: lead.bairro,
      cidade: lead.cidade,
      uf: lead.estadoUf,
    } satisfies PatientContact);
  }

  await persistApplicationState();
  return paciente.id;
}

/**
 * Reprocessa leads confirmados que ficaram sem paciente.
 *
 * Chamada da varredura de SLA, que já roda periodicamente: reaproveitar esse
 * gatilho evita mais um job e garante que a janela entre confirmar e promover
 * feche sozinha, inclusive quando a falha foi do lado do banco.
 */
export async function reconciliarPacientes(repositorio: CaptureRepository): Promise<number> {
  const state = await repositorio.read();
  const pendentes = state.triagensPacientes.filter(
    (lead) => lead.status === 'CONTATO_CONFIRMADO' && !lead.pacienteRef && lead.psicologoAlocadoId
  );
  if (pendentes.length === 0) return 0;

  const promovidos = new Map<string, string>();
  for (const lead of pendentes) {
    const pacienteRef = await promoverLeadEmPaciente(lead, state.cadastrosPsicologos);
    if (pacienteRef) promovidos.set(lead.id, pacienteRef);
  }
  if (promovidos.size === 0) return 0;

  await repositorio.mutate((atual: CaptureState) => ({
    next: {
      ...atual,
      triagensPacientes: atual.triagensPacientes.map((lead) => {
        const pacienteRef = promovidos.get(lead.id);
        return pacienteRef && !lead.pacienteRef ? { ...lead, pacienteRef } : lead;
      }),
    },
    result: null,
  }));

  return promovidos.size;
}
