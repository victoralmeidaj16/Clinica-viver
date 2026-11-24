'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { TURNOS_ATENDIMENTO, normalizarTurnosPreferencia } from '@/lib/turnos';
import { modalitiesForService } from '@/lib/patientCareOptions';
import type { CampoPreferencia, ValorPreferencia } from '@/lib/preferenciasSolicitacao';
import { chamarGestao } from '@/components/gestao/gestaoApi';
import { PreferenciasResumo } from './PreferenciasResumo';
import type { ManagedPatient } from './managementTypes';

export function preferenciasAtuais(patient: ManagedPatient): Partial<Record<CampoPreferencia, ValorPreferencia>> {
  return {
    servico: patient.servicoNome, servicoKey: patient.servicoKey, modalidade: patient.modalidade,
    formatoAtendimento: patient.formatoAtendimento, turno: patient.turno, paraQuemE: patient.paraQuemE,
    preferenciaGeneroPsicologo: patient.preferenciaGeneroPsicologo, abordagemDesejada: patient.abordagemDesejada,
    duracaoSessaoMinutos: patient.duracaoSessaoMinutos, necessidadesPaciente: patient.necessidadesPaciente,
    necessidadesOutro: patient.necessidadesOutro, opcaoAvaliacaoPsicologica: patient.opcaoAvaliacaoPsicologica,
    possuiConvenio: patient.possuiConvenio, convenioSelecionado: patient.convenioSelecionado,
  };
}

const campo = 'mt-1 block w-full rounded-xl border border-line bg-psi-light px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none';

/** Preferências do pedido na Gestão: origem, histórico e correção (4.04). */
export default function PatientPreferencesPanel({ patient, onChange }: {
  patient: ManagedPatient;
  onChange: () => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [turnos, setTurnos] = useState<string[]>(normalizarTurnosPreferencia(patient.turno));
  const [formato, setFormato] = useState(patient.formatoAtendimento ?? '');
  const [genero, setGenero] = useState(patient.preferenciaGeneroPsicologo ?? 'SEM_PREFERENCIA');
  const [duracao, setDuracao] = useState(patient.duracaoSessaoMinutos ? String(patient.duracaoSessaoMinutos) : '');
  const [modalidade, setModalidade] = useState(patient.modalidade ?? '');
  const [abordagem, setAbordagem] = useState(patient.abordagemDesejada ?? '');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  if (!patient.leadId) return null;
  const modalidades = patient.servicoKey ? modalitiesForService(patient.servicoKey) : [];

  const salvar = async () => {
    setEnviando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/pacientes/preferencias', {
        leadId: patient.leadId,
        motivo,
        preferencias: {
          turno: turnos,
          formatoAtendimento: formato,
          preferenciaGeneroPsicologo: genero,
          duracaoSessaoMinutos: duracao,
          abordagemDesejada: abordagem,
          ...(modalidade && modalidade !== patient.modalidade ? { modalidade } : {}),
        },
      }, 'PUT');
      setEditando(false);
      setMotivo('');
      await onChange();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao alterar as preferências.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="space-y-3 py-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-psi-darkest">
          <SlidersHorizontal className="h-4 w-4 text-psi-vibrant" /> Preferências do pedido
        </h3>
        <button type="button" onClick={() => setEditando((atual) => !atual)} className="text-[11px] font-bold text-psi-deep">
          {editando ? 'Cancelar' : 'Corrigir preferências'}
        </button>
      </div>

      <PreferenciasResumo
        originais={patient.preferenciasOriginais}
        atuais={preferenciasAtuais(patient)}
        alteracoes={patient.alteracoesPreferencias}
      />

      {editando && (
        <div className="space-y-2 rounded-2xl border border-psi-soft bg-psi-soft/20 p-3">
          <p className="text-[11px] text-muted">O valor original continua guardado; esta alteração entra no histórico.</p>
          <div className="flex flex-wrap gap-2">
            {TURNOS_ATENDIMENTO.map((turno) => (
              <label key={turno.value} className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={turnos.includes(turno.value)}
                  onChange={(event) => setTurnos((atual) => event.target.checked
                    ? [...atual, turno.value] : atual.filter((item) => item !== turno.value))}
                />
                {turno.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-bold text-muted">Formato
              <select value={formato} onChange={(event) => setFormato(event.target.value)} className={campo}>
                <option value="">Não informado</option>
                <option value="ONLINE">On-line</option>
                <option value="PRESENCIAL">Presencial</option>
                <option value="INDIFERENTE">Indiferente</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-muted">Gênero do profissional
              <select value={genero} onChange={(event) => setGenero(event.target.value)} className={campo}>
                <option value="SEM_PREFERENCIA">Sem preferência</option>
                <option value="FEMININO">Feminino</option>
                <option value="MASCULINO">Masculino</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-muted">Duração da sessão
              <select value={duracao} onChange={(event) => setDuracao(event.target.value)} className={campo}>
                <option value="">Conforme o serviço</option>
                <option value="50">50 minutos</option>
                <option value="90">1h30</option>
              </select>
            </label>
            {modalidades.length > 0 && (
              <label className="text-[11px] font-bold text-muted">Faixa de valor
                <select value={modalidade} onChange={(event) => setModalidade(event.target.value)} className={campo}>
                  {modalidades.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className="block text-[11px] font-bold text-muted">Abordagem
            <input value={abordagem} onChange={(event) => setAbordagem(event.target.value)} className={campo} />
          </label>
          <label className="block text-[11px] font-bold text-muted">Motivo da alteração
            <input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ex.: paciente pediu outro período" className={campo} />
          </label>
          {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
          <button type="button" disabled={enviando || !turnos.length} onClick={() => void salvar()} className="btn-primary min-h-10 justify-center disabled:opacity-50">
            {enviando ? 'Salvando…' : 'Salvar preferências'}
          </button>
        </div>
      )}
    </section>
  );
}
