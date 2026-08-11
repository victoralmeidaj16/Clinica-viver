import { NextResponse } from 'next/server';
import { readSnapshot, writeSnapshot } from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import {
  aplicarMudancas,
  CAMPOS_DA_GESTAO,
  CorpoInvalidoError,
  validarCorpo,
} from '@/server/application/psychologistRegistration';
import {
  CadastroIncompletoError,
  markWelcomeSent,
  provisionPsychologistAccess,
  validateApprovalAccess,
} from '@/server/application/psychologistAccess';
import { avisarBoasVindasPsicologo } from '@/server/application/viverMaisWhatsApp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Decisões da gestão sobre um cadastro: aprovar, recusar e ligar/desligar do
 * rodízio.
 *
 * O toggle vive aqui, e não numa rota própria, porque é a mesma coisa que a
 * aprovação sob outro nome: as duas respondem "esta pessoa recebe pacientes
 * agora?". Separá-las criaria dois lugares para desligar alguém e a
 * possibilidade de discordarem.
 *
 * Só os campos presentes no corpo são alterados — o `PATCH` é parcial de
 * verdade, para que desligar o perfil não apague, de passagem, os turnos e
 * serviços que a gestão levou tempo cadastrando.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();

    const { id } = await params;
    const corpo = await request.json();

    await validarCorpo(corpo);

    if (isMysqlConfigured()) {
      const atualizado = await new MysqlCaptureRepository().mutate((state) => {
        const existente = state.cadastrosPsicologos.find((psi) => psi.id === id);
        if (!existente) return { next: state, result: null };
        const next = aplicarMudancas(existente, corpo, CAMPOS_DA_GESTAO);
        if (next.status === 'APROVADO') validateApprovalAccess(next);
        return {
          next: {
            ...state,
            cadastrosPsicologos: state.cadastrosPsicologos.map((psi) =>
              psi.id === id ? next : psi
            ),
          },
          result: next,
        };
      });

      if (!atualizado) {
        return NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 });
      }
      let acesso: { criado: boolean; boasVindas: string } | undefined;
      if (atualizado.status === 'APROVADO' && (!atualizado.usuarioRef || !atualizado.boasVindasEnviadaEm)) {
        const provisioned = await provisionPsychologistAccess(atualizado);
        let boasVindas = 'conta_existente';
        if (provisioned.activationToken) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://clinica-viver-web.vercel.app';
          const activationUrl = `${appUrl}/ativar-conta?token=${encodeURIComponent(provisioned.activationToken)}`;
          const delivery = await avisarBoasVindasPsicologo(atualizado, activationUrl);
          boasVindas = delivery.situacao;
          if (delivery.situacao === 'enviada') await markWelcomeSent(atualizado.id);
        }
        acesso = { criado: true, boasVindas };
      }
      return NextResponse.json({ success: true, data: atualizado, acesso });
    }

    const snapshot = readSnapshot();
    const existente = snapshot?.cadastrosPsicologos?.find((psi) => psi.id === id);

    if (!snapshot || !existente) {
      return NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 });
    }

    const atualizado = aplicarMudancas(existente, corpo, CAMPOS_DA_GESTAO);

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      cadastrosPsicologos: (snapshot.cadastrosPsicologos ?? []).map((psi) =>
        psi.id === id ? atualizado : psi
      ),
    });

    return NextResponse.json({ success: true, data: atualizado });
  } catch (error) {
    if (error instanceof CorpoInvalidoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof CadastroIncompletoError) {
      return NextResponse.json({ success: false, error: error.message, campos: error.campos }, { status: 422 });
    }
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao atualizar cadastro de psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar o cadastro.' }, { status: 500 });
  }
}
