'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { ResponsavelFinanceiro } from '@/lib/responsavelFinanceiro';
import { ROTULO_TIPO_COLETIVO, type TipoVinculoColetivo, type VinculoColetivo } from '@/lib/vinculoColetivo';
import { ParticipantesCampos, participantesParaForm, type ParticipanteForm } from './ParticipantesCampos';
import {
  RESPONSAVEL_VAZIO,
  ResponsavelFinanceiroCampos,
  responsavelParaEnvio,
  responsavelParaForm,
  type ResponsavelForm,
} from './ResponsavelFinanceiroCampos';

interface VinculoDoPaciente {
  leadId: string;
  menorDeIdade: boolean;
  tipoColetivoSugerido?: TipoVinculoColetivo;
  possuiCpfProprio: boolean;
  identificadoPeloResponsavel: boolean;
  responsavelFinanceiro?: ResponsavelFinanceiro;
  vinculoColetivo?: VinculoColetivo;
}

/**
 * Responsável financeiro e participantes do vínculo (especificação final, 6.03
 * e 6.04). O responsável recebe as cobranças e é o tomador da nota; no menor,
 * também o primeiro contato.
 */
export default function PatientBondForm({ patientId, onSaved }: { patientId: string; onSaved?: () => void | Promise<void> }) {
  const [vinculo, setVinculo] = useState<VinculoDoPaciente | null>(null);
  const [temResponsavel, setTemResponsavel] = useState(false);
  const [responsavel, setResponsavel] = useState<ResponsavelForm>(RESPONSAVEL_VAZIO);
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>(participantesParaForm());
  const [identificado, setIdentificado] = useState(false);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'salvando' | 'indisponivel'>('carregando');
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();

  const aplicar = (dados: VinculoDoPaciente) => {
    setVinculo(dados);
    setTemResponsavel(Boolean(dados.responsavelFinanceiro));
    setResponsavel(responsavelParaForm(dados.responsavelFinanceiro));
    setParticipantes(participantesParaForm(dados.vinculoColetivo?.participantes));
    setIdentificado(dados.identificadoPeloResponsavel);
  };

  useEffect(() => {
    let ativo = true;
    applicationRequest<VinculoDoPaciente>(`/patients/${encodeURIComponent(patientId)}/vinculo`)
      .then((dados) => { if (ativo) { aplicar(dados); setEstado('pronto'); } })
      .catch(() => { if (ativo) setEstado('indisponivel'); });
    return () => { ativo = false; };
  }, [patientId]);

  if (estado === 'carregando') return <p className="text-xs text-muted">Carregando responsável e participantes…</p>;
  if (estado === 'indisponivel' || !vinculo) return null;

  const tipo = vinculo.vinculoColetivo?.tipo ?? vinculo.tipoColetivoSugerido;
  const coletivo = Boolean(tipo);
  const relevante = coletivo || vinculo.menorDeIdade || Boolean(vinculo.responsavelFinanceiro);

  const salvar = async () => {
    setEstado('salvando');
    setMensagem(undefined);
    const envio = responsavelParaEnvio(responsavel);
    try {
      const dados = await applicationRequest<VinculoDoPaciente>(`/patients/${encodeURIComponent(patientId)}/vinculo`, {
        method: 'PUT',
        headers: commandHeaders(),
        body: JSON.stringify({
          responsavelFinanceiro: temResponsavel || coletivo ? envio : null,
          ...(vinculo.menorDeIdade && !vinculo.possuiCpfProprio ? { identificadoPeloResponsavel: identificado } : {}),
          ...(coletivo ? {
            vinculoColetivo: {
              tipo,
              participantes: participantes.map((item) => ({
                nome: item.nome, cpf: item.cpf,
                ...(item.mesmoEnderecoDoResponsavel && envio.endereco ? { endereco: envio.endereco } : {}),
              })),
            },
          } : {}),
        }),
      });
      aplicar(dados);
      setMensagem({ tipo: 'ok', texto: 'Dados do vínculo salvos.' });
      await onSaved?.();
    } catch (causa) {
      setMensagem({ tipo: 'erro', texto: causa instanceof Error ? causa.message : 'Não foi possível salvar.' });
    } finally {
      setEstado('pronto');
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-psi-soft/60 bg-psi-soft/10 p-4">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
        <Users className="h-4 w-4 text-psi-vibrant" />
        {coletivo ? `Atendimento de ${ROTULO_TIPO_COLETIVO[tipo!].toLowerCase()}` : 'Responsável financeiro'}
      </h3>
      {coletivo ? (
        <p className="text-[11px] text-muted">Um vínculo e uma vaga para o conjunto, com uma cobrança por sessão em nome do responsável abaixo. Os participantes não contam como pacientes ativos e o vínculo individual de cada um continua separado.</p>
      ) : vinculo.menorDeIdade ? (
        <p className="text-[11px] text-muted">Criança ou adolescente: o primeiro contato da clínica e todas as cobranças vão ao responsável.</p>
      ) : null}

      {!coletivo && (
        <label className="flex items-center gap-2 text-xs font-semibold text-ink">
          <input type="checkbox" checked={temResponsavel} onChange={(event) => setTemResponsavel(event.target.checked)} />
          {relevante ? 'Há responsável financeiro' : 'Outra pessoa paga as sessões'}
        </label>
      )}
      {(temResponsavel || coletivo) && (
        <ResponsavelFinanceiroCampos
          idPrefixo={`vinculo-${patientId}`}
          value={responsavel}
          onChange={setResponsavel}
          mostrarEndereco={coletivo}
          exigirEmail={coletivo}
        />
      )}
      {vinculo.menorDeIdade && !vinculo.possuiCpfProprio && (
        <label className="flex items-center gap-2 text-xs font-semibold text-ink">
          <input type="checkbox" checked={identificado} onChange={(event) => setIdentificado(event.target.checked)} />
          O paciente ainda não tem CPF: identificar pelo CPF do responsável
        </label>
      )}
      {coletivo && <ParticipantesCampos value={participantes} onChange={setParticipantes} />}

      {mensagem && <p className={`text-xs font-semibold ${mensagem.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{mensagem.texto}</p>}
      <button type="button" disabled={estado === 'salvando'} onClick={() => void salvar()} className="btn-primary min-h-10 justify-center disabled:opacity-50">
        {estado === 'salvando' ? 'Salvando…' : 'Salvar responsável e participantes'}
      </button>
    </section>
  );
}
