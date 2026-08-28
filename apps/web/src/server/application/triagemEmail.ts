import 'server-only';

import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type SituacaoEmail =
  | 'enviada'
  | 'destinatario_invalido'
  | 'provedor_desconfigurado'
  | 'falha';

export interface ResultadoEmailTriagem {
  situacao: SituacaoEmail;
}

interface ConteudoEmail {
  subject: string;
  text: string;
  html: string;
}

function normalizarEmail(value: string | undefined): string | undefined {
  const email = value?.trim().toLocaleLowerCase('pt-BR');
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function escaparHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] as string);
}

function configuracaoEmail() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PSYCHOLOGIST_EMAIL_FROM?.trim()
    || process.env.NFSE_EMAIL_FROM?.trim()
    || 'atendimento@vivermaispsicologia.com.br';
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.PSYCHOLOGIST_EMAIL_REPLY_TO?.trim()
      || process.env.NFSE_EMAIL_REPLY_TO?.trim()
      || undefined,
  };
}

export function conteudoTriagemRecebida(
  lead: TriagemPacienteRecord,
  psicologo?: CadastroPsicologoRecord
): ConteudoEmail {
  const nomePaciente = lead.nomePaciente || 'Paciente';
  const nomePacienteSeguro = escaparHtml(nomePaciente);
  const protocoloSeguro = escaparHtml(lead.protocolo);
  const servicoSeguro = escaparHtml(lead.servico || 'Psicoterapia');
  const nomePsicologo = psicologo ? (psicologo.nomeSocial?.trim() || psicologo.nomeCompleto) : undefined;
  const psicologoSeguro = nomePsicologo ? escaparHtml(nomePsicologo) : undefined;

  return {
    subject: `Solicitação de Agendamento Recebida (${lead.protocolo}) — Viver Mais Psicologia`,
    text: [
      `Olá, ${nomePaciente}!`,
      '',
      'Recebemos com sucesso a sua solicitação de agendamento na Clínica Viver Mais Psicologia.',
      '',
      `Protocolo de Acompanhamento: ${lead.protocolo}`,
      `Serviço Solicitado: ${lead.servico || 'Psicoterapia'}`,
      ...(nomePsicologo ? [`Profissional Vinculado: ${nomePsicologo}`] : []),
      '',
      'Próximos Passos:',
      '• Um de nossos psicólogos entrará em contato via WhatsApp no prazo de até 24 horas para alinhar o dia e horário do seu atendimento.',
      '• (Caso o prazo de 24h coincida com finais de semana ou feriados, o contato ocorrerá no próximo dia útil).',
      '',
      '⚠️ ATENÇÃO & SUPORTE DE EMERGÊNCIA:',
      'Se você ou alguém que você conhece estiver passando por uma crise emocional aguda, sofrimento intenso ou risco à vida, ligue imediatamente para o CVV no número 188 (ligação gratuita, 24 horas por dia) ou procure a Unidade de Pronto Atendimento (UPA) mais próxima.',
      '',
      'Com carinho e acolhimento,',
      'Equipe Viver Mais Psicologia',
    ].join('\n'),
    html: `<div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
      <h2 style="color: #6b21a8; margin-top: 0;">Solicitação de Agendamento Recebida</h2>
      <p>Olá, <strong>${nomePacienteSeguro}</strong>!</p>
      <p>Recebemos com sucesso a sua solicitação de atendimento na <strong>Clínica Viver Mais Psicologia</strong>.</p>

      <div style="background-color: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Protocolo:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #581c87;">${protocoloSeguro}</span></p>
        <p style="margin: 0 0 8px 0;"><strong>Serviço:</strong> ${servicoSeguro}</p>
        ${psicologoSeguro ? `<p style="margin: 0;"><strong>Profissional:</strong> ${psicologoSeguro}</p>` : ''}
      </div>

      <h3 style="color: #334155; font-size: 1.1em;">Próximos Passos:</h3>
      <p>Um de nossos psicólogos credenciados entrará em contato com você via WhatsApp em até <strong>24 horas</strong> para combinar o melhor dia e horário da sua primeira sessão.</p>
      <p style="font-size: 0.85em; color: #64748b; font-style: italic;">*Se o prazo de 24h coincidir com finais de semana ou feriados, o contato ocorrerá no primeiro dia útil subsequente.</p>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 24px 0;">
        <strong style="color: #991b1b; display: block; margin-bottom: 6px;">⚠️ Suporte e Acolhimento em Crise:</strong>
        <p style="margin: 0; font-size: 0.9em; color: #7f1d1d;">
          Se estiver passando por um momento de sofrimento agudo, crise ou risco à vida, ligue gratuitamente para o <strong>CVV no 188</strong> (Centro de Valorização da Vida — atendimento 24h) ou procure o serviço de emergência mais próximo.
        </p>
      </div>

      <p style="color: #64748b; font-size: 0.9em; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Com carinho e acolhimento,<br />
        <strong>Equipe Viver Mais Psicologia</strong>
      </p>
    </div>`,
  };
}

export async function avisarTriagemRecebidaPorEmail(
  lead: TriagemPacienteRecord,
  psicologo?: CadastroPsicologoRecord
): Promise<ResultadoEmailTriagem> {
  const destinatario = normalizarEmail(lead.email);
  if (!destinatario) return { situacao: 'destinatario_invalido' };

  const config = configuracaoEmail();
  if (!config) {
    console.info('[email] Confirmação ao paciente não enviada: provedor de e-mail não configurado.');
    return { situacao: 'provedor_desconfigurado' };
  }

  const conteudo = conteudoTriagemRecebida(lead, psicologo);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `triagem-received-${lead.id}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [destinatario],
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        ...conteudo,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`[email] Provedor recusou confirmação ao paciente: HTTP ${response.status}.`);
      return { situacao: 'falha' };
    }
    return { situacao: 'enviada' };
  } catch (error) {
    console.warn('[email] Falha ao enviar confirmação ao paciente:', error instanceof Error ? error.message : error);
    return { situacao: 'falha' };
  }
}
