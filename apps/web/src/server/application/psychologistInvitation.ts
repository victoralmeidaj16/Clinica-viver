import 'server-only';

import { randomUUID } from 'node:crypto';
import type { CadastroPsicologoRecord } from './persistence';
import { avisarCadastroAprovadoPorEmail } from './psychologistRegistrationEmail';
import { avisarBoasVindasPsicologo, type ResultadoEnvio } from './viverMaisWhatsApp';
import { markWelcomeSent, provisionPsychologistAccess } from './psychologistAccess';

export interface ResultadoConvitePsicologo {
  contaAtivada: boolean;
  whatsapp: ResultadoEnvio['situacao'] | 'nao_aplicavel';
  email: Awaited<ReturnType<typeof avisarCadastroAprovadoPorEmail>>;
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
  const provisionado = await provisionPsychologistAccess(cadastro);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
    || 'https://clinicavivermais.cloud';

  let whatsapp: ResultadoConvitePsicologo['whatsapp'] = 'nao_aplicavel';
  let email: ResultadoConvitePsicologo['email'];

  if (provisionado.activationToken) {
    const activationUrl = `${appUrl}/ativar-conta?token=${encodeURIComponent(provisionado.activationToken)}`;
    const [entregaWhatsapp, entregaEmail] = await Promise.all([
      avisarBoasVindasPsicologo(cadastro, activationUrl, tentativaId),
      avisarCadastroAprovadoPorEmail(cadastro, `${appUrl}/login`, activationUrl, tentativaId),
    ]);
    whatsapp = entregaWhatsapp.situacao;
    email = entregaEmail;
  } else {
    email = await avisarCadastroAprovadoPorEmail(
      cadastro,
      `${appUrl}/login`,
      undefined,
      tentativaId
    );
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
