export interface SolicitacaoHistoricoCpf {
  leadId: string;
  protocolo: string;
  criadoEm: string;
  status: string;
  servico?: string;
  modalidade?: string;
  psicologoNome?: string;
  atual: boolean;
}

interface TriagemResumoCpf {
  id: string;
  protocolo: string;
  cpf?: string | null;
  criadoEm: string;
  status: string;
  servico?: string;
  servicoKey?: string;
  modalidade?: string;
  psicologoNome?: string;
}

export function normalizarCpfBusca(cpf?: string | null): string | undefined {
  const digitos = (cpf ?? '').replace(/\D/g, '');
  return digitos.length === 11 ? digitos : undefined;
}

/**
 * Reúne todas as solicitações administrativas registradas para o mesmo CPF (§§ 4.02 e 6.09),
 * ordenadas da mais recente para a mais antiga e sem expor nenhum dado clínico.
 */
export function historicoAdministrativoPorCpf(
  triagens: readonly TriagemResumoCpf[],
  cpf?: string | null,
  leadAtualId?: string
): SolicitacaoHistoricoCpf[] {
  const alvo = normalizarCpfBusca(cpf);
  if (!alvo) return [];

  return triagens
    .filter((item) => normalizarCpfBusca(item.cpf) === alvo)
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
    .map((item) => ({
      leadId: item.id,
      protocolo: item.protocolo,
      criadoEm: item.criadoEm,
      status: item.status,
      servico: item.servico ?? item.servicoKey,
      modalidade: item.modalidade,
      psicologoNome: item.psicologoNome,
      atual: item.id === leadAtualId,
    }));
}

interface PedidoParaHistorico extends TriagemResumoCpf {
  nomePaciente?: string;
  dataNascimento?: string;
  identificadoPeloResponsavel?: boolean;
  responsavelFinanceiro?: { cpf?: string } | null;
  vinculoColetivo?: { participantes?: readonly { cpf?: string }[] } | null;
}

function nomeNormalizado(nome?: string): string {
  return (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

/** CPFs que identificam a própria pessoa no pedido — nunca o do responsável de um menor. */
function cpfsDoPedido(pedido: PedidoParaHistorico): string[] {
  const participantes = (pedido.vinculoColetivo?.participantes ?? []).map((item) => normalizarCpfBusca(item.cpf));
  return [normalizarCpfBusca(pedido.cpf), ...participantes].filter((cpf): cpf is string => Boolean(cpf));
}

/**
 * Histórico administrativo do pedido (§§ 4.02, 6.03, 6.04 e 6.09).
 *
 * - Menor identificado pelo CPF do responsável: casa só com outros pedidos do
 *   mesmo menor (mesmo responsável e mesmo nome), nunca com os atendimentos do
 *   próprio responsável — o histórico pertence ao menor.
 * - Demais pedidos: o CPF da pessoa, inclusive quando ela participa de um
 *   casal, família ou grupo, aparece em todos os vínculos em que está.
 */
export function historicoAdministrativoDoPedido(
  triagens: readonly PedidoParaHistorico[],
  pedido: PedidoParaHistorico,
  cpfCadastro?: string | null,
): SolicitacaoHistoricoCpf[] {
  let candidatos: readonly PedidoParaHistorico[];
  if (pedido.identificadoPeloResponsavel) {
    const responsavel = normalizarCpfBusca(pedido.responsavelFinanceiro?.cpf);
    if (!responsavel) return [];
    const nome = nomeNormalizado(pedido.nomePaciente);
    candidatos = triagens.filter((item) => item.identificadoPeloResponsavel
      && normalizarCpfBusca(item.responsavelFinanceiro?.cpf) === responsavel
      && nomeNormalizado(item.nomePaciente) === nome
      && (!item.dataNascimento || !pedido.dataNascimento || item.dataNascimento === pedido.dataNascimento));
  } else {
    const alvos = new Set([...cpfsDoPedido(pedido), normalizarCpfBusca(cpfCadastro)].filter((cpf): cpf is string => Boolean(cpf)));
    if (!alvos.size) return [];
    candidatos = triagens.filter((item) => !item.identificadoPeloResponsavel && cpfsDoPedido(item).some((cpf) => alvos.has(cpf)));
  }
  return [...candidatos]
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
    .map((item) => ({
      leadId: item.id,
      protocolo: item.protocolo,
      criadoEm: item.criadoEm,
      status: item.status,
      servico: item.servico ?? item.servicoKey,
      modalidade: item.modalidade,
      psicologoNome: item.psicologoNome,
      atual: item.id === pedido.id,
    }));
}
