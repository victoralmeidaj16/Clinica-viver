import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { camposAlterados, mascararCpf, reaisDeCentavos, type ValorAuditavel } from '@/lib/auditoria';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { custeioEfetivoSql } from '@/server/persistence/mysql/custeioSql';
import type { AutorDaSessao } from './autorGestao';
import { registrarAlteracao } from './auditoriaAlteracoes';

/**
 * Antes e depois do cadastro administrativo do paciente (13.02). Lê só campos
 * administrativos — nunca prontuário (13.03). O CPF entra mascarado.
 */

export type EstadoPaciente = Record<string, ValorAuditavel> & { rotulo?: string };

const CATEGORIA: Record<string, string> = { acessivel: 'Acessível', particular: 'Particular', personalizado: 'Personalizado' };

export const ROTULOS_PACIENTE = {
  nome: 'Nome',
  nomeSocial: 'Nome social',
  cpf: 'CPF',
  email: 'E-mail',
  telefone: 'Telefone',
  categoriaValor: 'Categoria do valor da sessão',
  valorPersonalizado: 'Valor personalizado',
  convenio: 'Convênio',
  custeio: 'Pagador das sessões',
  status: 'Situação',
} as const;

export async function estadoDoPaciente(organizationId: string, pacienteRef: string): Promise<EstadoPaciente | null> {
  if (!isMysqlConfigured() || !pacienteRef) return null;
  try {
    const [rows] = await getMysqlPool().query<RowDataPacket[]>(
      `SELECT pa.nome, pa.nome_social, pa.documento, pa.email, pa.telefone, pa.status,
              pa.categoria_valor_sessao, pa.valor_sessao_personalizado_centavos, pa.convenio_ref,
              conv.nome AS convenio_nome, ${custeioEfetivoSql({ paciente: 'pa', convenio: 'conv' })} AS custeado
         FROM clinica_pacientes pa
         JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
         LEFT JOIN clinica_convenios conv ON conv.instituicao_id = pa.instituicao_id
          AND conv.organizacao_ref = o.ref_core AND conv.ref_core = pa.convenio_ref
        WHERE pa.instituicao_id = ? AND o.ref_core = ? AND pa.ref_core = ? LIMIT 1`,
      [instituicaoId(), organizationId, pacienteRef]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      rotulo: String(r.nome_social || r.nome || pacienteRef),
      nome: r.nome ?? null,
      nomeSocial: r.nome_social ?? null,
      cpf: mascararCpf(r.documento),
      email: r.email ?? null,
      telefone: r.telefone ? `final ${String(r.telefone).replace(/\D/g, '').slice(-4)}` : null,
      categoriaValor: CATEGORIA[String(r.categoria_valor_sessao)] ?? r.categoria_valor_sessao ?? null,
      valorPersonalizado: r.valor_sessao_personalizado_centavos === null || r.valor_sessao_personalizado_centavos === undefined
        ? null : reaisDeCentavos(Number(r.valor_sessao_personalizado_centavos)),
      convenio: r.convenio_nome ?? r.convenio_ref ?? null,
      custeio: r.convenio_ref ? (Boolean(r.custeado) ? 'Empresa (convênio)' : 'Paciente') : 'Paciente',
      status: r.status ?? null,
    };
  } catch {
    return null;
  }
}

/** Compara, grava a trilha e nunca lança. */
export async function auditarPaciente(input: {
  organizationId: string;
  pacienteRef: string;
  acao: string;
  antes: EstadoPaciente | null;
  depois: EstadoPaciente | null;
  autor: AutorDaSessao;
  motivo?: string;
  rotulos?: Readonly<Record<string, string>>;
}): Promise<void> {
  try {
    const campos = camposAlterados(input.antes ?? {}, input.depois ?? {}, input.rotulos ?? ROTULOS_PACIENTE);
    await registrarAlteracao({
      organizationId: input.organizationId, modulo: 'pacientes', entidadeTipo: 'paciente',
      entidadeRef: input.pacienteRef, entidadeRotulo: input.depois?.rotulo ?? input.antes?.rotulo,
      acao: input.acao, campos, motivo: input.motivo, autor: input.autor,
    });
  } catch (erro) {
    console.error('[auditoria] Falha ao auditar paciente:', erro instanceof Error ? erro.message : erro);
  }
}
