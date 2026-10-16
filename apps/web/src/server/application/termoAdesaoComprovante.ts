import 'server-only';

import { createHash } from 'node:crypto';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';

/**
 * Código de verificação do comprovante de aceite.
 *
 * É o SHA-256 de quem aceitou (cadastro, nome, CRP, e-mail) junto com a prova
 * apurada pelo servidor. Sai impresso em todas as páginas do PDF e no corpo do
 * e-mail: se alguém alterar o nome, o CRP, a data ou o IP de uma cópia, o
 * código recalculado a partir do banco deixa de bater.
 */
export function codigoVerificacaoAceite(cadastro: CadastroPsicologoRecord): string {
  const aceite = cadastro.aceiteTermoAdesao;
  if (!aceite) throw new Error('Cadastro sem prova de aceite do Termo de Adesão.');
  const canonico = JSON.stringify({
    cadastroId: cadastro.id,
    nomeCompleto: cadastro.nomeCompleto.trim(),
    crp: cadastro.crp.trim(),
    email: cadastro.email?.trim() ?? null,
    versao: aceite.versao,
    aceitoEm: aceite.aceitoEm,
    ip: aceite.ip ?? null,
    navegador: aceite.navegador ?? null,
    hashTexto: aceite.hashTexto ?? null,
  });
  return createHash('sha256').update(canonico, 'utf8').digest('hex');
}

/** O PDF que vai por e-mail e os dados que o amarram à prova gravada. */
export interface ComprovanteGerado {
  pdf: Buffer;
  arquivo: string;
  sha256: string;
  codigoVerificacao: string;
}

export function sha256(conteudo: Buffer): string {
  return createHash('sha256').update(conteudo).digest('hex');
}

export function nomeArquivoComprovante(cadastro: CadastroPsicologoRecord): string {
  return `termo-de-adesao-${cadastro.aceiteTermoAdesao?.versao ?? 'sem-versao'}-${cadastro.id}.pdf`;
}

const DATA_HORA_BRASILIA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});

export function dataHoraBrasilia(iso: string): string {
  return `${DATA_HORA_BRASILIA.format(new Date(iso))} (horário de Brasília)`;
}
