import 'server-only';

import { TERMO_ADESAO_TITULO } from '@/components/forms/termoAdesaoContent';
import type { CadastroPsicologoRecord, EnvioComprovanteTermo } from './persistence';
import {
  configuracaoEmail,
  detalheSeguroDaFalha,
  escaparHtml,
  normalizarEmail,
} from './psychologistRegistrationEmail';
import { dataHoraBrasilia, type ComprovanteGerado } from './termoAdesaoComprovante';
import { montarEmailViverMais } from './viverMaisEmailTemplate';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Caixa da clínica que guarda a via institucional do termo. Sem variável
 * própria, vai para o mesmo endereço que já recebe as respostas dos e-mails
 * do credenciamento.
 */
function emailDaClinica(replyTo: string | undefined): string | undefined {
  return normalizarEmail(process.env.TERMO_ADESAO_EMAIL_CLINICA) ?? normalizarEmail(replyTo);
}

export function conteudoComprovanteTermo(cadastro: CadastroPsicologoRecord, comprovante: ComprovanteGerado) {
  const aceite = cadastro.aceiteTermoAdesao!;
  const nome = cadastro.nomeCompleto.trim();
  const aprovado = cadastro.status === 'APROVADO';
  const introducao = aprovado
    ? 'Segue em anexo a sua via do Termo de Adesão e Condições de Uso da Viver Mais Psicologia, com o registro do seu aceite eletrônico.'
    : 'Segue em anexo a via da clínica do Termo de Adesão e Condições de Uso, com o aceite eletrônico registrado na solicitação de cadastro do profissional.';
  const entrega = aprovado
    ? 'Esta mesma mensagem foi enviada à Viver Mais Psicologia, que guarda a via da instituição.'
    : 'A via do profissional será enviada junto ao e-mail de acesso ao portal, após a aprovação do cadastro pela gestão.';
  const quando = dataHoraBrasilia(aceite.aceitoEm);
  const registro = [
    `Profissional: ${nome} — CRP ${cadastro.crp.trim()}`,
    `Documento: ${TERMO_ADESAO_TITULO}, versão ${aceite.versao}`,
    `Aceito em: ${quando}`,
    `IP de origem: ${aceite.ip ?? 'não identificado'}`,
    `Código de verificação: ${comprovante.codigoVerificacao}`,
    `SHA-256 do PDF anexo (${comprovante.arquivo}): ${comprovante.sha256}`,
  ];
  return {
    subject: `Comprovante de aceite do Termo de Adesão — ${nome}`,
    text: [
      aprovado ? `Olá, ${nome}!` : 'Olá, equipe Viver Mais!',
      '',
      introducao,
      entrega,
      '',
      ...registro,
      '',
      'Guarde este e-mail e o PDF anexo. Se você não reconhece este aceite, responda a esta mensagem.',
      '',
      'Equipe Viver Mais Psicologia',
    ].join('\n'),
    html: montarEmailViverMais({
      preheader: 'Sua via do Termo de Adesão, com o registro do aceite eletrônico.',
      eyebrow: 'Termo de Adesão',
      titulo: aprovado ? 'Sua via do termo aceito' : 'Via da clínica do termo aceito',
      saudacao: aprovado ? `Olá, <strong>${escaparHtml(nome)}</strong>!` : 'Olá, equipe Viver Mais!',
      paragrafos: [
        introducao,
        entrega,
        `<span style="font-size:12px;line-height:19px;">${registro.map(escaparHtml).join('<br>')}</span>`,
        'Guarde este e-mail e o PDF anexo. Se você não reconhece este aceite, responda a esta mensagem.',
      ],
    }),
  };
}

/**
 * Na inscrição, entrega somente a via da clínica. O profissional recebe sua
 * via no convite aprovado; reenvios manuais podem incluí-lo após a aprovação.
 */
export async function enviarComprovanteTermoAdesao(
  cadastro: CadastroPsicologoRecord,
  comprovante: ComprovanteGerado,
  agora: Date = new Date(),
  /** Reenvio pela gestão: sem um sufixo novo o provedor descartaria a mensagem como repetida. */
  reenvioId?: string
): Promise<EnvioComprovanteTermo> {
  const config = configuracaoEmail();
  if (!config) {
    console.warn('[email] Comprovante do Termo de Adesão não enviado: provedor desconfigurado.');
    return { situacao: 'provedor_desconfigurado', tentadoEm: agora.toISOString() };
  }
  const profissional = cadastro.status === 'APROVADO' ? normalizarEmail(cadastro.email) : undefined;
  const clinica = emailDaClinica(config.replyTo);
  const destinatarios = [profissional, clinica].filter((email): email is string => Boolean(email));
  if (destinatarios.length === 0) return { situacao: 'destinatario_invalido', tentadoEm: agora.toISOString() };
  const [to, ...cc] = [...new Set(destinatarios)];

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `termo-adesao-comprovante-${cadastro.id}${reenvioId ? `-${reenvioId}` : ''}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        ...(cc.length ? { cc } : {}),
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        ...conteudoComprovanteTermo(cadastro, comprovante),
        attachments: [{ filename: comprovante.arquivo, content: comprovante.pdf.toString('base64') }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const base = {
      tentadoEm: agora.toISOString(),
      paraProfissional: Boolean(profissional),
      paraClinica: Boolean(clinica),
    };
    if (!response.ok) {
      const detalhe = await detalheSeguroDaFalha(response);
      console.warn(`[email] Provedor recusou o comprovante do termo: HTTP ${response.status}${detalhe ? ` — ${detalhe}` : ''}.`);
      return { ...base, situacao: 'falha', detalhe: `HTTP ${response.status}${detalhe ? ` — ${detalhe}` : ''}` };
    }
    const corpo = (await response.json().catch(() => ({}))) as { id?: unknown };
    return { ...base, situacao: 'enviada', idMensagem: typeof corpo.id === 'string' ? corpo.id : undefined };
  } catch (error) {
    console.warn('[email] Falha ao enviar o comprovante do termo:', error instanceof Error ? error.message : error);
    return { situacao: 'falha', tentadoEm: agora.toISOString() };
  }
}
