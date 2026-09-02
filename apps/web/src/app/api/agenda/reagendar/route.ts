import { NextResponse } from 'next/server';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import {
  identifyPatient,
  rescheduleAppointmentPublic,
} from '@/server/scheduling/agendaRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (rateLimited(request, 'agenda-reagendar')) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token ?? '').trim();
    const cpf = String(body.cpf ?? '').replace(/\D/g, '');
    const appointmentId = String(body.appointmentId ?? body.agendamentoId ?? '').trim();
    const inicio = String(body.inicio ?? '').trim();

    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: 'Link de agendamento inválido.' }, { status: 404 });
    }
    if (!validCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    }
    if (!appointmentId) {
      return NextResponse.json({ error: 'Identificador do agendamento não informado.' }, { status: 400 });
    }
    if (!inicio || Number.isNaN(Date.parse(inicio))) {
      return NextResponse.json({ error: 'Horário de início inválido.' }, { status: 400 });
    }

    const paciente = await identifyPatient(token, cpf);
    if (!paciente) {
      return NextResponse.json(
        {
          error:
            'Não encontramos este CPF entre os pacientes vinculados ao psicólogo. Confira os dados ou fale com a clínica.',
        },
        { status: 404 }
      );
    }

    const resultado = await rescheduleAppointmentPublic(paciente, appointmentId, inicio);
    if (!resultado.ok) {
      if (resultado.motivo === 'PRAZO_EXPIRADO') {
        return NextResponse.json(
          {
            error:
              'O reagendamento online requer antecedência mínima de 2 horas. Entre em contato diretamente com o psicólogo.',
          },
          { status: 400 }
        );
      }
      if (resultado.motivo === 'NAO_ENCONTRADO') {
        return NextResponse.json({ error: 'Agendamento não encontrado para este paciente.' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Este horário acabou de ser preenchido ou está indisponível. Por favor, escolha outro.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        inicio: resultado.inicio,
        fim: resultado.fim,
        modalidade: resultado.modalidade,
        linkPagamento: resultado.linkPagamento,
        mensagem: 'Sessão reagendada com sucesso!',
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[agenda] Falha ao reagendar:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Não foi possível reagendar a sessão agora.' }, { status: 500 });
  }
}
