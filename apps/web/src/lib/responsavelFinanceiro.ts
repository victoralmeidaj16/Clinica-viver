import { validCpf } from './cpf';
import { normalizeBrazilPhone } from './brazilPhone';

/**
 * Responsável financeiro do atendimento (especificação final, 6.03, 6.04 e
 * seção 15).
 *
 * Dois casos usam o mesmo registro:
 *  - criança ou adolescente: o responsável recebe o primeiro contato da
 *    clínica e todas as comunicações financeiras; quando o menor ainda não tem
 *    CPF, ele é identificado pelo CPF do responsável;
 *  - casal, família ou grupo: o responsável pelo pagamento e pela nota fiscal
 *    do atendimento coletivo.
 *
 * Presente, ele é o pagador: cliente do Asaas, devedor do Pix e tomador da
 * NFS-e. O histórico administrativo continua sendo do paciente.
 */

export interface EnderecoResponsavel {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface ResponsavelFinanceiro {
  nome: string;
  cpf: string;
  telefone?: string;
  email?: string;
  /** Mãe, pai, tutor(a)… Livre e curto. */
  parentesco?: string;
  endereco?: EnderecoResponsavel;
}

function texto(valor: unknown, maximo: number): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim().replace(/\s+/g, ' ').slice(0, maximo);
  return limpo || undefined;
}

function lerEndereco(bruto: unknown): EnderecoResponsavel | undefined | 'invalido' {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const fonte = bruto as Record<string, unknown>;
  const endereco = {
    cep: String(fonte.cep ?? '').replace(/\D/g, ''),
    logradouro: texto(fonte.logradouro, 255) ?? '',
    numero: texto(fonte.numero ?? fonte.numeroResidencia, 32) ?? '',
    complemento: texto(fonte.complemento, 120),
    bairro: texto(fonte.bairro, 120) ?? '',
    cidade: texto(fonte.cidade, 120) ?? '',
    uf: (texto(fonte.uf ?? fonte.estadoUf, 2) ?? '').toUpperCase(),
  };
  const algum = endereco.cep || endereco.logradouro || endereco.numero || endereco.bairro || endereco.cidade || endereco.uf;
  if (!algum) return undefined;
  if (endereco.cep.length !== 8 || !endereco.logradouro || !endereco.numero || !endereco.bairro
      || !endereco.cidade || !/^[A-Z]{2}$/.test(endereco.uf)) {
    return 'invalido';
  }
  return endereco.complemento ? endereco : { ...endereco, complemento: undefined };
}

export type ValidacaoResponsavel =
  | { ok: true; responsavel: ResponsavelFinanceiro }
  | { ok: false; erro: string };

/**
 * Valida o responsável enviado pelo formulário. `exigir` diz o que o fluxo
 * precisa além de nome e CPF: o menor precisa de telefone (é por ele que o
 * primeiro contato sai); o coletivo precisa de e-mail e endereço (NFS-e).
 */
export function validarResponsavelFinanceiro(
  bruto: unknown,
  exigir: { telefone?: boolean; email?: boolean; endereco?: boolean } = {},
): ValidacaoResponsavel {
  if (!bruto || typeof bruto !== 'object') return { ok: false, erro: 'Informe os dados do responsável financeiro.' };
  const fonte = bruto as Record<string, unknown>;
  const nome = texto(fonte.nome, 255);
  if (!nome || nome.length < 3) return { ok: false, erro: 'Informe o nome completo do responsável.' };
  const cpf = String(fonte.cpf ?? '').replace(/\D/g, '');
  if (!validCpf(cpf)) return { ok: false, erro: 'Informe um CPF válido para o responsável.' };

  const telefoneBruto = texto(fonte.telefone ?? fonte.whatsapp, 32);
  // Guardado com DDD e sem o 55, como o telefone do paciente; o envio normaliza.
  const telefone = telefoneBruto ? normalizeBrazilPhone(telefoneBruto)?.slice(2) ?? null : null;
  if (telefoneBruto && !telefone) return { ok: false, erro: 'Informe um WhatsApp válido, com DDD, para o responsável.' };
  if (exigir.telefone && !telefone) return { ok: false, erro: 'Informe o WhatsApp do responsável.' };

  const email = texto(fonte.email, 160)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: 'O e-mail do responsável não parece válido.' };
  if (exigir.email && !email) return { ok: false, erro: 'Informe o e-mail do responsável pelo pagamento.' };

  const endereco = lerEndereco(fonte.endereco);
  if (endereco === 'invalido') return { ok: false, erro: 'Complete o endereço do responsável: CEP, rua, número, bairro, cidade e UF.' };
  if (exigir.endereco && !endereco) return { ok: false, erro: 'Informe o endereço do responsável pelo pagamento.' };

  return {
    ok: true,
    responsavel: {
      nome,
      cpf,
      ...(telefone ? { telefone } : {}),
      ...(email ? { email } : {}),
      ...(texto(fonte.parentesco, 60) ? { parentesco: texto(fonte.parentesco, 60) } : {}),
      ...(endereco ? { endereco } : {}),
    },
  };
}

