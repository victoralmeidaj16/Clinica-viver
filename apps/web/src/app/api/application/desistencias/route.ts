import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { getApplicationStore } from '@/server/application/store';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type AuditoriaDesistenciaRecord,
  type TriagemPacienteRecord,
} from '@/server/application/persistence';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import {
  alocarLeadParaPsicologo,
  listarPsicologosCompativeis,
  recalcularPacientesAtivos,
} from '@/server/application/viverMaisRodizio';
import { motivoValido } from '@/lib/desistencias';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Auditoria de desistências conduzida pela gestão.
 *
 * Não há `GET`: a auditoria deixou de ser uma tela própria e passou a viver no
 * cadastro do paciente, então a leitura sai junto da fila, em
 * `api/application/gestao/pacientes`. O `GET` que existia aqui respondia sem
 * trava de sessão nenhuma — nome de paciente e de psicólogo eram legíveis por
 * qualquer requisição.
 *
 * A identidade também deixou de vir do navegador. Antes a rota gravava
 * `body.pacienteNome` e `body.psicologoNome` como chegassem, porque o
 * formulário antigo só tinha campos de texto; agora ela recebe o id da linha e
 * resolve os nomes contra o cadastro. É o mesmo princípio de
 * `registerPatientDropout`, que faz isso do lado do psicólogo.
 */

class RequisicaoInvalida extends Error {
  readonly status: number;

  constructor(mensagem: string, status = 400) {
    super(mensagem);
    this.name = 'RequisicaoInvalida';
    this.status = status;
  }
}

interface Identidade {
  pacienteId?: string;
  leadId?: string;
  pacienteNome: string;
  psicologoId?: string;
  psicologoNome: string;
  lead?: TriagemPacienteRecord;
}

/**
 * Quem é a pessoa, segundo o cadastro — nunca segundo o corpo da requisição.
 *
 * A fila tem dois tipos de linha e a auditoria precisa dos dois: quem já virou
 * paciente é resolvido pelo store de identidades; quem ainda é lead da triagem
 * só existe na captação, e é lá que estão o nome e o profissional alocado.
 */
async function resolverIdentidade(
  organizationId: string,
  patientId: string | undefined,
  leadId: string | undefined
): Promise<Identidade> {
  const store = getApplicationStore();
  const captura = await getCaptureRepository().read();

  if (patientId) {
    const paciente = await store.identities.getPatient(organizationId, patientId);
    if (!paciente) throw new RequisicaoInvalida('Paciente não encontrado.', 404);

    const lead = captura.triagensPacientes.find((item) => item.pacienteRef === paciente.id);
    const profissionalId = paciente.primaryProfessionalId;
    const profissional = profissionalId
      ? await store.identities.getProfessional(organizationId, profissionalId)
      : null;

    return {
      pacienteId: paciente.id,
      leadId: lead?.id,
      pacienteNome: paciente.displayName,
      psicologoId: profissionalId,
      psicologoNome: profissional?.displayName ?? lead?.psicologoNome ?? 'Sem profissional alocado',
      lead,
    };
  }

  const lead = captura.triagensPacientes.find((item) => item.id === leadId);
  if (!lead) throw new RequisicaoInvalida('Solicitação de triagem não encontrada.', 404);

  return {
    leadId: lead.id,
    pacienteNome: lead.nomePaciente,
    psicologoId: lead.psicologoAlocadoId,
    psicologoNome: lead.psicologoNome ?? 'Sem profissional alocado',
    lead,
  };
}

/**
 * POST /api/application/desistencias
 *
 * Registra a saída de um paciente ou faz sua nova alocação validada.
 */
