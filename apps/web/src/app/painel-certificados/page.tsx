'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  CheckCircle2,
  Filter,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { CertificateUploaderModal } from '@/components/certificados/CertificateUploaderModal';
import type { CertificateRecord, CertificateStatus } from '@thats-life/core';

const STORAGE_KEY = 'cert_admin_pin';

export default function PainelCertificadosPage() {
  const [pin, setPin] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | CertificateStatus>('all');

  // Modais
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);
  const [revocationReason, setRevocationReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPin(saved);
      setIsAuthenticated(true);
      fetchCertificados(saved);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Digite o PIN de acesso.');
      return;
    }

    const testPin = pinInput.trim();
    setLoading(true);
    setPinError(null);

    fetch(`/api/certificados?pin=${encodeURIComponent(testPin)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('PIN inválido ou não autorizado.');
        }
        const data = await res.json();
        setPin(testPin);
        setIsAuthenticated(true);
        sessionStorage.setItem(STORAGE_KEY, testPin);
        if (data.ok && Array.isArray(data.data)) {
          setCertificates(data.data);
        }
      })
      .catch((err) => {
        setPinError(err.message || 'Falha ao autenticar.');
      })
      .finally(() => setLoading(false));
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
    setPin('');
    setPinInput('');
  };

  const fetchCertificados = (currentPin = pin) => {
    if (!currentPin) return;
    setLoading(true);
    fetch(`/api/certificados?pin=${encodeURIComponent(currentPin)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.data)) setCertificates(d.data);
      })
      .catch((err) => console.error('Erro ao carregar certificados:', err))
      .finally(() => setLoading(false));
  };

  const handleUpdateStatus = async (codigo: string, novoStatus: CertificateStatus, motivo?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/certificados/${encodeURIComponent(codigo)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin,
        },
        body: JSON.stringify({
          status: novoStatus,
          motivo,
          revogadoPor: 'diretoria@viver.com',
        }),
      });

      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Erro ao atualizar status.');

      setShowRevokeModal(false);
      setSelectedCert(null);
      setRevocationReason('');
      fetchCertificados();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setActionLoading(false);
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
              Painel de Certificados
            </h1>
            <p className="text-xs text-muted">
              Digite o PIN de administração para gerenciar, incluir certificados e posicionar carimbos digitais.
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
              disabled={loading}
              className="btn-primary w-full py-3 font-bold text-xs"
            >
              {loading ? 'Validando…' : 'Entrar no Painel'}
            </button>
          </form>

          <div className="text-center text-[10px] text-muted">
            🔒 Módulo isolado de certificações da Viver Mais Psicologia.
          </div>
        </div>
      </div>
    );
  }

  const filtered = certificates.filter((c) => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchBusca =
      c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchBusca;
  });

  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-psi-soft text-psi-deep text-[11px] font-bold mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Gestão Acadêmica & Certificações</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Gestão de Certificados & Autenticidade
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Consulte, emita, revogue ou reative certificados de cursos e pós-graduações.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary py-2.5 px-4 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Incluir Certificado (Upload & Carimbo)</span>
            </button>

            <button
              onClick={handleLogout}
              title="Sair do painel"
              className="p-2.5 rounded-xl border border-line bg-white hover:bg-red-50 hover:text-red-700 text-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-96 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              className="input pl-10 text-xs"
              placeholder="Buscar por aluno, código (ex: yZV8anjS) ou curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                statusFilter === 'all' ? 'bg-psi-deep text-white shadow-xs' : 'bg-psi-soft/50 text-muted hover:text-ink'
              }`}
            >
              Todos ({certificates.length})
            </button>

            <button
              onClick={() => setStatusFilter('valid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                statusFilter === 'valid' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800'
              }`}
            >
              🟢 Válidos
            </button>

            <button
              onClick={() => setStatusFilter('revoked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                statusFilter === 'revoked' ? 'bg-red-600 text-white shadow-xs' : 'bg-red-50 text-red-800'
              }`}
            >
              🔴 Revogados
            </button>

            <button
              onClick={() => fetchCertificados()}
              title="Atualizar lista"
              className="p-2 rounded-xl border border-line hover:bg-psi-soft transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabela de Certificados */}
        <div className="rounded-3xl border border-line bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-psi-soft/30 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="p-4">Código</th>
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Curso / Formação</th>
                  <th className="p-4 text-center">Carga</th>
                  <th className="p-4">Emissão</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.code} className="border-b border-line/60 last:border-0 hover:bg-psi-soft/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-psi-deep">{c.code}</td>
                    <td className="p-4 font-bold text-ink">{c.studentName}</td>
                    <td className="p-4 text-muted max-w-xs truncate">{c.courseTitle}</td>
                    <td className="p-4 text-center font-bold text-ink">{c.durationHours}</td>
                    <td className="p-4 text-muted">{c.issueDate}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'valid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'revoked'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.status === 'valid' ? '🟢 Válido' : c.status === 'revoked' ? '🔴 Revogado' : '🟡 Cancelado'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/validar-certificado/${c.code}`}
                        target="_blank"
                        className="px-2.5 py-1 rounded-lg bg-psi-soft hover:bg-psi-soft/80 text-psi-deep font-bold transition-colors inline-block"
                      >
                        🔗 Validar
                      </Link>

                      {c.status === 'valid' ? (
                        <button
                          onClick={() => {
                            setSelectedCert(c);
                            setShowRevokeModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold transition-colors"
                        >
                          🚫 Revogar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(c.code, 'valid')}
                          disabled={actionLoading}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition-colors"
                        >
                          ✓ Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted italic">
                      Nenhum certificado encontrado para os critérios selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE UPLOAD & POSICIONAMENTO DO CARIMBO */}
        {showUploadModal && (
          <CertificateUploaderModal
            adminPin={pin}
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              setShowUploadModal(false);
              fetchCertificados();
            }}
          />
        )}

        {/* MODAL DE REVOGAÇÃO */}
        {showRevokeModal && selectedCert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-line space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-red-100 text-red-600">
                  <ShieldAlert className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="font-heading text-lg font-black text-red-950">
                    Revogar Certificado: {selectedCert.code}
                  </h3>
                  <p className="text-xs text-muted">
                    Aluno: <strong className="text-ink">{selectedCert.studentName}</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="block font-bold uppercase tracking-wider text-ink">
                  Motivo Oficial da Revogação (Ficará visível na validação pública) *
                </label>
                <textarea
                  required
                  className="input min-h-24 resize-y text-xs"
                  placeholder="Ex: Inadimplência pedagógica ou solicitação administrativa conforme diretriz acadêmica..."
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRevokeModal(false);
                    setSelectedCert(null);
                  }}
                  className="btn-outline py-2 px-4 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !revocationReason.trim()}
                  onClick={() => handleUpdateStatus(selectedCert.code, 'revoked', revocationReason)}
                  className="btn-primary bg-red-600 hover:bg-red-700 text-white py-2 px-4 text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Revogando…' : 'Confirmar Revogação'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
