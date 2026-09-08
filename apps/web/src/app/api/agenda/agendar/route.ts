import { NextResponse } from 'next/server';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import {
  bookAppointments,
  getContatosDaSessao,
  identifyPatient,
} from '@/server/scheduling/agendaRepository';
import { avisarSessaoMarcada } from '@/server/scheduling/agendaAvisos';
import { garantirCobrancaDaSessao } from '@/server/payments/sessionCharge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Marca a sessão escolhida pelo paciente.
 *
 * O CPF é revalidado contra o vínculo antes de qualquer escrita: o horário
 * chega do cliente, mas a autorização de marcar naquele profissional não —
 * senão bastaria conhecer o token e um ISO para ocupar a agenda de alguém.
 */
export async function POST(request: Request) {
  if (rateLimited(request, 'agenda-agendar', { limite: 6 })) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token ?? '').trim();
    const cpf = String(body.cpf ?? '').replace(/\D/g, '');
    const inicios = Array.isArray(body.inicios)
      ? [...new Set(body.inicios.map(String))]
      : [String(body.inicio ?? '')];
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: 'Link de agendamento inválido.' }, { status: 404 });
    }
    if (!validCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    }
    if (inicios.length === 0 || inicios.length > 10 || inicios.some((inicio) => !Number.isFinite(Date.parse(inicio)))) {
      return NextResponse.json({ error: 'Selecione entre 1 e 10 horários válidos.' }, { status: 400 });
    }

    const paciente = await identifyPatient(token, cpf);
    if (!paciente) {
      return NextResponse.json(
        { error: 'Não encontramos este CPF entre os pacientes vinculados ao psicólogo.' },
        { status: 404 }
      );
    }

    const resultado = await bookAppointments(paciente, inicios);
    if (!resultado.ok) {
      return NextResponse.json(
        {
          error:
            'Este horário acabou de ser ocupado. Escolha outro na lista — ela já foi atualizada.',
        },
        { status: 409 }
      );
    }

    // A cobrança é consequência do agendamento já confirmado. A função contém
    // qualquer falha e nunca transforma indisponibilidade financeira em erro
    // para o paciente que acabou de reservar o horário.
    for (const agendamento of resultado.agendamentos) {
      await garantirCobrancaDaSessao(agendamento.agendamentoId);
      try {
        const contatos = await getContatosDaSessao(agendamento.agendamentoId);
        if (contatos) await avisarSessaoMarcada(contatos);
      } catch (erro) {
        console.error('[agenda] Sessão marcada, mas o aviso falhou:', erro);
      }
    }

    const first = resultado.agendamentos[0];

    return NextResponse.json(
      {
        success: true,
        inicio: first.inicio,
        fim: first.fim,
        modalidade: first.modalidade,
        linkPagamento: first.linkPagamento,
        sessoes: resultado.agendamentos,
        pacienteNome: paciente.nome,
        professionalName: paciente.professionalName,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[agenda] Falha ao agendar:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Não foi possível concluir o agendamento agora.' }, { status: 500 });
  }
}
