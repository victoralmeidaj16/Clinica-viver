import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { PoliticaConvenio } from '@/lib/politicaConvenio';
import { custeioDoAgendamentoSql } from './custeioSql';
import { instituicaoId, rowId } from './mappers';

type Banco = Pool | PoolConnection;
export async function previaContratual(db: Banco, org: string, convenio: string, politica: PoliticaConvenio,
  unitario: number, inicio: string, fim: string) {
  if (!Number.isSafeInteger(unitario) || unitario <= 0) throw new Error('Informe o preço contratual por sessão.');
  const [rows] = politica.base === 'agendadas' ? await db.query<RowDataPacket[]>(`SELECT a.ref_core
    FROM clinica_agendamentos a JOIN clinica_organizacoes o ON o.id=a.organizacao_id
    JOIN clinica_pacientes p ON p.id=a.paciente_id AND p.organizacao_id=o.id
    JOIN clinica_convenios c ON c.instituicao_id=a.instituicao_id AND c.organizacao_ref=o.ref_core
      AND c.ref_core=COALESCE(a.cota_ocorrencia_ref,a.custeio_convenio_ref,p.convenio_ref)
    WHERE a.instituicao_id=? AND o.ref_core=? AND c.ref_core=? AND a.pacote_id IS NULL AND a.custeio_aguarda_autorizacao=0
      AND ((a.status IN ('agendado','confirmado','realizado') AND ${custeioDoAgendamentoSql({ agendamento:'a',paciente:'p',convenio:'c' })}=1)
        OR a.cota_ocorrencia_ref=c.ref_core)
      AND NOT EXISTS(SELECT 1 FROM financeiro_faturas_convenio f WHERE f.instituicao_id=a.instituicao_id
        AND f.organizacao_ref=o.ref_core AND f.status<>'cancelada' AND JSON_CONTAINS(f.composicao_contratual,JSON_QUOTE(a.ref_core),'$.sessoes'))
      AND NOT EXISTS(SELECT 1 FROM financeiro_cobrancas fc WHERE fc.instituicao_id=a.instituicao_id AND fc.organizacao_ref=o.ref_core
        AND fc.sessao_ref IN (a.ref_core,a.sessao_clinica_ref) AND fc.fatura_convenio_ref IS NOT NULL AND fc.status<>'cancelled')
      AND a.inicio >= DATE_ADD(?, INTERVAL 3 HOUR) AND a.inicio < DATE_ADD(DATE_ADD(?, INTERVAL 1 DAY),INTERVAL 3 HOUR)
      ORDER BY a.ref_core`,[instituicaoId(),org,convenio,inicio,fim]) : [[]];
  const sessoes = rows.map(r => String(r.ref_core));
  const quantidade = politica.base === 'fixa' ? politica.quantidadeFixa! : sessoes.length;
  return { base:politica.base, quantidade, unitario, total:quantidade * unitario, sessoes };
}

export interface ConferenciaContrato { quantidade: number; unitario: number; base: string; sessoes: string[]; ajuste: number; motivo: string }

export async function gravarFaturaContratual(conn: PoolConnection, org: string, convenio: string, politica: PoliticaConvenio,
  unitario: number, input: { competencia:string; periodoInicio:string; periodoFim:string; conferencia?: ConferenciaContrato }) {
  const previa = await previaContratual(conn,org,convenio,politica,unitario,input.periodoInicio,input.periodoFim);
  const conf = input.conferencia;
  if (!conf || conf.quantidade !== previa.quantidade || conf.unitario !== unitario || conf.base !== politica.base
    || JSON.stringify(conf.sessoes) !== JSON.stringify(previa.sessoes))
    throw new Error('A composição mudou. Atualize a prévia antes de fechar a fatura.');
  if (!Number.isSafeInteger(conf.ajuste) || typeof conf.motivo !== 'string' || conf.motivo.length > 500
    || (conf.ajuste !== 0 && !conf.motivo.trim()) || !previa.quantidade || previa.total + conf.ajuste <= 0)
    throw new Error('Confira a quantidade e justifique o ajuste da fatura.');
  const [anteriores] = await conn.query<RowDataPacket[]>(`SELECT id FROM financeiro_faturas_convenio
    WHERE instituicao_id=? AND organizacao_ref=? AND convenio_ref=? AND status <> 'cancelada'
      AND (competencia=? OR (periodo_inicio<=? AND periodo_fim>=?)) FOR UPDATE`,
  [instituicaoId(),org,convenio,input.competencia,input.periodoFim,input.periodoInicio]);
  if (anteriores.length) throw new Error('Já existe uma fatura para esta competência ou período.');
  const ref = 'fatura-convenio-' + randomUUID();
  await conn.execute(`INSERT INTO financeiro_faturas_convenio (id,instituicao_id,organizacao_ref,ref_core,convenio_ref,competencia,
    periodo_inicio,periodo_fim,total_sessoes,valor_centavos,composicao_contratual) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  [rowId('fatura_convenio',ref),instituicaoId(),org,ref,convenio,input.competencia,input.periodoInicio,input.periodoFim,
    previa.quantidade,previa.total+conf.ajuste,JSON.stringify({...previa,ajuste:conf.ajuste,motivo:conf.motivo})]);
  return ref;
}
