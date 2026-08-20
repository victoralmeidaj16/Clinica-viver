import 'server-only';

import {
  apurarHorasClinicas,
  calcularHashDeclaracao,
  STATUS_QUE_CONTAM_HORA,
  type ApuracaoDeHoras,
  type ConteudoDeclaracao,
} from '@thats-life/core';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { getApplicationStore } from '@/server/application/store';
import { ApplicationError } from '@/server/application/http';
import {
  DeclaracaoHorasRepository,
  exigirPersistenciaDeclaracao,
  type DeclaracaoHoras,
} from '@/server/declaracao/declaracaoHorasRepository';

/**
 * Declaração de horas de atendimento.
 *
 * O que este serviço garante, e que a versão anterior não garantia: **o total
 * declarado é sempre derivado das sessões registradas**. Não há parâmetro de
 * horas, não há valor padrão, não há caminho em que a declaração saia com um
 * número que ninguém possa reconstituir. Quando não há sessão, a emissão
 * falha — e falhar é a resposta certa, porque a alternativa é atestar hora que
 * não aconteceu.
 */

/**
 * Quem assina a declaração.
 *
 * A coordenação da clínica é cargo, não preferência de tela: deixá-la editável
 * no formulário permitiria emitir declaração assinada por quem não coordena.
 * As variáveis de ambiente existem para a troca de quem ocupa o cargo, que
 * acontece fora do código.
 *
 * A supervisora é fixa hoje porque o cadastro do psicólogo não guarda quem o
 * supervisiona. Quando guardar, este valor vira consulta.
 */
export const SIGNATARIOS_DECLARACAO = {
  coordenadora: process.env.DECLARACAO_COORDENADORA?.trim() || 'GIULIANA ALANO DE OLIVEIRA',
  supervisora: process.env.DECLARACAO_SUPERVISORA?.trim() || 'ALINE ALVES DE ANDRADE FURLAN DE SÁ',
} as const;

/**
 * Endereço impresso na declaração, montado no servidor.
 *
 * A tela poderia usar `window.location.origin`, mas o resultado dependeria de
 * por qual domínio a coordenação abriu o sistema — e o QR iria para o papel
 * apontando para `app.clinicavivermais.cloud`, que é o backend, e não o
 * endereço que a clínica divulga. O documento circula por anos; o endereço
 * nele precisa ser o canônico.
 */
export function enderecoDeConferencia(codigo: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://clinicavivermais.cloud';
  return `${base}/validar/${codigo}`;
}

async function exigirCadastro(psicologoCadastroId: string): Promise<CadastroPsicologoRecord> {
  const { cadastrosPsicologos } = await getCaptureRepository().read();
  const cadastro = cadastrosPsicologos.find((psi) => psi.id === psicologoCadastroId);
  if (!cadastro) {
    throw new ApplicationError('NOT_FOUND', 'Psicólogo não encontrado no cadastro da clínica.', 404);
  }
  return cadastro;
}

/**
 * O curso, montado do cadastro.
 *
 * Era campo de texto livre na tela, com um curso de exemplo já preenchido —
 * bastava não reparar nele para emitir a declaração de alguém apontando o
 * curso de outra pessoa. A pós-graduação e a turma já estão no cadastro; a
 * ausência delas é um cadastro incompleto, e a mensagem diz onde completar.
 */
function cursoDoCadastro(cadastro: CadastroPsicologoRecord): string {
  const pos = cadastro.posGraduacaoViverMais?.trim();
  if (!pos) {
    throw new ApplicationError(
      'INVALID_STATE',
      `O cadastro de ${cadastro.nomeCompleto} não informa a pós-graduação cursada. Complete o cadastro antes de emitir a declaração.`,
      422
    );
  }

  const turma = cadastro.turmaViverMais?.trim();
  return turma ? `${pos} — Turma ${turma}` : pos;
}

/**
 * A ponte entre o cadastro do rodízio e as sessões clínicas é `profissionalRef`.
 *
 * A rota anterior comparava `primaryProfessionalId` com o id do **cadastro**,
 * que é outro identificador: o filtro nunca casava, e o total caía no valor
 * fixo de 180 horas sem que nada indicasse o erro.
 */
function exigirProfissionalRef(cadastro: CadastroPsicologoRecord): string {
  if (!cadastro.profissionalRef) {
    throw new ApplicationError(
      'INVALID_STATE',
      `${cadastro.nomeCompleto} ainda não tem acesso clínico provisionado, então não há sessões vinculadas ao cadastro. Conclua o credenciamento antes de emitir a declaração.`,
      422
    );
  }
  return cadastro.profissionalRef;
}

