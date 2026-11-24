'use client';

import { validCpf } from '@/lib/cpf';
import {
  ResponsavelFinanceiroCampos,
  type ResponsavelForm,
} from '@/components/patients/ResponsavelFinanceiroCampos';

/**
 * Criança ou adolescente (especificação final, 6.03 e seção 15): o
 * responsável recebe o primeiro contato e as cobranças; sem CPF próprio, o
 * menor é identificado pelo CPF do responsável.
 */
export function ResponsavelMenorCampos({ idPrefixo, semCpf, onSemCpfChange, responsavel, onResponsavelChange }: {
  idPrefixo: string;
  semCpf: boolean;
  onSemCpfChange: (valor: boolean) => void;
  responsavel: ResponsavelForm;
  onResponsavelChange: (valor: ResponsavelForm) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
      <legend className="px-1 text-xs font-black text-purple-900">Responsável pelo paciente</legend>
      <p className="text-[11px] text-slate-600">
        Para crianças e adolescentes, o primeiro contato da clínica e todas as cobranças vão para o responsável.
      </p>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
        <input type="checkbox" checked={semCpf} onChange={(event) => onSemCpfChange(event.target.checked)} />
        O paciente ainda não tem CPF (usar o CPF do responsável)
      </label>
      <ResponsavelFinanceiroCampos idPrefixo={idPrefixo} value={responsavel} onChange={onResponsavelChange} />
    </fieldset>
  );
}

/** Mensagem de erro do bloco, ou `null` quando está completo. */
export function erroResponsavelMenor(responsavel: ResponsavelForm, cpfPaciente: string, semCpf: boolean): string | null {
  if (responsavel.nome.trim().length < 3) return 'Informe o nome completo do responsável.';
  if (!validCpf(responsavel.cpf)) return 'Informe um CPF válido para o responsável.';
  if (!semCpf && responsavel.cpf.replace(/\D/g, '') === cpfPaciente.replace(/\D/g, '')) {
    return 'O CPF do responsável deve ser diferente do CPF do paciente. Se o paciente ainda não tem CPF, marque essa opção.';
  }
  return null;
}
