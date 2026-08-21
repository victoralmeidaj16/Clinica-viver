import { NextResponse } from 'next/server';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import { identifyPatient, listAvailableSlots } from '@/server/scheduling/agendaRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Até onde o link deixa marcar. Além disso a grade recorrente é só palpite. */
const HORIZONTE_DIAS = 60;

/**
 * Identificação por CPF e horários livres na mesma resposta.
 *
 * São duas perguntas do ponto de vista do paciente — "sou eu mesmo?" e "quando
 * posso?" — mas separá-las em duas rotas obrigaria a segunda a confiar num
 * ticket emitido pela primeira, e um ticket que carrega vínculo de paciente é
 * mais superfície do que reenviar o CPF numa chamada rate-limitada.
 */
export async function POST(request: Request) {
  if (rateLimited(request, 'agenda-horarios')) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token ?? '').trim();
    const cpf = String(body.cpf ?? '').replace(/\D/g, '');
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: 'Link de agendamento inválido.' }, { status: 404 });
    }
    if (!validCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
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

    const agora = new Date();
    const slots = await listAvailableSlots(
      paciente,
      agora,
      new Date(agora.getTime() + HORIZONTE_DIAS * 24 * 60 * 60_000),
      agora
    );

    // Agrupado por dia porque é assim que a tela pergunta: primeiro o dia no
    // calendário, depois o horário. Montar os grupos no cliente exigiria
    // repetir a noção de "dia da clínica" no navegador do paciente, cujo fuso
    // não é necessariamente o de Brasília.
    const dias = new Map<string, Array<{ inicio: string; hora: string; modalidade: string }>>();
    for (const slot of slots) {
      const doDia = dias.get(slot.dia) ?? [];
      doDia.push({ inicio: slot.inicio, hora: slot.hora, modalidade: slot.modalidade });
      dias.set(slot.dia, doDia);
    }

    return NextResponse.json(
      {
        pacienteNome: paciente.nome,
        professionalName: paciente.professionalName,
        dias: [...dias.entries()].map(([dia, horarios]) => ({ dia, horarios })),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[agenda] Falha ao listar horários:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Não foi possível carregar os horários agora.' }, { status: 500 });
  }
}