/**
 * "Pós-Graduanda" ou "Pós-Graduando", conforme quem recebe a declaração.
 *
 * O modelo em papel da clínica traz a forma feminina fixa, o que sai errado
 * para um psicólogo homem — e sair errado num documento que a coordenação do
 * curso arquiva não é detalhe de estilo. O cadastro já guarda `genero`.
 *
 * Sem gênero informado, ou com `OUTRO`, o documento usa a forma dupla: é o que
 * a redação oficial brasileira faz quando não cabe escolher, e é preferível a
 * presumir a partir do nome.
 */
function tratamentoAcademico(cadastro: CadastroPsicologoRecord): string {
  if (cadastro.genero === 'FEMININO') return 'Pós-Graduanda';
  if (cadastro.genero === 'MASCULINO') return 'Pós-Graduando';
  return 'Pós-Graduando(a)';
}

export interface PreviaDeclaracao {
  psicologoCadastroId: string;
  psicologoNome: string;
  psicologoCrp: string;
  tratamento: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  coordenadora: string;
  supervisora: string;
}

async function apurar(cadastro: CadastroPsicologoRecord, organizationId: string): Promise<ApuracaoDeHoras> {
  const sessoes = await getApplicationStore().sessions.list({
    organizationId,
    professionalId: exigirProfissionalRef(cadastro),
    statuses: STATUS_QUE_CONTAM_HORA,
  });

  const apuracao = apurarHorasClinicas(sessoes);
  if (!apuracao) {
    throw new ApplicationError(
      'INVALID_STATE',
      `Não há sessões de atendimento registradas para ${cadastro.nomeCompleto}. A declaração só pode ser emitida sobre atendimentos realizados.`,
      422
    );
  }
  return apuracao;
}

/** O que a declaração dirá, antes de emitir. Nada aqui é gravado. */
export async function previaDeclaracao(
  organizationId: string,
  psicologoCadastroId: string
): Promise<PreviaDeclaracao> {
  const cadastro = await exigirCadastro(psicologoCadastroId);
  const apuracao = await apurar(cadastro, organizationId);

  return {
    psicologoCadastroId: cadastro.id,
    psicologoNome: cadastro.nomeSocial || cadastro.nomeCompleto,
    psicologoCrp: cadastro.crp,
    tratamento: tratamentoAcademico(cadastro),
    curso: cursoDoCadastro(cadastro),
    periodoInicio: apuracao.periodoInicio,
    periodoFim: apuracao.periodoFim,
    totalSessoes: apuracao.totalSessoes,
    totalHoras: apuracao.totalHoras,
    coordenadora: SIGNATARIOS_DECLARACAO.coordenadora,
    supervisora: SIGNATARIOS_DECLARACAO.supervisora,
  };
}

/**
 * Emite a declaração e devolve o código de conferência.
 *
 * A apuração é refeita aqui, e não recebida da tela: entre abrir a prévia e
 * clicar em emitir podem ter entrado sessões novas, e — o que importa mais —
 * um total que viaja pelo navegador é um total que o navegador pode alterar.
 */
export async function emitirDeclaracao(
  organizationId: string,
  usuarioId: string,
  psicologoCadastroId: string
): Promise<DeclaracaoHoras & { tratamento: string }> {
  exigirPersistenciaDeclaracao();

  const cadastro = await exigirCadastro(psicologoCadastroId);
  const apuracao = await apurar(cadastro, organizationId);
  const curso = cursoDoCadastro(cadastro);
  const nome = cadastro.nomeSocial || cadastro.nomeCompleto;

  const declaracao = await new DeclaracaoHorasRepository().registrar(
    {
      organizationId,
      psicologoCadastroId: cadastro.id,
      profissionalId: exigirProfissionalRef(cadastro),
      psicologoNome: nome,
      psicologoCrp: cadastro.crp,
      curso,
      periodoInicio: apuracao.periodoInicio,
      periodoFim: apuracao.periodoFim,
      totalSessoes: apuracao.totalSessoes,
      totalHoras: apuracao.totalHoras,
      sessaoIds: apuracao.sessaoIds,
      coordenadora: SIGNATARIOS_DECLARACAO.coordenadora,
      supervisora: SIGNATARIOS_DECLARACAO.supervisora,
      emitidoPor: usuarioId,
    },
    (codigo, emitidoEm) =>
      calcularHashDeclaracao({
        codigo,
        psicologoNome: nome,
        psicologoCrp: cadastro.crp,
        curso,
        periodoInicio: apuracao.periodoInicio,
        periodoFim: apuracao.periodoFim,
        totalSessoes: apuracao.totalSessoes,
        totalHoras: apuracao.totalHoras,
        emitidoEm,
        sessaoIds: apuracao.sessaoIds,
      })
  );

  // O tratamento acompanha a resposta sem entrar na linha gravada: ele é
  // concordância do texto impresso, não afirmação sobre horas. Deixá-lo fora
  // do hash mantém a conferência falando só do que ela pode provar.
  return { ...declaracao, tratamento: tratamentoAcademico(cadastro) };
}

