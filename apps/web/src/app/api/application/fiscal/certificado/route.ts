import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, success } from '@/server/application/http';
import { statusCertificadoNfse } from '@/server/fiscal/certificadoNfse';
import { PRESTADOR_NFSE } from '@/server/fiscal/prestador';
import { ambienteNfse, baseDaApiNfse, CODIGO_TP_AMB } from '@/server/fiscal/sefinNacional';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnóstico do certificado digital.
 *
 * Existe para responder "por que a emissão não está funcionando?" sem que
 * alguém precise abrir terminal na VPS. Devolve estado, titular e validade —
 * nunca a chave privada, nunca a senha.
 *
 * Restrito à administração: o titular e a validade do certificado dizem
 * respeito à empresa, não ao corpo clínico.
 */
export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);

    const eAdmin = context.actor.roles.some((papel) => papel === 'owner' || papel === 'admin');
    if (!eAdmin) {
      throw new ApplicationError(
        'FORBIDDEN',
        'O certificado digital é visível apenas para a administração da clínica.',
        403
      );
    }

    return success({
      prestador: {
        cnpj: PRESTADOR_NFSE.cnpj,
        razaoSocial: PRESTADOR_NFSE.razaoSocial,
        inscricaoMunicipal: PRESTADOR_NFSE.inscricaoMunicipal,
        municipio: `${PRESTADOR_NFSE.municipio}/${PRESTADOR_NFSE.uf}`,
        codigoMunicipioIbge: PRESTADOR_NFSE.codigoMunicipioIbge,
      },
      // Saber em qual ambiente o sistema está apontando é metade do
      // diagnóstico: "a nota não aparece no portal" quase sempre é isto.
      ambiente: { nome: ambienteNfse(), api: baseDaApiNfse(), tpAmb: CODIGO_TP_AMB[ambienteNfse()] },
      certificado: statusCertificadoNfse(),
    });
  } catch (error) {
    return failure(error);
  }
}
