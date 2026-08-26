import 'server-only';

import type { CadastroPsicologoRecord, StatusCadastroPsicologo } from './persistence';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { isBrazilUf } from '@/lib/brazilLocations';
import { municipioPertenceAoEstado } from './ibgeLocations';
import { validateGender } from '@/lib/gender';

/**
 * Regras de edição do cadastro de psicólogo, num lugar só.
 *
 * Três rotas escrevem neste registro — o POST público, o PATCH da gestão e o
 * PATCH do próprio profissional — e antes cada uma trazia sua cópia da
 * derivação de serviços e da validação de telefone/cidade/gênero. Duas cópias
 * divergem no dia em que só uma é corrigida; foi assim que o formulário público
 * passou a gravar `servicosHabilitados` de um jeito que a gestão não reproduzia
 * ao editar.
 */

export const STATUS_VALIDOS: readonly StatusCadastroPsicologo[] = [
  'EM_ANALISE',
  'APROVADO',
  'RECUSADO',
];

/**
 * O que a gestão pode alterar: tudo. É ela quem confere CRP, decide sobre o
 * acesso e opera capacidade e vitrine.
 */
export const CAMPOS_DA_GESTAO = new Set([
  'status', 'nomeCompleto', 'nomeSocial', 'crp', 'whatsapp', 'email', 'fotoUrl',
  'estadoUf', 'cidade', 'logradouro', 'bairro', 'genero', 'generoOutro', 'especialidade',
  'modalidadeAtendimento', 'atendimentoPreferencia', 'minibio',
  'turnosDisponiveis', 'modalidadesAtendidas', 'servicosHabilitados',
  'servicosPrestados', 'publicoAlvo', 'publicoAlvoOutro',
  'especificarNecessidades', 'necessidadesAtendidas', 'necessidadesOutro',
  'limitePacientesAtivos', 'exibirNaVitrine', 'motivoDesativacao',
  'pausadoNoRodizio', 'motivoPausaRodizio',
  'turmaViverMais', 'posGraduacaoViverMais', 'segundaPosGraduacao',
  'ultimoLeadRecebidoEm', 'solicitacaoAlteracaoGestao',
]);

/**
 * O que o psicólogo altera no próprio perfil. Nome, CRP e e-mail fazem parte
 * dos próprios dados profissionais; status, vitrine e capacidade continuam
 * sendo decisões da clínica.
 */
export const CAMPOS_DO_PROPRIO_PSICOLOGO = new Set([
  'nomeCompleto', 'crp', 'email', 'nomeSocial', 'whatsapp', 'fotoUrl', 'minibio', 'especialidade',
  'estadoUf', 'cidade', 'logradouro', 'bairro', 'genero', 'generoOutro',
  'modalidadeAtendimento', 'atendimentoPreferencia', 'turnosDisponiveis',
  'servicosPrestados', 'publicoAlvo', 'publicoAlvoOutro',
  'especificarNecessidades', 'necessidadesAtendidas', 'necessidadesOutro',
  'turmaViverMais', 'posGraduacaoViverMais', 'segundaPosGraduacao',
  'solicitacaoAlteracaoGestao',
]);

/**
 * Traduz os rótulos que o profissional marca no formulário para as chaves que o
 * rodízio compara (`viverMaisMatchingEngine`). Orientação vocacional e
 * profissional caem na mesma chave de propósito: são o mesmo serviço com dois
 * nomes de mercado.
 */
export function derivarServicosHabilitados(servicosPrestados: readonly string[]): string[] {
  return Array.from(
    new Set(
      [
        servicosPrestados.includes('Atendimento Psicológico') ? 'PSICOTERAPIA' : '',
        servicosPrestados.includes('Avaliação Psicológica') ? 'AVALIACAO' : '',
        servicosPrestados.some((s) => s.includes('Vocacional') || s.includes('Profissional'))
          ? 'ORIENTACAO_PROFISSIONAL'
          : '',
        servicosPrestados.includes('Orientação Parental') ? 'ORIENTACAO_PARENTAL' : '',
      ].filter(Boolean)
    )
  );
}

/** `AMBOS` é o default do formulário e o que abre o rodízio para as duas filas. */
export function derivarModalidadesAtendidas(
  preferencia: 'PARTICULAR' | 'SOCIAL' | 'AMBOS' | undefined
): string[] {
  if (preferencia === 'PARTICULAR') return ['PARTICULAR'];
  if (preferencia === 'SOCIAL') return ['SOCIAL'];
  return ['SOCIAL', 'PARTICULAR'];
}

