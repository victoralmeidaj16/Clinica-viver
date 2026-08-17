import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, success } from '@/server/application/http';
import { statusCertificadoNfse } from '@/server/fiscal/certificadoNfse';
import { PRESTADOR_NFSE, SERVICO_NFSE } from '@/server/fiscal/prestador';
import {
  ambienteNfse, baseDaApiParametrizacaoNfse, consultarConvenioMunicipal,
  consultarParametrosDoServico, SefinNacionalError,
} from '@/server/fiscal/sefinNacional';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O município aderiu ao Sistema Nacional NFS-e?
 *
 * É a pergunta que decide se este caminho de emissão serve para a clínica, e
 * até agora só era respondível por quem tivesse terminal, certificado e o
 * Swagger da SEFIN aberto. Se Tubarão não for conveniada, nenhuma configuração
 * faz a nota sair por aqui — a via é o sistema da prefeitura.
 *
 * A consulta vai à API ADN de parametrização e é autenticada pelo próprio
 * certificado A1 no TLS. Ou seja: **sem o certificado instalado não há como
 * perguntar**, e a resposta abaixo diz isso em vez de fingir uma indisponibilidade
 * da SEFIN.
 */

/** Dia corrente em São Paulo (`AAAA-MM-DD`), aceito pela parametrização ADN. */
function competenciaAtual(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === tipo)?.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

function resumirFalha(error: unknown) {
  if (error instanceof SefinNacionalError) {
    return {
      situacao: error.status === 404 ? ('nao_encontrado' as const) : ('recusado' as const),
      httpStatus: error.status,
      // O corpo cru é curto nessas respostas e é onde vem o código do erro.
      resposta: error.corpo.slice(0, 2_000) || undefined,
    };
  }
  return {
    situacao: 'indisponivel' as const,
    mensagem: error instanceof Error ? error.message : 'Falha desconhecida na consulta.',
  };
}

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const eAdmin = context.actor.roles.some((papel) => papel === 'owner' || papel === 'admin');
    if (!eAdmin) {
      throw new ApplicationError('FORBIDDEN', 'O diagnóstico fiscal é restrito à administração da clínica.', 403);
    }

    const certificado = statusCertificadoNfse();
    const municipio = {
      nome: `${PRESTADOR_NFSE.municipio}/${PRESTADOR_NFSE.uf}`,
      codigoIbge: PRESTADOR_NFSE.codigoMunicipioIbge,
    };

    if (!certificado.apto) {
      return success({
        ambiente: ambienteNfse(),
        api: baseDaApiParametrizacaoNfse(),
        municipio,
        convenio: {
          situacao: 'sem_certificado' as const,
          mensagem: 'A consulta é autenticada pelo certificado A1 no TLS. Instale um certificado apto para perguntar à SEFIN.',
          impedimentos: certificado.impedimentos,
        },
        aliquota: null,
      });
    }

    const competencia = competenciaAtual();
    const [convenio, aliquota] = await Promise.all([
      consultarConvenioMunicipal(municipio.codigoIbge).then(
        (resposta) => ({
          situacao: 'respondeu' as const,
          httpStatus: resposta.status,
          // Sem interpretação: os campos do convênio são do manual da SEFIN, e
          // traduzi-los aqui só criaria uma segunda verdade sobre o que ele diz.
          resposta: resposta.json ?? resposta.corpo.slice(0, 2_000),
        }),
        resumirFalha
      ),
      consultarParametrosDoServico(municipio.codigoIbge, SERVICO_NFSE.codigoTributacaoNacional.replace(/\D/g, ''), competencia).then(
        (resposta) => ({
          situacao: 'respondeu' as const,
          httpStatus: resposta.status,
          competencia,
          codigoServico: SERVICO_NFSE.codigoTributacaoNacional,
          resposta: resposta.json ?? resposta.corpo.slice(0, 2_000),
        }),
        (error) => ({ ...resumirFalha(error), competencia, codigoServico: SERVICO_NFSE.codigoTributacaoNacional })
      ),
    ]);

    return success({
      ambiente: ambienteNfse(),
      api: baseDaApiParametrizacaoNfse(),
      municipio,
      convenio,
      aliquota,
    });
  } catch (error) {
    return failure(error);
  }
}
