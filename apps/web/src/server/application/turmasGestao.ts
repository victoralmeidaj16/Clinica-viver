import 'server-only';

import { cursoNoCatalogo, type CursoPos } from '@/components/forms/opcoesPsicologo';
import { chaveTurma, hojeEmBrasilia, TURMAS_ATIVAS } from '@/lib/turmaEncerrada';
import {
  dataDeSaida,
  dataValida,
  diasEntre,
  lerAvisosTurma,
  lerPrazoSaida,
  normalizarCodigoTurma,
  situacaoDaTurma,
  type AcaoTurma,
  type AvisosTurma,
  type EventoTurma,
  type PrazoSaidaTurma,
  type SituacaoTurma,
  type TurmaRegistro,
} from '@/lib/turmasCiclo';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { CHAVE_AVISOS_TURMAS, CHAVE_PRAZO_SAIDA_TURMAS } from '@/server/persistence/turmasEncerradas';
import { getTurmasRepository, novoIdDeTurma } from '@/server/persistence/turmasRepository';
import type { AutorDaSessao } from './autorGestao';
import { obterCatalogoCursos } from './catalogoCursos';
import { gravarConfiguracaoGestao, lerConfiguracaoGestao } from './configuracaoGestao';
import { ApplicationError } from './http';

/**
 * Turmas administradas pela Gestão (especificação final, 1.01–1.05): criar,
 * editar, encerrar, reabrir, alterar datas, prorrogar ou antecipar a saída e
 * interromper a retirada. Cada ação entra no histórico da turma com autor e
 * data, e a situação dos psicólogos é recalculada na próxima leitura.
 */

export type AcaoGestaoTurma =
  | 'CRIAR' | 'EDITAR' | 'ENCERRAR' | 'REABRIR' | 'ALTERAR_ENCERRAMENTO'
  | 'ALTERAR_SAIDA' | 'INTERROMPER_RETIRADA' | 'RETOMAR_RETIRADA';

export type ResultadoAcaoTurma = { ok: true; turma: TurmaRegistro } | { ok: false; erro: string; status?: number };

function texto(valor: unknown, maximo = 300): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim().replace(/\s+/g, ' ').slice(0, maximo) : undefined;
}

/**
 * Aplica uma ação ao cadastro de turmas, sem gravar. Pura, para os testes
 * conferirem as regras sem banco.
 */
