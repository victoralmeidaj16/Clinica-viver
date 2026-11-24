import { tipoColetivoDoPedido, type EnderecoParticipante } from '@/lib/vinculoColetivo';
import type { ResponsavelFinanceiro } from '@/lib/responsavelFinanceiro';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import type { TriagemPacienteRecord } from './persistence';

function enderecoDoPedido(lead: TriagemPacienteRecord): EnderecoParticipante | undefined {
  if (!lead.cep || !lead.logradouro || !lead.numeroResidencia || !lead.bairro || !lead.cidade || !lead.estadoUf) {
    return undefined;
  }
  return {
    cep: lead.cep.replace(/\D/g, ''),
    logradouro: lead.logradouro,
    numero: lead.numeroResidencia,
    ...(lead.complemento ? { complemento: lead.complemento } : {}),
    bairro: lead.bairro,
    cidade: lead.cidade,
    uf: lead.estadoUf.toUpperCase(),
  };
}

/**
 * Pedido de casal, família ou grupo na entrada (especificação final, 6.04).
 *
 * Quem preencheu o formulário vira o primeiro participante e, por padrão, o
 * responsável pelo pagamento e pela nota — exatamente quem a cobrança já usava.
 * O CPF sai do campo próprio do pedido: assim o vínculo coletivo não ocupa o
 * CPF de ninguém no cadastro e não colide com o atendimento individual que a
 * mesma pessoa tenha com outro psicólogo. Os demais participantes são
 * completados depois pelo psicólogo ou pela Gestão.
 */
export function normalizarPedidoColetivo(lead: TriagemPacienteRecord): TriagemPacienteRecord {
  const tipo = tipoColetivoDoPedido(lead);
  if (!tipo || lead.vinculoColetivo) return lead;
  const endereco = enderecoDoPedido(lead);
  const responsavel: ResponsavelFinanceiro | undefined = lead.responsavelFinanceiro
    ?? (lead.cpf
      ? {
          nome: lead.nomePaciente,
          cpf: lead.cpf,
          ...(normalizeBrazilPhone(lead.telefone) ? { telefone: normalizeBrazilPhone(lead.telefone)!.slice(2) } : {}),
          ...(lead.email ? { email: lead.email } : {}),
          ...(endereco ? { endereco } : {}),
        }
      : undefined);
  return {
    ...lead,
    cpf: undefined,
    vinculoColetivo: {
      tipo,
      participantes: [{ nome: lead.nomePaciente, ...(lead.cpf ? { cpf: lead.cpf } : {}), ...(endereco ? { endereco } : {}) }],
    },
    ...(responsavel ? { responsavelFinanceiro: responsavel } : {}),
  };
}
