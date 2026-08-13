import { comporIdentificadorDps } from './identificadorDps';

/** Namespace da DPS no XSD oficial `DPS_v1.01.xsd`. */
export const NAMESPACE_NFSE = 'http://www.sped.fazenda.gov.br/nfse';
export const VERSAO_DPS = '1.01';

export interface DpsPrestador {
  cnpj: string;
  inscricaoMunicipal: string;
  codigoMunicipioIbge: string;
  razaoSocial?: string;
  /** 3 = optante pelo Simples Nacional como ME/EPP. */
  opcaoSimplesNacional: '3';
  /** 1 = tributos federais e ISSQN apurados pelo Simples Nacional. */
  regimeApuracaoSimples: '1';
  /** 0 = sem regime especial municipal. */
  regimeEspecialTributacao: '0';
}

export interface DpsTomador {
  cpfOuCnpj: string;
  nome: string;
  email?: string;
}

/**
 * O caso de uso implementado é uma NFS-e regular da clínica para paciente no
 * Brasil. Operações de exportação, retenções, deduções, IBS/CBS e substituição
 * possuem grupos e regras próprios no Anexo I e devem entrar em geradores
 * específicos, em vez de virarem flags soltas neste documento.
 */
export interface GerarDpsPsicologiaInput {
  ambiente: '1' | '2';
  /** Série própria: o Anexo I reserva 00001–49999 para aplicativo do contribuinte. */
  serie: string | number;
  /** Sequencial fiscal único por série, controlado na persistência de NFS-e. */
  numeroDps: string | number;
  /** Data da prestação no formato AAAA-MM-DD. */
  competencia: string;
  /** Data/hora com offset, por exemplo `2026-08-13T14:30:00-03:00`. */
  emitidoEm: string;
  versaoAplicativo: string;
  prestador: DpsPrestador;
  tomador: DpsTomador;
  valorCents: number;
  descricaoServico: string;
  codigoTributacaoNacional: string;
  codigoNbs: string;
  codigoMunicipioPrestacao: string;
}

export interface DpsGerada {
  id: string;
  xml: string;
}

const somenteDigitos = (valor: string | number) => String(valor).replace(/\D/g, '');

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textoObrigatorio(valor: string, campo: string, maximo: number): string {
  const limpo = valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!limpo) throw new Error(`${campo} é obrigatório para gerar a DPS.`);
  if (limpo.length > maximo) throw new Error(`${campo} excede o limite de ${maximo} caracteres da DPS.`);
  return limpo;
}

function validarCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((total, algarismo, indice) => total + Number(algarismo) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function validarCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcular = (base: string) => {
    let peso = base.length - 7;
    const soma = [...base].reduce((total, algarismo) => {
      const proximo = total + Number(algarismo) * peso;
      peso = peso === 2 ? 9 : peso - 1;
      return proximo;
    }, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calcular(cnpj.slice(0, 12)) === Number(cnpj[12]) && calcular(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

function identidadeTomador(valor: string): { tag: 'CPF' | 'CNPJ'; numero: string } {
  const numero = somenteDigitos(valor);
  if (numero.length === 11 && validarCpf(numero)) return { tag: 'CPF', numero };
  if (numero.length === 14 && validarCnpj(numero)) return { tag: 'CNPJ', numero };
  throw new Error('O CPF ou CNPJ do tomador é inválido para emissão de NFS-e.');
}

function validarDataCompetencia(valor: string): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(valor) || Number.isNaN(Date.parse(`${valor}T12:00:00Z`))) {
    throw new Error('A competência da DPS deve estar no formato AAAA-MM-DD e representar uma data válida.');
  }
  return valor;
}

function validarDataHoraEmissao(valor: string): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d[+-](0\d|1[0-2]):00$/.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw new Error('A data/hora de emissão da DPS deve ter offset, como AAAA-MM-DDThh:mm:ss-03:00.');
  }
  return valor;
}

function valorMonetario(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    throw new Error('O valor da DPS deve ser um valor positivo inteiro em centavos.');
  }
  return (centavos / 100).toFixed(2);
}

function numeroDps(valor: string | number): string {
  const numero = somenteDigitos(valor);
  if (!/^[1-9]\d{0,14}$/.test(numero)) throw new Error('O número da DPS deve ter de 1 a 15 dígitos e ser maior que zero.');
  return numero;
}

