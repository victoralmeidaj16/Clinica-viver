import 'server-only';
import { compararOrdemRodizio, ordenarPsicologosRoundRobin, type PsicologoPerfil } from '@thats-life/core';
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
  // Empatados em todos os critérios dividem a posição: a alocação sorteia
  // entre eles (especificação final, 5.01), então nenhuma ordem fixa seria
  // verdadeira na tela.
  const posicoes = new Map<string, { posicao: number; empate: boolean }>();
  fila.forEach((perfil, indice) => {
    const anterior = fila[indice - 1];
    const empataComAnterior = anterior !== undefined && compararOrdemRodizio(anterior, perfil) === 0;
    const proximo = fila[indice + 1];
    const empataComProximo = proximo !== undefined && compararOrdemRodizio(perfil, proximo) === 0;
    posicoes.set(perfil.id, {
      posicao: empataComAnterior ? posicoes.get(anterior.id)!.posicao : indice + 1,
      empate: empataComAnterior || empataComProximo,
    });
  });
  return new Map(avaliados.map(({ perfil, motivo }) => {
    const lugar = posicoes.get(perfil.id);
    return [perfil.id, {
      posicao: lugar?.posicao ?? null,
      total: fila.length,
      ...(lugar?.empate ? { empate: true } : {}),
      ...(motivo ? { motivo } : {}),
    }];
  }));
}
