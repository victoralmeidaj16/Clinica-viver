'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Check,
  FileImage,
  FileText,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
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
  const [frontFileName, setFrontFileName] = useState<string>('');
  const [backFileName, setBackFileName] = useState<string>('');
  const [isPdf, setIsPdf] = useState(false);

  // Aba ativa de preview: 'verso' para posicionar e redimensionar o carimbo ou 'front' para conferir
  const [activeTab, setActiveTab] = useState<'verso' | 'front'>('verso');

  // Posição e estilo do carimbo no Verso
  const [stampX, setStampX] = useState<number>(5);
  const [stampY, setStampY] = useState<number>(75);
  const [stampFontSize, setStampFontSize] = useState<number>(11);
  const [stampAlign, setStampAlign] = useState<'left' | 'center' | 'right'>('left');

  // Drag & Resize state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const resizeStartRef = useRef<{ mouseX: number; initialFontSize: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filePdfRef = useRef<HTMLInputElement>(null);
  const fileFrontRef = useRef<HTMLInputElement>(null);
  const fileBackRef = useRef<HTMLInputElement>(null);

  // --- Handlers de Upload de Arquivos ---
  const handleUploadPdf = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setFrontImageUrl(dataUrl);
      setBackImageUrl(dataUrl);
      setFrontFileName(`${file.name} (Pág 1)`);
      setBackFileName(`${file.name} (Pág 2)`);
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
      setFrontFileName(file.name);
      setIsPdf(file.type === 'application/pdf');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadBackImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBackImageUrl(String(reader.result));
      setBackFileName(file.name);
      setIsPdf(file.type === 'application/pdf');
      setActiveTab('verso');
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers de Arraste (Drag & Drop) ---
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

  // --- Handlers de Redimensionamento Direto no Bloco (Resize Corner) ---
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    resizeStartRef.current = {
      mouseX: clientX,
      initialFontSize: stampFontSize,
    };
  };

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!canvasRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // Arraste de posição
      if (isDragging && dragStartRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const deltaX = clientX - dragStartRef.current.mouseX;
        const deltaY = clientY - dragStartRef.current.mouseY;

        const deltaXPct = (deltaX / rect.width) * 100;
        const deltaYPct = (deltaY / rect.height) * 100;

        const newX = Math.max(1, Math.min(90, dragStartRef.current.startX + deltaXPct));
        const newY = Math.max(1, Math.min(90, dragStartRef.current.startY + deltaYPct));

        setStampX(Math.round(newX * 10) / 10);
        setStampY(Math.round(newY * 10) / 10);
      }

      // Redimensionamento interativo da fonte/bloco direto no canto
      if (isResizing && resizeStartRef.current) {
        const deltaX = clientX - resizeStartRef.current.mouseX;
        const deltaFontSize = Math.round(deltaX / 12);
        const newFontSize = Math.max(8, Math.min(32, resizeStartRef.current.initialFontSize + deltaFontSize));
        setStampFontSize(newFontSize);
      }
    },
    [isDragging, isResizing]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    dragStartRef.current = null;
    resizeStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
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
  }, [isDragging, isResizing, handlePointerMove, handlePointerUp]);

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
            <span className="p-2.5 rounded-2xl bg-psi-soft text-psi-deep">
              <Award className="w-6 h-6" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-black text-ink">
                Incluir Certificado & Posicionar Carimbo Digital
              </h2>
              <p className="text-xs text-muted">
                Envie o arquivo do certificado (2 imagens ou 1 PDF) e redimensione/posicione o carimbo oficial no verso.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-psi-soft text-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* PASSO 1: UPLOAD DAS ARTES REAIS DO CERTIFICADO */}
          <div className="p-5 rounded-2xl bg-psi-soft/30 border border-psi-soft space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                1. Upload dos Arquivos do Certificado (PDF ou 2 Imagens)
              </span>
              <span className="text-[11px] text-muted">Formatos: PNG, JPG, JPEG ou PDF</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Opção 1: PDF de 2 Páginas */}
              <div className="p-4 rounded-2xl bg-white border border-line shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-psi-vibrant" />
                    PDF de 2 Páginas
                  </p>
                  <p className="text-[10px] text-muted leading-tight">
                    Extrai automaticamente a frente (pág 1) e o verso (pág 2).
                  </p>
                </div>
                {frontFileName && isPdf ? (
                  <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-2 rounded-xl text-[11px] font-bold">
                    <span className="truncate max-w-[160px]">✓ {frontFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFrontImageUrl(null);
                        setBackImageUrl(null);
                        setFrontFileName('');
                        setBackFileName('');
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => filePdfRef.current?.click()}
                    className="btn-outline py-2 text-xs font-bold w-full"
                  >
                    📁 Enviar PDF 2 Págs
                  </button>
                )}
                <input
                  ref={filePdfRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => handleUploadPdf(e.target.files?.[0])}
                />
              </div>

              {/* Opção 2: Imagem Frente */}
              <div className="p-4 rounded-2xl bg-white border border-line shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <FileImage className="w-4 h-4 text-emerald-600" />
                    Página 1: Frente (Imagem)
                  </p>
                  <p className="text-[10px] text-muted leading-tight">Upload da imagem frontal (PNG ou JPG).</p>
                </div>
                {frontImageUrl && !isPdf ? (
                  <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-2 rounded-xl text-[11px] font-bold">
                    <span className="truncate max-w-[160px]">✓ {frontFileName || 'Frente carregada'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFrontImageUrl(null);
                        setFrontFileName('');
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileFrontRef.current?.click()}
                    className="btn-outline py-2 text-xs font-bold w-full"
                  >
                    📁 Enviar Imagem Frente
                  </button>
                )}
                <input
                  ref={fileFrontRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleUploadFrontImage(e.target.files?.[0])}
                />
              </div>

              {/* Opção 3: Imagem Verso */}
              <div className="p-4 rounded-2xl bg-white border border-line shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                    <FileImage className="w-4 h-4 text-purple-600" />
                    Página 2: Verso (Imagem)
                  </p>
                  <p className="text-[10px] text-muted leading-tight">Upload da imagem do verso para o carimbo.</p>
                </div>
                {backImageUrl && !isPdf ? (
                  <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-2 rounded-xl text-[11px] font-bold">
                    <span className="truncate max-w-[160px]">✓ {backFileName || 'Verso carregado'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBackImageUrl(null);
                        setBackFileName('');
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileBackRef.current?.click()}
                    className="btn-outline py-2 text-xs font-bold w-full"
                  >
                    📁 Enviar Imagem Verso
                  </button>
                )}
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
                Assinado de forma digital por: [Nome da Instituição / CNPJ]
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

          {/* PASSO 3: CANVAS DO VERSO COM CARIMBO ARRASTÁVEL E REDIMENSIONÁVEL DIRETAMENTE NO BLOCO */}
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
                  📜 Página 2: Verso (Arraste & Redimensione o Carimbo)
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
                    <span className="text-muted text-[10px]">Tamanho:</span>
                    <button
                      type="button"
                      onClick={() => setStampFontSize((s) => Math.max(8, s - 1))}
                      className="px-1.5 py-0.5 rounded bg-white font-bold text-[10px] border border-line"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-[10px]">{stampFontSize}px</span>
                    <button
                      type="button"
                      onClick={() => setStampFontSize((s) => Math.min(32, s + 1))}
                      className="px-1.5 py-0.5 rounded bg-white font-bold text-[10px] border border-line"
                    >
                      <Plus className="w-3 h-3" />
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
                    // eslint-disable-next-line @next/next/no-img-element
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
                /* VERSO COM CARIMBO ARRASTÁVEL E REDIMENSIONÁVEL */
                <>
                  {backImageUrl ? (
                    isPdf ? (
                      <iframe
                        src={`${backImageUrl}#page=2`}
                        title="Verso PDF"
                        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
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

                  {/* BLOCO DO CARIMBO DIGITAL: ARRASTE E REDIMENSIONAMENTO DIRETO */}
                  <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={{
                      position: 'absolute',
                      left: `${stampX}%`,
                      top: `${stampY}%`,
                      fontSize: `${stampFontSize}px`,
                      textAlign: stampAlign,
                      maxWidth: '92%',
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    className={`group rounded-2xl p-3 bg-white/95 border-2 transition-shadow backdrop-blur-xs ${
                      isDragging
                        ? 'border-psi-deep shadow-2xl ring-4 ring-psi-vibrant/30 scale-[1.01]'
                        : isResizing
                        ? 'border-psi-vibrant ring-4 ring-psi-vibrant/40'
                        : 'border-dashed border-psi-vibrant shadow-md hover:border-psi-deep'
                    }`}
                  >
                    {/* Barra Superior do Bloco do Carimbo (Mover + Controles Rápidos de Tamanho) */}
                    <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-line/60">
                      <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-psi-deep bg-psi-soft px-1.5 py-0.5 rounded">
                        <Move className="w-2.5 h-2.5" />
                        <span>Arraste</span>
                      </div>

                      {/* Botões de Aumentar / Diminuir Direto no Bloco */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Diminuir tamanho do carimbo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStampFontSize((s) => Math.max(8, s - 1));
                          }}
                          className="h-4 w-4 rounded bg-psi-soft hover:bg-psi-deep hover:text-white grid place-items-center text-[10px] font-bold transition-colors"
                        >
                          -
                        </button>
                        <span className="text-[9px] font-mono font-bold text-muted px-1">
                          {stampFontSize}px
                        </span>
                        <button
                          type="button"
                          title="Aumentar tamanho do carimbo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStampFontSize((s) => Math.min(32, s + 1));
                          }}
                          className="h-4 w-4 rounded bg-psi-soft hover:bg-psi-deep hover:text-white grid place-items-center text-[10px] font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Texto Oficial Formatado */}
                    <p className="font-mono text-ink/90 whitespace-pre-line leading-tight font-medium">
                      {versoText}
                    </p>

                    {/* ALÇA DE REDIMENSIONAMENTO DIRETO NO CANTO INFERIOR DIREITO DO BLOCO */}
                    <div
                      onMouseDown={handleResizeStart}
                      onTouchStart={handleResizeStart}
                      title="Clique e arraste este canto para maximizar ou diminuir o carimbo"
                      className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-psi-deep text-white flex items-center justify-center cursor-nwse-resize shadow-md hover:scale-125 transition-transform text-[11px] font-bold z-20"
                    >
                      ⤡
                    </div>
                  </div>
                </>
              )}
            </div>

            <p className="text-[11px] text-muted text-center italic">
              💡 Dica: <strong>Arraste o bloco</strong> pelo corpo e use o botão <strong>⤡ no canto</strong> ou os botões <strong>[+] e [-]</strong> para redimensionar o carimbo diretamente.
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
