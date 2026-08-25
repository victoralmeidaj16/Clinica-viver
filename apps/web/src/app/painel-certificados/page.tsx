'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  ExternalLink,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import type { CertificateRecord } from '@thats-life/core';

const STORAGE_KEY = 'cert_admin_pin';

export default function PainelCertificadosPage() {
  const [pin, setPin] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

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
              Digite o PIN de administração para anexar novos certificados e consultar registros.
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
    return (
      c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.courseTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-psi-soft text-psi-deep text-[11px] font-bold mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Registro e Upload de Certificados</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Certificados Emitidos & Registros
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Anexe certificados via upload para permitir a conferência de autenticidade e emissão de 2ª via em PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/painel-certificados/novo"
              className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Anexar Certificado (Upload & Carimbo)</span>
            </Link>

            <button
              onClick={handleLogout}
              title="Sair do painel"
              className="p-2.5 rounded-xl border border-line bg-white hover:bg-red-50 hover:text-red-700 text-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Busca e Atualização */}
        <div className="rounded-3xl border border-line bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-96 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              className="input pl-10 text-xs"
              placeholder="Buscar por aluno, código ou curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-semibold">
              Total: <strong>{filtered.length}</strong> registro(s)
            </span>
            <button
              onClick={() => fetchCertificados()}
              title="Atualizar lista"
              className="p-2 rounded-xl border border-line hover:bg-psi-soft transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabela de Certificados Registrados */}
        <div className="rounded-3xl border border-line bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-psi-soft/30 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="p-4">Código</th>
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Curso / Formação</th>
                  <th className="p-4 text-center">Carga</th>
                  <th className="p-4">Data Emissão</th>
                  <th className="p-4 text-right">Validador Público & 2ª Via</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.code} className="border-b border-line/60 last:border-0 hover:bg-psi-soft/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-psi-deep text-sm">{c.code}</td>
                    <td className="p-4 font-bold text-ink">{c.studentName}</td>
                    <td className="p-4 text-muted max-w-xs truncate">{c.courseTitle}</td>
                    <td className="p-4 text-center font-bold text-ink">{c.durationHours}</td>
                    <td className="p-4 text-muted">{c.issueDate}</td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/validar-certificado/${c.code}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-psi-soft hover:bg-psi-deep hover:text-white text-psi-deep font-bold transition-all text-xs shadow-xs"
                      >
                        <span>Visualizar / 2ª Via PDF</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted italic">
                      Nenhum certificado encontrado. Clique no botão acima para anexar um novo certificado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
