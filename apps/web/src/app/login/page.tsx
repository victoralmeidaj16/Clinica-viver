'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  Hand,
  Lock,
  LockKeyhole,
  Mail,
  User,
  type LucideIcon,
} from 'lucide-react';

const RECURSOS: { icone: LucideIcon; label: string }[] = [
  { icone: User, label: 'Pacientes' },
  { icone: CalendarDays, label: 'Atendimentos' },
  { icone: FileText, label: 'Processos da clínica' },
];

function Marca({ claro }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <Image
        src={claro ? '/logo-viver-mais-white.png' : '/logo-viver-mais.png'}
        alt="Viver Mais Psicologia"
        width={190}
        height={36}
        className="h-8 w-auto object-contain sm:h-9"
        priority
      />
      <span className={`h-8 w-px ${claro ? 'bg-white/30' : 'bg-psi-soft'}`} />
      <p
        className={`text-[11px] font-semibold uppercase leading-relaxed tracking-[0.16em] ${
          claro ? 'text-white/85' : 'text-psi-deep'
        }`}
      >
        Ambiente do
        <br />
        profissional
      </p>
    </div>
  );
}

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
    <main className="flex min-h-screen items-center justify-center bg-psi-light px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-contrast lg:grid-cols-2">
        {/* Painel roxo: imagem de ambientação e identidade visual */}
        <section className="relative hidden min-h-[700px] overflow-hidden bg-[#3b1d5a] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:min-h-[740px] xl:p-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
            style={{ backgroundImage: `url('/capa-login-viver-mais.png')` }}
          />
          {/* Suave camada de contraste para legibilidade */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#3b1d5a]/20 via-transparent to-[#240e38]/50"
          />

          <div className="relative z-10 space-y-10">
            <Marca claro />

            <div className="space-y-5">
              <h2 className="text-4xl font-extrabold leading-[1.15] tracking-tight drop-shadow-sm xl:text-[2.65rem]">
                Sua rotina na Clínica Viver Mais Psicologia,{' '}
                <span className="text-[#d8bcf5]">em um só lugar.</span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-white/90 drop-shadow-sm">
                Acesse sua plataforma para acompanhar seus pacientes, atendimentos e processos da clínica de forma
                simples e organizada.
              </p>
            </div>

            <ul className="flex flex-wrap gap-x-12 gap-y-6">
              {RECURSOS.map(({ icone: Icone, label }) => (
                <li key={label} className="space-y-3">
                  <Icone className="h-7 w-7 text-white/90 drop-shadow-sm" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-white/90 drop-shadow-sm">{label}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Formulário de login */}
        <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-14 xl:px-20">
          <div className="mb-10 lg:hidden">
            <Marca />
          </div>

          <div className="mx-auto w-full max-w-md space-y-8">
            <div className="space-y-3">
              <h1 className="flex items-center gap-2 text-4xl font-black tracking-tight text-psi-darkest">
                Olá! <Hand className="h-8 w-8 -rotate-12 text-psi-vibrant" aria-hidden="true" />
              </h1>
              <p className="text-xl font-extrabold text-psi-darkest">Acesse seu ambiente profissional</p>
              <p className="text-sm leading-relaxed text-muted">
                Entre com seus dados para acompanhar sua rotina e gerenciar seus atendimentos na Viver Mais.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-sm font-bold text-psi-darkest">
                  E-mail profissional
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-psi-soft bg-psi-light px-4 py-3.5 pl-11 text-sm text-ink outline-none transition-all placeholder:text-muted/70 hover:border-psi-vibrant/40 focus:border-psi-deep focus:bg-white focus:ring-4 focus:ring-psi-soft"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="block text-sm font-bold text-psi-darkest">
                    Senha
                  </label>
                  <Link
                    href="/redefinir-senha"
                    className="text-xs font-bold text-psi-deep transition-colors hover:text-psi-darkest hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-psi-soft bg-psi-light px-4 py-3.5 pl-11 pr-11 text-sm text-ink outline-none transition-all placeholder:text-muted/70 hover:border-psi-vibrant/40 focus:border-psi-deep focus:bg-white focus:ring-4 focus:ring-psi-soft"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted transition-colors hover:text-psi-deep"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs font-bold text-rose-800 animate-in fade-in duration-200"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span className="flex-1 leading-snug">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-psi-deep px-5 py-3.5 text-sm font-bold text-white shadow-lift transition-all hover:bg-psi-darkest active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              >
                <span>{loading ? 'Validando acesso…' : 'Entrar na plataforma'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="space-y-4">
              <p className="flex items-center gap-2.5 text-sm text-muted">
                <Lock className="h-4 w-4 shrink-0 text-psi-deep" />
                Acesso exclusivo para profissionais Viver Mais
              </p>
              <Link href="/vitrine" className="inline-block text-xs text-muted transition-colors hover:text-psi-deep">
                ← Voltar para a página inicial
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
