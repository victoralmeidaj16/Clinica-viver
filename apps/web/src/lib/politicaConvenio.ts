export interface PoliticaConvenio {
  consumirFalta: boolean;
  consumirCancelamento: boolean;
  excedente: 'funcionario' | 'bloquear' | 'autorizar';
  base: 'realizadas' | 'agendadas' | 'fixa';
  quantidadeFixa?: number;
}

export const politicaPadrao: PoliticaConvenio = {
  consumirFalta: false, consumirCancelamento: false, excedente: 'funcionario', base: 'realizadas',
};

export function validarPolitica(valor: unknown): PoliticaConvenio {
  const p = valor as Partial<PoliticaConvenio> | null;
  if (!p || typeof p.consumirFalta !== 'boolean' || typeof p.consumirCancelamento !== 'boolean'
    || !['funcionario','bloquear','autorizar'].includes(String(p.excedente))
    || !['realizadas','agendadas','fixa'].includes(String(p.base))
    || (p.base === 'fixa' && (!Number.isSafeInteger(p.quantidadeFixa) || p.quantidadeFixa! < 1 || p.quantidadeFixa! > 65535))) {
    throw new Error('Política de convênio inválida. Confira a base, a quantidade e as regras da cota.');
  }
  return { consumirFalta:p.consumirFalta, consumirCancelamento:p.consumirCancelamento,
    excedente:p.excedente!, base:p.base!, ...(p.base === 'fixa' && { quantidadeFixa:p.quantidadeFixa }) };
}
