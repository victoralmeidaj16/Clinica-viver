'use client';

import { useState } from 'react';
import { Award, Check, Copy, FileText, Printer, Share2 } from 'lucide-react';
import {
  CertificateRecord,
  formatCertificateVersoText,
  formatLongDate,
} from '@thats-life/core';
import { QrCodeConferencia } from '@/components/declaracao/QrCodeConferencia';

interface Props {
  record: CertificateRecord;
  publicValidationUrl: string;
}

export function CertificateDocumentView({ record, publicValidationUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const versoText = formatCertificateVersoText({
    signerInfo: record.signerInfo,
    durationHours: record.durationHours,
    issueDate: record.issueDate,
    validationUrl: record.validationUrl,
    code: record.code,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(publicValidationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Barra de Ações (Oculta na impressão) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-line shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Award className="w-4 h-4 text-psi-vibrant" />
          <span>Visualizador Oficial de Documento Acadêmico</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="btn-outline py-2 px-3 text-xs font-bold"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link</span>
              </>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="btn-primary py-2 px-4 text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / Salvar em PDF</span>
          </button>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMÍVEL */}
      <div className="cert-printable space-y-8">
        {/* PÁGINA 1: FRENTE DO CERTIFICADO */}
        <div className="space-y-2 cert-page-break">
          <div className="no-print flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
              Página 1 · Frente do Certificado
            </span>
            <span className="text-xs font-mono font-bold text-psi-deep">ID: {record.code}</span>
          </div>

          <div className="relative aspect-[1.414/1] w-full rounded-2xl bg-white border-2 border-psi-deep/20 p-8 md:p-12 flex flex-col justify-between overflow-hidden shadow-card">
            {record.frontImageUrl ? (
              record.frontImageUrl.includes('application/pdf') || record.frontImageUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={`${record.frontImageUrl}#page=1`}
                  title="Frente do Certificado em PDF"
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={record.frontImageUrl}
                  alt="Frente do Certificado"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )
            ) : (
              <>
                {/* Faixa superior estética */}
                <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-psi-deep via-psi-vibrant to-psi-soft" />

                {/* Topo institucional */}
                <div className="flex items-center justify-between border-b border-psi-soft/60 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-xl bg-psi-deep text-white font-black grid place-items-center text-sm shadow-sm">
                      V+
                    </span>
                    <div>
                      <p className="font-extrabold text-sm text-ink tracking-tight">Viver Mais Psicologia</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                        Secretaria de Cursos & Pós-Graduação
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-psi-deep bg-psi-soft/60 px-3 py-1 rounded-full border border-psi-vibrant/20">
                    Certificado de Conclusão
                  </span>
                </div>

                {/* Corpo do Certificado */}
                <div className="my-auto text-center space-y-4 py-6">
                  <p className="text-xs font-medium text-muted uppercase tracking-widest">
                    Certificamos oficialmente que
                  </p>
                  <h2 className="font-heading text-2xl md:text-3xl font-black text-ink tracking-tight">
                    {record.studentName}
                  </h2>
                  <p className="text-xs md:text-sm text-muted max-w-xl mx-auto leading-relaxed">
                    concluiu com aproveitamento e frequência integral o curso de extensão / formação profissional em
                  </p>
                  <p className="font-heading text-lg md:text-xl font-extrabold text-psi-deep max-w-2xl mx-auto">
                    {record.courseTitle}
                  </p>
                  <p className="text-xs font-semibold text-muted pt-2">
                    Carga Horária Total: <strong className="text-ink">{record.durationHours}</strong> · Data de Emissão: <strong className="text-ink">{record.issueDate}</strong>
                  </p>
                </div>

                {/* Rodapé da Frente */}
                <div className="flex items-end justify-between gap-4 pt-4 border-t border-psi-soft/60">
                  <div className="text-center">
                    <div className="w-44 md:w-56 border-t border-ink/40 pt-1" />
                    <p className="text-xs font-bold text-ink">Dra. Viviane Jeremias</p>
                    <p className="text-[10px] text-muted">Direção Acadêmica · Viver Mais Psicologia</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Código de Registro</p>
                      <p className="font-mono text-xs font-bold text-psi-deep">{record.code}</p>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white border border-psi-soft/80 shadow-xs">
                      <QrCodeConferencia valor={publicValidationUrl} tamanho={64} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* PÁGINA 2: VERSO OFICIAL COM CARIMBO DIGITAL */}
        <div className="space-y-2">
          <div className="no-print flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
              Página 2 · Verso Oficial e Registro de Autenticidade
            </span>
            <span className="text-xs font-mono font-bold text-psi-deep">ID: {record.code}</span>
          </div>

          <div className="relative aspect-[1.414/1] w-full rounded-2xl bg-white border-2 border-psi-deep/20 p-8 md:p-12 flex flex-col justify-between overflow-hidden shadow-card">
            {record.backImageUrl ? (
              record.backImageUrl.includes('application/pdf') || record.backImageUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={`${record.backImageUrl}#page=2`}
                  title="Verso do Certificado em PDF"
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={record.backImageUrl}
                  alt="Verso do Certificado"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h3 className="font-bold text-xs md:text-sm text-ink">Registro Acadêmico e Ementa Oficial</h3>
                    <p className="text-[10px] text-muted mt-0.5">{record.courseTitle}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono font-bold text-muted">REGISTRO LIVRO N° 2026/VVR</span>
                  </div>
                </div>

                <div className="py-6 space-y-3 text-xs text-muted leading-relaxed">
                  <p>• Curso livre de formação continuada e aprofundamento técnico em Psicologia.</p>
                  <p>• Aluno com frequência atestada e cumprimento de 100% das atividades pedagógicas programadas.</p>
                  <p>• Documento assinado eletronicamente sob conformidade com a legislação educacional e arquivado na Secretaria Acadêmica da Viver Mais Psicologia.</p>
                </div>
              </div>
            )}

            {/* CARIMBO DIGITAL NO VERSO (COM POSICIONAMENTO DINÂMICO CONFIGURADO) */}
            {record.stampX !== undefined && record.stampY !== undefined ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${record.stampX}%`,
                  top: `${record.stampY}%`,
                  fontSize: `${record.stampFontSize || 11}px`,
                  textAlign: record.stampAlign || 'left',
                  maxWidth: '90%',
                }}
                className="rounded-xl p-3 bg-white/95 border-2 border-psi-vibrant shadow-md backdrop-blur-xs z-10"
              >
                <p className="font-mono text-ink/90 whitespace-pre-line leading-tight font-medium">
                  {versoText}
                </p>
              </div>
            ) : (
              <div className="mt-auto border-t-2 border-dashed border-psi-soft pt-4 flex items-center justify-between gap-4 bg-psi-soft/20 p-4 rounded-xl border border-psi-soft/60 z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-psi-deep">
                    🔒 Assinatura Digital & Carimbo de Autenticidade
                  </p>
                  <p className="text-[11px] font-mono text-ink/90 whitespace-pre-line leading-relaxed font-medium">
                    {versoText}
                  </p>
                </div>
                <div className="p-1 rounded-lg bg-white border border-line shrink-0">
                  <QrCodeConferencia valor={publicValidationUrl} tamanho={56} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
