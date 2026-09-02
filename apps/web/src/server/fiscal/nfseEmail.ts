import 'server-only';

import { gerarDanfsePdf } from './danfsePdf';
import type { EmissaoNfse } from './nfseRepository';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface EnvioNfseEmailInput {
  emissao: EmissaoNfse;
  paciente: { nome: string; email: string };
}

export interface EnvioNfseEmailResult {
  providerId: string;
}

function emailValido(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizarEmailPaciente(value: string | undefined): string | undefined {
  const email = value?.trim().toLocaleLowerCase('pt-BR');
  return email && emailValido(email) ? email : undefined;
}

function escaparHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] as string);
}

function valorEmReais(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function configuracaoEmail() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NFSE_EMAIL_FROM?.trim()
    || process.env.RESEND_FROM?.trim()
    || process.env.EMAIL_FROM?.trim()
    || 'Viver Mais Psicologia <vivermaispsicoterapia@gmail.com>';
  if (!apiKey || !from) {
    throw new Error('Configure RESEND_API_KEY para enviar a NFS-e ao paciente.');
  }
  return {
    apiKey,
    from,
    replyTo: process.env.NFSE_EMAIL_REPLY_TO?.trim()
      || process.env.RESEND_REPLY_TO?.trim()
      || process.env.EMAIL_REPLY_TO?.trim()
      || 'vivermaispsicoterapia@gmail.com',
  };
}

/** Envia o documento fiscal apenas com dados presentes na própria emissão. */
export async function enviarNfsePorEmail(input: EnvioNfseEmailInput): Promise<EnvioNfseEmailResult> {
  const { emissao } = input;
  if (!emissao.nfseXml || !emissao.chaveAcesso || emissao.status !== 'issued') {
    throw new Error('A NFS-e ainda não possui os documentos necessários para envio por e-mail.');
  }

  const email = normalizarEmailPaciente(input.paciente.email);
  if (!email) throw new Error('O paciente não possui um e-mail válido para receber a NFS-e.');

  const { apiKey, from, replyTo } = configuracaoEmail();
  const numero = emissao.numeroNfse ?? emissao.numeroDps;
  const nomePaciente = input.paciente.nome.trim() || 'paciente';
  const pdf = await gerarDanfsePdf(emissao.nfseXml);
  const assunto = `Sua nota fiscal da Viver Mais${emissao.numeroNfse ? ` — nº ${emissao.numeroNfse}` : ''}`;
  const texto = [
    `Olá, ${nomePaciente}.`,
    '',
    'Sua nota fiscal referente ao atendimento na Viver Mais Psicologia foi emitida.',
    `Valor: ${valorEmReais(emissao.valorCents)}`,
    `Competência: ${emissao.competencia.split('-').reverse().join('/')}`,
    '',
    'O DANFSe em PDF e o XML da NFS-e seguem anexos a este e-mail.',
    '',
    'Viver Mais Psicologia',
  ].join('\n');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `nfse-email-${emissao.id}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: assunto,
      text: texto,
      html: `<p>Olá, <strong>${escaparHtml(nomePaciente)}</strong>.</p>
        <p>Sua nota fiscal referente ao atendimento na Viver Mais Psicologia foi emitida.</p>
        <p><strong>Valor:</strong> ${valorEmReais(emissao.valorCents)}<br />
        <strong>Competência:</strong> ${emissao.competencia.split('-').reverse().join('/')}</p>
        <p>O DANFSe em PDF e o XML da NFS-e seguem anexos a este e-mail.</p>
        <p>Viver Mais Psicologia</p>`,
      attachments: [
        {
          filename: `danfse-${emissao.serie}-${numero}.pdf`,
          content: pdf.toString('base64'),
          content_type: 'application/pdf',
        },
        {
          filename: `nfse-${emissao.serie}-${numero}.xml`,
          content: Buffer.from(emissao.nfseXml, 'utf8').toString('base64'),
          content_type: 'application/xml',
        },
      ],
    }),
  });

  const raw = await response.text();
  let result: { id?: string; message?: string; name?: string } = {};
  try { result = JSON.parse(raw) as typeof result; } catch { /* resposta não JSON */ }

  if (!response.ok || !result.id) {
    throw new Error(result.message || result.name || `O provedor de e-mail respondeu HTTP ${response.status}.`);
  }
  return { providerId: result.id };
}
