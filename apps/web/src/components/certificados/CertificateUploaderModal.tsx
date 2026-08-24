'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Check,
  FileImage,
  FileText,
  Move,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  formatCertificateVersoText,
  generateCertificateCode,
  type CertificateRecord,
} from '@thats-life/core';

interface Props {
  adminPin: string;
  onClose: () => void;
  onSuccess: (record: CertificateRecord) => void;
}

export function CertificateUploaderModal({ adminPin, onClose, onSuccess }: Props) {
  const [studentName, setStudentName] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [durationHours, setDurationHours] = useState('360h');
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('pt-BR'));
  const [signerInfo, setSignerInfo] = useState('VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153');
  const [validationUrl, setValidationUrl] = useState('www.vivermaispsicologia.com.br');
  const [code, setCode] = useState(generateCertificateCode());

  // Uploads
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  // Aba ativa de preview: 'verso' para posicionar o carimbo ou 'front' para conferir
  const [activeTab, setActiveTab] = useState<'verso' | 'front'>('verso');

  // Posição e estilo do carimbo no Verso
  const [stampX, setStampX] = useState<number>(5);
  const [stampY, setStampY] = useState<number>(80);
  const [stampFontSize, setStampFontSize] = useState<number>(11);
  const [stampAlign, setStampAlign] = useState<'left' | 'center' | 'right'>('left');

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filePdfRef = useRef<HTMLInputElement>(null);
  const fileFrontRef = useRef<HTMLInputElement>(null);
  const fileBackRef = useRef<HTMLInputElement>(null);

  const handleUploadSinglePdf = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setFrontImageUrl(dataUrl);
      setBackImageUrl(dataUrl);
      setIsPdf(true);
      setActiveTab('verso');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadFrontImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFrontImageUrl(String(reader.result));
      setIsPdf(file.type === 'application/pdf');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadBackImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBackImageUrl(String(reader.result));
      setIsPdf(file.type === 'application/pdf');
      setActiveTab('verso');
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers de Drag & Drop do Carimbo ---
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: stampX,
      startY: stampY,
    };
  };

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !dragStartRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.mouseX;
      const deltaY = clientY - dragStartRef.current.mouseY;

      const deltaXPct = (deltaX / rect.width) * 100;
      const deltaYPct = (deltaY / rect.height) * 100;

      const newX = Math.max(1, Math.min(90, dragStartRef.current.startX + deltaXPct));
      const newY = Math.max(1, Math.min(90, dragStartRef.current.startY + deltaYPct));

      setStampX(Math.round(newX * 10) / 10);
      setStampY(Math.round(newY * 10) / 10);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove);
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const versoText = formatCertificateVersoText({
    signerInfo,
    durationHours,
    issueDate,
    validationUrl,
    code,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !courseTitle.trim()) {
      setError('Por favor preencha o nome do aluno e o título do curso.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/certificados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          studentName: studentName.trim(),
          courseTitle: courseTitle.trim(),
          durationHours: durationHours.trim(),
          issueDate: issueDate.trim(),
          signerInfo: signerInfo.trim(),
          validationUrl: validationUrl.trim(),
          frontImageUrl: frontImageUrl || undefined,
          backImageUrl: backImageUrl || undefined,
          stampX,
          stampY,
          stampFontSize,
          stampAlign,
        }),
      });

      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Erro ao registrar certificado');

      onSuccess(d.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-line space-y-6 my-6">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-psi-soft text-psi-deep">
              <Award className="w-6 h-6" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-black text-ink">
                Incluir Certificado & Posicionar Carimbo Digital
              </h2>
              <p className="text-xs text-muted">
                Envie as duas páginas do certificado e arraste o carimbo oficial no verso.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-psi-soft text-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* PASSO 1: UPLOADS DE ARTE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-psi-soft/30 border border-psi-soft space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                1. Upload das Artes do Certificado (PDF 2 Páginas ou 2 Imagens)
              </span>
              <span className="text-[11px] text-muted">Formatos: PNG, JPG ou PDF</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* PDF de 2 Páginas */}
              <div className="p-4 rounded-xl bg-white border border-line flex flex-col justify-between space-y-2">
                <div>
                  <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-psi-vibrant" />
                    PDF Completo (2 Páginas)
                  </p>
                  <p className="text-[10px] text-muted mt-1">
                    Preenche a frente (pág 1) e o verso (pág 2) de uma só vez.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => filePdfRef.current?.click()}
                  className="btn-outline py-2 text-xs font-bold w-full"
                >
                  {frontImageUrl && backImageUrl && isPdf ? '✓ PDF Carregado' : '📁 Enviar PDF 2 Págs'}
                </button>
                <input
                  ref={filePdfRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => handleUploadSinglePdf(e.target.files?.[0])}
                />
              </div>

              {/* Imagem Frente */}
              <div className="p-4 rounded-xl bg-white border border-line flex flex-col justify-between space-y-2">
                <div>
                  <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <FileImage className="w-4 h-4 text-emerald-600" />
                    Página 1: Frente (Imagem)
                  </p>
                  <p className="text-[10px] text-muted mt-1">Upload da imagem frontal (PNG ou JPG).</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileFrontRef.current?.click()}
                  className="btn-outline py-2 text-xs font-bold w-full"
                >
                  {frontImageUrl && !isPdf ? '✓ Frente Carregada' : '📁 Enviar Imagem Frente'}
                </button>
                <input
                  ref={fileFrontRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleUploadFrontImage(e.target.files?.[0])}
                />
              </div>

              {/* Imagem Verso */}
              <div className="p-4 rounded-xl bg-white border border-line flex flex-col justify-between space-y-2">
                <div>
                  <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <FileImage className="w-4 h-4 text-purple-600" />
                    Página 2: Verso (Imagem)
                  </p>
                  <p className="text-[10px] text-muted mt-1">Upload da imagem do verso para o carimbo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileBackRef.current?.click()}
                  className="btn-outline py-2 text-xs font-bold w-full"
                >
                  {backImageUrl && !isPdf ? '✓ Verso Carregado' : '📁 Enviar Imagem Verso'}
                </button>
                <input
                  ref={fileBackRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleUploadBackImage(e.target.files?.[0])}
                />
              </div>
            </div>
          </div>

          {/* PASSO 2: METADADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                Nome do Aluno *
              </label>
              <input
                type="text"
                required
                className="input py-2.5 text-xs"
                placeholder="Ex: Marina Silva Santos"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-muted mb-1 flex items-center justify-between">
                <span>Código de Validação</span>
                <button
                  type="button"
                  onClick={() => setCode(generateCertificateCode())}
                  className="text-[10px] text-psi-vibrant hover:underline font-bold"
                >
                  ⚡ Gerar Novo
                </button>
              </label>
              <input
                type="text"
                required
                className="input py-2.5 text-xs font-mono font-bold text-psi-deep"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                Curso / Titulação *
              </label>
              <input
                type="text"
                required
                className="input py-2.5 text-xs"
                placeholder="Ex: Pós-Graduação em Psicoterapia Existencial e Fenomenológica"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                Carga Horária *
              </label>
              <input
                type="text"
                required
                className="input py-2.5 text-xs"
                placeholder="Ex: 360h"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                Assinado de forma digital por: [Instituição / CNPJ]
              </label>
              <input
                type="text"
                className="input py-2.5 text-xs font-mono"
                value={signerInfo}
                onChange={(e) => setSignerInfo(e.target.value)}
                placeholder="VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                Data de Emissão / Conclusão
              </label>
              <input
                type="text"
                className="input py-2.5 text-xs"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                placeholder="05/03/2026"
              />
            </div>
          </div>

          {/* PASSO 3: CANVAS DO VERSO COM CARIMBO ARRASTÁVEL */}
          <div className="space-y-3 pt-2 border-t border-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('verso')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    activeTab === 'verso' ? 'bg-psi-deep text-white shadow-xs' : 'bg-psi-soft text-muted'
                  }`}
                >
                  📜 Página 2: Verso (Arraste o Carimbo Aqui!)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('front')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    activeTab === 'front' ? 'bg-psi-deep text-white shadow-xs' : 'bg-psi-soft text-muted'
                  }`}
                >
                  📄 Página 1: Frente (Conferência)
                </button>
              </div>

              {activeTab === 'verso' && (
                <div className="flex items-center gap-3 text-xs bg-psi-soft/50 px-3 py-1.5 rounded-xl">
                  <span className="font-mono text-[11px] font-bold text-psi-deep">
                    Posição: X {stampX}% | Y {stampY}%
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted text-[10px]">Fonte:</span>
                    <button
                      type="button"
                      onClick={() => setStampFontSize((s) => Math.max(8, s - 1))}
                      className="px-1.5 py-0.5 rounded bg-white font-bold text-[10px] border border-line"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-[10px]">{stampFontSize}px</span>
                    <button
                      type="button"
                      onClick={() => setStampFontSize((s) => Math.min(24, s + 1))}
                      className="px-1.5 py-0.5 rounded bg-white font-bold text-[10px] border border-line"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CANVAS CONTAINER */}
            <div
              ref={canvasRef}
              className="relative mx-auto w-full aspect-[1.414/1] rounded-2xl bg-white border-2 border-psi-deep/30 overflow-hidden shadow-card select-none"
            >
              {activeTab === 'front' ? (
                /* FRENTE */
                frontImageUrl ? (
                  isPdf ? (
                    <iframe
                      src={`${frontImageUrl}#page=1`}
                      title="Frente PDF"
                      className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                    />
                  ) : (
                    <img
                      src={frontImageUrl}
                      alt="Frente do Certificado"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted">
                    Nenhuma arte de frente carregada (envie a imagem ou PDF acima)
                  </div>
                )
              ) : (
                /* VERSO COM CARIMBO ARRASTÁVEL */
                <>
                  {backImageUrl ? (
                    isPdf ? (
                      <iframe
                        src={`${backImageUrl}#page=2`}
                        title="Verso PDF"
                        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                      />
                    ) : (
                      <img
                        src={backImageUrl}
                        alt="Verso do Certificado"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted">
                      Nenhuma arte de verso carregada (envie o verso acima para posicionar o carimbo)
                    </div>
                  )}

                  {/* CARIMBO OFICIAL ARRASTÁVEL */}
                  <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={{
                      position: 'absolute',
                      left: `${stampX}%`,
                      top: `${stampY}%`,
                      fontSize: `${stampFontSize}px`,
                      textAlign: stampAlign,
                      maxWidth: '90%',
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    className={`rounded-xl p-3 bg-white/95 border-2 transition-all backdrop-blur-xs ${
                      isDragging
                        ? 'border-psi-deep shadow-2xl ring-4 ring-psi-vibrant/30 scale-[1.01]'
                        : 'border-dashed border-psi-vibrant shadow-md hover:border-psi-deep'
                    }`}
                  >
                    <div className="absolute -top-6 left-0 bg-psi-deep text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                      <Move className="w-3 h-3" />
                      <span>Arraste para posicionar</span>
                    </div>

                    <p className="font-mono text-ink/90 whitespace-pre-line leading-tight font-medium">
                      {versoText}
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="text-[11px] text-muted text-center italic">
              👆 Clique e arraste o carimbo oficial sobre o verso do certificado para colocá-lo na posição exata desejada.
            </p>
          </div>

          {error && <p className="text-xs font-bold text-coral text-center">{error}</p>}

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline py-2.5 px-4 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2.5 px-6 text-xs font-bold"
            >
              {saving ? 'Gravando Certificado…' : 'Salvar e Cadastrar Certificado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
