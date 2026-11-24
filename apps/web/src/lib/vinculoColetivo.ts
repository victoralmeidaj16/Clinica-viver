import { validCpf } from './cpf';

/**
 * Atendimento de casal, família ou grupo como um único vínculo (especificação
 * final, 6.04).
 *
 * O conjunto atendido é um pedido só: ocupa uma vaga, gera uma cobrança por
 * sessão e tem um responsável financeiro (`lib/responsavelFinanceiro.ts`). Os
 * participantes ficam identificados aqui, sem virar pacientes ativos e sem
 * tocar no cadastro individual que algum deles tenha com outro psicólogo —
 * por isso o vínculo coletivo não ocupa o CPF de ninguém no cadastro.
 */

export type TipoVinculoColetivo = 'CASAL' | 'FAMILIA' | 'GRUPO';

export interface EnderecoParticipante {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface ParticipanteVinculo {
  nome: string;
  cpf?: string;
  endereco?: EnderecoParticipante;
}

export interface VinculoColetivo {
  tipo: TipoVinculoColetivo;
  participantes: readonly ParticipanteVinculo[];
}

export const ROTULO_TIPO_COLETIVO: Record<TipoVinculoColetivo, string> = {
  CASAL: 'Casal',
  FAMILIA: 'Família',
  GRUPO: 'Grupo',
};

export const MAXIMO_PARTICIPANTES = 12;

/** O pedido é coletivo? Decide pelo público e pela faixa de valor do site. */
export function tipoColetivoDoPedido(
  pedido: { paraQuemE?: string; modalidade?: string; servicoKey?: string },
): TipoVinculoColetivo | undefined {
  const publico = (pedido.paraQuemE ?? '').trim().toLocaleLowerCase('pt-BR');
  const modalidade = (pedido.modalidade ?? '').trim().toUpperCase();
  if (publico === 'grupo') return 'GRUPO';
  if (publico.startsWith('casa') || modalidade.startsWith('CASAL') || pedido.servicoKey === 'PSICOTERAPIA_CASAL') return 'CASAL';
  if (publico.startsWith('fam') || modalidade.startsWith('FAMILIA')) return 'FAMILIA';
  return undefined;
}

function texto(valor: unknown, maximo: number): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim().replace(/\s+/g, ' ').slice(0, maximo);
  return limpo || undefined;
}

function lerEndereco(bruto: unknown): EnderecoParticipante | undefined | 'invalido' {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const fonte = bruto as Record<string, unknown>;
  const endereco = {
    cep: String(fonte.cep ?? '').replace(/\D/g, ''),
    logradouro: texto(fonte.logradouro, 255) ?? '',
    numero: texto(fonte.numero, 32) ?? '',
    complemento: texto(fonte.complemento, 120),
    bairro: texto(fonte.bairro, 120) ?? '',
    cidade: texto(fonte.cidade, 120) ?? '',
    uf: (texto(fonte.uf, 2) ?? '').toUpperCase(),
  };
  if (!endereco.cep && !endereco.logradouro && !endereco.numero && !endereco.bairro && !endereco.cidade && !endereco.uf) {
    return undefined;
  }
  if (endereco.cep.length !== 8 || !endereco.logradouro || !endereco.numero || !endereco.bairro
      || !endereco.cidade || !/^[A-Z]{2}$/.test(endereco.uf)) {
    return 'invalido';
  }
  return endereco.complemento ? endereco : { ...endereco, complemento: undefined };
}

export type ValidacaoVinculoColetivo =
  | { ok: true; vinculo: VinculoColetivo }
  | { ok: false; erro: string };

/**
 * Participantes com nome obrigatório; CPF e endereço opcionais, mas válidos
 * quando informados. O mesmo CPF não pode aparecer duas vezes no conjunto.
 * O pedido do site chega com um participante (quem preencheu); quem edita
 * depois completa o conjunto, por isso o mínimo é escolha do chamador.
 */
export function validarVinculoColetivo(
  bruto: unknown,
  opcoes: { minimoParticipantes?: number } = {},
): ValidacaoVinculoColetivo {
  if (!bruto || typeof bruto !== 'object') return { ok: false, erro: 'Informe os participantes do atendimento.' };
  const fonte = bruto as Record<string, unknown>;
  const tipo = fonte.tipo;
  if (tipo !== 'CASAL' && tipo !== 'FAMILIA' && tipo !== 'GRUPO') {
    return { ok: false, erro: 'Informe se o atendimento é de casal, família ou grupo.' };
  }
  if (!Array.isArray(fonte.participantes)) return { ok: false, erro: 'Informe os participantes do atendimento.' };

  const participantes: ParticipanteVinculo[] = [];
  const cpfs = new Set<string>();
  for (const item of fonte.participantes.slice(0, MAXIMO_PARTICIPANTES)) {
    if (!item || typeof item !== 'object') continue;
    const registro = item as Record<string, unknown>;
    const nome = texto(registro.nome, 255);
    const cpf = String(registro.cpf ?? '').replace(/\D/g, '');
    const endereco = lerEndereco(registro.endereco);
    if (!nome && !cpf && !endereco) continue;
    if (!nome || nome.length < 3) return { ok: false, erro: 'Informe o nome completo de cada participante.' };
    if (cpf && !validCpf(cpf)) return { ok: false, erro: `O CPF de ${nome} não parece válido.` };
    if (cpf && cpfs.has(cpf)) return { ok: false, erro: 'O mesmo CPF foi informado para dois participantes.' };
    if (endereco === 'invalido') return { ok: false, erro: `Complete o endereço de ${nome}: CEP, rua, número, bairro, cidade e UF.` };
    if (cpf) cpfs.add(cpf);
    participantes.push({ nome, ...(cpf ? { cpf } : {}), ...(endereco ? { endereco } : {}) });
  }

  const minimo = opcoes.minimoParticipantes ?? 1;
  if (participantes.length < minimo) {
    return {
      ok: false,
      erro: minimo > 1 ? `Informe pelo menos ${minimo} participantes do atendimento.` : 'Informe os participantes do atendimento.',
    };
  }
  return { ok: true, vinculo: { tipo, participantes } };
}

export function lerVinculoColetivo(valor: unknown): VinculoColetivo | undefined {
  let bruto = valor;
  if (typeof valor === 'string') {
    try {
      bruto = JSON.parse(valor) as unknown;
    } catch {
      return undefined;
    }
  }
  const validado = validarVinculoColetivo(bruto);
  return validado.ok ? validado.vinculo : undefined;
}