function serieDps(valor: string | number): string {
  const serie = somenteDigitos(valor);
  if (!/^\d{1,5}$/.test(serie) || Number(serie) < 1 || Number(serie) > 49_999) {
    throw new Error('A série própria da DPS deve estar entre 00001 e 49999.');
  }
  return serie.padStart(5, '0');
}

function codigo(valor: string, campo: string, tamanho: number): string {
  const limpo = somenteDigitos(valor);
  if (limpo.length !== tamanho) throw new Error(`${campo} deve ter ${tamanho} dígitos.`);
  return limpo;
}

/**
 * Gera a DPS regular da clínica de psicologia no leiaute `v1.01`.
 *
 * A estrutura e a ordem dos elementos seguem `DPS_v1.01.xsd` e a planilha
 * "LEIAUTE DPS_NFS-e" do Anexo I `v1.01-20260209`. O XML é devolvido sem
 * assinatura: a assinatura XMLDSig deve ser aplicada depois, sobre `infDPS`.
 */
export function gerarDpsPsicologia(input: GerarDpsPsicologiaInput): DpsGerada {
  const prestadorCnpj = codigo(input.prestador.cnpj, 'O CNPJ do prestador', 14);
  const municipioEmissor = codigo(input.prestador.codigoMunicipioIbge, 'O código IBGE do município emissor', 7);
  const municipioPrestacao = codigo(input.codigoMunicipioPrestacao, 'O código IBGE do local de prestação', 7);
  const inscricaoMunicipal = textoObrigatorio(input.prestador.inscricaoMunicipal, 'A inscrição municipal', 15);
  const tomador = identidadeTomador(input.tomador.cpfOuCnpj);
  const nomeTomador = textoObrigatorio(input.tomador.nome, 'O nome do tomador', 150);
  const descricao = textoObrigatorio(input.descricaoServico, 'A descrição do serviço', 2000);
  const versaoAplicativo = textoObrigatorio(input.versaoAplicativo, 'A versão do aplicativo emissor', 20);
  const competencia = validarDataCompetencia(input.competencia);
  const emitidoEm = validarDataHoraEmissao(input.emitidoEm);
  const serie = serieDps(input.serie);
  const numero = numeroDps(input.numeroDps);
  const id = `DPS${comporIdentificadorDps({
    codigoMunicipioIbge: municipioEmissor,
    tipoInscricao: 'CNPJ',
    inscricaoFederal: prestadorCnpj,
    serie,
    numero,
  })}`;
  const email = input.tomador.email?.trim();
  if (email && (email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('O e-mail do tomador é inválido para a DPS.');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="${NAMESPACE_NFSE}" versao="${VERSAO_DPS}">
  <infDPS Id="${id}">
    <tpAmb>${input.ambiente}</tpAmb>
    <dhEmi>${emitidoEm}</dhEmi>
    <verAplic>${escaparXml(versaoAplicativo)}</verAplic>
    <serie>${serie}</serie>
    <nDPS>${numero}</nDPS>
    <dCompet>${competencia}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${municipioEmissor}</cLocEmi>
    <prest>
      <CNPJ>${prestadorCnpj}</CNPJ>
      <IM>${escaparXml(inscricaoMunicipal)}</IM>
      <regTrib>
        <opSimpNac>${input.prestador.opcaoSimplesNacional}</opSimpNac>
        <regApTribSN>${input.prestador.regimeApuracaoSimples}</regApTribSN>
        <regEspTrib>${input.prestador.regimeEspecialTributacao}</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      <${tomador.tag}>${tomador.numero}</${tomador.tag}>
      <xNome>${escaparXml(nomeTomador)}</xNome>${email ? `
      <email>${escaparXml(email)}</email>` : ''}
    </toma>
    <serv>
      <locPrest><cLocPrestacao>${municipioPrestacao}</cLocPrestacao></locPrest>
      <cServ>
        <cTribNac>${codigo(input.codigoTributacaoNacional, 'O código de tributação nacional', 6)}</cTribNac>
        <xDescServ>${escaparXml(descricao)}</xDescServ>
        <cNBS>${codigo(input.codigoNbs, 'O código NBS', 9)}</cNBS>
      </cServ>
    </serv>
    <valores>
      <vServPrest><vServ>${valorMonetario(input.valorCents)}</vServ></vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib><indTotTrib>0</indTotTrib></totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

  return { id, xml };
}
