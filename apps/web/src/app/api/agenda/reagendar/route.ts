import { NextResponse } from 'next/server';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import {
  getContatosDaSessao,
  identifyPatient,
} from '@/server/scheduling/agendaRepository';
import { requestPatientReschedule } from '@/server/scheduling/rescheduleRequestRepository';
import { avisarSolicitacaoReagendamentoPsicologo } from '@/server/scheduling/agendaAvisos';

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

    const resultado = await requestPatientReschedule(paciente, appointmentId, inicio);
    if (!resultado.ok) {
      if (resultado.reason === 'TOO_LATE') {
        return NextResponse.json(
          {
            error:
              'O reagendamento online requer antecedência mínima de 2 horas. Entre em contato diretamente com o psicólogo.',
          },
          { status: 400 }
        );
      }
      if (resultado.reason === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Agendamento não encontrado para este paciente.' }, { status: 404 });
      }
      if (resultado.reason === 'UNCHANGED') {
        return NextResponse.json({ error: 'Escolha um horário diferente do horário atual.' }, { status: 400 });
      }
      if (resultado.reason === 'ALREADY_PENDING') {
        return NextResponse.json(
          { error: 'Você já possui uma solicitação de reagendamento aguardando resposta do psicólogo.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Este horário acabou de ser preenchido ou está indisponível. Por favor, escolha outro.' },
        { status: 409 }
      );
    }

    try {
      const contatos = await getContatosDaSessao(resultado.request.appointmentId);
      if (contatos) {
        await avisarSolicitacaoReagendamentoPsicologo(
          contatos,
          resultado.request.requestedStartsAt,
          resultado.request.sequence
        );
      }
    } catch (noticeError) {
      console.error('[agenda] Solicitação gravada, mas o aviso ao psicólogo falhou:', noticeError);
    }

    return NextResponse.json(
      {
        agendamentoAtual: {
          inicio: resultado.request.currentStartsAt,
          fim: resultado.request.currentEndsAt,
        },
        solicitacao: resultado.request,
        mensagem: 'Reagendamento solicitado ao psicólogo. Seu horário atual continua válido enquanto você aguarda a resposta.',
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[agenda] Falha ao solicitar reagendamento:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Não foi possível solicitar o reagendamento agora.' }, { status: 500 });
  }
}
