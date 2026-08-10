import { NextResponse } from 'next/server';
import { readSnapshot } from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modalidadeFiltro = searchParams.get('modalidade') || 'TODAS';

    const snapshot = readSnapshot();
    const capture = isMysqlConfigured() ? await new MysqlCaptureRepository().read() : null;

    let triagens = capture?.triagensPacientes ?? snapshot?.triagensPacientes ?? [];
    const sessoes = snapshot?.sessions ?? [];
    const psicologos = capture?.cadastrosPsicologos ?? snapshot?.cadastrosPsicologos ?? [];
    const ledgerAlunos = snapshot?.ledgerAlunos ?? [];

    // Aplicar filtro de modalidade se fornecido
    if (modalidadeFiltro !== 'TODAS') {
      triagens = triagens.filter((t) => t.modalidade === modalidadeFiltro || t.servicoKey === modalidadeFiltro);
    }

    const totalLeads = triagens.length;

    // 1. Fila de Espera (Psicólogos Ativos)
    const psicologosAtivosCount = psicologos.filter((p) => p.status === 'APROVADO' && p.exibirNaVitrine !== false).length;

    // 2. SLA 24h WhatsApp (Cálculo real de cumprimento)
    const triagensComSla = triagens.filter((t) => t.alocadoEm);
    const triagensNoPrazo = triagensComSla.filter((t) => !t.slaExpirado);
    const slaPercentual = triagensComSla.length > 0
      ? Number(((triagensNoPrazo.length / triagensComSla.length) * 100).toFixed(1))
      : 100;

    // 3. Gênero (Cálculo dinâmico)
    const feminino = triagens.filter((t) => t.genero === 'FEMININO').length;
    const masculino = triagens.filter((t) => t.genero === 'MASCULINO').length;
    const pctFem = totalLeads > 0 ? Math.round((feminino / totalLeads) * 100) : 0;
    const pctMasc = totalLeads > 0 ? Math.round((masculino / totalLeads) * 100) : 0;

    // 4. Faixa Etária Predominante (Cálculo dinâmico por idade)
    let faixaEtariaPredominante = 'Sem registros suficientes';
    if (totalLeads > 0) {
      let jovens = 0; // 18 a 28
      let adultos = 0; // 29 a 42
      let maduros = 0; // 43+
      triagens.forEach((t) => {
        const numIdade = parseInt(t.idade || '0', 10);
        if (numIdade >= 18 && numIdade <= 28) jovens++;
        else if (numIdade >= 29 && numIdade <= 42) adultos++;
        else if (numIdade >= 43) maduros++;
      });

      if (jovens >= adultos && jovens >= maduros && jovens > 0) {
        faixaEtariaPredominante = `18 a 28 anos (${Math.round((jovens / totalLeads) * 100)}%)`;
      } else if (adultos >= jovens && adultos >= maduros && adultos > 0) {
        faixaEtariaPredominante = `29 a 42 anos (${Math.round((adultos / totalLeads) * 100)}%)`;
      } else if (maduros > 0) {
        faixaEtariaPredominante = `43+ anos (${Math.round((maduros / totalLeads) * 100)}%)`;
      }
    }

    // 5. Origem dos Leads (Cálculo dinâmico)
    const origensCount: Record<string, number> = {};
    triagens.forEach((t) => {
      const orig = t.origem || 'Vitrine';
      origensCount[orig] = (origensCount[orig] || 0) + 1;
    });
    const origensFormatadas = Object.entries(origensCount)
      .map(([orig, count]) => `${orig} (${Math.round((count / (totalLeads || 1)) * 100)}%)`)
      .join(' | ') || 'Formulário Vitrine (100%)';

    // 6. Atendimentos no Mês
    const totalAtendimentosMes = sessoes.length;

    // 7. Modalidades (Social vs Particular)
    const sociais = triagens.filter((t) => t.modalidade === 'SOCIAL' || t.modalidade === 'ACESSIVEL_SOCIAL' || !t.modalidade).length;
    const pctSocial = totalLeads > 0 ? Math.round((sociais / totalLeads) * 100) : 0;
    const pctParticular = totalLeads > 0 ? 100 - pctSocial : 0;

    // 8. Split 70/30 e Valores Reais do Ledger Aluno
    let totalCreditoAlunos70 = 0;
    let totalReceitaClinica30 = 0;

    if (ledgerAlunos.length > 0) {
      ledgerAlunos.forEach((item) => {
        totalCreditoAlunos70 += item.valorCreditoAluno;
        totalReceitaClinica30 += item.valorReceitaClinica;
      });
    } else if (sessoes.length > 0) {
      // Se houver sessões cadastradas, calcula o split 70/30 sobre os valores das sessões (Padrão R$ 75,00)
      sessoes.forEach(() => {
        const val = 75;
        totalCreditoAlunos70 += Math.round(val * 0.7 * 100) / 100;
        totalReceitaClinica30 += Math.round(val * 0.3 * 100) / 100;
      });
    }

    // 9. Convênios Ativos
    const conveniados = triagens.filter((t) => t.possuiConvenio === 'SIM').length;

    return NextResponse.json({
      success: true,
      data: {
        filaEsperaPsicologos: psicologosAtivosCount || psicologos.length,
        slaPercentual,
        generoPct: { feminino: pctFem, masculino: pctMasc },
        faixaEtariaPredominante,
        origemLeads: origensFormatadas,
        totalAtendimentosMes,
        modalidadesPct: { social: pctSocial, particular: pctParticular },
        faixaValor: 'R$ 75,00 a R$ 130,00',
        cacEstimado: totalLeads > 0 ? `R$ ${(1200 / totalLeads).toFixed(2)} / Lead` : 'R$ 0,00',
        conveniosAtivosCount: conveniados,
        totalLogsAuditados: totalLeads + sessoes.length,
        split7030: {
          creditoAlunosTotal: totalCreditoAlunos70,
          receitaClinicaTotal: totalReceitaClinica30,
          faturamentoBrutoTotal: totalCreditoAlunos70 + totalReceitaClinica30,
        },
      },
    });
  } catch (error) {
    console.error('Erro ao calcular indicadores reais:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar indicadores' }, { status: 500 });
  }
}
