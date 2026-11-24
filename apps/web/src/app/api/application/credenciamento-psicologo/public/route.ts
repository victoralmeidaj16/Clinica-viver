import { NextResponse } from 'next/server';
import { generoProfissional } from '@/lib/gender';
import { foraPorVinculoAcademico } from '@/lib/turmaEncerrada';
import {
  paraPsicologoPerfil,
  publicoEfetivo,
  recalcularPacientesAtivos,
  servicosEfetivos,
} from '@/server/application/viverMaisRodizio';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dados mínimos e públicos de profissionais aprovados para a vitrine. */
export async function GET() {
  try {
    const state = recalcularPacientesAtivos(captureStateAsSnapshot(await getCaptureRepository().read()));
    const agora = new Date();
    const data = (state.cadastrosPsicologos ?? [])
      // Sem vínculo acadêmico válido (turma fora do prazo e nenhuma outra pós
      // aprovada), o perfil some da vitrine junto com a saída do rodízio (1.04).
      .filter(
        (item) =>
          item.status === 'APROVADO' &&
          !item.reconfiguracaoAtendimentoPendente &&
          item.exibirNaVitrine !== false &&
          !foraPorVinculoAcademico(item)
      )
      .map((item) => ({
        id: item.id,
        nome: item.nomeCompleto,
        nomeSocial: item.nomeSocial,
        crp: item.crp,
        estadoUf: item.estadoUf,
        cidade: item.cidade,
        fotoUrl: item.fotoUrl,
        turmaViverMais: item.turmaViverMais,
        posGraduacaoViverMais: item.posGraduacaoViverMais,
        segundaPosGraduacao: item.segundaPosGraduacao,
        especialidades: item.especialidade ? [item.especialidade] : [],
        // Só o que os vínculos válidos permitem no catálogo atual (2.01–2.02).
        servicosHabilitados: servicosEfetivos(item),
        temposAtendimento: item.temposAtendimento ?? [],
        turnosDisponiveis: item.turnosDisponiveis ?? [],
        modalidadesAtendidas: item.modalidadesAtendidas ?? [],
        modalidadeAtendimento: item.modalidadeAtendimento,
        // Só o suficiente para o paciente filtrar por psicólogo ou psicóloga na
        // recomendação: quem não se declarou em um dos dois não expõe nada.
        generoProfissional: generoProfissional(item.genero),
        publicoAlvo: publicoEfetivo(item) ?? [],
        necessidadesAtendidas: item.necessidadesAtendidas ?? [],
        disponivelParaNovosPacientes:
          !paraPsicologoPerfil(item, agora).pausadoNoRodizio &&
          (item.pacientesAtivosCount ?? 0) < (item.limitePacientesAtivos ?? 5),
      }));
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao carregar profissionais da vitrine:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar profissionais.' }, { status: 500 });
  }
}
