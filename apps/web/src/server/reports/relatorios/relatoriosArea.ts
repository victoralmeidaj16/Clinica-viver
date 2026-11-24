import 'server-only';

import { ROTULO_MODULO } from '@/lib/auditoria';
import { avisoDoCatalogo, ROTULO_CANAL, ROTULO_DESTINATARIO, type CanalAviso, type DestinatarioAviso } from '@/lib/avisos/catalogo';
import { areaRelatorio, type AreaRelatorio, type FiltrosAplicados, type LinhaRelatorio } from '@/lib/relatorios/areas';
import { listarAlteracoes } from '@/server/application/auditoriaAlteracoes';
import { ApplicationError } from '@/server/application/http';
import { listarEnviosDeAvisos } from '@/server/communication/avisosEnviosRepository';
import { intervaloSql, relatorioHorasEstagio, relatorioPacientes, relatorioSessoes } from './fontesAgenda';
import { relatorioFila, relatorioPsicologos, relatorioTurmas } from './fontesCaptura';
import { relatorioConvenios, relatorioCreditos, relatorioFinanceiro } from './fontesFinanceiro';

/** Monta o relatório de uma área com os filtros que ela aceita (13.05). */

export interface RelatorioDaArea {
  area: AreaRelatorio;
  filtros: FiltrosAplicados;
  linhas: LinhaRelatorio[];
  geradoEm: string;
}

const SITUACAO_ENVIO: Record<string, string> = {
  enviada: 'Entregue ao provedor', registrado: 'Registrado no painel', falha: 'Falhou',
  bloqueada_allowlist: 'Telefone recusado', provedor_desconfigurado: 'Integração desligada', destinatario_invalido: 'Destino inválido',
};

async function relatorioAlteracoes(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const { desde, ate } = intervaloSql(filtros);
  const alteracoes = await listarAlteracoes(organizationId, { modulo: filtros.modulo || undefined, desde, ate, limite: 2000 });
  return alteracoes.flatMap((item): LinhaRelatorio[] => {
    const base = {
      data: item.criadoEm, modulo: ROTULO_MODULO[item.modulo] ?? item.modulo,
      registro: item.entidadeRotulo ?? item.entidadeRef, acao: item.acao.replace(/_/g, ' '),
      motivo: item.motivo ?? null, autor: item.autorNome ?? item.autorRef ?? null,
    };
    if (!item.campos.length) return [{ ...base, campo: null, anterior: null, novo: null }];
    return item.campos.map((campo) => ({ ...base, campo: campo.rotulo, anterior: campo.anterior, novo: campo.novo }));
  });
}

async function relatorioAvisos(filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const { desde, ate } = intervaloSql(filtros);
  return (await listarEnviosDeAvisos({ desde, ate, limite: 1000 })).map((envio) => ({
    data: envio.criadoEm,
    aviso: avisoDoCatalogo(envio.finalidade)?.titulo ?? envio.finalidade.replace(/_/g, ' '),
    destinatario: ROTULO_DESTINATARIO[envio.destinatarioTipo as DestinatarioAviso] ?? envio.destinatarioTipo,
    canal: `${ROTULO_CANAL[envio.canal as CanalAviso] ?? envio.canal}${envio.destinoFinal ? ` · final ${envio.destinoFinal}` : ''}`,
    situacao: SITUACAO_ENVIO[envio.situacao] ?? envio.situacao,
    versao: envio.modeloVersao ? `v${envio.modeloVersao}` : 'padrão',
    referencia: envio.referencia ?? null,
  }));
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Lê os filtros da URL, descartando os que a área não aceita. */
export function filtrosDaUrl(area: AreaRelatorio, params: URLSearchParams): FiltrosAplicados {
  const texto = (nome: string) => params.get(nome)?.trim().slice(0, 120) || undefined;
  const filtros: FiltrosAplicados = {};
  if (area.filtros.includes('periodo')) {
    const desde = texto('desde');
    const ate = texto('ate');
    if (desde && !DATA.test(desde)) throw new ApplicationError('INVALID_INPUT', 'Data inicial inválida.', 400);
    if (ate && !DATA.test(ate)) throw new ApplicationError('INVALID_INPUT', 'Data final inválida.', 400);
    if (desde && ate && desde > ate) throw new ApplicationError('INVALID_INPUT', 'A data inicial é posterior à final.', 400);
    filtros.desde = desde;
    filtros.ate = ate;
  }
  for (const nome of ['profissional', 'paciente', 'curso', 'turma', 'empresa', 'modulo'] as const) {
    if (area.filtros.includes(nome)) filtros[nome] = texto(nome);
  }
  return filtros;
}

export async function montarRelatorio(organizationId: string, areaId: string, params: URLSearchParams): Promise<RelatorioDaArea> {
  const area = areaRelatorio(areaId);
  if (!area) throw new ApplicationError('INVALID_INPUT', 'Escolha uma área de relatório.', 400);
  const filtros = filtrosDaUrl(area, params);
  const linhas = await (async (): Promise<LinhaRelatorio[]> => {
    switch (area.id) {
      case 'psicologos': return relatorioPsicologos(filtros);
      case 'turmas': return relatorioTurmas(organizationId, filtros);
      case 'pacientes': return relatorioPacientes(organizationId, filtros);
      case 'fila': return relatorioFila(filtros);
      case 'agendamentos': return relatorioSessoes(organizationId, filtros, false);
      case 'atendimentos': return relatorioSessoes(organizationId, filtros, true);
      case 'horas_estagio': return relatorioHorasEstagio(organizationId, filtros);
      case 'financeiro': return relatorioFinanceiro(organizationId, filtros);
      case 'convenios': return relatorioConvenios(organizationId, filtros);
      case 'creditos': return relatorioCreditos(organizationId, filtros);
      case 'alteracoes': return relatorioAlteracoes(organizationId, filtros);
      case 'avisos': return relatorioAvisos(filtros);
    }
  })();
  return { area, filtros, linhas, geradoEm: new Date().toISOString() };
}
