'use client';

import { maskCpf, validCpf } from '@/lib/cpf';
import { maskBrazilPhoneInput } from '@/lib/brazilPhone';
import type { ResponsavelFinanceiro } from '@/lib/responsavelFinanceiro';

export interface ResponsavelForm {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  parentesco: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export const RESPONSAVEL_VAZIO: ResponsavelForm = {
  nome: '', cpf: '', telefone: '', email: '', parentesco: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
};

export function responsavelParaForm(valor?: ResponsavelFinanceiro): ResponsavelForm {
  if (!valor) return RESPONSAVEL_VAZIO;
  return {
    nome: valor.nome, cpf: maskCpf(valor.cpf), telefone: valor.telefone ? maskBrazilPhoneInput(valor.telefone) : '',
    email: valor.email ?? '', parentesco: valor.parentesco ?? '',
    cep: valor.endereco?.cep ?? '', logradouro: valor.endereco?.logradouro ?? '', numero: valor.endereco?.numero ?? '',
    complemento: valor.endereco?.complemento ?? '', bairro: valor.endereco?.bairro ?? '',
    cidade: valor.endereco?.cidade ?? '', uf: valor.endereco?.uf ?? '',
  };
}

/** Corpo enviado à API; o servidor revalida tudo. */
export function responsavelParaEnvio(form: ResponsavelForm) {
  const temEndereco = [form.cep, form.logradouro, form.numero, form.bairro, form.cidade, form.uf].some((campo) => campo.trim());
  return {
    nome: form.nome, cpf: form.cpf, telefone: form.telefone, email: form.email, parentesco: form.parentesco,
    ...(temEndereco ? {
      endereco: {
        cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento,
        bairro: form.bairro, cidade: form.cidade, uf: form.uf,
      },
    } : {}),
  };
}

const entrada = 'mt-1 block w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none';

/**
 * Dados do responsável financeiro (especificação final, 6.03 e 6.04). O
 * endereço só aparece quando a nota fiscal sai em nome dele (vínculo coletivo).
 */
export function ResponsavelFinanceiroCampos({ value, onChange, mostrarEndereco = false, exigirEmail = false, idPrefixo }: {
  value: ResponsavelForm;
  onChange: (value: ResponsavelForm) => void;
  mostrarEndereco?: boolean;
  exigirEmail?: boolean;
  idPrefixo: string;
}) {
  const alterar = (campo: keyof ResponsavelForm, valor: string) => onChange({ ...value, [campo]: valor });
  const cpfInvalido = value.cpf.length === 14 && !validCpf(value.cpf);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label htmlFor={`${idPrefixo}-nome`} className="text-[11px] font-bold text-muted sm:col-span-2">
        Nome completo do responsável *
        <input id={`${idPrefixo}-nome`} value={value.nome} onChange={(event) => alterar('nome', event.target.value)} className={entrada} />
      </label>
      <label htmlFor={`${idPrefixo}-cpf`} className="text-[11px] font-bold text-muted">
        CPF do responsável *
        <input
          id={`${idPrefixo}-cpf`}
          value={value.cpf}
          maxLength={14}
          inputMode="numeric"
          onChange={(event) => alterar('cpf', maskCpf(event.target.value))}
          className={`${entrada} ${cpfInvalido ? 'border-rose-400 bg-rose-50/40' : ''}`}
        />
        {cpfInvalido && <span className="mt-0.5 block text-[11px] font-semibold text-rose-600">CPF inválido.</span>}
      </label>
      <label htmlFor={`${idPrefixo}-parentesco`} className="text-[11px] font-bold text-muted">
        Parentesco
        <input id={`${idPrefixo}-parentesco`} value={value.parentesco} placeholder="Mãe, pai, tutor(a)…" onChange={(event) => alterar('parentesco', event.target.value)} className={entrada} />
      </label>
      <label htmlFor={`${idPrefixo}-telefone`} className="text-[11px] font-bold text-muted">
        WhatsApp do responsável
        <input id={`${idPrefixo}-telefone`} value={value.telefone} inputMode="tel" placeholder="(00) 00000-0000" onChange={(event) => alterar('telefone', maskBrazilPhoneInput(event.target.value))} className={entrada} />
      </label>
      <label htmlFor={`${idPrefixo}-email`} className="text-[11px] font-bold text-muted">
        E-mail do responsável{exigirEmail ? ' *' : ''}
        <input id={`${idPrefixo}-email`} type="email" value={value.email} onChange={(event) => alterar('email', event.target.value)} className={entrada} />
      </label>
      {mostrarEndereco && (
        <>
          <label className="text-[11px] font-bold text-muted">CEP *
            <input value={value.cep} inputMode="numeric" maxLength={9} onChange={(event) => alterar('cep', event.target.value.replace(/\D/g, '').slice(0, 8))} className={entrada} />
          </label>
          <label className="text-[11px] font-bold text-muted">Número *
            <input value={value.numero} onChange={(event) => alterar('numero', event.target.value)} className={entrada} />
          </label>
          <label className="text-[11px] font-bold text-muted sm:col-span-2">Rua *
            <input value={value.logradouro} onChange={(event) => alterar('logradouro', event.target.value)} className={entrada} />
          </label>
          <label className="text-[11px] font-bold text-muted">Complemento
            <input value={value.complemento} onChange={(event) => alterar('complemento', event.target.value)} className={entrada} />
          </label>
          <label className="text-[11px] font-bold text-muted">Bairro *
            <input value={value.bairro} onChange={(event) => alterar('bairro', event.target.value)} className={entrada} />
          </label>
          <label className="text-[11px] font-bold text-muted">Cidade *
            <input value={value.cidade} onChange={(event) => alterar('cidade', event.target.value)} className={entrada} />
          </label>
          <label className="text-[11px] font-bold text-muted">UF *
            <input value={value.uf} maxLength={2} onChange={(event) => alterar('uf', event.target.value.toUpperCase())} className={entrada} />
          </label>
        </>
      )}
    </div>
  );
}
