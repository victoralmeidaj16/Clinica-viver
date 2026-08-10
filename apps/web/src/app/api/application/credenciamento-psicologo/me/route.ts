import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { getApplicationStore } from '@/server/application/store';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { readSnapshot } from '@/server/application/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Retorna somente o cadastro ligado ao e-mail da conta profissional. */
export async function GET() {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ success: false, error: 'Faça login para acompanhar o cadastro.' }, { status: 401 });

    const store = getApplicationStore();
    const membership = await store.identities.findMembershipByUser(session.organizationId, session.userId);
    if (!membership || membership.status !== 'active' || membership.roles.some((role) => role === 'owner' || role === 'admin')) {
      return NextResponse.json({ success: false, error: 'Acesso disponível apenas para psicólogos.' }, { status: 403 });
    }

    const user = await store.identities.getUser(session.userId);
    const email = user?.normalizedEmail?.trim().toLocaleLowerCase('pt-BR');
    const state = isMysqlConfigured() ? await new MysqlCaptureRepository().read() : readSnapshot();
    const cadastro = state?.cadastrosPsicologos?.find(
      (item) => email && item.email?.trim().toLocaleLowerCase('pt-BR') === email
    );

    return NextResponse.json({ success: true, data: cadastro ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao carregar cadastro do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar seu cadastro.' }, { status: 500 });
  }
}
