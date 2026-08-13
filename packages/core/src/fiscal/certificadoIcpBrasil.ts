/**
 * Aptidão do certificado A1 para assinar NFS-e.
 *
 * Nada aqui lê arquivo nem toca em criptografia: recebe os dados já extraídos
 * do certificado e responde uma pergunta só — este certificado pode assinar
 * nota em nome deste CNPJ, agora? Ficar puro é o que torna a regra testável
 * sem a senha do `.pfx` e sem um certificado real no repositório.
 *
 * A resposta falha fechada. Certificado vencido, ainda não vigente ou de outro
 * CNPJ não gera aviso: impede a emissão. Uma nota assinada por certificado
 * errado é rejeitada pela prefeitura, e quando não é, é pior — vira nota
 * emitida em nome de quem não prestou o serviço.
 */

export interface DadosCertificado {
  /** `CN` do titular, como vem no certificado: `RAZÃO SOCIAL:CNPJ`. */
  titular: string;
  validoDe: string;
  validoAte: string;
  emissor: string;
}

export interface AvaliacaoCertificado {
  apto: boolean;
  cnpjTitular: string | null;
  /** Motivos que proíbem a emissão. Vazio é o único estado que permite assinar. */
  impedimentos: readonly string[];
  /** Não bloqueiam hoje, mas bloquearão: a renovação tem prazo de compra. */
  alertas: readonly string[];
  diasParaVencer: number;
}

const MILISSEGUNDOS_POR_DIA = 86_400_000;

export function normalizarCnpj(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

export function formatarCnpj(valor: string): string {
  const digitos = normalizarCnpj(valor);
  if (digitos.length !== 14) return valor;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

/**
 * O CNPJ vem colado à razão social no `CN`, depois do dois-pontos — é assim
 * que a ICP-Brasil identifica a pessoa jurídica num e-CNPJ.
 */
export function extrairCnpjDoTitular(titular: string): string | null {
  const aposDoisPontos = titular.split(':').pop();
  const digitos = normalizarCnpj(aposDoisPontos);
  return digitos.length === 14 ? digitos : null;
}

export function avaliarCertificado(
  dados: DadosCertificado,
  opcoes: { cnpjPrestador: string; agora: string; diasDeAlerta?: number }
): AvaliacaoCertificado {
  const { cnpjPrestador, agora, diasDeAlerta = 30 } = opcoes;

  const impedimentos: string[] = [];
  const alertas: string[] = [];

  const instante = Date.parse(agora);
  const inicio = Date.parse(dados.validoDe);
  const fim = Date.parse(dados.validoAte);

  if (Number.isNaN(inicio) || Number.isNaN(fim)) {
    impedimentos.push('As datas de validade do certificado não puderam ser lidas.');
  }

  const diasParaVencer = Number.isNaN(fim)
    ? 0
    : Math.floor((fim - instante) / MILISSEGUNDOS_POR_DIA);

  if (!Number.isNaN(inicio) && instante < inicio) {
    impedimentos.push(
      `O certificado só passa a valer em ${new Date(inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`
    );
  }

  if (!Number.isNaN(fim) && instante > fim) {
    impedimentos.push(
      `O certificado venceu em ${new Date(fim).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. É preciso renová-lo na autoridade certificadora.`
    );
  } else if (diasParaVencer <= diasDeAlerta) {
    alertas.push(
      `O certificado vence em ${diasParaVencer} dia(s). A emissão de notas para no vencimento.`
    );
  }

  const cnpjTitular = extrairCnpjDoTitular(dados.titular);
  const esperado = normalizarCnpj(cnpjPrestador);

  if (!cnpjTitular) {
    impedimentos.push('Não foi possível identificar o CNPJ do titular do certificado.');
  } else if (esperado.length !== 14) {
    impedimentos.push('O CNPJ do prestador não está configurado corretamente.');
  } else if (cnpjTitular !== esperado) {
    impedimentos.push(
      `O certificado é do CNPJ ${formatarCnpj(cnpjTitular)}, mas o prestador configurado é ${formatarCnpj(esperado)}.`
    );
  }

  return {
    apto: impedimentos.length === 0,
    cnpjTitular,
    impedimentos,
    alertas,
    diasParaVencer,
  };
}