/** Lê o JSON gravado sem confiar na forma: nome e CPF válido são o mínimo. */
export function lerResponsavelFinanceiro(valor: unknown): ResponsavelFinanceiro | undefined {
  let bruto = valor;
  if (typeof valor === 'string') {
    try {
      bruto = JSON.parse(valor) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!bruto || typeof bruto !== 'object') return undefined;
  const validado = validarResponsavelFinanceiro(bruto);
  return validado.ok ? validado.responsavel : undefined;
}

/** Idade completa em anos, a partir da data de nascimento `AAAA-MM-DD`. */
export function idadeEmAnos(dataNascimento: string | undefined, agora: Date = new Date()): number | undefined {
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}/.test(dataNascimento)) return undefined;
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split('-').map(Number);
  let idade = agora.getUTCFullYear() - ano;
  const mesAtual = agora.getUTCMonth() + 1;
  if (mesAtual < mes || (mesAtual === mes && agora.getUTCDate() < dia)) idade -= 1;
  return idade >= 0 ? idade : undefined;
}

const PUBLICOS_INFANTIS = new Set(['infantil', 'criança', 'crianca', 'adolescente']);

/**
 * O paciente é criança ou adolescente? Vale o que for mais seguro: a data de
 * nascimento ou a idade informada abaixo de 18, ou o público marcado no site.
 */
export function pacienteMenorDeIdade(
  dados: { dataNascimento?: string; idade?: string; paraQuemE?: string },
  agora: Date = new Date(),
): boolean {
  const pelaData = idadeEmAnos(dados.dataNascimento, agora);
  if (pelaData !== undefined) return pelaData < 18;
  const informada = dados.idade && /^\d{1,3}$/.test(dados.idade) ? Number(dados.idade) : undefined;
  if (informada !== undefined) return informada < 18;
  return PUBLICOS_INFANTIS.has((dados.paraQuemE ?? '').trim().toLocaleLowerCase('pt-BR'));
}

export interface PagadorDoAtendimento {
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  /** `RESPONSAVEL` quando a cobrança sai em nome de outra pessoa. */
  origem: 'PACIENTE' | 'RESPONSAVEL';
}

/**
 * Quem paga e recebe a cobrança. O responsável, quando existe, substitui o
 * paciente inteiro — nome, CPF, e-mail e telefone —, nunca campo a campo: uma
 * nota com o nome do menor e o CPF da mãe seria pior do que nenhuma.
 */
export function pagadorDoAtendimento(
  paciente: { nome: string; cpf?: string; email?: string; telefone?: string },
  responsavel?: ResponsavelFinanceiro | null,
): PagadorDoAtendimento {
  if (responsavel) {
    return {
      nome: responsavel.nome,
      cpf: responsavel.cpf,
      email: responsavel.email,
      telefone: responsavel.telefone,
      origem: 'RESPONSAVEL',
    };
  }
  return { ...paciente, origem: 'PACIENTE' };
}

/** Telefone das mensagens financeiras: o do responsável, quando há um. */
export function telefoneFinanceiro(
  paciente: { telefone?: string },
  responsavel?: ResponsavelFinanceiro | null,
): string | undefined {
  return responsavel?.telefone || paciente.telefone;
}

/**
 * Destinatário do primeiro contato da clínica. Para criança ou adolescente é
 * sempre o responsável (6.03); no casal, família ou grupo continua sendo quem
 * pediu o atendimento — o pagador recebe só o que é financeiro.
 */
export function responsavelDoPrimeiroContato(
  pedido: { responsavelFinanceiro?: ResponsavelFinanceiro | null; vinculoColetivo?: unknown },
): ResponsavelFinanceiro | undefined {
  return pedido.vinculoColetivo ? undefined : pedido.responsavelFinanceiro ?? undefined;
}
