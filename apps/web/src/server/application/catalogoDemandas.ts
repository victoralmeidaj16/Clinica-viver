import 'server-only';

import { aplicarOperacaoDemanda, lerCatalogoDemandas, renomearNaLista, type DemandaClinica } from '@/lib/catalogoDemandas';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { AlteracaoConfiguracao } from '@/server/persistence/mysql/configuracaoGestaoRepository';
import type { AutorDaSessao } from './autorGestao';
import { gravarConfiguracaoGestao, lerConfiguracaoGestao, organizacaoPadrao } from './configuracaoGestao';
import { ApplicationError } from './http';

export const CHAVE_CATALOGO_DEMANDAS = 'catalogo_demandas';

/** Demandas clínicas vigentes (3.4). Sem ajuste gravado, a lista inicial. */
export async function obterDemandas(organizationId: string = organizacaoPadrao()): Promise<DemandaClinica[]> {
  return lerCatalogoDemandas((await lerConfiguracaoGestao<unknown>(organizationId, CHAVE_CATALOGO_DEMANDAS)).valor);
}

export async function obterDemandasParaGestao(organizationId: string): Promise<{
  demandas: DemandaClinica[];
  historico: readonly AlteracaoConfiguracao[];
  editavel: boolean;
}> {
  const lida = await lerConfiguracaoGestao<unknown>(organizationId, CHAVE_CATALOGO_DEMANDAS);
  return { demandas: lerCatalogoDemandas(lida.valor), historico: lida.historico, editavel: lida.editavel };
}

/**
 * Adiciona, renomeia, remove (desativa) ou reativa uma demanda. Renomear
 * troca o nome nos cadastros de psicólogos e nos pedidos antes de gravar o
 * catálogo, para o rodízio continuar casando psicólogo e paciente. As
 * preferências originais dos pedidos (4.04) ficam como chegaram.
 */
export async function operarDemanda(
  organizationId: string,
  corpo: Record<string, unknown>,
  autor: AutorDaSessao
): Promise<DemandaClinica[]> {
  const lida = await lerConfiguracaoGestao<unknown>(organizationId, CHAVE_CATALOGO_DEMANDAS);
  const resultado = aplicarOperacaoDemanda(lerCatalogoDemandas(lida.valor), corpo);
  if (!resultado.ok) throw new ApplicationError('INVALID_INPUT', resultado.erro, 400);

  if (resultado.renomeada) {
    const { de, para } = resultado.renomeada;
    await getCaptureRepository().mutate((state) => ({
      next: {
        ...state,
        cadastrosPsicologos: state.cadastrosPsicologos.map((cadastro) => cadastro.necessidadesAtendidas?.includes(de)
          ? { ...cadastro, necessidadesAtendidas: renomearNaLista(cadastro.necessidadesAtendidas, de, para) }
          : cadastro),
        triagensPacientes: state.triagensPacientes.map((lead) => lead.necessidadesPaciente?.includes(de)
          ? { ...lead, necessidadesPaciente: renomearNaLista(lead.necessidadesPaciente, de, para) }
          : lead),
      },
      result: null,
    }));
  }
  await gravarConfiguracaoGestao(organizationId, CHAVE_CATALOGO_DEMANDAS, resultado.catalogo, autor);
  return resultado.catalogo;
}
