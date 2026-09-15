import 'server-only';

import {
  apurarHorasClinicas,
  calcularHashDeclaracao,
  STATUS_QUE_CONTAM_HORA,
  type ApuracaoDeHoras,
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
 * A prévia nasce das sessões e do cadastro. Quando a gestão faz um ajuste
 * manual, o valor impresso é persistido junto dos ids das sessões que serviram
 * de base, preservando a rastreabilidade do documento emitido.
 */

/**
 * Quem assina a declaração.
 *
 * As variáveis de ambiente definem os nomes sugeridos no formulário. A gestão
 * pode ajustá-los em uma emissão específica quando houver mudança de cargo ou
 * substituição temporária.
 *
 * O relatório é assinado apenas pela coordenação. O campo legado de
 * supervisão permanece opcional na persistência para preservar históricos.
 */
export const SIGNATARIOS_DECLARACAO = {
  coordenadora: process.env.DECLARACAO_COORDENADORA?.trim() || 'GIULIANA ALANO DE OLIVEIRA',
} as const;

/**
 * Aqui ficava `enderecoDeConferencia`, que montava a URL impressa no QR do
 * papel. O relatório de estágio deixou de trazer código e QR — quem confere um
 * relatório confere a assinatura da coordenação —, e a
 * validação pública por código passou a ser exclusividade dos certificados.
 *
 * O código de verificação continua sendo gerado e gravado na emissão: ele é a
 * chave do registro interno, não mais algo que circula no documento.
 */

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
}

/** Campos que a gestão pode ajustar no documento antes da emissão. */
export interface AjustesDeclaracao {
  psicologoNome: string;
  psicologoCrp: string;
  tratamento: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalHoras: number;
  coordenadora: string;
}

function textoObrigatorio(valor: unknown, rotulo: string, limite = 180): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) {
    throw new ApplicationError('INVALID_INPUT', `Preencha o campo ${rotulo}.`, 400);
  }
  if (texto.length > limite) {
    throw new ApplicationError('INVALID_INPUT', `${rotulo} deve ter no máximo ${limite} caracteres.`, 400);
  }
  return texto;
}

function dataObrigatoria(valor: unknown, rotulo: string): string {
  const data = textoObrigatorio(valor, rotulo, 10);
  const instante = new Date(`${data}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    Number.isNaN(instante.getTime()) ||
    instante.toISOString().slice(0, 10) !== data
  ) {
    throw new ApplicationError('INVALID_INPUT', `Informe uma data válida em ${rotulo}.`, 400);
  }
  return data;
}

function validarAjustes(ajustes: AjustesDeclaracao): AjustesDeclaracao {
  const periodoInicio = dataObrigatoria(ajustes.periodoInicio, 'início do período');
  const periodoFim = dataObrigatoria(ajustes.periodoFim, 'fim do período');
  if (periodoInicio > periodoFim) {
    throw new ApplicationError('INVALID_INPUT', 'O início do período não pode ser posterior ao fim.', 400);
  }

  const totalHoras = Number(ajustes.totalHoras);
  if (!Number.isInteger(totalHoras) || totalHoras <= 0 || totalHoras > 10000) {
    throw new ApplicationError('INVALID_INPUT', 'Informe um total de horas inteiro entre 1 e 10.000.', 400);
  }

  return {
    psicologoNome: textoObrigatorio(ajustes.psicologoNome, 'nome', 180),
    psicologoCrp: textoObrigatorio(ajustes.psicologoCrp, 'CRP', 40),
    tratamento: textoObrigatorio(ajustes.tratamento, 'tratamento acadêmico', 80),
    curso: textoObrigatorio(ajustes.curso, 'curso', 240),
    periodoInicio,
    periodoFim,
    totalHoras,
    coordenadora: textoObrigatorio(ajustes.coordenadora, 'coordenadora', 180),
  };
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
  };
}

/**
 * Emite a declaração e devolve o código de conferência.
 *
 * A apuração é refeita aqui para manter a evidência das sessões atualizada. Os
 * ajustes enviados pela gestão são validados e persistidos como conteúdo final
 * da declaração.
 */
export async function emitirDeclaracao(
  organizationId: string,
  usuarioId: string,
  psicologoCadastroId: string,
  ajustes?: AjustesDeclaracao
): Promise<DeclaracaoHoras & { tratamento: string }> {
  exigirPersistenciaDeclaracao();

  const cadastro = await exigirCadastro(psicologoCadastroId);
  const apuracao = await apurar(cadastro, organizationId);
  const valores = ajustes
    ? validarAjustes(ajustes)
    : {
        psicologoNome: cadastro.nomeSocial || cadastro.nomeCompleto,
        psicologoCrp: cadastro.crp,
        tratamento: tratamentoAcademico(cadastro),
        curso: cursoDoCadastro(cadastro),
        periodoInicio: apuracao.periodoInicio,
        periodoFim: apuracao.periodoFim,
        totalHoras: apuracao.totalHoras,
        coordenadora: SIGNATARIOS_DECLARACAO.coordenadora,
      };

  const declaracao = await new DeclaracaoHorasRepository().registrar(
    {
      organizationId,
      psicologoCadastroId: cadastro.id,
      profissionalId: exigirProfissionalRef(cadastro),
      psicologoNome: valores.psicologoNome,
      psicologoCrp: valores.psicologoCrp,
      curso: valores.curso,
      periodoInicio: valores.periodoInicio,
      periodoFim: valores.periodoFim,
      totalSessoes: apuracao.totalSessoes,
      totalHoras: valores.totalHoras,
      sessaoIds: apuracao.sessaoIds,
      coordenadora: valores.coordenadora,
      emitidoPor: usuarioId,
    },
    (codigo, emitidoEm) =>
      calcularHashDeclaracao({
        codigo,
        psicologoNome: valores.psicologoNome,
        psicologoCrp: valores.psicologoCrp,
        curso: valores.curso,
        periodoInicio: valores.periodoInicio,
        periodoFim: valores.periodoFim,
        totalSessoes: apuracao.totalSessoes,
        totalHoras: valores.totalHoras,
        emitidoEm,
        sessaoIds: apuracao.sessaoIds,
      })
  );

  // O tratamento acompanha a resposta sem entrar na linha gravada: ele é
  // concordância do texto impresso, não afirmação sobre horas. Deixá-lo fora
  // do hash mantém a conferência falando só do que ela pode provar.
  return { ...declaracao, tratamento: valores.tratamento };
}

/*
 * Aqui ficava `conferirDeclaracao`, com `ResultadoConferencia` e
 * `SituacaoConferencia`: a conferência pública que recalculava o hash da linha
 * e respondia `valida`, `revogada` ou `adulterada` para quem digitasse o
 * código impresso. Saiu junto com o código do papel — sem nada impresso para
 * conferir, ela não tinha mais quem a chamasse.
 *
 * O hash continua sendo gravado na emissão. É ele que permitiria detectar uma
 * alteração feita direto no banco, se um dia a clínica quiser a conferência de
 * volta; o que se apagou foi a porta de entrada, não a prova.
 */

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
