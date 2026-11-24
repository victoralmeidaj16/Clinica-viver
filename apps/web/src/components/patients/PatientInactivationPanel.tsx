'use client';

import { useState } from 'react';
import { PowerOff, RotateCcw } from 'lucide-react';
import { MOTIVO_INATIVACAO_MINIMO, ROTULO_PERFIL_INATIVACAO } from '@/lib/inativacaoVinculo';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';
import type { ManagedPatient } from './managementTypes';

/**
 * Inativação do vínculo pela Gestão e reativação (especificação final, 6.05,
 * 6.08 e 13.01). Distinta da desistência: não abre novo encaminhamento.
 */
export default function PatientInactivationPanel({ patient, onChange }: {
  patient: ManagedPatient;
  onChange: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [excederLimite, setExcederLimite] = useState(false);
  const [pedirExcesso, setPedirExcesso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  const ativo = patient.leadStatus === 'CONTATO_CONFIRMADO' || (patient.leadStatus === 'AGUARDANDO_CONTATO' && patient.status === 'ATIVO');
  const inativo = patient.leadStatus === 'INATIVO';
  if (!patient.leadId || (!ativo && !inativo && !patient.inativacoes?.length)) return null;

  const enviar = async (acao: 'INATIVAR' | 'REATIVAR') => {
    setEnviando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/pacientes/inativacao', {
        acao,
        leadId: patient.leadId,
        ...(acao === 'INATIVAR' ? { motivo } : { justificativa, excederLimite }),
      });
      setMotivo('');
      setJustificativa('');
      setPedirExcesso(false);
      await onChange();
    } catch (causa) {
      const codigo = (causa as { code?: string }).code;
      const mensagem = causa instanceof Error ? causa.message : 'Falha ao atualizar o vínculo.';
      // Lotado: pede confirmação expressa e justificativa (6.08).
      if (acao === 'REATIVAR' && (codigo === 'LIMITE_ATINGIDO' || mensagem.includes('limite'))) setPedirExcesso(true);
      setErro(mensagem);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-psi-soft bg-surface p-4 shadow-card">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
        <PowerOff aria-hidden className="h-4 w-4 text-psi-vibrant" /> Inativação do vínculo
      </h3>

      {inativo && patient.inativacao && (
        <div className="rounded-xl border border-psi-soft bg-psi-light p-3 text-xs text-ink">
          <p><strong>Inativo</strong> desde {dataHoraBr(patient.inativacao.inativadoEm)}</p>
          <p className="mt-1">Motivo: {patient.inativacao.motivo}</p>
          <p className="mt-1 text-muted">
            Por {patient.inativacao.porNome ?? 'usuário sem nome registrado'} ({ROTULO_PERFIL_INATIVACAO[patient.inativacao.perfil]})
            {patient.inativacao.psicologoNome ? ` · vínculo com ${patient.inativacao.psicologoNome}` : ''}
          </p>
        </div>
      )}

      {ativo && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">A vaga do psicólogo é liberada na hora. Para pedir novo encaminhamento, use a desistência.</p>
          <textarea
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={2}
            placeholder="Motivo da inativação (obrigatório)"
            className="w-full rounded-xl border border-line bg-psi-light px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none"
          />
          <button
            type="button"
            disabled={enviando || motivo.trim().length < MOTIVO_INATIVACAO_MINIMO}
            onClick={() => void enviar('INATIVAR')}
            className="btn-ghost min-h-10 justify-center disabled:opacity-50"
          >
            {enviando ? 'Salvando…' : 'Inativar vínculo'}
          </button>
        </div>
      )}

      {inativo && (
        <div className="space-y-2">
          {pedirExcesso && (
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <input type="checkbox" checked={excederLimite} onChange={(event) => setExcederLimite(event.target.checked)} />
              Autorizo exceder o limite de pacientes do psicólogo
            </label>
          )}
          <input
            type="text"
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            placeholder={pedirExcesso ? 'Justificativa da exceção (obrigatória)' : 'Justificativa da reativação (opcional)'}
            className="w-full rounded-xl border border-line bg-psi-light px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none"
          />
          <button type="button" disabled={enviando} onClick={() => void enviar('REATIVAR')} className="btn-primary min-h-10 justify-center disabled:opacity-50">
            <RotateCcw className="h-4 w-4" /> {enviando ? 'Salvando…' : 'Reativar vínculo'}
          </button>
        </div>
      )}

      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}

      {Boolean(patient.inativacoes?.length) && (
        <ul className="space-y-1 border-t border-psi-soft pt-2 text-[11px] text-muted">
          {[...patient.inativacoes!].reverse().map((item) => (
            <li key={item.inativadoEm}>
              {dataHoraBr(item.inativadoEm)} — inativado por {item.porNome ?? ROTULO_PERFIL_INATIVACAO[item.perfil]}: {item.motivo}
              {item.reativadoEm ? ` · reativado em ${dataHoraBr(item.reativadoEm)}${item.reativadoPorNome ? ` por ${item.reativadoPorNome}` : ''}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