export function aplicarAcaoTurma(
  turmas: readonly TurmaRegistro[],
  corpo: Record<string, unknown>,
  autor: AutorDaSessao,
  catalogo: readonly CursoPos[],
  agora: Date = new Date(),
  novoId: () => string = novoIdDeTurma
): ResultadoAcaoTurma {
  const acao = corpo.acao as AcaoGestaoTurma;
  const evento = (tipo: AcaoTurma, detalhe?: string): EventoTurma => ({
    acao: tipo, em: agora.toISOString(), porUsuarioRef: autor.usuarioRef,
    ...(autor.nome ? { porNome: autor.nome } : {}), ...(detalhe ? { detalhe } : {}),
  });
  const datas = (): { dataInicio?: string; dataEncerramentoPrevista?: string } | string => {
    const inicio = corpo.dataInicio ? dataValida(corpo.dataInicio) : undefined;
    const fim = corpo.dataEncerramentoPrevista ? dataValida(corpo.dataEncerramentoPrevista) : undefined;
    if ((corpo.dataInicio && !inicio) || (corpo.dataEncerramentoPrevista && !fim)) return 'Informe as datas no formato AAAA-MM-DD.';
    if (inicio && fim && fim < inicio) return 'O encerramento previsto não pode ser antes do início.';
    return { ...(inicio ? { dataInicio: inicio } : {}), ...(fim ? { dataEncerramentoPrevista: fim } : {}) };
  };

  if (acao === 'CRIAR') {
    const posGraduacao = texto(corpo.posGraduacao, 255);
    const codigo = normalizarCodigoTurma(corpo.codigo);
    if (!posGraduacao || !cursoNoCatalogo(posGraduacao, catalogo)) return { ok: false, erro: 'Selecione uma pós-graduação do catálogo.' };
    if (!codigo) return { ok: false, erro: 'Informe a identificação da turma, por exemplo 26A.' };
    if (turmas.some((turma) => chaveTurma({ turma: turma.codigo, posGraduacao: turma.posGraduacao }) === chaveTurma({ turma: codigo, posGraduacao }))) {
      return { ok: false, erro: 'Esta turma já está cadastrada para o curso.', status: 409 };
    }
    const periodo = datas();
    if (typeof periodo === 'string') return { ok: false, erro: periodo };
    return { ok: true, turma: { id: novoId(), posGraduacao, codigo, ...periodo, historico: [evento('CRIADA')] } };
  }

  const turma = turmas.find((item) => item.id === corpo.id);
  if (!turma) return { ok: false, erro: 'Turma não encontrada.', status: 404 };
  const com = (mudanca: Partial<TurmaRegistro>, tipo: AcaoTurma, detalhe?: string): ResultadoAcaoTurma => ({
    ok: true, turma: { ...turma, ...mudanca, historico: [...turma.historico, evento(tipo, detalhe)] },
  });

  switch (acao) {
    case 'EDITAR': {
      const periodo = datas();
      if (typeof periodo === 'string') return { ok: false, erro: periodo };
      return com({ dataInicio: periodo.dataInicio, dataEncerramentoPrevista: periodo.dataEncerramentoPrevista }, 'EDITADA',
        `Início ${periodo.dataInicio ?? '—'}, encerramento previsto ${periodo.dataEncerramentoPrevista ?? '—'}`);
    }
    case 'ENCERRAR': {
      if (turma.encerradaEm) return { ok: false, erro: 'A turma já está encerrada.', status: 409 };
      const encerradaEm = corpo.encerradaEm ? dataValida(corpo.encerradaEm) : hojeEmBrasilia(agora);
      if (!encerradaEm) return { ok: false, erro: 'Informe a data de encerramento no formato AAAA-MM-DD.' };
      return com({ encerradaEm, saidaManual: undefined, retiradaInterrompida: undefined }, 'ENCERRADA', `Encerrada em ${encerradaEm}`);
    }
    case 'REABRIR':
      if (!turma.encerradaEm) return { ok: false, erro: 'A turma já está aberta.', status: 409 };
      return com({ encerradaEm: undefined, saidaManual: undefined, retiradaInterrompida: undefined }, 'REABERTA',
        texto(corpo.motivo));
    case 'ALTERAR_ENCERRAMENTO': {
      const encerradaEm = dataValida(corpo.encerradaEm);
      if (!turma.encerradaEm) return { ok: false, erro: 'Encerre a turma antes de alterar a data.', status: 409 };
      if (!encerradaEm) return { ok: false, erro: 'Informe a data de encerramento no formato AAAA-MM-DD.' };
      return com({ encerradaEm }, 'ENCERRAMENTO_ALTERADO', `${turma.encerradaEm} → ${encerradaEm}`);
    }
    case 'ALTERAR_SAIDA': {
      if (!turma.encerradaEm) return { ok: false, erro: 'A saída só existe para turma encerrada.', status: 409 };
      const saida = corpo.saidaEm === null || corpo.saidaEm === '' ? undefined : dataValida(corpo.saidaEm);
      if (corpo.saidaEm && !saida) return { ok: false, erro: 'Informe a data de saída no formato AAAA-MM-DD.' };
      if (saida && saida < turma.encerradaEm) return { ok: false, erro: 'A saída não pode ser antes do encerramento.' };
      const motivo = texto(corpo.motivo);
      if (!motivo) return { ok: false, erro: 'Informe o motivo da alteração da data de saída.' };
      return com({ saidaManual: saida }, 'SAIDA_ALTERADA', `${saida ? `Saída em ${saida}` : 'Volta ao prazo configurado'}: ${motivo}`);
    }
    case 'INTERROMPER_RETIRADA': {
      if (!turma.encerradaEm) return { ok: false, erro: 'A retirada só existe para turma encerrada.', status: 409 };
      const motivo = texto(corpo.motivo);
      if (!motivo) return { ok: false, erro: 'Informe o motivo da interrupção.' };
      return com({ retiradaInterrompida: true }, 'RETIRADA_INTERROMPIDA', motivo);
    }
    case 'RETOMAR_RETIRADA':
      if (!turma.retiradaInterrompida) return { ok: false, erro: 'A retirada não está interrompida.', status: 409 };
      return com({ retiradaInterrompida: undefined }, 'RETIRADA_RETOMADA', texto(corpo.motivo));
    default:
      return { ok: false, erro: 'Ação desconhecida para a turma.' };
  }
}

export interface PsicologoDaTurma { id: string; nome: string; papel: 'PRINCIPAL' | 'SEGUNDA'; aprovado: boolean }

export interface TurmaParaGestao extends TurmaRegistro {
  situacao: SituacaoTurma;
  saidaEm?: string;
  diasRestantes?: number;
  psicologos: PsicologoDaTurma[];
}

export interface PainelTurmas {
  turmas: TurmaParaGestao[];
  prazo: PrazoSaidaTurma;
  avisos: AvisosTurma;
  /** `false` sem a migration 092: o painel mostra o aviso e não grava. */
  cadastroDisponivel: boolean;
}

