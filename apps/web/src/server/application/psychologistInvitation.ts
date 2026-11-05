import 'server-only';

import { randomUUID } from 'node:crypto';
import type { CadastroPsicologoRecord } from './persistence';
import { avisarCadastroAprovadoPorEmail, normalizarEmail } from './psychologistRegistrationEmail';
import { avisarBoasVindasPsicologo, type ResultadoEnvio } from './viverMaisWhatsApp';
import { markWelcomeSent, provisionPsychologistAccess } from './psychologistAccess';
import { montarComprovanteTermoAdesao } from './termoAdesaoComprovantePdf';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';

export interface ResultadoConvitePsicologo {
  contaAtivada: boolean;
  whatsapp: ResultadoEnvio['situacao'] | 'nao_aplicavel';
  email: Awaited<ReturnType<typeof avisarCadastroAprovadoPorEmail>>;
}

/** A via em PDF acompanha o convite, mas uma falha nela não pode deixar o profissional sem acesso. */
async function comprovanteDoConvite(cadastro: CadastroPsicologoRecord) {
  if (!cadastro.aceiteTermoAdesao) return undefined;
  try {
    return await montarComprovanteTermoAdesao(cadastro);
  } catch (error) {
    console.error('Não foi possível gerar o comprovante do convite:', error instanceof Error ? error.message : error);
    return undefined;
  }
}

/**
 * Cria ou renova o convite e mantém os dois canais apontando para o mesmo
 * token. Se a conta já tem senha, não inventa outro convite: envia somente a
 * orientação de acesso por e-mail.
 */
export async function enviarConvitePsicologo(
  cadastro: CadastroPsicologoRecord,
  tentativaId: string = randomUUID()
): Promise<ResultadoConvitePsicologo> {
  if (cadastro.status !== 'APROVADO') throw new Error('Apenas psicólogos aprovados podem receber o convite.');
  const comprovante = await comprovanteDoConvite(cadastro);
  const provisionado = await provisionPsychologistAccess(cadastro);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
    || 'https://clinicavivermais.cloud';

  let whatsapp: ResultadoConvitePsicologo['whatsapp'] = 'nao_aplicavel';
  let email: ResultadoConvitePsicologo['email'];

  if (provisionado.activationToken) {
    const activationUrl = `${appUrl}/ativar-conta?token=${encodeURIComponent(provisionado.activationToken)}`;
    const [entregaWhatsapp, entregaEmail] = await Promise.all([
      avisarBoasVindasPsicologo(cadastro, activationUrl, tentativaId),
      avisarCadastroAprovadoPorEmail(cadastro, `${appUrl}/login`, activationUrl, tentativaId, comprovante),
    ]);
    whatsapp = entregaWhatsapp.situacao;
    email = entregaEmail;
  } else {
    email = await avisarCadastroAprovadoPorEmail(
      cadastro,
      `${appUrl}/login`,
      undefined,
      tentativaId,
      comprovante
    );
  }

  if (comprovante && isMysqlConfigured()) {
    try {
      await new MysqlCaptureRepository().registrarEnvioComprovanteTermo(cadastro.id, {
        situacao: email.situacao,
        tentadoEm: new Date().toISOString(),
        paraProfissional: Boolean(normalizarEmail(cadastro.email)),
        paraClinica: false,
        detalhe: email.detalhe,
      }, 'envioComprovanteConvite');
    } catch {
      console.error('Não foi possível registrar o envio do comprovante no convite do psicólogo.');
    }
  }

  if (whatsapp === 'enviada' || email.situacao === 'enviada') {
    await markWelcomeSent(cadastro.id);
  }

  return {
    contaAtivada: !provisionado.activationToken,
    whatsapp,
    email,
  };
}
