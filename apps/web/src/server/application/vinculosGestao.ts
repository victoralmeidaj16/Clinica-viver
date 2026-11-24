import 'server-only';

import { normalizarCodigoTurma, dataValida } from '@/lib/turmasCiclo';
import type { DecisaoVinculo, EventoVinculo, PapelVinculo, StatusVinculo } from '@/lib/vinculoAcademico';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { AutorDaSessao } from './autorGestao';
import { ApplicationError } from './http';
import type { CadastroPsicologoRecord } from './persistence';

/**
 * Aprovação e validade de cada vínculo acadêmico pela Gestão (especificação
 * final, 1.01 passo 6, 2.02, 3.2 e 3.10). Aprovar libera as permissões do
 * curso daquele vínculo; pendente ou recusado não libera serviço novo, sem
 * mexer nas permissões do outro vínculo.
 */

export type ResultadoVinculo = { ok: true; cadastro: CadastroPsicologoRecord } | { ok: false; erro: string };

const MAXIMO_HISTORICO = 50;

export function decidirVinculo(
  cadastro: CadastroPsicologoRecord,
  corpo: Record<string, unknown>,
  autor: AutorDaSessao,
  agora: Date = new Date()
): ResultadoVinculo {
  const papel = corpo.papel as PapelVinculo;
  if (papel !== 'PRINCIPAL' && papel !== 'SEGUNDA') return { ok: false, erro: 'Informe qual vínculo: principal ou segunda pós.' };
  const posGraduacao = papel === 'PRINCIPAL' ? cadastro.posGraduacaoViverMais : cadastro.segundaPosGraduacao;
  if (!posGraduacao) return { ok: false, erro: 'Este cadastro não tem essa pós-graduação.' };
  const anterior = cadastro.vinculosAcademicos?.[papel];
  const vigente = anterior?.posGraduacao === posGraduacao ? anterior : undefined;
  const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim().slice(0, 500) || undefined : undefined;
  const base = {
    posGraduacao,
    decididoEm: agora.toISOString(),
    decididoPorUsuarioRef: autor.usuarioRef,
    ...(autor.nome ? { decididoPorNome: autor.nome } : {}),
  };

  let decisao: DecisaoVinculo | undefined = vigente;
  let turma: string | undefined;
  let mudancas: Partial<CadastroPsicologoRecord> = {};

  if (corpo.acao === 'TURMA') {
    turma = normalizarCodigoTurma(corpo.turma);
    if (!turma) return { ok: false, erro: 'Informe a turma, por exemplo 26A.' };
    mudancas = papel === 'PRINCIPAL' ? { turmaViverMais: turma } : { segundaTurmaViverMais: turma };
  } else {
    const status = corpo.status as StatusVinculo;
    if (status !== 'APROVADO' && status !== 'PENDENTE' && status !== 'RECUSADO') {
      return { ok: false, erro: 'Escolha aprovar, deixar pendente ou recusar o vínculo.' };
    }
    if (status === 'RECUSADO' && !motivo) return { ok: false, erro: 'Informe o motivo da recusa do vínculo.' };
    const validoAte = corpo.validoAte === undefined ? vigente?.validoAte
      : corpo.validoAte === null || corpo.validoAte === '' ? undefined : dataValida(corpo.validoAte);
    if (corpo.validoAte && !validoAte) return { ok: false, erro: 'Informe a validade no formato AAAA-MM-DD.' };
    decisao = { ...base, status, ...(motivo ? { motivo } : {}), ...(validoAte ? { validoAte } : {}) };
  }

  const evento: EventoVinculo = {
    ...base,
    papel,
    status: decisao?.status ?? (cadastro.status === 'APROVADO' ? 'APROVADO' : cadastro.status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE'),
    ...(motivo ? { motivo } : {}),
    ...(decisao?.validoAte ? { validoAte: decisao.validoAte } : {}),
    ...(turma ? { turma } : {}),
  };
  const historico = [...(cadastro.vinculosAcademicos?.historico ?? []), evento].slice(-MAXIMO_HISTORICO);
  return {
    ok: true,
    cadastro: {
      ...cadastro,
      ...mudancas,
      vinculosAcademicos: {
        ...(cadastro.vinculosAcademicos ?? {}),
        ...(decisao ? { [papel]: decisao } : {}),
        historico,
      },
    },
  };
}

export async function decidirVinculoDoCadastro(
  cadastroId: string,
  corpo: Record<string, unknown>,
  autor: AutorDaSessao
): Promise<CadastroPsicologoRecord> {
  return getCaptureRepository().mutate((state) => {
    const cadastro = state.cadastrosPsicologos.find((item) => item.id === cadastroId);
    if (!cadastro) throw new ApplicationError('NOT_FOUND', 'Cadastro não encontrado.', 404);
    const resultado = decidirVinculo(cadastro, corpo, autor);
    if (!resultado.ok) throw new ApplicationError('INVALID_INPUT', resultado.erro, 400);
    return {
      next: { ...state, cadastrosPsicologos: state.cadastrosPsicologos.map((item) => (item.id === cadastroId ? resultado.cadastro : item)) },
      result: resultado.cadastro,
    };
  });
}