export async function POST(request: Request) {
  try {
    await exigirGestao();
    const sessao = await readSession();
    if (!sessao) throw new NaoAutorizadoError(401, 'Faça login para continuar.');

    const body = (await request.json()) as Record<string, unknown>;
    const snapshot = readSnapshot() ?? emptySnapshot();
    const registros = [...(snapshot.auditoriaDesistencias ?? [])];
    const agora = new Date().toISOString();

    if (body.action === 'ALOCAR_PACIENTE') {
      const id = String(body.id ?? '').trim();
      const indice = registros.findIndex((item) => item.id === id);
      if (indice === -1) throw new RequisicaoInvalida('Registro de desistência não encontrado.', 404);
      const registro = registros[indice];
      if (registro.organizationId && registro.organizationId !== sessao.organizationId) {
        throw new RequisicaoInvalida('Registro de desistência não encontrado.', 404);
      }
      if (registro.reengajado) throw new RequisicaoInvalida('Este paciente já foi alocado novamente.', 409);
      if (!registro.pacienteId || !registro.leadId) {
        throw new RequisicaoInvalida('A nova alocação exige um paciente confirmado.', 409);
      }

      const psicologoId = String(body.psicologoId ?? '').trim();
      if (!psicologoId) throw new RequisicaoInvalida('Selecione o psicólogo para a nova alocação.');

      const captureRepository = getCaptureRepository();
      const captura = await captureRepository.read();
      const lead = captura.triagensPacientes.find((item) => item.id === registro.leadId);
      if (!lead) throw new RequisicaoInvalida('Triagem vinculada ao paciente não encontrada.', 404);
      if (!registro.permitirTrocaPsicologo && lead.psicologoAlocadoId && lead.psicologoAlocadoId !== psicologoId) {
        throw new RequisicaoInvalida('O paciente não autorizou a troca para outro psicólogo.', 409);
      }

      const compativel = listarPsicologosCompativeis(captureStateAsSnapshot(captura), lead)
        .find((item) => item.id === psicologoId && item.profissionalRef);
      if (!compativel?.profissionalRef) {
        throw new RequisicaoInvalida('O psicólogo não está mais disponível ou não é compatível com esta solicitação.', 409);
      }

      const store = getApplicationStore();
      const perfil = await store.identities.getProfessional(sessao.organizationId, compativel.profissionalRef);
      if (!perfil || perfil.status !== 'active') {
        throw new RequisicaoInvalida('O perfil clínico do psicólogo está inativo.', 409);
      }
      const reatribuido = await store.identities.reassignPatient({
        organizationId: sessao.organizationId,
        patientId: registro.pacienteId,
        professionalId: compativel.profissionalRef,
        actorUserId: sessao.userId,
        reason: `Nova alocação após desistência (${registro.motivo}).`,
        changedAt: agora,
      });
      if (!reatribuido) throw new RequisicaoInvalida('Paciente não encontrado.', 404);
      await store.identities.savePatient({ ...reatribuido, status: 'active', updatedAt: agora });

      await captureRepository.mutate((state) => {
        const atual = state.triagensPacientes.find((item) => item.id === registro.leadId);
        if (!atual) throw new RequisicaoInvalida('Triagem vinculada ao paciente não encontrada.', 404);
        const resultado = alocarLeadParaPsicologo(captureStateAsSnapshot(state), atual, psicologoId, agora);
        if (!resultado.psicologo) {
          throw new RequisicaoInvalida('O psicólogo deixou de estar disponível para esta alocação.', 409);
        }
        return {
          next: {
            triagensPacientes: resultado.snapshot.triagensPacientes ?? [],
            cadastrosPsicologos: resultado.snapshot.cadastrosPsicologos ?? [],
          },
          result: null,
        };
      });

      registros[indice] = {
        ...registro,
        reengajado: true,
        observacoesReengajamento: `Paciente alocado para ${compativel.nomeSocial || compativel.nomeCompleto}.`,
      };

      await writeSnapshot({ ...snapshot, auditoriaDesistencias: registros, savedAt: agora });
      return NextResponse.json({ success: true, data: registros[indice] });
    }

    const patientId = String(body.patientId ?? '').trim() || undefined;
    const leadId = String(body.leadId ?? '').trim() || undefined;
    if (!patientId && !leadId) {
      throw new RequisicaoInvalida('Selecione o paciente cuja desistência será registrada.');
    }

    const motivo = String(body.motivo ?? '').trim();
    if (!motivoValido(motivo)) throw new RequisicaoInvalida('Informe o motivo da desistência.');

    const identidade = await resolverIdentidade(sessao.organizationId, patientId, leadId);

    const jaAberta = registros.some(
      (item) =>
        !item.reengajado &&
        ((identidade.pacienteId && item.pacienteId === identidade.pacienteId) ||
          (identidade.leadId && item.leadId === identidade.leadId))
    );
    if (jaAberta) {
      throw new RequisicaoInvalida('Este paciente já possui uma desistência em acompanhamento.', 409);
    }

    const desistencia: AuditoriaDesistenciaRecord = {
      id: `desistencia-${Date.now()}`,
      organizationId: sessao.organizationId,
      pacienteId: identidade.pacienteId,
      leadId: identidade.leadId,
      pacienteNome: identidade.pacienteNome,
      psicologoId: identidade.psicologoId,
      psicologoNome: identidade.psicologoNome,
      motivo,
      descricaoDetalhada:
        String(body.descricaoDetalhada ?? '').trim().slice(0, 2000) || 'Saída do acompanhamento registrada pela gestão.',
      acaoSugestao:
        String(body.acaoSugestao ?? '').trim().slice(0, 500) || 'Contato de reengajamento prioritário',
      dataDesistencia: agora,
      reengajado: false,
      permitirTrocaPsicologo: Boolean(body.permitirTrocaPsicologo),
    };

    // O prontuário é encerrado antes da auditoria porque é ele que faz o
    // paciente deixar de contar como acompanhamento ativo. Gravar a auditoria
    // primeiro deixaria, numa falha no meio, um registro de saída para alguém
    // que a plataforma continua exibindo como ativo.
    if (identidade.pacienteId) {
      const store = getApplicationStore();
      const paciente = await store.identities.getPatient(sessao.organizationId, identidade.pacienteId);
      if (paciente) await store.identities.savePatient({ ...paciente, status: 'discharged', updatedAt: agora });
    }

    await writeSnapshot({
      ...snapshot,
      auditoriaDesistencias: [desistencia, ...registros],
      savedAt: agora,
    });

    // Marcar o lead libera a vaga do profissional no mesmo banco que o rodízio
    // consulta — sem isso a capacidade seguiria ocupada por quem saiu.
    if (identidade.leadId) {
      const alvo = identidade.leadId;
      await getCaptureRepository().mutate((state) => {
        const next = recalcularPacientesAtivos({
          ...captureStateAsSnapshot(state),
          triagensPacientes: state.triagensPacientes.map((lead) =>
            lead.id === alvo ? { ...lead, status: 'DESISTENTE' as const } : lead
          ),
        });
        return {
          next: {
            triagensPacientes: next.triagensPacientes ?? [],
            cadastrosPsicologos: next.cadastrosPsicologos ?? [],
          },
          result: null,
        };
      });
    }

    return NextResponse.json({ success: true, data: desistencia }, { status: 201 });
  } catch (error) {
    if (error instanceof NaoAutorizadoError || error instanceof RequisicaoInvalida) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao salvar auditoria de desistência:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar desistência' }, { status: 500 });
  }
}
