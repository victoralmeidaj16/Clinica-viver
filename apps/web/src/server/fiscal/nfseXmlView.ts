import 'server-only';

import { DOMParser } from '@xmldom/xmldom';

export interface NfseDocumentView {
  chaveAcesso: string;
  numero: string;
  numeroDps: string;
  serieDps: string;
  competencia: string;
  emitidaEm: string;
  processadaEm: string;
  ambiente: 'Produção' | 'Homologação';
  situacao: string;
  municipio: string;
  prestador: { nome: string; documento: string; inscricaoMunicipal: string; endereco: string };
  tomador: { nome: string; documento: string; email: string };
  servico: { descricao: string; tributacao: string; nbs: string; local: string };
  valorServico: number;
  valorLiquido: number;
  percentualTributos: number;
}

function first(scope: Document | Element | undefined, localName: string): Element | undefined {
  if (!scope) return undefined;
  return Array.from(scope.getElementsByTagName('*')).find((item) => item.localName === localName);
}

function value(scope: Document | Element | undefined, localName: string): string {
  return first(scope, localName)?.textContent?.trim() ?? '';
}

function child(scope: Document | Element | undefined, localName: string): Element | undefined {
  return scope ? first(scope, localName) : undefined;
}

function money(valueToParse: string): number {
  const parsed = Number(valueToParse);
  return Number.isFinite(parsed) ? parsed : 0;
}

function documentOf(scope: Element | undefined): string {
  return value(scope, 'CNPJ') || value(scope, 'CPF');
}

export function parseNfseXml(xml: string): NfseDocumentView {
  const document = new DOMParser({
    errorHandler: { warning() {}, error() {}, fatalError() {} },
  }).parseFromString(xml, 'application/xml');
  const infNfse = child(document, 'infNFSe');
  const dps = child(infNfse, 'DPS');
  const infDps = child(dps, 'infDPS');
  const emitente = child(infNfse, 'emit');
  const tomador = child(infDps, 'toma');
  const servico = child(infDps, 'serv');
  const endereco = child(emitente, 'enderNac');
  const id = infNfse?.getAttribute('Id') ?? '';

  if (!infNfse || !infDps || !/^NFS\d{50}$/.test(id)) {
    throw new Error('O XML armazenado não contém uma NFS-e Nacional válida.');
  }

  const enderecoPrestador = [
    [value(endereco, 'xLgr'), value(endereco, 'nro')].filter(Boolean).join(', '),
    value(endereco, 'xBairro'),
    [value(infNfse, 'xLocEmi'), value(endereco, 'UF')].filter(Boolean).join('/'),
    value(endereco, 'CEP') ? `CEP ${value(endereco, 'CEP')}` : '',
  ].filter(Boolean).join(' · ');

  return {
    chaveAcesso: id.slice(3),
    numero: value(infNfse, 'nNFSe'),
    numeroDps: value(infDps, 'nDPS'),
    serieDps: value(infDps, 'serie'),
    competencia: value(infDps, 'dCompet'),
    emitidaEm: value(infDps, 'dhEmi'),
    processadaEm: value(infNfse, 'dhProc'),
    ambiente: value(infDps, 'tpAmb') === '1' ? 'Produção' : 'Homologação',
    situacao: value(infNfse, 'cStat') === '100' ? 'NFS-e gerada' : `Código ${value(infNfse, 'cStat') || 'não informado'}`,
    municipio: value(infNfse, 'xLocEmi'),
    prestador: {
      nome: value(emitente, 'xNome'),
      documento: documentOf(emitente),
      inscricaoMunicipal: value(emitente, 'IM'),
      endereco: enderecoPrestador,
    },
    tomador: {
      nome: value(tomador, 'xNome') || 'Não informado',
      documento: documentOf(tomador),
      email: value(tomador, 'email'),
    },
    servico: {
      descricao: value(servico, 'xDescServ'),
      tributacao: [value(servico, 'cTribNac'), value(infNfse, 'xTribNac')].filter(Boolean).join(' · '),
      nbs: [value(servico, 'cNBS'), value(infNfse, 'xNBS')].filter(Boolean).join(' · '),
      local: value(infNfse, 'xLocPrestacao'),
    },
    valorServico: money(value(infDps, 'vServ')),
    valorLiquido: money(value(infNfse, 'vLiq')),
    percentualTributos: money(value(infDps, 'pTotTribSN')),
  };
}
