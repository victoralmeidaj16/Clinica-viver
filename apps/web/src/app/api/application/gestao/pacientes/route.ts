import { NextResponse } from 'next/server';
import type { PatientProfile } from '@thats-life/core';
import { readSession } from '@/server/auth';
import { getApplicationStore } from '@/server/application/store';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { TriagemPacienteRecord } from '@/server/application/persistence';
import type { PatientContact, PatientContactCapable } from '@/server/persistence/mysql/identityRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StatusGestao = 'EM_TRIAGEM' | 'ATIVO' | 'ALTA' | 'DESISTENTE';

function contactSource(value: unknown): PatientContactCapable | null {
  const candidate = value as Partial<PatientContactCapable>;
  return typeof candidate.listPatientContacts === 'function' ? (candidate as PatientContactCapable) : null;
}

function statusGestao(lead: TriagemPacienteRecord | undefined, patient: PatientProfile | undefined): StatusGestao {
  if (lead?.status === 'DESISTENTE') return 'DESISTENTE';
  if (patient?.status === 'discharged' || lead?.status === 'FINALIZADO') return 'ALTA';
  if (patient && lead?.status === 'CONTATO_CONFIRMADO') return 'ATIVO';
  if (patient?.status === 'active') return 'ATIVO';
  return 'EM_TRIAGEM';
}

function horasDesde(iso: string | undefined): number {
  const timestamp = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000)) : 0;
}

export async function GET() {
  try {
    await exigirGestao();
    const session = await readSession();
    if (!session) throw new NaoAutorizadoError(401, 'Faça login para continuar.');

    const store = getApplicationStore();
    const capture = await getCaptureRepository().read();
    const contacts = contactSource(store.identities);
    const organizationId = session.organizationId;
    const [patients, appointments, ledger, contactMap] = await Promise.all([
      store.identities.listPatients(organizationId),
      store.appointments.list({ organizationId }),
      store.financial.getLedger({ organizationId }),
      contacts
        ? contacts.listPatientContacts(organizationId)
        : Promise.resolve<Record<string, PatientContact>>({}),
    ]);

    const patientsById = new Map(patients.map((patient) => [patient.id, patient]));
    const leadsByPatient = new Map(
      capture.triagensPacientes
        .filter((lead) => lead.pacienteRef)
        .map((lead) => [lead.pacienteRef!, lead])
    );
    const patientIds = new Set<string>([
      ...patients.map((patient) => patient.id),
      ...capture.triagensPacientes.map((lead) => lead.pacienteRef ?? `lead:${lead.id}`),
    ]);

    const professionalIds = new Set<string>();
    for (const patient of patients) {
      if (patient.primaryProfessionalId) professionalIds.add(patient.primaryProfessionalId);
    }
    for (const psychologist of capture.cadastrosPsicologos) {
      if (psychologist.profissionalRef) professionalIds.add(psychologist.profissionalRef);
    }
    const professionalPairs = await Promise.all(
      [...professionalIds].map(async (id) => [id, await store.identities.getProfessional(organizationId, id)] as const)
    );
    const professionalNames = new Map(
      professionalPairs
        .filter((pair): pair is readonly [string, NonNullable<(typeof pair)[1]>] => pair[1] !== null)
        .map(([id, profile]) => [id, profile.displayName])
    );

    const leadsBySyntheticId = new Map(
      capture.triagensPacientes.map((lead) => [lead.pacienteRef ?? `lead:${lead.id}`, lead])
    );

    const data = [...patientIds].map((id) => {
      const patient = patientsById.get(id);
      const lead = patient ? leadsByPatient.get(patient.id) : leadsBySyntheticId.get(id);
      const patientId = patient?.id;
      const ownAppointments = patientId
        ? appointments.filter((appointment) => appointment.patientId === patientId)
        : [];
      const ownCharges = patientId
        ? ledger.charges.filter((charge) => charge.patientId === patientId)
        : [];
      const waitingBase = lead?.alocadoEm ?? lead?.criadoEm;
      const waitingHours = lead?.status === 'AGUARDANDO_CONTATO' || lead?.status === 'PENDENTE_ATRIBUICAO'
        ? horasDesde(waitingBase)
        : 0;
      const professionalId = patient?.primaryProfessionalId
        ?? capture.cadastrosPsicologos.find((psi) => psi.id === lead?.psicologoAlocadoId)?.profissionalRef;

      return {
        id: patientId ?? id,
        patientId,
        leadId: lead?.id,
        protocolo: lead?.protocolo ?? patient?.externalReference,
        nome: lead?.nomePaciente ?? patient?.displayName ?? 'Paciente',
        whatsapp: lead?.telefone ?? (patientId ? contactMap[patientId]?.phone : undefined),
        email: lead?.email ?? (patientId ? contactMap[patientId]?.email : undefined),
        cpf: lead?.cpf,
        idade: lead?.idade,
        cep: lead?.cep,
        numeroResidencia: lead?.numeroResidencia,
        servicoKey: lead?.servicoKey,
        servicoNome: lead?.servico,
        modalidade: lead?.modalidade,
        paraQuemE: lead?.paraQuemE,
        turno: lead?.turno,
        necessidadesPaciente: lead?.necessidadesPaciente,
        necessidadesOutro: lead?.necessidadesOutro,
        opcaoAvaliacaoPsicologica: lead?.opcaoAvaliacaoPsicologica,
        psicologoId: professionalId,
        psicologoNome: professionalId
          ? professionalNames.get(professionalId) ?? lead?.psicologoNome
          : lead?.psicologoNome,
        status: statusGestao(lead, patient),
        criadoEm: lead?.criadoEm ?? patient?.createdAt,
        confirmadoEm: lead?.confirmadoEm,
        horasEspera: waitingHours,
        slaStatus: !lead?.psicologoAlocadoId
          ? 'SEM_ALOCACAO'
          : waitingHours >= 24
            ? 'ESTOURADO'
            : waitingHours > 0
              ? 'NO_PRAZO'
              : 'CONCLUIDO',
        agenda: {
          total: ownAppointments.length,
          realizadas: ownAppointments.filter((item) => item.status === 'completed').length,
          proximaEm: ownAppointments
            .filter((item) => ['scheduled', 'confirmed'].includes(item.status) && Date.parse(item.startsAt) >= Date.now())
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]?.startsAt,
        },
        financeiro: {
          cobrancas: ownCharges.length,
          totalCentavos: ownCharges.reduce((sum, charge) => sum + charge.amountCents, 0),
          emAbertoCentavos: ownCharges
            .filter((charge) => ['pending', 'partially_paid', 'overdue'].includes(charge.status))
            .reduce((sum, charge) => sum + charge.amountCents, 0),
        },
      };
    });

    const psicologos = capture.cadastrosPsicologos
      .filter((psi) => psi.status === 'APROVADO' && psi.profissionalRef)
      .map((psi) => ({ id: psi.profissionalRef!, nome: psi.nomeSocial || psi.nomeCompleto }));

    return NextResponse.json(
      { success: true, data, psicologos },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao montar diretório unificado de pacientes:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar pacientes.' }, { status: 500 });
  }
}
