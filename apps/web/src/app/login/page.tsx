'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? 'Não foi possível entrar.');
      }
      const me = (await fetch('/api/auth/me', { cache: 'no-store' }).then((result) =>
        result.json()
      )) as { data: { role: 'admin' | 'psicologo' } };
      router.replace(me.data.role === 'admin' ? '/gestao/cockpit' : '/cockpit');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-white">
      {/* ============================================================ */}
      {/* LADO ESQUERDO: Branding e Tons de Roxo (Estilo Showcase)     */}
      {/* ============================================================ */}
      <section className="hidden lg:flex lg:col-span-6 xl:col-span-6 bg-gradient-to-br from-psi-darkest via-[#502f74] to-psi-deep text-white p-10 xl:p-14 flex-col justify-between relative overflow-hidden select-none">
        {/* Elementos decorativos de fundo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-psi-vibrant/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#c38cff]/20 blur-3xl pointer-events-none" />

        {/* Grade de pontos decorativos (Top Right) */}
        <div className="absolute top-8 right-8 grid grid-cols-4 gap-2 opacity-25" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
          ))}
        </div>

        {/* Grade de pontos decorativos (Bottom Left) */}
        <div className="absolute bottom-8 left-8 grid grid-cols-4 gap-2 opacity-20" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
          ))}
        </div>

        {/* Topo: Logo & Identidade Clínica */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-psi-deep shadow-md shadow-black/10">
            <Brain className="h-6 w-6 text-psi-deep" />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              Viver Mais
              <span className="rounded-lg bg-psi-vibrant/40 border border-psi-vibrant/40 px-2 py-0.5 text-xs font-black text-white">
                Psi
              </span>
            </p>
            <p className="text-xs text-purple-200/80 font-medium">Clínica &amp; Inteligência Clínica</p>
          </div>
        </div>

        {/* Centro: Mockup Ilustrativo da Plataforma (Cards Flutuantes) */}
        <div className="relative my-auto py-10 max-w-sm xl:max-w-md mx-auto w-full z-10">
          {/* Efeito de brilho ambiente */}
          <div className="absolute -inset-4 bg-psi-vibrant/30 rounded-3xl blur-2xl -z-10" />

          {/* Card Flutuante Superior Direito (Pílula de Status) */}
          <div className="absolute -top-2 -right-2 xl:-right-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-2xl border border-purple-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 leading-tight">Prontuário SOAP</p>
              <p className="text-[10px] font-extrabold text-emerald-600">Emitido com Sucesso</p>
            </div>
          </div>

          {/* Card Central Branco (Simulando Dashboard do Psicólogo) */}
          <div className="bg-white rounded-3xl p-6 xl:p-7 shadow-2xl text-slate-800 border border-purple-100 relative z-10 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Atendimentos do Mês
                </span>
                <p className="text-2xl font-black text-psi-darkest tracking-tight">118 sessões</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Pacientes Ativos
                </span>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">32 ativos</p>
              </div>
            </div>

            {/* Gráfico Vetorial de Evolução Clínica */}
            <div className="relative h-20 w-full pt-2">
              <svg viewBox="0 0 280 70" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9E6BCF" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#9E6BCF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 55 Q 50 20, 90 40 T 170 15 T 230 35 T 280 10 L 280 70 L 0 70 Z"
                  fill="url(#chartGrad)"
                />
                <path
                  d="M 0 55 Q 50 20, 90 40 T 170 15 T 230 35 T 280 10"
                  fill="none"
                  stroke="#9E6BCF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="170" cy="15" r="4.5" fill="#5C397D" stroke="#ffffff" strokeWidth="2" />
              </svg>
              <div className="flex justify-between text-[9px] font-bold text-slate-400 pt-1">
                <span>Semana 1</span>
                <span>Semana 2</span>
                <span>Semana 3</span>
                <span>Semana 4</span>
              </div>
            </div>

            {/* Resumo de Atividades Recentes */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-psi-deep" />
                  <span className="font-bold text-slate-700">Psicoterapia Individual</span>
                </div>
                <span className="font-extrabold text-slate-900">Hoje às 14h</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-700">Repasses Clínicos</span>
                </div>
                <span className="font-bold text-emerald-600">100% em dia</span>
              </div>
            </div>
          </div>

          {/* Card Flutuante Inferior Esquerdo (Garantia de Ética e Sigilo) */}
          <div className="absolute -bottom-3 -left-2 xl:-left-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-2xl border border-purple-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 text-psi-deep flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-psi-deep" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 leading-tight">Sigilo CFP &amp; LGPD</p>
              <p className="text-[10px] font-semibold text-slate-500">Criptografia em Repouso</p>
            </div>
          </div>
        </div>

        {/* Rodapé do lado esquerdo: Chamada e Paginação visual */}
        <div className="relative z-10 space-y-4">
          <h2 className="text-2xl xl:text-3xl font-black text-white leading-tight tracking-tight">
            Prática clínica com clareza, ética e agilidade.
          </h2>
          <p className="text-xs xl:text-sm text-purple-200/90 leading-relaxed max-w-lg">
            O cockpit inteligente para psicólogos e gestão acompanharem prontuários automatizados,
            agenda integrada e repasses transparentes.
          </p>

          {/* Indicadores estilo carrossel */}
          <div className="pt-2 flex items-center gap-2">
            <div className="w-7 h-1.5 rounded-full bg-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* LADO DIREITO: Fundo Branco & Formulário de Login              */}
      {/* ============================================================ */}
      <section className="col-span-1 lg:col-span-6 xl:col-span-6 min-h-screen bg-white flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-12 lg:px-14 xl:px-20">
        {/* Cabeçalho mobile (oculto no desktop) */}
        <div className="lg:hidden flex items-center gap-2.5 pt-2 pb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-psi-deep text-white shadow-sm">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-black text-base text-psi-darkest tracking-tight flex items-center gap-1">
              Viver Mais
              <span className="rounded bg-psi-soft px-1.5 py-0.2 text-xs font-bold text-psi-deep">
                Psi
              </span>
            </p>
          </div>
        </div>

        {/* Container Central do Formulário */}
        <div className="my-auto w-full max-w-md mx-auto py-6 space-y-8">
          {/* Header do Form */}
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-psi-deep bg-psi-soft px-3 py-1 rounded-full">
              Cockpit Profissional
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight font-sans">
              Acesse sua conta
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              Entre com suas credenciais para gerenciar seus atendimentos e prontuários.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={submit} className="space-y-5">
            {/* Campo de E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-extrabold text-ink uppercase tracking-wider">
                E-mail Profissional
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-11 text-sm text-ink placeholder:text-slate-400 outline-none transition-all focus:border-psi-deep focus:ring-4 focus:ring-purple-100 hover:border-slate-300"
                />
              </div>
            </div>

            {/* Campo de Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-extrabold text-ink uppercase tracking-wider">
                  Senha
                </label>
                <Link
                  href="/redefinir-senha"
                  className="text-xs font-bold text-psi-deep hover:text-psi-darkest hover:underline transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-11 pr-11 text-sm text-ink placeholder:text-slate-400 outline-none transition-all focus:border-psi-deep focus:ring-4 focus:ring-purple-100 hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Alerta de Erro */}
            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs font-bold text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span className="flex-1 leading-snug">{error}</span>
              </div>
            )}

            {/* Botão de Submissão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-psi-deep hover:bg-psi-darkest active:scale-[0.99] text-white py-3.5 px-5 font-black text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"
            >
              <span>{loading ? 'Validando acesso…' : 'Entrar na plataforma'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Nota de Segurança e Sigilo */}
          <div className="pt-2 text-center">
            <p className="text-xs text-muted/70 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-psi-deep shrink-0" />
              <span>Acesso restrito a profissionais autorizados • CFP &amp; LGPD</span>
            </p>
          </div>
        </div>

        {/* Rodapé do lado direito */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link href="/vitrine" className="hover:text-psi-deep transition-colors">
              Página Inicial
            </Link>
            <span>•</span>
            <span className="text-slate-400">Ambiente Seguro</span>
          </div>
          <p className="text-slate-400">© 2026 Clínica Viver Mais</p>
        </div>
      </section>
    </main>
  );
}

