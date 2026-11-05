export interface AcessibilidadePsicologo {
  necessita: boolean;
  descricao?: string;
}

export function validarAcessibilidade(value: unknown):
  | { ok: true; data: AcessibilidadePsicologo | undefined }
  | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, data: undefined };
  if (typeof value !== 'object' || Array.isArray(value) || !('necessita' in value) || typeof value.necessita !== 'boolean') {
    return { ok: false, error: 'Informe se você tem necessidade de acessibilidade.' };
  }
  const descricao = 'descricao' in value ? value.descricao : undefined;
  if (descricao !== undefined && (typeof descricao !== 'string' || descricao.length > 1000)) {
    return { ok: false, error: 'Descreva a necessidade de acessibilidade em até 1.000 caracteres.' };
  }
  return { ok: true, data: { necessita: value.necessita,
    ...(value.necessita && typeof descricao === 'string' && descricao.trim() ? { descricao: descricao.trim() } : {}),
  } };
}
