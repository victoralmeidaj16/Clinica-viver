import 'server-only';

import { ApplicationError } from './http';
import { getApplicationStore } from './store';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { PatientDocumentCapable } from '@/server/persistence/mysql/identityRepository';
import { validCpf } from '@/server/http/publicRequest';

/**
 * CPF do paciente — o campo que decide se a NFS-e sai.
 *
 * Ele nasceu só no formulário de triagem, e ficava só lá. Quem a recepção
 * cadastrou direto, ou quem chegou antes de a triagem coletar CPF, tinha uma
 * cobrança paga e uma nota impossível: a conferência acusava "CPF do tomador"
 * pendente e não existia tela em lugar nenhum para preencher.
 *
 * A gravação vai aos **dois** lugares onde o CPF é lido, de propósito:
 *
 *  - `clinica_triagens_pacientes.cpf`, que é por onde o paciente se identifica
 *    no link público de agendamento; e
 *  - `clinica_pacientes.documento`, que é o cadastro e o único lugar que existe
 *    para quem nunca teve triagem.
 *
 * Gravar em um só criaria a situação pior de todas: a nota sai, e o paciente
 * deixa de conseguir marcar sessão pelo próprio link — ou o contrário.
 */

function documentCapable(valor: unknown): PatientDocumentCapable | null {
  const candidato = valor as Partial<PatientDocumentCapable>;
  return typeof candidato.savePatientDocument === 'function' ? (candidato as PatientDocumentCapable) : null;
}

export interface AtualizacaoCpfPaciente {
  patientId?: string;
  leadId?: string;
  cpf: string;
  /** Onde o dado efetivamente entrou, para a tela poder dizer a verdade. */
  gravadoEm: readonly ('cadastro' | 'triagem')[];
}

/**
 * Grava o CPF do paciente.
 *
 * `referencia` aceita o id do paciente ou o `lead:<id>` que o diretório de
 * pacientes usa para quem ainda não foi promovido a cadastro — é o mesmo
 * identificador que a listagem devolve, para a tela não precisar saber a
 * diferença.
 */
export async function definirCpfDoPaciente(
  organizationId: string,
  referencia: string,
  cpfInformado: unknown
): Promise<AtualizacaoCpfPaciente> {
  const cpf = String(cpfInformado ?? '').replace(/\D/g, '');
  if (!validCpf(cpf)) {
    throw new ApplicationError('INVALID_CPF', 'Informe um CPF válido, com 11 dígitos.', 422);
  }

  const referenciaLead = referencia.startsWith('lead:') ? referencia.slice(5) : undefined;
  const patientId = referenciaLead ? undefined : referencia;
  const gravadoEm: ('cadastro' | 'triagem')[] = [];

  const atualizacaoTriagem = await getCaptureRepository().mutate((state) => {
    const alvo = state.triagensPacientes.find((lead) =>
      referenciaLead ? lead.id === referenciaLead : lead.pacienteRef === patientId
    );
    if (!alvo) return { next: state, result: undefined };
    return {
      next: {
        ...state,
        triagensPacientes: state.triagensPacientes.map((lead) => (lead.id === alvo.id ? { ...lead, cpf } : lead)),
      },
      result: alvo.id,
    };
  });
  if (atualizacaoTriagem) gravadoEm.push('triagem');

  if (patientId) {
    const repositorio = documentCapable(getApplicationStore().identities);
    if (repositorio) {
      const encontrado = await repositorio.savePatientDocument(organizationId, patientId, cpf);
      if (encontrado) gravadoEm.push('cadastro');
    }
  }

  if (!gravadoEm.length) {
    throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado para gravar o CPF.', 404);
  }

  return { patientId, leadId: atualizacaoTriagem, cpf, gravadoEm };
}
