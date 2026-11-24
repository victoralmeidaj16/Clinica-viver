import { normalizarFormatoAtendimento, psicologoCompativel } from '@thats-life/core/src/viverMaisMatchingEngine';
import type { PsicologoVitrineItem } from '@/components/vitrineCarrossel';
import { normalizarModalidade } from './modalidade';
import { normalizarTurnoPreferencia, normalizarTurnosPreferencia } from './turnos';

export function profissionalCompativelNaVitrine(
  psi: PsicologoVitrineItem,
  demanda: {
    turno: string;
    modalidade: string | null;
    servicoKey: string | null;
    paraQuemE?: string;
    necessidadesPaciente?: readonly string[];
    formatoAtendimento?: string;
    abordagemDesejada?: string;
    duracaoSessaoMinutos?: number;
  }
): boolean {
  const modalidade = normalizarModalidade(demanda.modalidade ?? undefined);
  if (!modalidade || psi.disponivelParaNovosPacientes === false) return false;
  const formato = normalizarFormatoAtendimento(demanda.formatoAtendimento);
  return psicologoCompativel({
    id: psi.id,
    pacientesAtivosCount: 0,
    limitePacientesAtivos: 1,
    turnosDisponiveis: (psi.turnosDisponiveis ?? []).flatMap((valor) => {
      const turno = normalizarTurnoPreferencia(valor);
      return turno ? [turno] : [];
    }),
    modalidadesAtendidas: (psi.modalidadesAtendidas ?? []).flatMap((valor) => {
      const normalizada = normalizarModalidade(valor);
      return normalizada ? [normalizada] : [];
    }),
    modalidadeAtendimento: psi.modalidadeAtendimento,
    abordagem: psi.especialidades?.[0],
    posGraduacaoViverMais: psi.posGraduacaoViverMais,
    outrasPosGraduacoes: psi.segundaPosGraduacao ? [psi.segundaPosGraduacao] : undefined,
    temposAtendimento: psi.temposAtendimento,
    servicosHabilitados: psi.servicosHabilitados,
    publicoAlvo: psi.publicoAlvo,
    necessidadesAtendidas: psi.necessidadesAtendidas,
  }, normalizarTurnosPreferencia(demanda.turno), modalidade, {
    servicoDesejado: demanda.servicoKey ?? undefined,
    paraQuemE: demanda.paraQuemE,
    necessidadesDesejadas: demanda.necessidadesPaciente,
    formatoDesejado: formato && formato !== 'AMBOS' ? formato : undefined,
    abordagemDesejada: demanda.abordagemDesejada,
    duracaoDesejadaMinutos: demanda.duracaoSessaoMinutos,
  });
}