function listaDeTexto(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  return valor.filter((item): item is string => typeof item === 'string');
}

function texto(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  return limpo || undefined;
}

export class CorpoInvalidoError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'CorpoInvalidoError';
  }
}

/**
 * Valida e normaliza o que veio do cliente, antes de qualquer merge.
 *
 * Só olha os campos presentes: o PATCH é parcial de verdade, para que desligar
 * um perfil não apague de passagem os turnos e serviços que a gestão levou
 * tempo cadastrando.
 */
export async function validarCorpo(
  corpo: Record<string, unknown>,
  permitidos: ReadonlySet<string> = CAMPOS_DA_GESTAO
): Promise<void> {
  // Só o que vai ser aplicado é validado.
  //
  // Antes a validação corria sobre o corpo inteiro, então o psicólogo que
  // reenviasse o próprio cadastro recebia "o limite deve ser entre 1 e 5" por
  // um campo que a allowlist ia descartar de qualquer forma — erro sobre uma
  // decisão que não era dele. O descarte continua silencioso, como documentado.
  for (const campo of Object.keys(corpo)) {
    if (!permitidos.has(campo)) delete corpo[campo];
  }

  if (corpo.status !== undefined && !STATUS_VALIDOS.includes(corpo.status as StatusCadastroPsicologo)) {
    throw new CorpoInvalidoError('Status inválido.');
  }

  if (corpo.whatsapp !== undefined) {
    const whatsapp = normalizeBrazilPhone(corpo.whatsapp);
    if (!whatsapp) throw new CorpoInvalidoError('Informe um telefone brasileiro válido com DDD.');
    corpo.whatsapp = whatsapp;
  }

  if (corpo.nomeCompleto !== undefined) {
    const nome = texto(corpo.nomeCompleto);
    if (!nome || nome.length < 2) throw new CorpoInvalidoError('Informe seu nome completo.');
    corpo.nomeCompleto = nome.slice(0, 255);
  }

  if (corpo.crp !== undefined) {
    const crp = texto(corpo.crp);
    if (!crp) throw new CorpoInvalidoError('Informe seu registro CRP.');
    corpo.crp = crp.slice(0, 40);
  }

  if (corpo.email !== undefined) {
    const email = texto(corpo.email)?.toLocaleLowerCase('pt-BR');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new CorpoInvalidoError('Informe um e-mail profissional válido.');
    }
    corpo.email = email.slice(0, 255);
  }

  if (corpo.genero !== undefined || corpo.generoOutro !== undefined) {
    const genero = validateGender(corpo.genero, corpo.generoOutro);
    if (!genero) {
      throw new CorpoInvalidoError(
        'Selecione o gênero e informe a descrição quando escolher Outro.'
      );
    }
    corpo.genero = genero.gender;
    corpo.generoOutro = genero.other;
  }

  // Estado e cidade andam juntos: uma UF nova com a cidade antiga produz um par
  // que não existe, e é justamente o par que o IBGE valida.
  if (corpo.estadoUf !== undefined || corpo.cidade !== undefined) {
    const estadoUf = String(corpo.estadoUf ?? '').trim().toUpperCase();
    const cidade = String(corpo.cidade ?? '').trim();
    if (!isBrazilUf(estadoUf) || !cidade) {
      throw new CorpoInvalidoError('Informe estado e cidade juntos.');
    }
    try {
      if (!(await municipioPertenceAoEstado(estadoUf, cidade))) {
        throw new CorpoInvalidoError('Selecione uma cidade oficial da UF informada.');
      }
    } catch (error) {
      if (error instanceof CorpoInvalidoError) throw error;
      console.error('Erro ao validar município no IBGE:', error);
      throw new CorpoInvalidoError('Não foi possível validar a cidade agora. Tente novamente.', 503);
    }
  }

  // Rua e bairro também formam um par. Cadastros antigos podem não ter nenhum
  // dos dois, mas uma edição nunca deve deixar um endereço pela metade.
  if (corpo.logradouro !== undefined || corpo.bairro !== undefined) {
    const logradouro = texto(corpo.logradouro);
    const bairro = texto(corpo.bairro);
    if (!logradouro || !bairro) {
      throw new CorpoInvalidoError('Informe rua/logradouro e bairro juntos.');
    }
    corpo.logradouro = logradouro;
    corpo.bairro = bairro;
  }

  if (
    corpo.limitePacientesAtivos !== undefined &&
    (!Number.isInteger(corpo.limitePacientesAtivos) ||
      Number(corpo.limitePacientesAtivos) < 1 ||
      Number(corpo.limitePacientesAtivos) > 5)
  ) {
    throw new CorpoInvalidoError('O limite deve ser um número inteiro entre 1 e 5.');
  }

  if (corpo.turnosDisponiveis !== undefined) {
    const turnos = listaDeTexto(corpo.turnosDisponiveis);
    if (!turnos || turnos.length === 0) {
      // Turno é critério eliminatório do rodízio: lista vazia não significa
      // "qualquer horário", significa nunca receber paciente.
      throw new CorpoInvalidoError('Selecione ao menos um turno de atendimento.');
    }
  }
}

