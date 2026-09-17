import 'server-only';

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
 * Não tem transação nem trava: duas requisições simultâneas podem se
 * sobrescrever, e o encadeamento de escritas em `writeSnapshot` só protege
 * dentro do mesmo processo. É a razão de o MySQL existir — e é uma limitação
 * declarada, não um detalhe esquecido. Este caminho serve à instalação de
 * demonstração e ao desenvolvimento local.
 */
export class FileCaptureRepository implements CaptureRepository {
  async read(): Promise<CaptureState> {
    return this.comDerivados(captureStateFromSnapshot(readSnapshot() ?? emptySnapshot()));
  }

  async mutate<T>(mutator: (state: CaptureState) => CaptureResult<T>): Promise<T> {
    const snapshot = readSnapshot() ?? emptySnapshot();
    const change = mutator(await this.comDerivados(captureStateFromSnapshot(snapshot)));

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      triagensPacientes: change.next.triagensPacientes,
      // O encerramento da turma é derivado a cada leitura; gravado no arquivo,
      // sobreviveria à reabertura da turma.
      cadastrosPsicologos: change.next.cadastrosPsicologos.map((cadastro) => ({ ...cadastro, turmaEncerrada: undefined })),
    });

    return change.result;
  }

  private async comDerivados(state: CaptureState): Promise<CaptureState> {
    return {
      ...state,
      cadastrosPsicologos: await comTurmasEncerradas([...state.cadastrosPsicologos]),
    };
  }
}

export function getCaptureRepository(): CaptureRepository {
  return isMysqlConfigured() ? new MysqlCaptureRepository() : new FileCaptureRepository();
}

export { captureStateAsSnapshot };
