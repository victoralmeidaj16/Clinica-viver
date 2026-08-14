import { NextResponse } from 'next/server';
import { getPublicAgendaProfile } from '@/server/scheduling/agendaRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cabeçalho do link de marcação: só o nome de quem atende.
 *
 * Nada de agenda aqui. Os horários livres exigem CPF de paciente vinculado —
 * um link vazado não pode virar um retrato da rotina do profissional.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: 'Link de agendamento inválido.' }, { status: 404 });
  }
  try {
    const profile = await getPublicAgendaProfile(token);
    if (!profile) {
      return NextResponse.json({ error: 'Link de agendamento inválido.' }, { status: 404 });
    }
    return NextResponse.json(
      { professionalName: profile.professionalName },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[agenda] Falha ao carregar perfil:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Não foi possível carregar a agenda agora.' }, { status: 500 });
  }
}
