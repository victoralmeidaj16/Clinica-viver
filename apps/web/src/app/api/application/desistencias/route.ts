import { NextResponse } from 'next/server';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type AuditoriaDesistenciaRecord,
} from '@/server/application/persistence';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/application/desistencias
 * Retorna as desistências registradas (tanto das triagens canceladas quanto dos registros diretos de auditoria).
 */
export async function GET() {
  try {
    const snapshot = readSnapshot() ?? emptySnapshot();

    // 1. Desistências registradas na coleção dedicada
    const directes = snapshot.auditoriaDesistencias ?? [];

    // 2. Desistências registradas na fila de triagem (status DESISTENTE)
    const triagensDesistentes = (snapshot.triagensPacientes ?? [])
      .filter((t) => t.status === 'DESISTENTE')
      .map((t) => ({
        id: `desistencia-${t.id}`,
        pacienteId: t.id,
        pacienteNome: t.nomePaciente,
        psicologoId: t.psicologoAlocadoId,
        psicologoNome: t.psicologoNome || 'Profissional Alocado',
        motivo: 'FINANCEIRO' as const,
        descricaoDetalhada: `Solicitação cancelada no status ${t.status}. Origem: ${t.origem}`,
        acaoSugestao: 'Entrar em contato via WhatsApp para ofertar modalidade social/acessível',
        dataDesistencia: t.criadoEm,
        reengajado: false,
      }));

    // Combina removendo duplicados por id
    const idsExistentes = new Set(directes.map((d) => d.id));
    const combinadas = [...directes];

    triagensDesistentes.forEach((td) => {
      if (!idsExistentes.has(td.id)) {
        combinadas.push(td);
      }
    });

    return NextResponse.json({
      success: true,
      data: combinadas,
    });
  } catch (error) {
    console.error('Erro ao listar desistências:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar auditoria de desistências' }, { status: 500 });
  }
}

/**
 * POST /api/application/desistencias
 * Registra uma nova desistência ou atualiza o status de reengajamento de uma existente.
 */
export async function POST(request: Request) {
  try {
    await exigirGestao();
    const body = await request.json();

    const snapshot = readSnapshot() ?? emptySnapshot();
    const desistenciasAtuais = [...(snapshot.auditoriaDesistencias ?? [])];

    if (body.action === 'MARCAR_REENGAJADO' && body.id) {
      const index = desistenciasAtuais.findIndex((d) => d.id === body.id);
      if (index !== -1) {
        desistenciasAtuais[index] = {
          ...desistenciasAtuais[index],
          reengajado: true,
          observacoesReengajamento: body.observacoes || 'Reengajamento confirmado via atendimento.',
        };
      } else {
        // Se a desistência veio da triagem e ainda não estava na coleção explícita, adiciona como reengajado
        desistenciasAtuais.push({
          id: body.id,
          pacienteNome: body.pacienteNome || 'Paciente',
          psicologoNome: body.psicologoNome || 'Psicólogo',
          motivo: body.motivo || 'FINANCEIRO',
          descricaoDetalhada: body.descricao || 'Desistência reengajada pela gestão',
          acaoSugestao: 'Paciente aceitou reagendamento',
          dataDesistencia: new Date().toISOString(),
          reengajado: true,
          observacoesReengajamento: body.observacoes || 'Reengajamento confirmado.',
        });
      }
    } else {
      // Nova inclusão de desistência
      const novaDesistencia: AuditoriaDesistenciaRecord = {
        id: body.id || `desistencia-${Date.now()}`,
        pacienteId: body.pacienteId,
        pacienteNome: body.pacienteNome,
        psicologoId: body.psicologoId,
        psicologoNome: body.psicologoNome,
        motivo: body.motivo || 'FINANCEIRO',
        descricaoDetalhada: body.descricaoDetalhada || 'Saída do acompanhamento',
        acaoSugestao: body.acaoSugestao || 'Contato de reengajamento prioritário',
        dataDesistencia: new Date().toISOString(),
        reengajado: false,
        permitirTrocaPsicologo: Boolean(body.permitirTrocaPsicologo),
      };
      desistenciasAtuais.unshift(novaDesistencia);
    }

    await writeSnapshot({
      ...snapshot,
      auditoriaDesistencias: desistenciasAtuais,
      savedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: desistenciasAtuais });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao salvar auditoria de desistência:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar desistência' }, { status: 500 });
  }
}
