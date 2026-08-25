'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Check,
  FileImage,
  FileText,
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

  // Drag over states para dropzone
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);

  // Aba ativa de preview: 'verso' para posicionar e redimensionar o carimbo ou 'front' para conferir
  const [activeTab, setActiveTab] = useState<'verso' | 'front'>('verso');

  // Posição e estilo do carimbo no Verso
  const [stampX, setStampX] = useState<number>(5);
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

  const filePdfRef = useRef<HTMLInputElement>(null);
  const fileFrontRef = useRef<HTMLInputElement>(null);
  const fileBackRef = useRef<HTMLInputElement>(null);

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

        const newX = Math.max(1, Math.min(90, dragStartRef.current.startX + deltaXPct));
        const newY = Math.max(1, Math.min(90, dragStartRef.current.startY + deltaYPct));

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
              disabled={saving}
              className="btn-primary py-2.5 px-6 text-xs font-bold shadow-md flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Gravando…' : 'Salvar e Registrar Certificado'}</span>
            </button>
          </div>
        </div>

        {/* LAYOUT EM 2 COLUNAS: CONFIGURAÇÕES NA LATERAL + CANVAS AMPLO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA LATERAL ESQUERDA: CONFIGURAÇÕES & UPLOAD */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            <form id="form-anexar" onSubmit={handleSave} className="space-y-5">
              {/* CARD 1: UPLOADS DE ARQUIVO */}
              <div className="rounded-3xl border border-line bg-white p-5 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-psi-vibrant" />
                    1. Upload dos Arquivos
                  </span>
                  <span className="text-[10px] font-semibold text-muted">PNG, JPG ou PDF</span>
                </div>

                <div className="space-y-3">
                  {/* Opção A: PDF de 2 Páginas */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(true);
                    }}
                    onDragLeave={() => setIsDraggingPdf(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                      handleUploadPdf(e.dataTransfer.files?.[0]);
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all space-y-2 ${
                      isDraggingPdf
                        ? 'border-psi-deep bg-psi-soft/80'
                        : frontImageUrl && isPdf
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-dashed border-psi-vibrant/40 bg-[#FAF8FC] hover:border-psi-deep'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-psi-vibrant" />
                        <span className="font-extrabold text-xs text-ink">PDF de 2 Páginas</span>
                      </div>
                      <span className="text-[9px] text-muted font-bold">Frente & Verso</span>
                    </div>

                    {frontImageUrl && isPdf ? (
                      <div className="flex items-center justify-between bg-emerald-100 text-emerald-900 p-2 rounded-xl text-[11px] font-bold">
                        <span className="truncate max-w-[200px]">✓ {frontFileName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFrontImageUrl(null);
                            setBackImageUrl(null);
                            setFrontFileName('');
                            setBackFileName('');
                          }}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => filePdfRef.current?.click()}
                        className="w-full py-2 px-3 bg-psi-soft hover:bg-psi-deep hover:text-white text-psi-deep font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Selecionar PDF (2 Págs)</span>
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

                  {/* Opção B: Imagem Frente */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFront(true);
                    }}
                    onDragLeave={() => setIsDraggingFront(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFront(false);
                      handleUploadFrontImage(e.dataTransfer.files?.[0]);
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all space-y-2 ${
                      isDraggingFront
                        ? 'border-emerald-600 bg-emerald-50'
                        : frontImageUrl && !isPdf
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-dashed border-line bg-[#FAF8FC] hover:border-emerald-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-emerald-600" />
                        <span className="font-extrabold text-xs text-ink">Página 1: Frente (Imagem)</span>
                      </div>
                    </div>

                    {frontImageUrl && !isPdf ? (
                      <div className="flex items-center justify-between bg-emerald-100 text-emerald-900 p-2 rounded-xl text-[11px] font-bold">
                        <span className="truncate max-w-[200px]">✓ {frontFileName || 'Frente carregada'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFrontImageUrl(null);
                            setFrontFileName('');
                          }}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileFrontRef.current?.click()}
                        className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Imagem Frente</span>
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

                  {/* Opção C: Imagem Verso */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingBack(true);
                    }}
                    onDragLeave={() => setIsDraggingBack(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingBack(false);
                      handleUploadBackImage(e.dataTransfer.files?.[0]);
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all space-y-2 ${
                      isDraggingBack
                        ? 'border-purple-600 bg-purple-50'
                        : backImageUrl && !isPdf
                        ? 'border-purple-300 bg-purple-50/60'
                        : 'border-dashed border-line bg-[#FAF8FC] hover:border-purple-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-purple-600" />
                        <span className="font-extrabold text-xs text-ink">Página 2: Verso (Imagem)</span>
                      </div>
                    </div>

                    {backImageUrl && !isPdf ? (
                      <div className="flex items-center justify-between bg-purple-100 text-purple-900 p-2 rounded-xl text-[11px] font-bold">
                        <span className="truncate max-w-[200px]">✓ {backFileName || 'Verso carregado'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setBackImageUrl(null);
                            setBackFileName('');
                          }}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileBackRef.current?.click()}
                        className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-800 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Imagem Verso</span>
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

              {error && <p className="text-xs font-bold text-coral text-center">{error}</p>}

              <button
                type="submit"
                disabled={saving}
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
                    📜 Página 2: Verso (Arraste & Redimensione o Carimbo)
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
                    📄 Página 1: Frente (Conferência)
                  </button>
                </div>

                <span className="text-[11px] text-muted italic">
                  💡 Arraste o carimbo com o mouse para posicioná-lo no verso.
                </span>
              </div>

              {/* CANVAS CONTAINER AMPLO */}
              <div
                ref={canvasRef}
                className="relative mx-auto w-full aspect-[1.414/1] rounded-2xl bg-[#FAF8FC] border-2 border-psi-deep/30 overflow-hidden shadow-card select-none"
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
                    <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted p-6 text-center">
                      Nenhuma arte de frente carregada (envie o PDF ou imagem na lateral esquerda)
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
                      <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted p-6 text-center">
                        Nenhuma arte de verso carregada (envie o PDF ou imagem na lateral esquerda para posicionar o carimbo)
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
                        cursor: isDraggingStamp ? 'grabbing' : 'grab',
                      }}
                      className={`group rounded-xl p-2.5 transition-all ${
                        isDraggingStamp
                          ? 'bg-white/60 border-2 border-psi-deep shadow-lg ring-2 ring-psi-vibrant/30 scale-[1.01]'
                          : isResizingStamp
                          ? 'bg-white/60 border-2 border-psi-vibrant ring-2 ring-psi-vibrant/40'
                          : 'bg-transparent border border-dashed border-psi-vibrant/70 hover:bg-white/40 hover:border-psi-deep'
                      }`}
                    >
                      {/* Barra Superior do Bloco do Carimbo (Mover + Controles Rápidos de Tamanho) */}
                      <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-psi-vibrant/30 bg-white/70 px-1.5 py-0.5 rounded-lg">
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

              <div className="p-4 rounded-2xl bg-[#FAF8FC] border border-line text-xs text-muted leading-relaxed flex items-center justify-between">
                <span>
                  👆 <strong>Como funciona:</strong> Arraste o carimbo com o mouse para a posição desejada no verso e use o puxador <strong>⤡</strong> no canto do carimbo para redimensionar.
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
