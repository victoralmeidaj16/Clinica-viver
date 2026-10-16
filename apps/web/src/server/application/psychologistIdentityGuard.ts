import 'server-only';

import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { CadastroPsicologoRecord } from './persistence';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { CadastroDuplicadoError, emailDeCadastro } from './psychologistUniqueness';

export async function assertEmailsDeCadastroDisponiveis(
  connection: Pool | PoolConnection,
  antes: readonly CadastroPsicologoRecord[],
  depois: readonly CadastroPsicologoRecord[]
): Promise<void> {
  const porId = new Map(antes.map((item) => [item.id, item]));
  const alterados = depois.filter((item) => emailDeCadastro(item.email)
    && (!porId.has(item.id) || emailDeCadastro(porId.get(item.id)?.email) !== emailDeCadastro(item.email)));
  if (!alterados.length) return;
  const [users] = await connection.query<Array<RowDataPacket & { ref_core: string; email_normalizado: string }>>(
    'SELECT ref_core, email_normalizado FROM clinica_usuarios WHERE instituicao_id = ? AND email_normalizado IN (?)',
    [instituicaoId(), alterados.map((item) => emailDeCadastro(item.email))]
  );
  for (const item of alterados) {
    if (users.some((user) => emailDeCadastro(user.email_normalizado) === emailDeCadastro(item.email)
      && user.ref_core !== porId.get(item.id)?.usuarioRef)) throw new CadastroDuplicadoError();
  }
}

/** Atualiza perfil e login na mesma transação que altera o cadastro. */
export async function syncIdentidadeDoCadastro(
  connection: PoolConnection,
  antes: readonly CadastroPsicologoRecord[],
  depois: readonly CadastroPsicologoRecord[]
): Promise<void> {
  const porId = new Map(antes.map((item) => [item.id, item]));
  for (const item of depois) {
    const anterior = porId.get(item.id);
    if (!anterior?.usuarioRef) continue;
    const campos = ['nomeCompleto', 'nomeSocial', 'email', 'whatsapp', 'crp'] as const;
    if (!campos.some((campo) => anterior[campo] !== item[campo])) continue;
    if (depois.some((outro) => outro.id !== item.id && outro.usuarioRef === anterior.usuarioRef)) {
      throw new CadastroDuplicadoError();
    }
    const nome = item.nomeSocial?.trim() || item.nomeCompleto;
    await connection.execute(
      `UPDATE clinica_usuarios SET nome_exibicao = ?, email_normalizado = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND ref_core = ?`,
      [nome, emailDeCadastro(item.email) || null, instituicaoId(), anterior.usuarioRef]
    );
    if (anterior.profissionalRef) await connection.execute(
      `UPDATE clinica_profissionais SET nome = ?, crp = ?, email = ?, telefone = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND ref_core = ? AND usuario_ref = ?`,
      [nome, item.crp, emailDeCadastro(item.email) || null, item.whatsapp, instituicaoId(), anterior.profissionalRef, anterior.usuarioRef]
    );
  }
}