export type SituacaoConferencia = 'valida' | 'revogada' | 'adulterada';

export interface ResultadoConferencia {
  situacao: SituacaoConferencia;
  codigo: string;
  psicologoNome: string;
  psicologoCrp: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  emitidoEm: string;
  revogadaEm?: string;
  revogacaoMotivo?: string;
}

/**
 * Conferência pública de uma declaração.
 *
 * O hash é recalculado a partir da própria linha e comparado com o gravado na
 * emissão. Uma alteração direta no banco — o total de horas, o nome, o
 * período — não bate mais, e a resposta passa a `adulterada`. É o que dá
 * sentido ao código impresso: sem esta comparação, a página apenas repetiria o
 * que o banco diz hoje, seja lá quem o tenha escrito.
 *
 * O que volta é só o que a declaração já afirma no papel. Não sai daqui id de
 * sessão, id de paciente nem quem emitiu: quem confere precisa saber se o
 * documento é verdadeiro, não quem a pessoa atendeu.
 */
export async function conferirDeclaracao(codigo: string): Promise<ResultadoConferencia | null> {
  exigirPersistenciaDeclaracao();

  const declaracao = await new DeclaracaoHorasRepository().porCodigo(codigo);
  if (!declaracao) return null;

  const conteudo: ConteudoDeclaracao = {
    codigo: declaracao.codigo,
    psicologoNome: declaracao.psicologoNome,
    psicologoCrp: declaracao.psicologoCrp,
    curso: declaracao.curso,
    periodoInicio: declaracao.periodoInicio,
    periodoFim: declaracao.periodoFim,
    totalSessoes: declaracao.totalSessoes,
    totalHoras: declaracao.totalHoras,
    emitidoEm: declaracao.emitidoEm,
    sessaoIds: declaracao.sessaoIds,
  };

  const integra = (await calcularHashDeclaracao(conteudo)) === declaracao.conteudoHash;
  const situacao: SituacaoConferencia = !integra
    ? 'adulterada'
    : declaracao.revogadaEm
      ? 'revogada'
      : 'valida';

  return {
    situacao,
    codigo: declaracao.codigo,
    psicologoNome: declaracao.psicologoNome,
    psicologoCrp: declaracao.psicologoCrp,
    curso: declaracao.curso,
    periodoInicio: declaracao.periodoInicio,
    periodoFim: declaracao.periodoFim,
    totalSessoes: declaracao.totalSessoes,
    totalHoras: declaracao.totalHoras,
    emitidoEm: declaracao.emitidoEm,
    revogadaEm: declaracao.revogadaEm,
    revogacaoMotivo: declaracao.revogacaoMotivo,
  };
}

export interface PsicologoElegivel {
  id: string;
  nome: string;
  crp: string;
  curso?: string;
  /** Por que não dá para emitir. Ausente quando dá. */
  impedimento?: string;
}

/**
 * Os psicólogos que a tela oferece, com o impedimento de cada um já resolvido.
 *
 * Mostrar a lista inteira e só falhar no clique faria a gestão descobrir um
 * cadastro incompleto uma pessoa por vez. O impedimento vem junto, e a tela
 * pode dizer o que falta antes de alguém tentar.
 */
export async function listarPsicologosParaDeclaracao(): Promise<readonly PsicologoElegivel[]> {
  const { cadastrosPsicologos } = await getCaptureRepository().read();

  return cadastrosPsicologos
    .filter((psi) => psi.status === 'APROVADO')
    .map((psi) => {
      const impedimento = !psi.profissionalRef
        ? 'Credenciamento incompleto: sem acesso clínico provisionado.'
        : !psi.posGraduacaoViverMais?.trim()
          ? 'Cadastro sem a pós-graduação cursada.'
          : undefined;

      const turma = psi.turmaViverMais?.trim();
      const pos = psi.posGraduacaoViverMais?.trim();

      return {
        id: psi.id,
        nome: psi.nomeSocial || psi.nomeCompleto,
        crp: psi.crp,
        curso: pos ? (turma ? `${pos} — Turma ${turma}` : pos) : undefined,
        impedimento,
      };
    })
    .sort((primeiro, segundo) => primeiro.nome.localeCompare(segundo.nome, 'pt-BR'));
}
