import 'server-only';

import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import { gerarTokenConfirmacao } from '@/server/viverMaisConfirmToken';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type TipoAlocacaoLead = 'ESCOLHA_DIRETA' | 'RODIZIO';

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
    || process.env.RESEND_FROM?.trim()
    || process.env.EMAIL_FROM?.trim()
    || 'Viver Mais Psicologia <vivermaispsicoterapia@gmail.com>';
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.PSYCHOLOGIST_EMAIL_REPLY_TO?.trim()
      || process.env.NFSE_EMAIL_REPLY_TO?.trim()
      || process.env.RESEND_REPLY_TO?.trim()
      || process.env.EMAIL_REPLY_TO?.trim()
      || 'vivermaispsicoterapia@gmail.com',
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

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
    'https://clinicavivermais.cloud'
  );
}

function rotuloTurno(turno?: string): string {
  switch (turno?.trim().toUpperCase()) {
    case 'MANHA':
      return 'Manhã';
    case 'TARDE':
      return 'Tarde';
    case 'NOITE':
      return 'Noite';
    default:
      return turno || 'Não informado';
  }
}

function rotuloModalidade(modalidade?: string): string {
  switch (modalidade?.trim().toUpperCase()) {
    case 'SOCIAL':
      return 'Acessível (social)';
    case 'CASAL_SOCIAL':
      return 'Acessível (social) — casal';
    case 'PARTICULAR':
      return 'Particular';
    case 'CASAL_PARTICULAR':
      return 'Particular — casal';
    default:
      return modalidade || 'Não informada';
  }
}

