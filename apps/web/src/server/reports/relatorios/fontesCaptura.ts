import 'server-only';

import { contemTermo, dentroDoPeriodo, type FiltrosAplicados, type LinhaRelatorio } from '@/lib/relatorios/areas';
import { ROTULO_MODO_LISTA_ESPERA } from '@/lib/listaEspera';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { obterPainelTurmas } from '@/server/application/turmasGestao';

/** Psicólogos, turmas e fila: vêm do estado da captação, a mesma fonte do cockpit. */

export function rotuloSituacao(valor: string | undefined): string {
  if (!valor) return '—';
  const texto = valor.replace(/_/g, ' ').toLocaleLowerCase('pt-BR');
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

export async function relatorioPsicologos(filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const { cadastrosPsicologos } = await getCaptureRepository().read();
  return cadastrosPsicologos
    .filter((p) => dentroDoPeriodo(p.criadoEm, filtros.desde, filtros.ate))
    .filter((p) => contemTermo(`${p.nomeCompleto} ${p.nomeSocial ?? ''} ${p.crp}`, filtros.profissional))
    .filter((p) => contemTermo(`${p.posGraduacaoViverMais ?? ''} ${p.segundaPosGraduacao ?? ''}`, filtros.curso))
    .filter((p) => contemTermo(`${p.turmaViverMais ?? ''} ${p.segundaTurmaViverMais ?? ''}`, filtros.turma))
    .map((p) => {
      const ativos = p.pacientesAtivosCount ?? 0;
      const limite = p.limitePacientesAtivos ?? null;
      return {
        nome: p.nomeSocial?.trim() || p.nomeCompleto,
        crp: p.crp,
        situacao: rotuloSituacao(p.status),
        curso: [p.posGraduacaoViverMais, p.segundaPosGraduacao].filter(Boolean).join(' · ') || null,
        turma: [p.turmaViverMais, p.segundaTurmaViverMais].filter(Boolean).join(' · ') || null,
        ativos,
        limite,
        vagas: limite === null ? null : Math.max(limite - ativos, 0),
        rodizio: p.status !== 'APROVADO' ? '—' : p.pausadoNoRodizio ? 'Pausado' : 'Participa',
        cadastro: p.criadoEm,
      };
    })
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

export async function relatorioTurmas(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const painel = await obterPainelTurmas(organizationId);
  return painel.turmas
    .filter((t) => dentroDoPeriodo(t.dataInicio ?? null, filtros.desde, filtros.ate))
    .filter((t) => contemTermo(t.posGraduacao, filtros.curso) && contemTermo(t.codigo, filtros.turma))
    .map((t) => ({
      curso: t.posGraduacao,
      turma: t.codigo,
      situacao: rotuloSituacao(t.situacao),
      inicio: t.dataInicio ?? null,
      encerramento: t.encerradaEm ?? t.dataEncerramentoPrevista ?? null,
      saida: t.saidaEm ?? null,
      psicologos: t.psicologos.length,
      nomes: t.psicologos.map((p) => p.nome).join(', ') || null,
    }));
}

export async function relatorioFila(filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const { triagensPacientes } = await getCaptureRepository().read();
  return triagensPacientes
    .filter((lead) => dentroDoPeriodo(lead.criadoEm, filtros.desde, filtros.ate))
    .filter((lead) => contemTermo(lead.psicologoNome, filtros.profissional))
    .filter((lead) => contemTermo(`${lead.nomePaciente} ${lead.nomeSocial ?? ''} ${lead.protocolo}`, filtros.paciente))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .map((lead) => {
      const espera = lead.listaEspera && !lead.listaEspera.saidaEm
        ? `${ROTULO_MODO_LISTA_ESPERA[lead.listaEspera.modo]}${lead.listaEspera.prioritario ? ' · prioritário' : ''}` : null;
      return {
        protocolo: lead.protocolo,
        paciente: lead.nomeSocial?.trim() || lead.nomePaciente,
        situacao: rotuloSituacao(lead.status),
        servico: lead.servico ?? null,
        profissional: lead.psicologoNome ?? null,
        tipo: lead.tipoAlocacao === 'ESCOLHA_DIRETA' ? 'Escolha na vitrine' : lead.psicologoAlocadoId ? 'Rodízio' : null,
        solicitado: lead.criadoEm,
        oferecido: lead.alocadoEm ?? null,
        aceito: lead.aceitoEm ?? null,
        transbordos: lead.transbordos ?? 0,
        espera,
      };
    });
}
