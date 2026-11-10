import 'server-only';
import { ordenarPsicologosRoundRobin, type PsicologoPerfil } from '@thats-life/core';
import type { PosicaoRodizio } from '@/lib/posicaoRodizio';
import type { CadastroPsicologoRecord } from './persistence';
import { ausenciaVigente, paraPsicologoPerfil } from './viverMaisRodizio';

function motivoForaDaFila(cadastro: CadastroPsicologoRecord, perfil: PsicologoPerfil, agora: Date): string | undefined {
  if (cadastro.status === 'EM_ANALISE') return 'Aguardando aprovação';
  if (cadastro.status !== 'APROVADO') return 'Cadastro recusado';
  if (cadastro.turmaEncerrada) return 'Turma encerrada';
  if (cadastro.pausadoNoRodizio) return 'Pausado pela gestão';
  if (cadastro.reconfiguracaoAtendimentoPendente) return 'Cadastro de atendimento pendente';
  if (ausenciaVigente(cadastro, agora)) return 'Ausente na agenda';
  if (perfil.pacientesAtivosCount >= perfil.limitePacientesAtivos) return 'Capacidade esgotada';
  if (!perfil.turnosDisponiveis.length) return 'Sem turno válido cadastrado';
  if (!perfil.modalidadesAtendidas.length) return 'Sem modalidade válida cadastrada';
}

/** Calculada antes dos filtros visuais, sem gravar ou avançar o rodízio. */
export function posicoesDoRodizio(
  cadastros: readonly CadastroPsicologoRecord[], agora = new Date()
): Map<string, PosicaoRodizio> {
  const avaliados = cadastros.map((cadastro) => {
    const perfil = paraPsicologoPerfil(cadastro, agora);
    return { perfil, motivo: motivoForaDaFila(cadastro, perfil, agora) };
  });
  const fila = ordenarPsicologosRoundRobin(avaliados.filter((item) => !item.motivo).map((item) => item.perfil));
  const posicoes = new Map(fila.map((perfil, indice) => [perfil.id, indice + 1]));
  return new Map(avaliados.map(({ perfil, motivo }) => [perfil.id, {
    posicao: posicoes.get(perfil.id) ?? null,
    total: fila.length,
    ...(motivo ? { motivo } : {}),
  }]));
}