/**
 * Aplica ao registro apenas os campos presentes no corpo E permitidos pela
 * allowlist. O que estiver fora é ignorado em silêncio — um cliente que tente
 * mandar `status: 'APROVADO'` no PATCH do próprio perfil não recebe erro, só
 * não consegue nada.
 */
export function aplicarMudancas(
  existente: CadastroPsicologoRecord,
  corpo: Record<string, unknown>,
  permitidos: ReadonlySet<string>
): CadastroPsicologoRecord {
  const pode = (campo: string) => permitidos.has(campo) && corpo[campo] !== undefined;

  const exibirNaVitrine =
    pode('exibirNaVitrine') && typeof corpo.exibirNaVitrine === 'boolean'
      ? corpo.exibirNaVitrine
      : existente.exibirNaVitrine;

  const pausadoNoRodizio =
    pode('pausadoNoRodizio') && typeof corpo.pausadoNoRodizio === 'boolean'
      ? corpo.pausadoNoRodizio
      : existente.pausadoNoRodizio;

  const estadoUf = pode('estadoUf')
    ? String(corpo.estadoUf).trim().toUpperCase() || undefined
    : existente.estadoUf;
  const cidade = pode('cidade') ? String(corpo.cidade).trim() || undefined : existente.cidade;
  const logradouro = pode('logradouro') ? texto(corpo.logradouro) : existente.logradouro;
  const bairro = pode('bairro') ? texto(corpo.bairro) : existente.bairro;
  const genero = pode('genero') ? String(corpo.genero) : existente.genero;

  const servicosPrestados = pode('servicosPrestados')
    ? listaDeTexto(corpo.servicosPrestados) ?? existente.servicosPrestados
    : existente.servicosPrestados;

  const atendimentoPreferencia = pode('atendimentoPreferencia')
    ? (corpo.atendimentoPreferencia as 'PARTICULAR' | 'SOCIAL' | 'AMBOS')
    : existente.atendimentoPreferencia;

  // Derivados nunca vêm do cliente quando a origem também veio: enviar os dois
  // permitiria declarar "atendo particular" e habilitar a fila social.
  const servicosHabilitados = pode('servicosPrestados')
    ? derivarServicosHabilitados(servicosPrestados ?? [])
    : pode('servicosHabilitados')
      ? listaDeTexto(corpo.servicosHabilitados) ?? existente.servicosHabilitados
      : existente.servicosHabilitados;

  const modalidadesAtendidas = pode('atendimentoPreferencia')
    ? derivarModalidadesAtendidas(atendimentoPreferencia)
    : pode('modalidadesAtendidas')
      ? listaDeTexto(corpo.modalidadesAtendidas) ?? existente.modalidadesAtendidas
      : existente.modalidadesAtendidas;

  return {
    ...existente,
    status: pode('status') ? (corpo.status as StatusCadastroPsicologo) : existente.status,
    nomeCompleto: pode('nomeCompleto')
      ? texto(corpo.nomeCompleto) ?? existente.nomeCompleto
      : existente.nomeCompleto,
    crp: pode('crp') ? texto(corpo.crp) ?? existente.crp : existente.crp,
    whatsapp: pode('whatsapp') ? String(corpo.whatsapp) : existente.whatsapp,
    email: pode('email') ? (corpo.email as string) || undefined : existente.email,
    fotoUrl: pode('fotoUrl') ? (corpo.fotoUrl as string) || undefined : existente.fotoUrl,
    estadoUf,
    cidade,
    logradouro,
    bairro,
    genero,
    generoOutro:
      genero === 'OUTRO'
        ? pode('generoOutro')
          ? String(corpo.generoOutro).trim() || undefined
          : existente.generoOutro
        : undefined,
    cidadeUf: cidade && estadoUf ? `${cidade}/${estadoUf}` : existente.cidadeUf,
    especialidade: pode('especialidade')
      ? (corpo.especialidade as string) || undefined
      : existente.especialidade,
    modalidadeAtendimento: pode('modalidadeAtendimento')
      ? (corpo.modalidadeAtendimento as string) || undefined
      : existente.modalidadeAtendimento,
    atendimentoPreferencia,
    minibio: pode('minibio') ? (corpo.minibio as string) || undefined : existente.minibio,
    exibirNaVitrine,
    motivoDesativacao: exibirNaVitrine
      ? undefined
      : (pode('motivoDesativacao') ? (corpo.motivoDesativacao as string) : undefined) ??
        existente.motivoDesativacao ??
        'Desativação manual pela gestão',
    // Mesma simetria do motivo da vitrine: enquanto a pausa existe o motivo
    // sobrevive, e ao retomar ele some — um motivo órfão descreveria uma
    // situação que acabou.
    pausadoNoRodizio,
    motivoPausaRodizio: pausadoNoRodizio
      ? (pode('motivoPausaRodizio') ? (corpo.motivoPausaRodizio as string) : undefined) ??
        existente.motivoPausaRodizio ??
        'Pausa manual pela gestão'
      : undefined,
    nomeSocial: pode('nomeSocial')
      ? (corpo.nomeSocial as string) || undefined
      : existente.nomeSocial,
    turnosDisponiveis: pode('turnosDisponiveis')
      ? listaDeTexto(corpo.turnosDisponiveis) ?? existente.turnosDisponiveis
      : existente.turnosDisponiveis,
    modalidadesAtendidas:
      modalidadesAtendidas && modalidadesAtendidas.length > 0
        ? modalidadesAtendidas
        : ['SOCIAL', 'PARTICULAR'],
    servicosHabilitados,
    servicosPrestados,
    publicoAlvo: pode('publicoAlvo')
      ? listaDeTexto(corpo.publicoAlvo) ?? existente.publicoAlvo
      : existente.publicoAlvo,
    publicoAlvoOutro: pode('publicoAlvoOutro')
      ? (corpo.publicoAlvoOutro as string) || undefined
      : existente.publicoAlvoOutro,
    especificarNecessidades: pode('especificarNecessidades')
      ? Boolean(corpo.especificarNecessidades)
      : existente.especificarNecessidades,
    necessidadesAtendidas: pode('necessidadesAtendidas')
      ? listaDeTexto(corpo.necessidadesAtendidas) ?? existente.necessidadesAtendidas
      : existente.necessidadesAtendidas,
    necessidadesOutro: pode('necessidadesOutro')
      ? (corpo.necessidadesOutro as string) || undefined
      : existente.necessidadesOutro,
    limitePacientesAtivos: pode('limitePacientesAtivos')
      ? Number(corpo.limitePacientesAtivos)
      : existente.limitePacientesAtivos,
    // `null` explícito limpa o carimbo e joga o profissional para a frente da
    // fila — é como a gestão compensa quem ficou de fora do rodízio.
    ultimoLeadRecebidoEm: pode('ultimoLeadRecebidoEm')
      ? (corpo.ultimoLeadRecebidoEm as string | null) ?? undefined
      : existente.ultimoLeadRecebidoEm,
    turmaViverMais: pode('turmaViverMais')
      ? (corpo.turmaViverMais as string) || undefined
      : existente.turmaViverMais,
    posGraduacaoViverMais: pode('posGraduacaoViverMais')
      ? (corpo.posGraduacaoViverMais as string) || undefined
      : existente.posGraduacaoViverMais,
    segundaPosGraduacao: pode('segundaPosGraduacao')
      ? (corpo.segundaPosGraduacao as string) || undefined
      : existente.segundaPosGraduacao,
    solicitacaoAlteracaoGestao: pode('solicitacaoAlteracaoGestao')
      ? (corpo.solicitacaoAlteracaoGestao as any) ?? undefined
      : existente.solicitacaoAlteracaoGestao,
  };
}
