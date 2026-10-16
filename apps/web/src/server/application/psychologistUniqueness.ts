import type { CadastroPsicologoRecord } from './persistence';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';

export class CadastroDuplicadoError extends Error {
  readonly status = 409;
  readonly code = 'CADASTRO_DUPLICADO';
  constructor() {
    super('Já existe um cadastro com este e-mail ou WhatsApp. Se ele é seu, recupere o acesso. Se ainda está em análise ou os contatos pertencem a outra pessoa, fale com a gestão.');
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

export function assertCadastroUnico(
  cadastro: Pick<CadastroPsicologoRecord, 'id' | 'email' | 'whatsapp'>,
  existentes: readonly CadastroPsicologoRecord[]
): void {
  const email = emailDeCadastro(cadastro.email);
  const telefone = telefoneDeCadastro(cadastro.whatsapp);
  if (existentes.some((outro) => outro.id !== cadastro.id && (
    (email && emailDeCadastro(outro.email) === email)
    || (telefone && telefoneDeCadastro(outro.whatsapp) === telefone)
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
      || (cadastro.status === 'APROVADO' && anterior.status !== 'APROVADO')) {
      assertCadastroUnico(cadastro, depois);
    }
  }
}
