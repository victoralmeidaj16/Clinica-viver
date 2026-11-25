import type { CadastroPsicologoRecord } from './persistence';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';

export class CadastroDuplicadoError extends Error {
  readonly status = 409;
  readonly code = 'CADASTRO_DUPLICADO';
  constructor() {
    super('Já existe um cadastro com este e-mail, CRP ou WhatsApp. Se ele é seu, recupere o acesso. Se ainda está em análise ou os dados pertencem a outra pessoa, fale com a gestão.');
    this.name = 'CadastroDuplicadoError';
  }
}

export function emailDeCadastro(email?: string): string {
  return email?.trim().toLocaleLowerCase('pt-BR') ?? '';
}

export function telefoneDeCadastro(value: string): string {
  const number = normalizeBrazilPhone(value) ?? '';
  return number.length === 13 && number[4] === '9'
    ? number.slice(0, 4) + number.slice(5)
    : number;
}

/** Região + registro só com dígitos: "CRP 06/123456", "06/123456" e "06123456" são o mesmo CRP. */
export function crpDeCadastro(value?: string): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 9);
  return digits.length > 2 ? digits : '';
}

export function assertCadastroUnico(
  cadastro: Pick<CadastroPsicologoRecord, 'id' | 'email' | 'whatsapp'> & { crp?: string },
  existentes: readonly Pick<CadastroPsicologoRecord, 'id' | 'email' | 'whatsapp' | 'crp'>[]
): void {
  const email = emailDeCadastro(cadastro.email);
  const telefone = telefoneDeCadastro(cadastro.whatsapp);
  const crp = crpDeCadastro(cadastro.crp);
  if (existentes.some((outro) => outro.id !== cadastro.id && (
    (email && emailDeCadastro(outro.email) === email)
    || (telefone && telefoneDeCadastro(outro.whatsapp) === telefone)
    || (crp && crpDeCadastro(outro.crp) === crp)
  ))) throw new CadastroDuplicadoError();
}

/** Valida novas identidades/contatos; não interrompe tarefas alheias por duplicidades legadas. */
export function assertMudancasDeCadastroUnicas(
  antes: readonly CadastroPsicologoRecord[],
  depois: readonly CadastroPsicologoRecord[]
): void {
  const porId = new Map(antes.map((cadastro) => [cadastro.id, cadastro]));
  for (const cadastro of depois) {
    const anterior = porId.get(cadastro.id);
    if (!anterior || emailDeCadastro(anterior.email) !== emailDeCadastro(cadastro.email)
      || telefoneDeCadastro(anterior.whatsapp) !== telefoneDeCadastro(cadastro.whatsapp)
      || crpDeCadastro(anterior.crp) !== crpDeCadastro(cadastro.crp)
      || (cadastro.status === 'APROVADO' && anterior.status !== 'APROVADO')) {
      assertCadastroUnico(cadastro, depois);
    }
  }
}