export function conteudoAlocacaoPsicologo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord,
  tipoAlocacao: TipoAlocacaoLead = lead.tipoAlocacao ?? 'RODIZIO'
): ConteudoEmail {
  const nomePsicologo = psicologo.nomeSocial?.trim() || psicologo.nomeCompleto.trim();
  const nomePaciente = lead.nomePaciente || 'Paciente';
  const nomePsicologoSeguro = escaparHtml(nomePsicologo);
  const nomePacienteSeguro = escaparHtml(nomePaciente);
  const protocoloSeguro = escaparHtml(lead.protocolo);
  const servicoSeguro = escaparHtml(lead.servico || 'Psicoterapia');
  const turnoSeguro = escaparHtml(rotuloTurno(lead.turno));
  const modalidadeSegura = escaparHtml(rotuloModalidade(lead.modalidade));

  const telefoneLimpo = lead.telefone.replace(/\D/g, '');
  const linkWhatsApp = telefoneLimpo ? `https://wa.me/${telefoneLimpo}` : undefined;

  const token = gerarTokenConfirmacao(lead.id, psicologo.id);
  const linkConfirmar = `${baseUrl()}/confirmar-contato/${lead.id}?psi=${encodeURIComponent(psicologo.id)}&t=${token}`;
  const linkEncaminhar = `${baseUrl()}/encaminhar-contato/${lead.id}?psi=${encodeURIComponent(psicologo.id)}&t=${token}`;
  const linkCockpit = `${baseUrl()}/cockpit`;

  const isEscolhaDireta = tipoAlocacao === 'ESCOLHA_DIRETA';

  const assunto = isEscolhaDireta
    ? `[Novo Paciente] Um paciente escolheu você na Vitrine (${lead.protocolo}) — Viver Mais Psicologia`
    : `[Novo Paciente] Você foi selecionado no Rodízio (${lead.protocolo}) — Viver Mais Psicologia`;

  const subtituloDestaque = isEscolhaDireta
    ? 'Um paciente escolheu você diretamente na Vitrine da clínica para iniciar os atendimentos.'
    : 'Você foi selecionado pelo sistema no Rodízio Inteligente de Atendimentos da clínica com base no seu perfil, turno e modalidades.';

  const badgeTexto = isEscolhaDireta
    ? '✨ Paciente escolheu você diretamente na Vitrine'
    : '🔄 Selecionado pelo Rodízio Inteligente';

  const badgeBg = isEscolhaDireta ? '#f3e8ff' : '#eff6ff';
  const badgeColor = isEscolhaDireta ? '#6b21a8' : '#1d4ed8';
  const badgeBorder = isEscolhaDireta ? '#d8b4fe' : '#bfdbfe';

  const demandas = [
    ...(lead.necessidadesPaciente ?? []),
    ...(lead.necessidadesOutro ? [lead.necessidadesOutro] : []),
  ];

  const linhasTexto = [
    `Olá, ${nomePsicologo}!`,
    '',
    isEscolhaDireta
      ? 'Você recebeu uma nova solicitação de atendimento por ESCOLHA DIRETA na Vitrine da Clínica Viver Mais Psicologia.'
      : 'Você foi selecionado no RODÍZIO INTELIGENTE de atendimentos da Clínica Viver Mais Psicologia.',
    '',
    '⏰ ATENÇÃO AO PRAZO DE 24 HORAS (SLA):',
    '• Você tem o prazo de até 24 horas para realizar o primeiro contato com o paciente via WhatsApp ou ligação.',
    '• Caso não possa atender esta solicitação no momento, encaminhe-a imediatamente para que o paciente seja direcionado ao próximo psicólogo da fila.',
    '• Se o prazo de 24 horas expirar sem confirmação, o paciente será encaminhado automaticamente a outro profissional credenciado.',
    '',
    'Dados da Solicitação:',
    `• Paciente: ${nomePaciente}`,
    `• WhatsApp / Telefone: ${lead.telefone}${linkWhatsApp ? ` (${linkWhatsApp})` : ''}`,
    `• Serviço: ${lead.servico || 'Psicoterapia'}`,
    `• Modalidade: ${rotuloModalidade(lead.modalidade)}`,
    `• Turno de Preferência: ${rotuloTurno(lead.turno)}`,
    ...(lead.idade ? [`• Idade: ${lead.idade}`] : []),
    ...(lead.genero ? [`• Gênero: ${lead.genero}`] : []),
    ...(lead.paraQuemE ? [`• Atendimento para: ${lead.paraQuemE}`] : []),
    ...(lead.opcaoAvaliacaoPsicologica ? [`• Tipo de Avaliação: ${lead.opcaoAvaliacaoPsicologica}`] : []),
    ...(lead.possuiConvenio === 'SIM' && lead.convenioSelecionado && lead.convenioSelecionado !== 'Nenhum'
      ? [`• Convênio: ${lead.convenioSelecionado}`]
      : []),
    ...(demandas.length > 0 ? [`• Demandas/Queixas Informadas: ${demandas.join(', ')}`] : []),
    `• Protocolo: ${lead.protocolo}`,
    '',
    'Ações Rápidas:',
    `1. Confirmar Primeiro Contato: ${linkConfirmar}`,
    `2. Encaminhar para o Próximo Colega: ${linkEncaminhar}`,
    '3. Ou responda diretamente no WhatsApp da clínica com:',
    '   CONTATO - quando já tiver falado com o paciente.',
    '   ENCAMINHAR - se não for atender e desejar repassar para a fila.',
    '',
    `Acesse o Cockpit do Psicólogo para gerenciar seus atendimentos: ${linkCockpit}`,
    '',
    'Atenciosamente,',
    'Equipe Viver Mais Psicologia',
  ];

  const html = `<div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; padding: 20px; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #6b21a8; margin: 0 0 6px 0;">Viver Mais Psicologia</h2>
      <p style="font-size: 13px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Nova Solicitação de Agendamento</p>
    </div>

    <div style="background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 10px; padding: 10px 16px; margin-bottom: 20px; text-align: center;">
      <span style="color: ${badgeColor}; font-weight: bold; font-size: 14px;">${badgeTexto}</span>
    </div>

    <p style="font-size: 16px; margin: 0 0 12px 0;">Olá, <strong>${nomePsicologoSeguro}</strong>!</p>
    <p style="margin: 0 0 20px 0; color: #334155;">${subtituloDestaque}</p>

    <!-- ALERTA DE 24 HORAS -->
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <strong style="color: #b45309; font-size: 15px; display: block; margin-bottom: 6px;">⏰ Prazo de Ação: até 24 Horas</strong>
      <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #92400e;">
        Você tem <strong>até 24 horas</strong> para realizar o primeiro contato com o paciente e <strong>confirmar o atendimento</strong> ou <strong>encaminhar para outro profissional</strong>.
      </p>
      <p style="margin: 0; font-size: 12.5px; color: #b45309; font-style: italic;">
        *Caso não haja confirmação em 24h, o sistema efetuará o transbordo automático para o próximo psicólogo da fila, garantindo agilidade no acolhimento.
      </p>
    </div>

    <!-- DADOS DO PACIENTE -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <h3 style="color: #0f172a; font-size: 15px; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        📋 Detalhes da Solicitação
      </h3>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Paciente:</strong></td>
          <td style="padding: 6px 0; color: #0f172a;"><strong>${nomePacienteSeguro}</strong></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>WhatsApp:</strong></td>
          <td style="padding: 6px 0;">
            <a href="${linkWhatsApp ?? '#'}" style="color: #059669; font-weight: bold; text-decoration: none;">
              ${escaparHtml(lead.telefone)} ↗ (Abrir conversa)
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Serviço:</strong></td>
          <td style="padding: 6px 0; color: #0f172a;">${servicoSeguro}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Modalidade:</strong></td>
          <td style="padding: 6px 0; color: #0f172a;">${modalidadeSegura}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Turno:</strong></td>
          <td style="padding: 6px 0; color: #0f172a;">${turnoSeguro}</td>
        </tr>
        ${lead.idade ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>Idade:</strong></td><td style="padding: 6px 0; color: #0f172a;">${escaparHtml(String(lead.idade))} anos</td></tr>` : ''}
        ${lead.genero ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>Gênero:</strong></td><td style="padding: 6px 0; color: #0f172a;">${escaparHtml(lead.genero)}</td></tr>` : ''}
        ${lead.opcaoAvaliacaoPsicologica ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>Avaliação:</strong></td><td style="padding: 6px 0; color: #0f172a;">${escaparHtml(lead.opcaoAvaliacaoPsicologica)}</td></tr>` : ''}
        ${lead.possuiConvenio === 'SIM' && lead.convenioSelecionado && lead.convenioSelecionado !== 'Nenhum' ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>Convênio:</strong></td><td style="padding: 6px 0; color: #0f172a;">${escaparHtml(lead.convenioSelecionado)}</td></tr>` : ''}
        ${demandas.length > 0 ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>Demandas:</strong></td><td style="padding: 6px 0; color: #0f172a;">${escaparHtml(demandas.join(', '))}</td></tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;"><strong>Protocolo:</strong></td>
          <td style="padding: 6px 0; font-family: monospace; color: #6b21a8; font-weight: bold;">${protocoloSeguro}</td>
        </tr>
      </table>
    </div>

    <!-- BOTÕES DE AÇÃO -->
    <div style="margin: 28px 0; text-align: center;">
      <a href="${linkConfirmar}" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-right: 10px; margin-bottom: 10px; font-size: 14px;">
        ✓ Confirmar Primeiro Contato
      </a>
      <a href="${linkEncaminhar}" style="display: inline-block; background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-bottom: 10px; font-size: 14px;">
        ⇄ Encaminhar para a Fila
      </a>
    </div>

    <!-- DICA DE WHATSAPP -->
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #475569;">
      💬 <strong>Atalho no WhatsApp da Clínica:</strong> Se preferir, responda diretamente na conversa com o número da clínica:
      <ul style="margin: 6px 0 0 0; padding-left: 20px;">
        <li>Digite <strong>CONTATO</strong> após falar com o paciente para registrar a confirmação.</li>
        <li>Digite <strong>ENCAMINHAR</strong> caso não tenha disponibilidade para atender.</li>
      </ul>
    </div>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${linkCockpit}" style="color: #6b21a8; font-size: 13px; font-weight: bold; text-decoration: none;">
        Acessar Cockpit do Psicólogo →
      </a>
    </p>

    <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">
      Clínica Viver Mais Psicologia • Notificação Automática de Alocação de Paciente
    </p>
  </div>`;

  return {
    subject: assunto,
    text: linhasTexto.join('\n'),
    html,
  };
}

export async function avisarAlocacaoPsicologoPorEmail(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord,
  tipoAlocacao: TipoAlocacaoLead = lead.tipoAlocacao ?? 'RODIZIO'
): Promise<ResultadoEmailTriagem> {
  const destinatario = normalizarEmail(psicologo.email);
  if (!destinatario) return { situacao: 'destinatario_invalido' };

  const config = configuracaoEmail();
  if (!config) {
    console.info('[email] Notificação ao psicólogo não enviada: provedor de e-mail não configurado.');
    return { situacao: 'provedor_desconfigurado' };
  }

  const conteudo = conteudoAlocacaoPsicologo(lead, psicologo, tipoAlocacao);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `triagem-alocacao-psi-${lead.id}-${psicologo.id}`,
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
      console.warn(`[email] Provedor recusou notificação ao psicólogo: HTTP ${response.status}.`);
      return { situacao: 'falha' };
    }
    return { situacao: 'enviada' };
  } catch (error) {
    console.warn('[email] Falha ao enviar notificação ao psicólogo:', error instanceof Error ? error.message : error);
    return { situacao: 'falha' };
  }
}

