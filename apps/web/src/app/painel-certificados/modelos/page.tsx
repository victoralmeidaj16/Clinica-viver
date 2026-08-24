'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Check,
  FileImage,
  Lock,
  Palette,
  Plus,
  Save,
  Trash2,
  Type,
} from 'lucide-react';
import {
  blankCertificateTemplate,
  type CertificateField,
  type CertificateTemplate,
} from '@thats-life/core';
import { CertificateCanvas } from '@/components/certificados/CertificateCanvas';

const STORAGE_KEY = 'cert_admin_pin';

const VARIABLES = [
  ['{{nome_do_aluno}}', 'Nome do Aluno'],
  ['{{nome_do_curso}}', 'Nome do Curso'],
  ['{{data_de_inicio}}', 'Data de Início'],
  ['{{data_de_conclusao}}', 'Data de Conclusão'],
  ['{{data_de_emissao}}', 'Data de Emissão'],
  ['{{carga_horaria}}', 'Carga Horária'],
  ['{{link_de_validacao}}', 'Link de Validação'],
  ['{{codigo_de_validacao}}', 'Código do Certificado'],
] as const;

const DIGITAL_SIGNATURE_TEXT = `Assinado de forma digital por VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153
Duração e data: {{carga_horaria}}h, {{data_de_emissao}}. Para verificar autenticidade acesse: {{link_de_validacao}}
Vá na aba certificados e adicione o código: {{codigo_de_validacao}}`;

