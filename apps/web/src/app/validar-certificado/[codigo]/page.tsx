import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  GraduationCap,
  Lock,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';
import { CertificateDocumentView } from '@/components/certificados/CertificateDocumentView';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Validação de Certificado | Viver Mais Psicologia',
  robots: { index: false },
};

export default async function ValidarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const codeParam = decodeURIComponent(codigo).trim();
  const record = await certificadosRepo.porCodigo(codeParam);

  const publicUrl = `https://www.vivermaispsicologia.com.br/validar-certificado/${encodeURIComponent(codeParam)}`;

  if (!record) {
    return (
      <div className="min-h-screen bg-[#F9F5FC] text-ink py-16 px-4">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-card space-y-5">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600">
            <XCircle className="w-8 h-8" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-bold uppercase tracking-wider">
            Status: Não Encontrado
          </span>

          <h1 className="font-heading text-2xl font-black text-red-950">
            Certificado Não Localizado
          </h1>

          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Nenhum certificado ativo foi localizado para o código{' '}
            <code className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
              {codeParam}
            </code>
            . Verifique se o código foi digitado corretamente ou consulte a Secretaria de Cursos.
          </p>

          <div className="pt-2">
            <Link
              href="/validar-certificado"
              className="btn-primary w-full py-3 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Digitar Outro Código
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isValid = record.status === 'valid';
  const isRevoked = record.status === 'revoked';
  const isCancelled = record.status === 'cancelled';

  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navegação Topo */}
        <div className="no-print flex items-center justify-between">
          <Link
            href="/validar-certificado"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-psi-deep transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Consultar outro certificado</span>
          </Link>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-line text-[11px] font-mono font-bold text-psi-deep shadow-xs">
            <span>ID: {record.code}</span>
          </div>
        </div>

        {/* BANNER DE STATUS DE AUTENTICIDADE */}
        {isValid && (
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-6 shadow-sm flex items-start gap-4 backdrop-blur-xs">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider">
                  🟢 Status: Válido & Autêntico
                </span>
                <span className="text-xs text-emerald-900 font-mono font-bold">
                  Código: {record.code}
                </span>
              </div>
              <h1 className="font-heading text-xl font-extrabold text-emerald-950">
                Certificado Autêntico e Verificado Oficialmente
              </h1>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Emitido pela Secretaria de Cursos da Viver Mais Psicologia em <strong>{record.issueDate}</strong> com aproveitamento integral.
              </p>
            </div>
          </div>
        )}

        {isRevoked && (
          <div className="rounded-3xl border border-red-300 bg-red-50 p-6 shadow-sm space-y-3">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-md">
                <XCircle className="w-6 h-6" />
              </span>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider">
                  🔴 Status: Revogado
                </span>
                <h1 className="font-heading text-xl font-extrabold text-red-950 mt-1">
                  Certificado Revogado Institucionalmente
                </h1>
                <p className="text-xs text-red-800 mt-0.5">
                  Este documento teve sua validade suspensa ou revogada pela Direção Acadêmica.
                </p>
              </div>
            </div>

            {record.revocationReason && (
              <div className="bg-white/90 p-4 rounded-2xl border border-red-200 text-xs text-red-900 leading-relaxed space-y-1">
                <p>
                  <strong>Motivo registrado da revogação:</strong> {record.revocationReason}
                </p>
                {record.revokedAt && (
                  <p className="text-[10px] text-red-700">
                    Data do registro de revogação: {new Date(record.revokedAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isCancelled && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-600 text-white shadow-md">
              <AlertTriangle className="w-6 h-6" />
            </span>
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-bold uppercase tracking-wider">
                🟡 Status: Cancelado
              </span>
              <h1 className="font-heading text-xl font-extrabold text-amber-950 mt-1">
                Certificado Cancelado / Anulado
              </h1>
              <p className="text-xs text-amber-800 mt-1">
                Este registro foi cancelado administrativamente e não possui valor comprobatório.
              </p>
            </div>
          </div>
        )}

        {/* FICHA TÉCNICA DO REGISTRO */}
        <div className="no-print rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-card space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-psi-deep text-white font-black grid place-items-center text-sm">
                V+
              </span>
              <div>
                <p className="font-extrabold text-sm text-ink leading-tight">Viver Mais Psicologia</p>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Ficha Técnica de Registro</p>
              </div>
            </div>

            <span className="font-mono text-xs font-bold text-psi-deep bg-psi-soft px-3 py-1.5 rounded-xl border border-psi-vibrant/20">
              {record.code}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-psi-vibrant" />
                Aluno Titular
              </p>
              <p className="font-heading text-base font-black text-ink">{record.studentName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-psi-vibrant" />
                Curso / Formação
              </p>
              <p className="font-heading text-sm font-bold text-psi-deep">{record.courseTitle}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-psi-vibrant" />
                Carga Horária
              </p>
              <p className="font-bold text-ink text-sm">{record.durationHours}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-psi-vibrant" />
                Data de Emissão
              </p>
              <p className="font-bold text-ink text-sm">{record.issueDate}</p>
            </div>

            <div className="sm:col-span-2 p-4 rounded-2xl bg-psi-soft/30 border border-psi-soft space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-psi-deep" />
                Assinatura Digital de Origem
              </p>
              <p className="font-mono text-xs font-bold text-ink">{record.signerInfo || 'VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153'}</p>
              <p className="text-[10px] text-muted">URL Oficial: {record.validationUrl || 'www.vivermaispsicologia.com.br'}</p>
            </div>
          </div>
        </div>

        {/* VISUALIZADOR COMPLETO DA FRENTE E VERSO */}
        <CertificateDocumentView record={record} publicValidationUrl={publicUrl} />
      </div>
    </div>
  );
}
