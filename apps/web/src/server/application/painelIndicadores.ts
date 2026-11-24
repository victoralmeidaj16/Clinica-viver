import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { listEducationalCreditLines } from '@thats-life/core';
import { LIMITE_PACIENTES_PADRAO } from '@/lib/psychologistCapacity';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { intervaloSql } from '@/server/reports/relatorios/fontesAgenda';
import { getApplicationStore } from './store';

/**
 * Indicadores do painel inicial da Gestão (especificação final, 13.04).
 *
 * Cada número diz o período que considera: os de estado ("agora") contam a
 * situação no momento da consulta; os de movimento contam o intervalo
 * escolhido. Todos saem dos mesmos registros dos módulos operacionais — a
 * captação, a agenda, as cobranças e os créditos gravados.
 */

export type PeriodoIndicador = { tipo: 'agora'; em: string } | { tipo: 'intervalo'; desde: string; ate: string };

export interface Indicador {
  chave: string;
  rotulo: string;
  valor: number;
  formato: 'numero' | 'moeda';
  detalhe?: string;
  periodo: PeriodoIndicador;
  href?: string;
}

export interface PainelIndicadores {
  desde: string;
  ate: string;
  indicadores: Indicador[];
}

async function sessoesDoPeriodo(organizationId: string, desde: Date, ate: Date) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.status, COUNT(*) AS total FROM clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND a.inicio >= ? AND a.inicio <= ?
      GROUP BY a.status`,
    [instituicaoId(), organizationId, desde, ate]
  );
  return Object.fromEntries(rows.map((r) => [String(r.status), Number(r.total)])) as Record<string, number>;
}

async function pagamentosDoPeriodo(organizationId: string, desde: Date, ate: Date, agora: Date) {
  const [[recebidos], [vencidas]] = await Promise.all([
    getMysqlPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(valor_centavos), 0) AS soma FROM financeiro_pagamentos
        WHERE instituicao_id = ? AND organizacao_ref = ? AND status = 'confirmed' AND recebido_em >= ? AND recebido_em <= ?`,
      [instituicaoId(), organizationId, desde, ate]
    ),
    getMysqlPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(valor_centavos), 0) AS soma FROM financeiro_cobrancas
        WHERE instituicao_id = ? AND organizacao_ref = ? AND status IN ('pending', 'overdue', 'partially_paid') AND vence_em < ?`,
      [instituicaoId(), organizationId, agora]
    ),
  ]);
  return {
    recebidos: Number(recebidos[0]?.total ?? 0), recebidoCents: Number(recebidos[0]?.soma ?? 0),
    vencidas: Number(vencidas[0]?.total ?? 0), vencidoCents: Number(vencidas[0]?.soma ?? 0),
  };
}

async function pacientesAtivos(organizationId: string): Promise<number | null> {
  if (!isMysqlConfigured()) return null;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM clinica_pacientes pa JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
      WHERE pa.instituicao_id = ? AND o.ref_core = ? AND pa.status = 'ativo'`,
    [instituicaoId(), organizationId]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function montarPainelIndicadores(
  organizationId: string,
  periodo: { desde: string; ate: string },
  agora: Date = new Date()
): Promise<PainelIndicadores> {
  const { desde, ate } = intervaloSql(periodo);
  const instante: PeriodoIndicador = { tipo: 'agora', em: agora.toISOString() };
  const intervalo: PeriodoIndicador = { tipo: 'intervalo', desde: periodo.desde, ate: periodo.ate };
  const { cadastrosPsicologos, triagensPacientes } = await getCaptureRepository().read();

  const aprovados = cadastrosPsicologos.filter((p) => p.status === 'APROVADO');
  const naRoda = aprovados.filter((p) => !p.pausadoNoRodizio);
  const vagas = naRoda.reduce((n, p) => n + Math.max((p.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO) - (p.pacientesAtivosCount ?? 0), 0), 0);
  const aguardandoGestao = triagensPacientes.filter((l) => l.status === 'PENDENTE_ATRIBUICAO').length;
  const ofertas = triagensPacientes.filter((l) => l.status === 'AGUARDANDO_CONTATO' && !l.aceitoEm).length;
  const aceitas = triagensPacientes.filter((l) => l.status === 'AGUARDANDO_CONTATO' && l.aceitoEm).length;
  const espera = triagensPacientes.filter((l) => l.listaEspera && !l.listaEspera.saidaEm).length;
  const novas = triagensPacientes.filter((l) => {
    const t = Date.parse(l.criadoEm);
    return (!desde || t >= desde.getTime()) && (!ate || t <= ate.getTime());
  }).length;

  const indicadores: Indicador[] = [
    { chave: 'psicologos_ativos', rotulo: 'Psicólogos ativos', valor: aprovados.length, formato: 'numero',
      detalhe: `${naRoda.length} no rodízio · ${aprovados.length - naRoda.length} pausados`, periodo: instante, href: '/gestao/psicologos' },
    { chave: 'pacientes_ativos', rotulo: 'Pacientes ativos', formato: 'numero', periodo: instante, href: '/gestao/pacientes',
      valor: (await pacientesAtivos(organizationId).catch(() => null)) ?? aprovados.reduce((n, p) => n + (p.pacientesAtivosCount ?? 0), 0) },
    { chave: 'vagas', rotulo: 'Vagas disponíveis', valor: vagas, formato: 'numero', periodo: instante,
      detalhe: 'Psicólogos no rodízio, pelo limite de cada um' },
    { chave: 'solicitacoes', rotulo: 'Solicitações em andamento', valor: aguardandoGestao + ofertas + aceitas, formato: 'numero', periodo: instante,
      detalhe: `${aguardandoGestao} com a Gestão · ${ofertas} ofertas em aberto · ${aceitas} aceitas sem contato · ${espera} na lista de espera`,
      href: '/gestao/cockpit' },
    { chave: 'solicitacoes_novas', rotulo: 'Solicitações recebidas', valor: novas, formato: 'numero', periodo: intervalo },
  ];

  if (isMysqlConfigured() && desde && ate) {
    const [sessoes, pagamentos] = await Promise.all([
      sessoesDoPeriodo(organizationId, desde, ate).catch(() => null),
      pagamentosDoPeriodo(organizationId, desde, ate, agora).catch(() => null),
    ]);
    if (sessoes) {
      indicadores.push({ chave: 'atendimentos', rotulo: 'Atendimentos realizados', valor: sessoes.realizado ?? 0, formato: 'numero',
        periodo: intervalo, href: '/gestao/relatorios',
        detalhe: `${sessoes.faltou ?? 0} faltas · ${(sessoes.agendado ?? 0) + (sessoes.confirmado ?? 0)} ainda agendadas · ${sessoes.cancelado ?? 0} canceladas` });
    }
    if (pagamentos) {
      indicadores.push(
        { chave: 'recebido', rotulo: 'Pagamentos recebidos', valor: pagamentos.recebidoCents / 100, formato: 'moeda', periodo: intervalo,
          detalhe: `${pagamentos.recebidos} pagamento(s)`, href: '/gestao/financeiro' },
        { chave: 'vencido', rotulo: 'Em aberto e vencido', valor: pagamentos.vencidoCents / 100, formato: 'moeda', periodo: instante,
          detalhe: `${pagamentos.vencidas} cobrança(s)`, href: '/gestao/financeiro' },
      );
    }
  }

  try {
    const filtro = { organizationId, startDate: desde?.toISOString(), endDate: ate?.toISOString() };
    const { financial } = getApplicationStore();
    const creditos = financial.listPersistedCredits
      ? await financial.listPersistedCredits(organizationId, filtro)
      : listEducationalCreditLines(await financial.getLedger({ organizationId }), filtro);
    indicadores.push({ chave: 'creditos', rotulo: 'Créditos Educacionais', formato: 'moeda', periodo: intervalo,
      valor: creditos.reduce((n, l) => n + l.creditCents, 0) / 100,
      detalhe: `${new Set(creditos.map((l) => l.professionalId)).size} psicólogo(s) · ${creditos.length} lançamento(s)`, href: '/gestao/financeiro' });
  } catch (erro) {
    console.warn('[painel] Créditos indisponíveis:', erro instanceof Error ? erro.message : erro);
  }

  return { desde: periodo.desde, ate: periodo.ate, indicadores };
}