export default function EditorModelosCertificadosPage() {
  const [pin, setPin] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [target, setTarget] = useState<string>('default');
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<1 | 2>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPin(saved);
      setIsAuthenticated(true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !pin) return;
    let active = true;
    setLoading(true);
    setSelected(null);
    setActivePage(1);

    fetch(`/api/certificados/templates?id=${encodeURIComponent(target)}&pin=${encodeURIComponent(pin)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; template: CertificateTemplate | null }) => {
        if (!active) return;
        setTemplate(
          d.template ??
            blankCertificateTemplate(
              target === 'default' ? null : target,
              target === 'default' ? 'Modelo Padrão (Todos os Cursos)' : target
            )
        );
      })
      .catch((err) => console.error('Erro ao carregar modelo:', err))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [target, isAuthenticated, pin]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Digite o PIN de acesso.');
      return;
    }
    const testPin = pinInput.trim();
    setPin(testPin);
    setIsAuthenticated(true);
    sessionStorage.setItem(STORAGE_KEY, testPin);
  };

  const patchField = (id: string, patch: Partial<CertificateField>) =>
    setTemplate((t) =>
      t
        ? {
            ...t,
            fields: t.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
          }
        : t
    );

  const moveField = (id: string, xPct: number, yPct: number) => patchField(id, { xPct, yPct });

  const addTextField = () => {
    const id = `text-${Date.now()}`;
    const field: CertificateField = {
      id,
      name: 'Novo Texto',
      text: 'Digite seu texto aqui',
      page: activePage,
      xPct: 50,
      yPct: 50,
      fontPct: 2.2,
      fontWeight: 600,
      color: '#1E1528',
      align: 'center',
    };
    setTemplate((t) => (t ? { ...t, fields: [...t.fields, field] } : t));
    setSelected(id);
  };

  const addDigitalSignature = () => {
    const existing = template?.fields.find((f) => f.name === 'Assinatura digital e validação');
    if (existing) {
      setSelected(existing.id);
      setActivePage(2);
      return;
    }
    const id = `signature-${Date.now()}`;
    const field: CertificateField = {
      id,
      name: 'Assinatura digital e validação',
      text: DIGITAL_SIGNATURE_TEXT,
      page: 2,
      xPct: 50,
      yPct: 95.5,
      fontPct: 0.85,
      fontWeight: 500,
      color: '#111827',
      align: 'center',
    };
    setTemplate((t) => (t ? { ...t, fields: [...t.fields, field] } : t));
    setSelected(id);
    setActivePage(2);
  };

  const deleteSelectedField = () => {
    if (!selected) return;
    setTemplate((t) => (t ? { ...t, fields: t.fields.filter((f) => f.id !== selected) } : t));
    setSelected(null);
  };

  const onUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const isPdf = file.type === 'application/pdf';
      setTemplate((t) =>
        t
          ? {
              ...t,
              ...(isPdf
                ? {
                    backgroundUrl: result,
                    backgroundType: 'pdf' as const,
                    secondBackgroundUrl: result,
                    secondBackgroundType: 'pdf' as const,
                  }
                : activePage === 1
                ? { backgroundUrl: result, backgroundType: 'image' as const }
                : { secondBackgroundUrl: result, secondBackgroundType: 'image' as const }),
            }
          : t
      );
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!template) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/certificados/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin,
        },
        body: JSON.stringify({ template }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Erro ao salvar');
      setToast('Modelo salvo com sucesso!');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Erro ao salvar o modelo.');
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
            <h1 className="font-heading text-2xl font-black text-ink">Editor de Modelos</h1>
            <p className="text-xs text-muted">Digite o PIN para acessar o editor visual de certificados.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              className="input text-center text-lg font-mono font-bold"
              placeholder="PIN de Acesso"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
            />
            {pinError && <p className="text-xs font-semibold text-coral">{pinError}</p>}
            <button type="submit" className="btn-primary w-full py-3 font-bold text-xs">
              Acessar Editor
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectedField = template?.fields.find((f) => f.id === selected) ?? null;

  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header e Ações */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/painel-certificados"
              className="p-2 rounded-xl bg-white border border-line hover:bg-psi-soft text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-heading text-2xl font-black text-ink">Editor de Modelos de Certificado</h1>
              <p className="text-xs text-muted">
                Personalize a arte de fundo e posicione os textos e variáveis que serão impressos no documento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {toast && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {toast}
              </span>
            )}
            <button onClick={save} disabled={saving} className="btn-primary py-2.5 px-5 text-xs font-bold">
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando…' : 'Salvar Modelo'}</span>
            </button>
          </div>
        </div>

        {/* Seletor de Curso / Alvo */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-line shadow-xs">
          <label className="text-xs font-bold uppercase tracking-wider text-muted">Modelo Aplicado a:</label>
          <select
            className="input max-w-xs text-xs py-2"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="default">Modelo Padrão (Todos os Cursos)</option>
            <option value="pos-graduacao">Pós-Graduação Institucional</option>
            <option value="formacao-clinica">Formação Clínica</option>
            <option value="curso-extensao">Curso de Extensão</option>
          </select>
        </div>

        {loading || !template ? (
          <div className="rounded-3xl border border-line bg-white grid h-64 place-items-center text-xs text-muted">
            Carregando modelo visual…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* CANVAS PRINCIPAL */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex rounded-2xl border border-line bg-white p-1 shadow-xs">
                  {([1, 2] as const).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => {
                        setActivePage(page);
                        setSelected(null);
                      }}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activePage === page
                          ? 'bg-psi-deep text-white shadow-sm'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      Página {page} {page === 1 ? '· Frente' : '· Verso (Carimbo)'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn-outline py-2 px-3 text-xs font-bold"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    <span>Upload Arte Pág. {activePage}</span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(e) => onUpload(e.target.files?.[0])}
                  />
                </div>
              </div>

              {/* Componente Canvas */}
              <CertificateCanvas
                template={template}
                page={activePage}
                selectedKey={selected}
                onFieldDrag={moveField}
                onSelectField={setSelected}
              />

              <p className="text-[11px] text-muted text-center leading-relaxed">
                💡 Dica: Clique e arraste qualquer texto sobre o certificado para posicioná-lo. Selecione o campo ao lado para editar o conteúdo ou inserir variáveis dinâmicas.
              </p>
            </div>

            {/* BARRA LATERAL / INSPETOR */}
            <aside className="space-y-4">
              {/* Lista de Campos */}
              <div className="rounded-3xl border border-line bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Textos na Arte</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={addDigitalSignature}
                      className="px-2 py-1 rounded-lg bg-psi-soft hover:bg-psi-soft/80 text-psi-deep text-[10px] font-bold"
                      title="Adicionar carimbo de assinatura no verso"
                    >
                      + Carimbo
                    </button>
                    <button
                      onClick={addTextField}
                      className="px-2 py-1 rounded-lg bg-psi-deep hover:bg-psi-darkest text-white text-[10px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Texto
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {template.fields.length === 0 ? (
                    <p className="p-3 rounded-xl bg-psi-soft/30 text-center text-xs text-muted">
                      Nenhum texto adicionado.
                    </p>
                  ) : (
                    template.fields.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setSelected(f.id);
                          setActivePage(f.page ?? 1);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex flex-col ${
                          selected === f.id
                            ? 'bg-psi-soft text-psi-deep font-bold border border-psi-vibrant/30 shadow-xs'
                            : 'hover:bg-psi-soft/30 text-muted'
                        }`}
                      >
                        <span className="truncate">{f.name || 'Texto'} · Pág {f.page ?? 1}</span>
                        <span className="truncate text-[10px] font-normal opacity-80">{f.text}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Editor do Campo Selecionado */}
              {selectedField && (
                <div className="rounded-3xl border border-line bg-white p-5 shadow-sm space-y-3.5 text-xs">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <p className="font-bold uppercase tracking-wider text-psi-deep">Editar Campo</p>
                    <button
                      onClick={deleteSelectedField}
                      className="text-coral hover:text-red-700 p-1"
                      title="Excluir campo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Nome do Campo
                    </label>
                    <input
                      type="text"
                      className="input py-2 text-xs"
                      value={selectedField.name}
                      onChange={(e) => patchField(selectedField.id, { name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Conteúdo do Texto
                    </label>
                    <textarea
                      className="input min-h-16 py-2 text-xs resize-y"
                      value={selectedField.text}
                      onChange={(e) => patchField(selectedField.id, { text: e.target.value })}
                    />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Inserir Variável
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {VARIABLES.map(([token, label]) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() =>
                            patchField(selectedField.id, {
                              text: `${selectedField.text}${selectedField.text ? ' ' : ''}${token}`,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-psi-soft hover:bg-psi-soft/80 text-psi-deep text-[10px] font-bold"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Tamanho da Fonte ({selectedField.fontPct.toFixed(1)}%)
                    </label>
                    <input
                      type="range"
                      min={0.8}
                      max={6.0}
                      step={0.1}
                      value={selectedField.fontPct}
                      onChange={(e) => patchField(selectedField.id, { fontPct: Number(e.target.value) })}
                      className="w-full accent-psi-deep"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                        Alinhamento
                      </label>
                      <select
                        className="input py-1.5 text-xs"
                        value={selectedField.align}
                        onChange={(e) =>
                          patchField(selectedField.id, {
                            align: e.target.value as CertificateField['align'],
                          })
                        }
                      >
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                        Cor do Texto
                      </label>
                      <input
                        type="color"
                        className="h-9 w-full rounded-xl border border-line cursor-pointer p-0.5"
                        value={selectedField.color}
                        onChange={(e) => patchField(selectedField.id, { color: e.target.value })}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-ink cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={selectedField.uppercase ?? false}
                      onChange={(e) => patchField(selectedField.id, { uppercase: e.target.checked })}
                      className="rounded accent-psi-deep"
                    />
                    <span>Forçar Letras Maiúsculas</span>
                  </label>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
