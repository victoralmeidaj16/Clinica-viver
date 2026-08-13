import 'server-only';

/**
 * Identidade fiscal de quem presta o serviço.
 *
 * O CNPJ mora aqui, num lugar só, porque ele precisa bater com o titular do
 * certificado A1 — e havia dois CNPJs diferentes espalhados pelas telas
 * (19.440.737/0001-53 na declaração, 48.912.830/0001-12 nos convênios). Um
 * deles assinaria nota em nome de uma empresa que não prestou o atendimento.
 *
 * O confirmado com a clínica, e que corresponde ao certificado, é o
 * 19.440.737/0001-53.
 */
export const PRESTADOR_NFSE = {
  cnpj: '19440737000153',
  razaoSocial: 'VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS E CIA LTDA',
  nomeFantasia: 'Viver Mais Psicologia',
  inscricaoMunicipal: '68870',
  municipio: 'Tubarão',
  uf: 'SC',
  /** Código IBGE de Tubarão/SC, conferido na API de localidades do IBGE. */
  codigoMunicipioIbge: '4218707',
} as const;

/** Serviço prestado, na classificação que a NFS-e nacional exige. */
export const SERVICO_NFSE = {
  codigoTributacaoNacional: '04.16.01',
  codigoNbs: '1.2301.98.00',
  descricaoPadrao: 'Atendimento Psicoterápico.',
} as const;
