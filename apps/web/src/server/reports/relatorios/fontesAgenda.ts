import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { contemTermo, type FiltrosAplicados, type LinhaRelatorio } from '@/lib/relatorios/areas';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { rotuloSituacao } from './fontesCaptura';

/**
 * Agendamentos, atendimentos, horas de estágio e pacientes: vêm do MySQL, os
 * mesmos registros que a agenda e o cadastro usam (13.04). Sem banco, as
 * áreas ficam vazias em vez de inventar números.
 */

/** Período em datas de Brasília virando instantes para o SQL. */
export function intervaloSql(filtros: FiltrosAplicados): { desde?: Date; ate?: Date } {
  const desde = filtros.desde ? new Date(clinicDateTimeToIso(filtros.desde, '00:00')) : undefined;
  const ate = filtros.ate ? new Date(Date.parse(clinicDateTimeToIso(filtros.ate, '23:59')) + 59_999) : undefined;
  return { desde, ate };
}

const SITUACAO_SESSAO: Record<string, string> = {
  agendado: 'Agendada', confirmado: 'Confirmada', realizado: 'Realizada', cancelado: 'Cancelada', faltou: 'Falta',
};

interface FiltroSessoes { apenasRealizadas?: boolean; atendimentos?: boolean }

async function sessoes(organizationId: string, filtros: FiltrosAplicados, opcoes: FiltroSessoes): Promise<RowDataPacket[]> {
  if (!isMysqlConfigured()) return [];
  const { desde, ate } = intervaloSql(filtros);
  const valores: unknown[] = [instituicaoId(), organizationId];
  let sql = `SELECT a.id, a.inicio, a.status, a.modalidade, a.duracao_min, a.valor_centavos, a.custeado_pela_empresa,
                    COALESCE(pa.nome_social, pa.nome) AS paciente, p.nome AS profissional, p.ref_core AS profissional_ref,
                    conv.nome AS convenio
               FROM clinica_agendamentos a
               JOIN clinica_profissionais p ON p.id = a.profissional_id
               JOIN clinica_organizacoes o ON o.id = p.organizacao_id
               JOIN clinica_pacientes pa ON pa.id = a.paciente_id
               LEFT JOIN clinica_convenios conv ON conv.instituicao_id = a.instituicao_id AND conv.organizacao_ref = o.ref_core
                AND conv.ref_core = COALESCE(a.custeio_convenio_ref, pa.convenio_ref)
              WHERE a.instituicao_id = ? AND o.ref_core = ?`;
  if (opcoes.apenasRealizadas) sql += ` AND a.status = 'realizado'`;
  else if (opcoes.atendimentos) sql += ` AND a.status IN ('realizado', 'faltou')`;
  if (desde) { sql += ' AND a.inicio >= ?'; valores.push(desde); }
  if (ate) { sql += ' AND a.inicio <= ?'; valores.push(ate); }
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`${sql} ORDER BY a.inicio DESC LIMIT 5000`, valores);
  return rows.filter((r) => contemTermo(r.profissional, filtros.profissional)
    && contemTermo(r.paciente, filtros.paciente) && contemTermo(r.convenio, filtros.empresa));
}

export async function relatorioSessoes(organizationId: string, filtros: FiltrosAplicados, atendimentos: boolean): Promise<LinhaRelatorio[]> {
  return (await sessoes(organizationId, filtros, { atendimentos })).map((r) => ({
    inicio: fromSqlTimestamp(r.inicio) ?? null,
    paciente: String(r.paciente),
    profissional: String(r.profissional),
    situacao: SITUACAO_SESSAO[String(r.status)] ?? String(r.status),
    modalidade: r.modalidade === 'online' ? 'Online' : r.modalidade === 'telefone' ? 'Telefone' : 'Presencial',
    duracao: Number(r.duracao_min ?? 0),
    pagador: Boolean(r.custeado_pela_empresa) ? `Empresa${r.convenio ? ` (${r.convenio})` : ''}` : 'Paciente',
    valor: r.valor_centavos === null || r.valor_centavos === undefined ? null : Number(r.valor_centavos) / 100,
  }));
}

function horasPorExtenso(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export async function relatorioHorasEstagio(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const linhas = await sessoes(organizationId, { ...filtros, paciente: undefined, empresa: undefined }, { apenasRealizadas: true });
  const { cadastrosPsicologos } = await getCaptureRepository().read();
  const cadastroPorRef = new Map(cadastrosPsicologos.filter((c) => c.profissionalRef).map((c) => [c.profissionalRef!, c]));
  const porProfissional = new Map<string, { nome: string; ref: string; sessoes: number; minutos: number }>();
  for (const r of linhas) {
    const ref = String(r.profissional_ref ?? r.profissional);
    const atual = porProfissional.get(ref) ?? { nome: String(r.profissional), ref, sessoes: 0, minutos: 0 };
    atual.sessoes += 1;
    atual.minutos += Number(r.duracao_min ?? 0);
    porProfissional.set(ref, atual);
  }
  return [...porProfissional.values()]
    .map((item) => {
      const cadastro = cadastroPorRef.get(item.ref);
      return {
        profissional: item.nome,
        curso: cadastro?.posGraduacaoViverMais ?? null,
        turma: cadastro?.turmaViverMais ?? null,
        sessoes: item.sessoes,
        minutos: item.minutos,
        horas: horasPorExtenso(item.minutos),
      };
    })
    .filter((item) => contemTermo(item.curso, filtros.curso) && contemTermo(item.turma, filtros.turma))
    .sort((a, b) => a.profissional.localeCompare(b.profissional, 'pt-BR'));
}

const CATEGORIA: Record<string, string> = { acessivel: 'Acessível', particular: 'Particular', personalizado: 'Personalizado' };

export async function relatorioPacientes(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  if (!isMysqlConfigured()) return [];
  const { desde, ate } = intervaloSql(filtros);
  const valores: unknown[] = [instituicaoId(), organizationId];
  let sql = `SELECT COALESCE(pa.nome_social, pa.nome) AS paciente, pa.status, pa.categoria_valor_sessao, pa.criado_em,
                    pa.custeado_pela_empresa, p.nome AS profissional, conv.nome AS convenio
               FROM clinica_pacientes pa
               JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
               LEFT JOIN clinica_profissionais p ON p.id = pa.profissional_id
               LEFT JOIN clinica_convenios conv ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
                AND conv.ref_core = pa.convenio_ref
              WHERE pa.instituicao_id = ? AND o.ref_core = ?`;
  if (desde) { sql += ' AND pa.criado_em >= ?'; valores.push(desde); }
  if (ate) { sql += ' AND pa.criado_em <= ?'; valores.push(ate); }
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`${sql} ORDER BY paciente LIMIT 5000`, valores);
  return rows
    .filter((r) => contemTermo(r.profissional, filtros.profissional) && contemTermo(r.paciente, filtros.paciente)
      && contemTermo(r.convenio, filtros.empresa))
    .map((r) => ({
      paciente: String(r.paciente),
      situacao: rotuloSituacao(String(r.status ?? '')),
      profissional: r.profissional ?? null,
      convenio: r.convenio ?? null,
      pagador: r.convenio && Boolean(r.custeado_pela_empresa) ? 'Empresa' : 'Paciente',
      categoria: CATEGORIA[String(r.categoria_valor_sessao)] ?? null,
      cadastro: fromSqlTimestamp(r.criado_em) ?? null,
    }));
}
