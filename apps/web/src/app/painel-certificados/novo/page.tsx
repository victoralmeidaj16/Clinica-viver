'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Check,
  FileImage,
  FileText,
  Loader2,
  Lock,
  Minus,
  Move,
  Plus,
  Save,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import {
  formatCertificateVersoText,
  generateCertificateCode,
  type CertificateRecord,
} from '@thats-life/core';
import { convertPdfToImages } from '@/lib/pdfRenderer';

const STORAGE_KEY = 'cert_admin_pin';

export default function AnexarCertificadoPage() {
  const router = useRouter();
  const [pin, setPin] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Metadados do Certificado
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
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1.414); // 1.414 = A4 Paisagem (Landscape)

  // Drag over states para dropzone única
  const [isDragging, setIsDragging] = useState(false);

  // Aba ativa de preview: 'verso' para posicionar e redimensionar o carimbo ou 'front' para conferir
  const [activeTab, setActiveTab] = useState<'verso' | 'front'>('verso');

  // Posição e estilo do carimbo no Verso
  const [stampX, setStampX] = useState<number>(15);
  const [stampY, setStampY] = useState<number>(75);
  const [stampFontSize, setStampFontSize] = useState<number>(11);
  const [stampAlign, setStampAlign] = useState<'left' | 'center' | 'right'>('center');

  // Drag & Resize state do carimbo
  const [isDraggingStamp, setIsDraggingStamp] = useState(false);
  const [isResizingStamp, setIsResizingStamp] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const resizeStartRef = useRef<{ mouseX: number; initialFontSize: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPin(saved);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Digite o PIN de acesso.');
      return;
    }
    const testPin = pinInput.trim();
    fetch(`/api/certificados?pin=${encodeURIComponent(testPin)}`)
      .then((res) => {
        if (!res.ok) throw new Error('PIN inválido ou não autorizado.');
        setPin(testPin);
        setIsAuthenticated(true);
        sessionStorage.setItem(STORAGE_KEY, testPin);
      })
      .catch((err) => setPinError(err.message || 'Falha ao autenticar.'));
  };

  // --- Handler ÚNICO de Upload Inteligente de Arquivos (PDF ou Imagens) ---
  const handleUnifiedUpload = async (fileList?: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);

    const pdfFiles = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));

    // Validação 1: Não permitir misturar PDF com Imagem
    if (pdfFiles.length > 0 && imageFiles.length > 0) {
      setError('Por favor, selecione apenas 1 arquivo PDF OU até 2 imagens (não misture PDF com imagem).');
      return;
    }

    // Validação 2: Apenas 1 PDF
    if (pdfFiles.length > 1) {
      setError('Por favor, selecione apenas 1 arquivo PDF por certificado.');
      return;
    }

    // Validação 3: No máximo 2 imagens
    if (imageFiles.length > 2) {
      setError('Por favor, selecione no máximo 2 imagens (1ª Frente e 2ª Verso).');
      return;
    }

    setIsProcessingPdf(true);

    try {
      if (pdfFiles.length === 1) {
        const file = pdfFiles[0];
        const result = await convertPdfToImages(file);
        setFrontImageUrl(result.frontDataUrl);
        setBackImageUrl(result.backDataUrl || result.frontDataUrl);
        setAspectRatio(result.aspectRatio);
        setFrontFileName(
          result.numPages >= 2
            ? `${file.name} (Pág 1)`
            : `${file.name} (Pág 1)`
        );
        setBackFileName(
          result.numPages >= 2
            ? `${file.name} (Pág ${result.numPages} - Verso)`
            : `${file.name} (Verso)`
        );
        setIsPdf(true);
        // Exibir automaticamente a última página do PDF (Verso) para posicionamento imediato do carimbo
        setActiveTab('verso');
      } else if (imageFiles.length >= 1) {
        const readOptimizedDataUrl = (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new Image();
              img.onload = () => {
                const MAX_DIM = 1600;
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                if (width > MAX_DIM || height > MAX_DIM) {
                  if (width > height) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                  } else {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                  }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, width, height);
                  resolve(canvas.toDataURL('image/jpeg', 0.85));
                } else {
                  resolve(String(reader.result));
                }
              };
              img.onerror = () => resolve(String(reader.result));
              img.src = String(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        };

        if (imageFiles.length === 2) {
          // 2 Imagens: 1ª Frente, 2ª Verso
          const [img1, img2] = imageFiles;
          const [data1, data2] = await Promise.all([readOptimizedDataUrl(img1), readOptimizedDataUrl(img2)]);
          setFrontImageUrl(data1);
          setBackImageUrl(data2);
          setFrontFileName(`1ª: ${img1.name} (Frente)`);
          setBackFileName(`2ª: ${img2.name} (Verso)`);
          setIsPdf(false);
          // Exibir automaticamente a 2ª imagem (Verso) para posicionamento do carimbo
          setActiveTab('verso');

          const img = new Image();
          img.onload = () => {
            if (img.naturalWidth && img.naturalHeight) {
              setAspectRatio(img.naturalWidth / img.naturalHeight);
            }
          };
          img.src = data2;
        } else {
          // 1 Imagem
          const img1 = imageFiles[0];
          const data1 = await readOptimizedDataUrl(img1);
          setFrontImageUrl(data1);
          setBackImageUrl(data1);
          setFrontFileName(img1.name);
          setBackFileName(img1.name);
          setIsPdf(false);
          setActiveTab('verso');

          const img = new Image();
          img.onload = () => {
            if (img.naturalWidth && img.naturalHeight) {
              setAspectRatio(img.naturalWidth / img.naturalHeight);
            }
          };
          img.src = data1;
        }
      }
    } catch (err: unknown) {
      console.error('Erro no upload de arquivos:', err);
      setError('Falha ao processar os arquivos. Tente novamente com imagens PNG/JPG ou PDF.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handleClearFiles = () => {
    setFrontImageUrl(null);
    setBackImageUrl(null);
    setFrontFileName('');
    setBackFileName('');
    setIsPdf(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- Handlers de Arraste do Carimbo ---
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingStamp(true);
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
    setIsResizingStamp(true);
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

      if (isDraggingStamp && dragStartRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const deltaX = clientX - dragStartRef.current.mouseX;
        const deltaY = clientY - dragStartRef.current.mouseY;

        const deltaXPct = (deltaX / rect.width) * 100;
        const deltaYPct = (deltaY / rect.height) * 100;

        const newX = Math.max(1, Math.min(85, dragStartRef.current.startX + deltaXPct));
        const newY = Math.max(1, Math.min(85, dragStartRef.current.startY + deltaYPct));

        setStampX(Math.round(newX * 10) / 10);
        setStampY(Math.round(newY * 10) / 10);
      }

      if (isResizingStamp && resizeStartRef.current) {
        const deltaX = clientX - resizeStartRef.current.mouseX;
        const deltaFontSize = Math.round(deltaX / 12);
        const newFontSize = Math.max(8, Math.min(32, resizeStartRef.current.initialFontSize + deltaFontSize));
        setStampFontSize(newFontSize);
      }
    },
    [isDraggingStamp, isResizingStamp]
  );

  const handlePointerUp = useCallback(() => {
    setIsDraggingStamp(false);
    setIsResizingStamp(false);
    dragStartRef.current = null;
    resizeStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDraggingStamp || isResizingStamp) {
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
  }, [isDraggingStamp, isResizingStamp, handlePointerMove, handlePointerUp]);

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
          'x-admin-pin': pin,
        },
        body: JSON.stringify({
          code: code.trim(),
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

      router.push('/painel-certificados');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F9F5FC] text-ink flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-card space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-psi-soft text-psi-deep">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="font-heading text-2xl font-black text-ink">
              Painel de Registro de Certificados
            </h1>
            <p className="text-xs text-muted">
              Digite o PIN de administração para anexar novos certificados.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="pin" className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                PIN de Acesso
              </label>
              <input
                id="pin"
                type="password"
                className="input text-center text-lg font-mono tracking-widest font-bold"
                placeholder="••••••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
              />
              {pinError && <p className="text-xs font-semibold text-coral mt-1.5">{pinError}</p>}
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3 font-bold text-xs"
            >
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* Header Superior da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4 bg-white p-5 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/painel-certificados"
              className="p-2.5 rounded-2xl border border-line bg-[#FAF8FC] hover:bg-psi-soft text-psi-deep font-bold transition-all shadow-xs"
              title="Voltar aos Registros"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-psi-soft text-psi-deep text-[10px] font-bold mb-0.5">
                <UploadCloud className="w-3 h-3" />
                <span>Upload de Certificado & Carimbo</span>
              </div>
              <h1 className="font-heading text-xl sm:text-2xl font-black text-ink tracking-tight">
                Anexar Certificado & Posicionar Carimbo Oficial
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/painel-certificados"
              className="btn-outline py-2.5 px-4 text-xs font-bold"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              form="form-anexar"
              disabled={saving || isProcessingPdf}
              className="btn-primary py-2.5 px-6 text-xs font-bold shadow-md flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Gravando…' : 'Salvar e Registrar Certificado'}</span>
            </button>
          </div>
        </div>

        {/* LAYOUT EM 2 COLUNAS: CONFIGURAÇÕES NA LATERAL + CANVAS AMPLO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA LATERAL ESQUERDA: CONFIGURAÇÕES & UPLOAD SIMPLIFICADO */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            <form id="form-anexar" onSubmit={handleSave} className="space-y-5">
              {/* CARD 1: DROPZONE ÚNICA DE UPLOAD */}
              <div className="rounded-3xl border border-line bg-white p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-psi-vibrant" />
                    1. Upload dos Arquivos
                  </span>
                  <span className="text-[10px] font-semibold text-muted">PDF ou até 2 imagens</span>
                </div>

                {/* ÁREA ÚNICA DE UPLOAD */}
                {frontImageUrl ? (
                  /* CARD DE ARQUIVO JÁ CARREGADO */
                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0 mt-0.5">
                          {isPdf ? <FileText className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-xs font-extrabold text-emerald-950 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isPdf ? 'PDF Carregado com Sucesso' : 'Arte(s) Carregada(s)'}</span>
                          </p>
                          <p className="text-[11px] font-semibold text-emerald-800 truncate max-w-[210px]">
                            {backFileName || frontFileName}
                          </p>
                          {frontFileName && backFileName && frontFileName !== backFileName && (
                            <p className="text-[10px] text-emerald-700 truncate max-w-[210px]">
                              Frente: {frontFileName}
                            </p>
                          )}
                          <p className="text-[10px] font-bold text-emerald-900 pt-0.5">
                            👉 Exibindo verso na tela para posicionar o carimbo
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearFiles}
                        className="p-1.5 rounded-xl bg-white border border-emerald-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors shadow-xs"
                        title="Remover e enviar outro arquivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Trocar Arquivo</span>
                    </button>
                  </div>
                ) : (
                  /* DROPZONE ÚNICA INICIAL */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleUnifiedUpload(e.dataTransfer.files);
                    }}
                    className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center space-y-3 cursor-pointer ${
                      isDragging
                        ? 'border-psi-deep bg-psi-soft/80 ring-4 ring-psi-vibrant/20 scale-[1.01]'
                        : 'border-psi-vibrant/40 bg-[#FAF8FC] hover:border-psi-deep hover:bg-psi-soft/30'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-psi-soft text-psi-deep grid place-items-center shadow-xs">
                      {isProcessingPdf ? (
                        <Loader2 className="w-6 h-6 animate-spin text-psi-deep" />
                      ) : (
                        <UploadCloud className="w-6 h-6" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="font-extrabold text-xs text-ink">
                        {isProcessingPdf
                          ? 'Processando e extraindo páginas…'
                          : 'Clique ou arraste o arquivo aqui'}
                      </p>
                      <p className="text-[11px] text-muted max-w-xs mx-auto leading-relaxed">
                        Envie <strong>1 PDF</strong> (1 ou 2 páginas) <br />
                        ou <strong>até 2 imagens</strong> (Frente e Verso)
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingPdf}
                      className="btn-primary py-2 px-4 text-xs font-bold shadow-xs mx-auto flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Selecionar Arquivo</span>
                    </button>
                  </div>
                )}

                {/* Input Invisível para Upload Único */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  hidden
                  onChange={(e) => handleUnifiedUpload(e.target.files)}
                />
              </div>

              {/* CARD 2: DADOS DO ALUNO E REGISTRO */}
              <div className="rounded-3xl border border-line bg-white p-5 shadow-card space-y-4">
                <div className="border-b border-line pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-psi-vibrant" />
                    2. Dados do Certificado
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                      Nome do Aluno *
                    </label>
                    <input
                      type="text"
                      required
                      className="input py-2 text-xs font-semibold"
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
                      className="input py-2 text-xs font-mono font-bold text-psi-deep"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                      Curso / Titulação *
                    </label>
                    <input
                      type="text"
                      required
                      className="input py-2 text-xs"
                      placeholder="Ex: Pós-Graduação em Psicoterapia Existencial"
                      value={courseTitle}
                      onChange={(e) => setCourseTitle(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                        Carga Horária *
                      </label>
                      <input
                        type="text"
                        required
                        className="input py-2 text-xs font-semibold"
                        placeholder="Ex: 360h"
                        value={durationHours}
                        onChange={(e) => setDurationHours(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                        Data de Emissão
                      </label>
                      <input
                        type="text"
                        className="input py-2 text-xs font-semibold"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        placeholder="05/03/2026"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-muted mb-1">
                      Assinado de forma digital por: [Nome / CNPJ]
                    </label>
                    <input
                      type="text"
                      className="input py-2 text-xs font-mono text-[11px]"
                      value={signerInfo}
                      onChange={(e) => setSignerInfo(e.target.value)}
                      placeholder="VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: AJUSTES RÁPIDOS DO CARIMBO */}
              <div className="rounded-3xl border border-line bg-white p-5 shadow-card space-y-3">
                <div className="border-b border-line pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-psi-vibrant" />
                    3. Ajustes do Carimbo
                  </span>
                  <span className="font-mono text-[10px] font-bold text-muted">
                    X: {stampX}% | Y: {stampY}%
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between bg-[#FAF8FC] p-2 rounded-xl border border-line/60">
                    <span className="text-muted font-bold text-[11px]">Tamanho da Fonte:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setStampFontSize((s) => Math.max(8, s - 1))}
                        className="h-6 w-6 rounded bg-white hover:bg-psi-deep hover:text-white font-bold text-xs border border-line grid place-items-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-bold px-2">{stampFontSize}px</span>
                      <button
                        type="button"
                        onClick={() => setStampFontSize((s) => Math.min(32, s + 1))}
                        className="h-6 w-6 rounded bg-white hover:bg-psi-deep hover:text-white font-bold text-xs border border-line grid place-items-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#FAF8FC] p-2 rounded-xl border border-line/60">
                    <span className="text-muted font-bold text-[11px]">Alinhamento:</span>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => setStampAlign(align)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                            stampAlign === align
                              ? 'bg-psi-deep text-white border-psi-deep'
                              : 'bg-white text-muted border-line hover:text-ink'
                          }`}
                        >
                          {align === 'left' ? '⬅ Esq' : align === 'center' ? '↔ Cent' : 'Dir ➡'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || isProcessingPdf}
                className="btn-primary w-full py-3.5 text-xs font-bold shadow-lg shadow-psi-deep/20 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Gravando Certificado…' : 'Salvar e Registrar Certificado'}</span>
              </button>
            </form>
          </div>

          {/* COLUNA PRINCIPAL DIREITA: CANVAS DE VISUALIZAÇÃO AMPLO */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="rounded-3xl border border-line bg-white p-5 sm:p-6 shadow-card space-y-4">
              {/* Barra de Abas do Preview */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex gap-2 bg-[#FAF8FC] p-1 rounded-2xl border border-line">
                  <button
                    type="button"
                    onClick={() => setActiveTab('verso')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'verso'
                        ? 'bg-psi-deep text-white shadow-xs'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    📜 Verso Oficial (Arraste o Carimbo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('front')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'front'
                        ? 'bg-psi-deep text-white shadow-xs'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    📄 Frente (Conferência)
                  </button>
                </div>

                <span className="text-[11px] text-muted italic">
                  💡 Arraste o carimbo com o mouse para posicioná-lo sobre a arte.
                </span>
              </div>

              {/* CANVAS CONTAINER AMPLO COM ENQUADRAMENTO TOTAL */}
              <div
                ref={canvasRef}
                style={{ aspectRatio: `${aspectRatio}` }}
                className="relative mx-auto w-full max-h-[75vh] rounded-2xl bg-white border-2 border-psi-deep/30 overflow-hidden shadow-card select-none flex items-center justify-center"
              >
                {activeTab === 'front' ? (
                  /* FRENTE */
                  frontImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frontImageUrl}
                      alt="Frente do Certificado"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted p-6 text-center">
                      Nenhuma arte carregada (anexe o PDF ou imagens na lateral esquerda)
                    </div>
                  )
                ) : (
                  /* VERSO COM CARIMBO ARRASTÁVEL E REDIMENSIONÁVEL */
                  <>
                    {backImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={backImageUrl}
                        alt="Verso do Certificado"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted p-6 text-center">
                        Nenhuma arte carregada (anexe o PDF ou imagens na lateral esquerda para posicionar o carimbo)
                      </div>
                    )}

                    {/* BLOCO DO CARIMBO DIGITAL: ARRASTE E REDIMENSIONAMENTO DIRETO SOBRE A ARTE */}
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
                        cursor: isDraggingStamp ? 'grabbing' : 'grab',
                      }}
                      className={`group rounded-xl p-2.5 transition-all ${
                        isDraggingStamp
                          ? 'bg-white/70 border-2 border-psi-deep shadow-lg ring-2 ring-psi-vibrant/30 scale-[1.01]'
                          : isResizingStamp
                          ? 'bg-white/70 border-2 border-psi-vibrant ring-2 ring-psi-vibrant/40'
                          : 'bg-transparent border border-dashed border-psi-vibrant/70 hover:bg-white/40 hover:border-psi-deep'
                      }`}
                    >
                      {/* Barra Superior do Bloco do Carimbo (Mover + Controles Rápidos de Tamanho) */}
                      <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-psi-vibrant/30 bg-white/80 px-1.5 py-0.5 rounded-lg backdrop-blur-xs">
                        <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-psi-deep">
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
                      <p className="font-mono text-ink whitespace-pre-line leading-tight font-medium select-none">
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

              <div className="p-4 rounded-2xl bg-[#FAF8FC] border border-line text-xs text-muted leading-relaxed flex items-center justify-between">
                <span>
                  👆 <strong>Como funciona:</strong> Arraste o carimbo com o mouse para a posição desejada no verso e use o puxador <strong>⤡</strong> no canto para redimensionar.
                </span>
                <span className="font-mono font-bold text-psi-deep shrink-0 ml-2">
                  X: {stampX}% | Y: {stampY}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
