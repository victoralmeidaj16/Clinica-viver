'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';

interface DiagnosticoCertificado {
  prestador: {
    cnpj: string;
    razaoSocial: string;
    inscricaoMunicipal: string;
    municipio: string;
  };
  ambiente: { nome: 'producao_restrita' | 'producao'; api: string; tpAmb: string };
  certificado: {
    configurado: boolean;
    apto: boolean;
    titular?: string;
    validoAte?: string;
    diasParaVencer?: number;
    impedimentos: readonly string[];
    alertas: readonly string[];
  };
}

interface DiagnosticoConvenio {
  municipio: { nome: string; codigoIbge: string };
  convenio: {
    situacao: 'respondeu' | 'nao_encontrado' | 'recusado' | 'indisponivel' | 'sem_certificado';
    httpStatus?: number;
    mensagem?: string;
  };
  aliquota: {
    situacao: 'respondeu' | 'nao_encontrado' | 'recusado' | 'indisponivel';
    httpStatus?: number;
    competencia?: string;
  } | null;
}

const mascararCnpj = (valor: string) => {
  const cnpj = valor.replace(/\D/g, '');
  return cnpj.length === 14
    ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
    : valor;
};

const dataBr = (valor?: string) => valor
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(valor))
  : 'Não informada';

async function obterDiagnostico() {
  const certificado = await applicationRequest<DiagnosticoCertificado>('/fiscal/certificado');
  if (!certificado.certificado.apto) return { certificado, convenio: null, erro: '' };

  try {
    const convenio = await applicationRequest<DiagnosticoConvenio>('/fiscal/convenio');
    return { certificado, convenio, erro: '' };
  } catch (causa) {
    return {
      certificado,
      convenio: null,
      erro: causa instanceof Error ? causa.message : 'Não foi possível consultar a SEFIN.',
    };
  }
}

export function NfseIntegrationCard() {
  const [certificado, setCertificado] = useState<DiagnosticoCertificado | null>(null);
  const [convenio, setConvenio] = useState<DiagnosticoConvenio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resultado = await obterDiagnostico();
      setCertificado(resultado.certificado);
      setConvenio(resultado.convenio);
      setErro(resultado.erro);
    } catch (causa) {
      setCertificado(null);
      setConvenio(null);
      setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar o diagnóstico fiscal.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    void obterDiagnostico().then(
      (resultado) => {
        if (!ativo) return;
        setCertificado(resultado.certificado);
        setConvenio(resultado.convenio);
        setErro(resultado.erro);
        setCarregando(false);
      },
      (causa) => {
        if (!ativo) return;
        setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar o diagnóstico fiscal.');
        setCarregando(false);
      }
    );
    return () => { ativo = false; };
  }, []);

  const convenioRespondeu = convenio?.convenio.situacao === 'respondeu';
  const prontoParaTeste = certificado?.certificado.apto === true && convenioRespondeu;
  const restrito = certificado?.ambiente.nome === 'producao_restrita';
  const avisos = certificado
    ? [...certificado.certificado.impedimentos, ...certificado.certificado.alertas]
    : [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-700">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">NFS-e Nacional</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                prontoParaTeste ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {carregando ? 'VERIFICANDO' : prontoParaTeste ? 'APTO PARA HOMOLOGAÇÃO' : 'AÇÃO NECESSÁRIA'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Certificado A1, convênio municipal e ambiente usados na emissão pela clínica.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar diagnóstico
        </button>
      </div>

      {erro && (
        <div className="mt-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      {certificado && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Building2 className="h-3.5 w-3.5" /> Prestador
              </p>
              <p className="mt-2 text-xs font-extrabold text-slate-900">{certificado.prestador.razaoSocial}</p>
              <p className="mt-1 text-[11px] text-slate-500">{mascararCnpj(certificado.prestador.cnpj)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Certificado A1</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {certificado.certificado.apto ? 'Apto para assinatura' : 'Bloqueado'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Válido até {dataBr(certificado.certificado.validoAte)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Município</p>
              <p className="mt-2 text-xs font-extrabold text-slate-900">{certificado.prestador.municipio}</p>
              <p className="mt-1 text-[11px] text-slate-500">IM {certificado.prestador.inscricaoMunicipal}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SEFIN Nacional</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                {convenioRespondeu && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                {convenioRespondeu ? 'Convênio respondeu' : carregando ? 'Consultando…' : 'Não confirmado'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{restrito ? 'Produção restrita (testes)' : 'Produção'}</p>
            </div>
          </div>

          {restrito && (
            <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold text-sky-900">
              A interface está em homologação: confirmações geram apenas documentos de teste. A emissão fiscal real continua bloqueada.
            </p>
          )}

          {avisos.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 pl-8 text-xs text-amber-900">
              {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