export async function obterPrazoEAvisos(organizationId: string): Promise<{ prazo: PrazoSaidaTurma; avisos: AvisosTurma }> {
  const [prazo, avisos] = await Promise.all([
    lerConfiguracaoGestao<unknown>(organizationId, CHAVE_PRAZO_SAIDA_TURMAS),
    lerConfiguracaoGestao<unknown>(organizationId, CHAVE_AVISOS_TURMAS),
  ]);
  return { prazo: lerPrazoSaida(prazo.valor), avisos: lerAvisosTurma(avisos.valor) };
}

export async function obterPainelTurmas(organizationId: string): Promise<PainelTurmas> {
  const [registro, { prazo, avisos }, captura] = await Promise.all([
    getTurmasRepository().listar(),
    obterPrazoEAvisos(organizationId),
    getCaptureRepository().read(),
  ]);
  const hoje = hojeEmBrasilia();
  const turmas = (registro ?? []).map((turma): TurmaParaGestao => {
    const saidaEm = dataDeSaida(turma, prazo);
    const chave = chaveTurma({ turma: turma.codigo, posGraduacao: turma.posGraduacao });
    const psicologos = captura.cadastrosPsicologos.flatMap((cadastro): PsicologoDaTurma[] => {
      const nome = cadastro.nomeSocial?.trim() || cadastro.nomeCompleto;
      return (cadastro.situacaoAcademica?.vinculos ?? [])
        .filter((vinculo) => vinculo.turma && chaveTurma({ turma: vinculo.turma, posGraduacao: vinculo.posGraduacao }) === chave)
        .map((vinculo) => ({ id: cadastro.id, nome, papel: vinculo.papel, aprovado: vinculo.status === 'APROVADO' }));
    });
    return {
      ...turma,
      situacao: situacaoDaTurma(turma, prazo, hoje),
      ...(saidaEm ? { saidaEm, diasRestantes: diasEntre(hoje, saidaEm) } : {}),
      psicologos,
    };
  });
  return { turmas, prazo, avisos, cadastroDisponivel: registro !== null };
}

export async function executarAcaoTurma(
  organizationId: string,
  corpo: Record<string, unknown>,
  autor: AutorDaSessao
): Promise<TurmaRegistro> {
  const repositorio = getTurmasRepository();
  const turmas = await repositorio.listar();
  if (turmas === null) throw new ApplicationError('UNAVAILABLE', 'O cadastro de turmas requer a migration 092_turmas.sql.', 503);
  const resultado = aplicarAcaoTurma(turmas, corpo, autor, await obterCatalogoCursos(organizationId));
  if (!resultado.ok) throw new ApplicationError('INVALID_INPUT', resultado.erro, resultado.status ?? 400);
  await repositorio.salvar(resultado.turma);
  return resultado.turma;
}

export async function salvarConfiguracaoTurmas(
  organizationId: string,
  corpo: Record<string, unknown>,
  autor: AutorDaSessao
): Promise<{ prazo: PrazoSaidaTurma; avisos: AvisosTurma }> {
  if (corpo.prazo !== undefined) {
    const prazo = lerPrazoSaida(corpo.prazo);
    const enviado = corpo.prazo as Record<string, unknown>;
    if (Number(enviado?.quantidade) !== prazo.quantidade || (enviado?.unidade !== prazo.unidade)) {
      throw new ApplicationError('INVALID_INPUT', 'Informe o prazo em meses (até 24) ou dias (até 730).', 400);
    }
    await gravarConfiguracaoGestao(organizationId, CHAVE_PRAZO_SAIDA_TURMAS, prazo, autor);
  }
  if (corpo.avisos !== undefined) {
    await gravarConfiguracaoGestao(organizationId, CHAVE_AVISOS_TURMAS, lerAvisosTurma(corpo.avisos), autor);
  }
  return obterPrazoEAvisos(organizationId);
}

/**
 * Turmas oferecidas no cadastro de cada curso (1.01, passos 1–3): as abertas
 * cadastradas pela Gestão. Curso ainda sem turma cadastrada (ou banco sem a
 * migration 092) oferece a lista anterior, para a inscrição não travar.
 */
export async function turmasAbertasPorCurso(catalogo: readonly CursoPos[]): Promise<Record<string, string[]>> {
  const registro = await getTurmasRepository().listar().catch(() => null);
  return Object.fromEntries(catalogo.map((curso) => {
    const doCurso = (registro ?? []).filter((turma) => turma.posGraduacao === curso.nome);
    const abertas = doCurso.filter((turma) => !turma.encerradaEm).map((turma) => turma.codigo).sort();
    return [curso.nome, doCurso.length ? abertas : [...TURMAS_ATIVAS]];
  }));
}
