import 'server-only';

import type { CadastroPsicologoRecord } from './persistence';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type SituacaoEmail =
  | 'enviada'
  | 'destinatario_invalido'
  | 'provedor_desconfigurado'
  | 'falha';

export interface ResultadoEmailPsicologo {
  situacao: SituacaoEmail;
}

interface ConteudoEmail {
  subject: string;
  text: string;
  html: string;
}

function nomeDeExibicao(record: CadastroPsicologoRecord): string {
  return record.nomeSocial?.trim() || record.nomeCompleto.trim();
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
    || process.env.NFSE_EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.PSYCHOLOGIST_EMAIL_REPLY_TO?.trim()
      || process.env.NFSE_EMAIL_REPLY_TO?.trim()
      || undefined,
  };
}

export function conteudoCadastroRecebido(nome: string): ConteudoEmail {
  const seguro = escaparHtml(nome);
  return {
    subject: 'Recebemos seu cadastro — Viver Mais Psicologia',
    text: [
      `Olá, ${nome}!`,
      '',
      'Seja bem-vindo(a) à Viver Mais Psicologia.',
      'Recebemos seu cadastro profissional e seu perfil já está sendo analisado pela nossa gestão.',
      '',
      'Em até 24 horas, você receberá outro e-mail com o resultado da análise. Em caso de aprovação, ele trará as instruções de acesso ao portal e o link seguro para cadastrar sua senha.',
      '',
      'Nenhuma ação é necessária neste momento.',
      '',
      'Equipe Viver Mais Psicologia',
    ].join('\n'),
    html: `<p>Olá, <strong>${seguro}</strong>!</p>
      <p>Seja bem-vindo(a) à Viver Mais Psicologia.</p>
      <p>Recebemos seu cadastro profissional e seu perfil já está sendo analisado pela nossa gestão.</p>
      <p>Em até <strong>24 horas</strong>, você receberá outro e-mail com o resultado da análise. Em caso de aprovação, ele trará as instruções de acesso ao portal e o link seguro para cadastrar sua senha.</p>
      <p>Nenhuma ação é necessária neste momento.</p>
      <p>Equipe Viver Mais Psicologia</p>`,
  };
}

export function conteudoCadastroAprovado(
  nome: string,
  portalUrl: string,
  activationUrl?: string
): ConteudoEmail {
  const seguro = escaparHtml(nome);
  const portalSeguro = escaparHtml(portalUrl);
  const ativacaoSegura = activationUrl ? escaparHtml(activationUrl) : undefined;
  return {
    subject: 'Cadastro aprovado — acesse o portal Viver Mais',
    text: [
      `Olá, ${nome}!`,
      '',
      'Seu cadastro profissional foi aprovado pela Viver Mais Psicologia.',
      '',
      `Portal: ${portalUrl}`,
      ...(activationUrl ? [`Cadastre sua senha: ${activationUrl}`] : []),
      '',
      ...(activationUrl ? ['O link de criação da senha é individual, pode ser usado uma única vez e expira em 72 horas.'] : []),
      'A Viver Mais nunca solicitará sua senha por e-mail ou WhatsApp.',
      '',
      'Equipe Viver Mais Psicologia',
    ].join('\n'),
    html: `<p>Olá, <strong>${seguro}</strong>!</p>
      <p>Seu cadastro profissional foi aprovado pela Viver Mais Psicologia.</p>
      <p><a href="${portalSeguro}">Acessar o portal</a></p>
      ${ativacaoSegura ? `<p><a href="${ativacaoSegura}"><strong>Cadastrar minha senha</strong></a></p>
      <p>O link de criação da senha é individual, pode ser usado uma única vez e expira em 72 horas.</p>` : ''}
      <p>A Viver Mais nunca solicitará sua senha por e-mail ou WhatsApp.</p>
      <p>Equipe Viver Mais Psicologia</p>`,
  };
}

async function enviar(
  record: CadastroPsicologoRecord,
  idempotencyKey: string,
  conteudo: ConteudoEmail
): Promise<ResultadoEmailPsicologo> {
  const destinatario = normalizarEmail(record.email);
  if (!destinatario) return { situacao: 'destinatario_invalido' };
  const config = configuracaoEmail();
  if (!config) {
    console.warn('[email] Confirmação de credenciamento não enviada: provedor desconfigurado.');
    return { situacao: 'provedor_desconfigurado' };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
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
      console.warn(`[email] Provedor recusou credenciamento: HTTP ${response.status}.`);
      return { situacao: 'falha' };
    }
    return { situacao: 'enviada' };
  } catch (error) {
    console.warn('[email] Falha ao enviar credenciamento:', error instanceof Error ? error.message : error);
    return { situacao: 'falha' };
  }
}

export async function avisarCadastroRecebidoPorEmail(
  record: CadastroPsicologoRecord
): Promise<ResultadoEmailPsicologo> {
  return enviar(
    record,
    `psychologist-registration-received-${record.id}`,
    conteudoCadastroRecebido(nomeDeExibicao(record))
  );
}

export async function avisarCadastroAprovadoPorEmail(
  record: CadastroPsicologoRecord,
  portalUrl: string,
  activationUrl?: string
): Promise<ResultadoEmailPsicologo> {
  return enviar(
    record,
    `psychologist-registration-approved-${record.id}`,
    conteudoCadastroAprovado(nomeDeExibicao(record), portalUrl, activationUrl)
  );
}
