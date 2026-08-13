/**
 * Identificador da DPS, como o manual do Sistema Nacional NFS-e o define.
 *
 * São cinco campos concatenados, de largura fixa, sem separador:
 *
 *   Código IBGE do município emissor .... 7
 *   Tipo de inscrição federal ........... 1
 *   Inscrição federal .................. 14   (CPF completa com 000 à esquerda)
 *   Série da DPS ........................ 5
 *   Número da DPS ...................... 15
 *                                        ──
 *                                        42
 *
 * É por ele que se recupera a chave de acesso da NFS-e (`GET /dps/{id}`), e é
 * ele que precisa ser único por emitente — daí a série e o número serem do
 * emissor, não do sistema. Um número repetido não gera duas notas: gera uma
 * rejeição, e a nota do atendimento não sai.
 */

export type TipoInscricaoFederal = 'CPF' | 'CNPJ';

export interface ComposicaoDps {
  codigoMunicipioIbge: string;
  tipoInscricao: TipoInscricaoFederal;
  inscricaoFederal: string;
  serie: string | number;
  numero: string | number;
}

export const TAMANHO_IDENTIFICADOR_DPS = 42;

/**
 * O manual descreve a largura do campo, não os valores do código. `1` para CPF
 * e `2` para CNPJ é a convenção do padrão nacional de documentos fiscais —
 * **confirme no Anexo I antes da primeira emissão**, porque um código trocado
 * aqui produz um identificador que consulta a nota de outra pessoa.
 */
const CODIGO_TIPO_INSCRICAO: Record<TipoInscricaoFederal, string> = {
  CPF: '1',
  CNPJ: '2',
};

function apenasDigitos(valor: string | number): string {
  return String(valor).replace(/\D/g, '');
}

function preencherAEsquerda(valor: string, largura: number, campo: string): string {
  if (valor.length > largura) {
    throw new Error(`${campo} excede ${largura} dígitos no identificador da DPS.`);
  }
  return valor.padStart(largura, '0');
}

export function comporIdentificadorDps(composicao: ComposicaoDps): string {
  const municipio = apenasDigitos(composicao.codigoMunicipioIbge);
  if (municipio.length !== 7) {
    throw new Error('O código IBGE do município emissor precisa ter 7 dígitos.');
  }

  const inscricao = apenasDigitos(composicao.inscricaoFederal);
  const larguraEsperada = composicao.tipoInscricao === 'CPF' ? 11 : 14;
  if (inscricao.length !== larguraEsperada) {
    throw new Error(
      `A inscrição federal do tipo ${composicao.tipoInscricao} precisa ter ${larguraEsperada} dígitos.`
    );
  }

  const numero = apenasDigitos(composicao.numero);
  if (numero.length === 0 || Number(numero) === 0) {
    throw new Error('O número da DPS precisa ser maior que zero.');
  }

  return [
    municipio,
    CODIGO_TIPO_INSCRICAO[composicao.tipoInscricao],
    // O CPF ocupa o mesmo campo do CNPJ, completado com zeros à esquerda.
    preencherAEsquerda(inscricao, 14, 'A inscrição federal'),
    preencherAEsquerda(apenasDigitos(composicao.serie), 5, 'A série'),
    preencherAEsquerda(numero, 15, 'O número'),
  ].join('');
}

export interface IdentificadorDpsDecomposto {
  codigoMunicipioIbge: string;
  tipoInscricao: TipoInscricaoFederal;
  inscricaoFederal: string;
  serie: string;
  numero: string;
}

export function decomporIdentificadorDps(identificador: string): IdentificadorDpsDecomposto {
  const digitos = apenasDigitos(identificador);
  if (digitos.length !== TAMANHO_IDENTIFICADOR_DPS) {
    throw new Error(
      `O identificador da DPS precisa ter ${TAMANHO_IDENTIFICADOR_DPS} dígitos (recebido: ${digitos.length}).`
    );
  }

  const codigoTipo = digitos.slice(7, 8);
  const tipoInscricao = (Object.keys(CODIGO_TIPO_INSCRICAO) as TipoInscricaoFederal[]).find(
    (tipo) => CODIGO_TIPO_INSCRICAO[tipo] === codigoTipo
  );
  if (!tipoInscricao) {
    throw new Error(`Tipo de inscrição federal desconhecido no identificador: ${codigoTipo}.`);
  }

  const inscricaoBruta = digitos.slice(8, 22);

  return {
    codigoMunicipioIbge: digitos.slice(0, 7),
    tipoInscricao,
    // O CPF volta sem os zeros de preenchimento; o CNPJ ocupa o campo inteiro.
    inscricaoFederal: tipoInscricao === 'CPF' ? inscricaoBruta.slice(3) : inscricaoBruta,
    serie: digitos.slice(22, 27),
    numero: digitos.slice(27),
  };
}
