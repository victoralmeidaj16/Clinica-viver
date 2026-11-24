import 'server-only';

import { assertMudancasDeCadastroUnicas } from '@/server/application/psychologistUniqueness';

import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
} from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import {
  captureStateAsSnapshot,
  captureStateFromSnapshot,
  MysqlCaptureRepository,
  type CaptureState,
} from './mysql/captureRepository';
import { comTurmasEncerradas } from './turmasEncerradas';
import { prazoOfertaValido } from '@/lib/prazoOferta';

/**
 * Um caminho só para a captação — fila de triagem e credenciamento.
 *
 * Antes disto, cada rota carregava um `if (isMysqlConfigured())` com dois
 * blocos que faziam a mesma coisa por meios diferentes. Seis rotas, doze
 * caminhos, e nenhuma garantia de que corrigir um bug em um deles corrigisse no
 * outro. A escolha do adaptador passa a acontecer **uma vez**, aqui, e as rotas
 * voltam a ter uma implementação só da regra.
 *
 * O contrato é o que o `MysqlCaptureRepository` já praticava: `mutate` recebe o
 * estado, devolve o estado novo e o resultado, e o adaptador cuida de ler e
 * gravar em volta. Isso mantém a transação e o `FOR UPDATE` do MySQL invisíveis
 * para quem chama — e é justamente essa invisibilidade que permite a versão em
 * arquivo cumprir o mesmo contrato sem ter transação nenhuma.
 */

export type { CaptureState };

export interface CaptureResult<T> {
  next: CaptureState;
  result: T;
}

export interface CaptureRepository {
  read(): Promise<CaptureState>;
  mutate<T>(mutator: (state: CaptureState) => CaptureResult<T>): Promise<T>;
}

/**
 * Adaptador de arquivo.
 *
 * A fila cobre a leitura e a gravação em um único processo de demonstração.
 * O MySQL usa uma transação por organização nas instalações compartilhadas.
 */
export class FileCaptureRepository implements CaptureRepository {
  private static pendingMutation: Promise<void> = Promise.resolve();

  async read(): Promise<CaptureState> {
    return this.comDerivados(captureStateFromSnapshot(readSnapshot() ?? emptySnapshot()));
  }

  mutate<T>(mutator: (state: CaptureState) => CaptureResult<T>): Promise<T> {
    const operation = FileCaptureRepository.pendingMutation.then(() => this.applyMutation(mutator));
    FileCaptureRepository.pendingMutation = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async applyMutation<T>(mutator: (state: CaptureState) => CaptureResult<T>): Promise<T> {
    const snapshot = readSnapshot() ?? emptySnapshot();
    const current = await this.comDerivados(captureStateFromSnapshot(snapshot));
    const change = mutator(current);
    assertMudancasDeCadastroUnicas(current.cadastrosPsicologos, change.next.cadastrosPsicologos);

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      triagensPacientes: change.next.triagensPacientes,
      // O encerramento da turma é derivado a cada leitura; gravado no arquivo,
      // sobreviveria à reabertura da turma.
      cadastrosPsicologos: change.next.cadastrosPsicologos.map((cadastro) => ({
        ...cadastro,
        turmaEncerrada: undefined,
        situacaoAcademica: undefined,
        permissoesEfetivas: undefined,
        formatosPermitidos: undefined,
        avisoSaidaTurma: undefined,
      })),
    });

    return change.result;
  }

  private async comDerivados(state: CaptureState): Promise<CaptureState> {
    // Modo arquivo é de uma organização só: vale o prazo que estiver gravado.
    const prazo = (readSnapshot()?.configuracoesGestao ?? [])
      .find((item) => item.chave.endsWith(':prazo_oferta_horas'));
    const prazoOfertaHoras = prazoOfertaValido(prazo?.valor) ?? undefined;
    return {
      ...state,
      cadastrosPsicologos: await comTurmasEncerradas([...state.cadastrosPsicologos]),
      ...(prazoOfertaHoras !== undefined ? { prazoOfertaHoras } : {}),
    };
  }
}

export function getCaptureRepository(): CaptureRepository {
  return isMysqlConfigured() ? new MysqlCaptureRepository() : new FileCaptureRepository();
}

export { captureStateAsSnapshot };
