import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  FileText,
  GraduationCap,
  Heart,
  House,
  Rocket,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface Props {
  /** Leva até o formulário de credenciamento, logo abaixo desta landing. */
  onQueroFazerParte: () => void;
}

interface ItemComIcone {
  icone: LucideIcon;
  titulo: string;
  texto: React.ReactNode;
}

const BENEFICIOS: ItemComIcone[] = [
  {
    icone: Users,
    titulo: 'Novos pacientes',
    texto:
      'Possibilidade de receber pacientes encaminhados pela clínica, de acordo com demanda, disponibilidade e compatibilidade profissional.',
  },
  {
    icone: CalendarDays,
    titulo: 'Estrutura para seus atendimentos',
    texto: 'Uma plataforma para acompanhar seus pacientes, atendimentos e processos da clínica de forma organizada.',
  },
  {
    icone: Heart,
    titulo: 'Apoio na sua trajetória profissional',
    texto: 'Uma rede de profissionais e uma estrutura pensada para quem está construindo e desenvolvendo sua prática clínica.',
  },
  {
    icone: GraduationCap,
    titulo: 'Créditos Educacionais',
    texto: (
      <>
        Ao realizar <strong className="font-bold text-ink">atendimentos</strong> pela Viver Mais, você pode acumular{' '}
        <strong className="font-bold text-ink">Créditos Educacionais</strong> para auxiliar no custeio de sua formação na
        Viver Mais.
      </>
    ),
  },
];

const RECURSOS_AMBIENTE: { icone: LucideIcon; label: string }[] = [
  { icone: Users, label: 'Pacientes' },
  { icone: CalendarDays, label: 'Atendimentos' },
  { icone: FileText, label: 'Prontuários' },
  { icone: Settings, label: 'Processos' },
];

const PASSOS: ItemComIcone[] = [
  {
    icone: FileText,
    titulo: 'Cadastro',
    texto: 'Preencha seus dados profissionais e informações necessárias para o credenciamento.',
  },
  {
    icone: CircleCheck,
    titulo: 'Validação',
    texto: 'Nossa equipe analisa as informações e verifica a possibilidade de credenciamento.',
  },
  {
    icone: Rocket,
    titulo: 'Ativação',
    texto: 'Com o credenciamento aprovado, você recebe as orientações para iniciar sua atuação na clínica.',
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-psi-deep">{children}</p>;
}

/** Ramo decorativo em traço, como o da referência visual da página. */
function RamoDecorativo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 180" fill="none" aria-hidden="true" className={className}>
      <path d="M60 178C60 130 58 80 70 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M66 60C40 50 28 28 34 6c22 12 34 32 32 54Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M62 110C88 102 104 80 100 54c-24 10-38 32-38 56Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M61 140C36 134 20 114 22 90c22 8 38 28 39 50Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Ilustração do ambiente do profissional — só formas, sem dados de pessoas. */
function NotebookAmbiente() {
  const menu = [House, Users, CalendarDays, FileText, Settings];
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-md select-none">
      <div className="rounded-t-2xl border-[6px] border-b-0 border-slate-800 bg-slate-800 shadow-contrast">
        <div className="flex aspect-[16/10] overflow-hidden rounded-t-lg bg-white">
          <div className="flex w-[26%] flex-col gap-2.5 bg-psi-darkest px-2.5 py-3">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-psi-vibrant" />
              <span className="h-1.5 w-8 rounded-full bg-white/60" />
            </div>
            {menu.map((Icone, indice) => (
              <div key={indice} className="flex items-center gap-1.5">
                <Icone className="h-2.5 w-2.5 text-white/70" />
                <span className="h-1 flex-1 rounded-full bg-white/25" />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-2.5 bg-psi-light p-3">
            <div>
              <p className="text-[9px] font-extrabold text-ink">Olá, profissional!</p>
              <p className="text-[6px] text-muted">Aqui é o seu espaço na Viver Mais.</p>
            </div>
            <div className="space-y-1.5 rounded-md bg-white p-2 shadow-card">
              <p className="text-[6px] font-bold text-ink">Seus próximos atendimentos</p>
              {[0, 1, 2].map((linha) => (
                <div key={linha} className="flex items-center gap-1.5 border-t border-line pt-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-psi-soft" />
                  <span className="h-1 w-12 rounded-full bg-slate-200" />
                  <span className="ml-auto h-1 w-6 rounded-full bg-psi-soft" />
                  <span className="h-1 w-4 rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-[-6%] h-3 rounded-b-xl bg-gradient-to-b from-slate-300 to-slate-400 shadow-lift" />
    </div>
  );
}

export function LandingEspecialista({ onQueroFazerParte }: Props) {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-psi-light via-psi-soft/60 to-psi-light">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-psi-soft" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-0 pt-12 lg:grid-cols-2 lg:pt-16">
          <div className="space-y-6 pb-4 lg:pb-16">
            <span className="inline-flex rounded-full bg-psi-soft px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-psi-deep">
              Faça parte da nossa equipe
            </span>
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-psi-darkest sm:text-5xl">
              Quer fazer parte da <span className="text-psi-vibrant">Clínica Viver Mais?</span>
            </h1>
            <p className="text-lg font-extrabold leading-snug text-psi-darkest sm:text-xl">
              Depois da graduação, você não precisa caminhar sozinho.
            </p>
            <p className="max-w-lg text-base leading-relaxed text-muted">
              Faça parte da nossa clínica e continue desenvolvendo sua prática profissional com uma estrutura que acompanha
              sua jornada.
            </p>
            <button
              type="button"
              onClick={onQueroFazerParte}
              className="inline-flex items-center gap-2.5 rounded-full bg-psi-deep px-7 py-3.5 text-sm font-bold text-white shadow-lift transition-all hover:bg-psi-darkest active:scale-95 sm:text-base"
            >
              Quero fazer parte da Viver Mais <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative self-end">
            <div aria-hidden="true" className="absolute -left-6 bottom-0 h-3/4 w-3/4 rounded-t-full bg-psi-vibrant/25 blur-2xl" />
            <div className="relative overflow-hidden rounded-t-[3rem] rounded-bl-[3rem] lg:rounded-bl-none">
              <img
                src="/hero_psychologist.jpg"
                alt="Psicóloga sorridente em um consultório acolhedor"
                className="h-72 w-full object-cover object-[70%_center] sm:h-96"
              />
            </div>
          </div>
        </div>
      </section>

      {/* O que você encontra */}
      <section className="relative bg-white">
        <RamoDecorativo className="pointer-events-none absolute right-6 top-8 hidden h-40 text-psi-vibrant/60 md:block" />
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-xl space-y-2">
            <Eyebrow>O que você encontra na Viver Mais</Eyebrow>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-psi-darkest">
              Um espaço para desenvolver sua prática
            </h2>
            <p className="text-sm text-muted">Ao fazer parte da clínica, você pode contar com:</p>
          </div>

          <ul className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="space-y-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-psi-soft text-psi-deep">
                  <Icone className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-base font-extrabold leading-snug text-psi-darkest">{titulo}</h3>
                <p className="text-sm leading-relaxed text-muted">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Ambiente do profissional */}
      <section className="px-6 lg:px-0">
        <div className="mx-auto grid max-w-7xl items-center gap-10 overflow-hidden rounded-3xl bg-gradient-to-r from-psi-light to-psi-soft/70 lg:grid-cols-2">
          <div className="bg-gradient-to-br from-white to-psi-soft px-6 pb-0 pt-10 sm:px-12 lg:py-14">
            <NotebookAmbiente />
          </div>
          <div className="space-y-5 px-6 pb-10 sm:px-12 lg:py-14 lg:pl-0">
            <Eyebrow>Ambiente do profissional</Eyebrow>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-psi-darkest">
              Sua rotina na Viver Mais, em um só lugar.
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted sm:text-base">
              Ao fazer parte da clínica, você terá acesso ao ambiente do profissional para acompanhar sua rotina de
              atendimentos e os processos da clínica.
            </p>
            <ul className="flex flex-wrap gap-2.5">
              {RECURSOS_AMBIENTE.map(({ icone: Icone, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-psi-soft bg-white py-1.5 pl-1.5 pr-4 text-xs font-semibold text-ink shadow-card"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-psi-soft text-psi-deep">
                    <Icone className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="inline-flex items-center gap-2.5 rounded-full bg-psi-deep px-6 py-3 text-sm font-bold text-white shadow-lift transition-all hover:bg-psi-darkest active:scale-95"
            >
              Acessar ambiente do profissional <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Passo a passo */}
      <section className="mx-auto max-w-6xl px-6 pb-4 pt-16">
        <div className="space-y-2">
          <Eyebrow>Passo a passo</Eyebrow>
          <h2 className="text-3xl font-black leading-tight tracking-tight text-psi-darkest">
            Comece sua jornada com a Viver Mais
          </h2>
          <p className="text-sm text-muted">O processo é simples e seguro. Veja como funciona:</p>
        </div>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-psi-soft">
          {PASSOS.map(({ icone: Icone, titulo, texto }, indice) => (
            <li key={titulo} className="flex gap-4 md:px-8 md:first:pl-0 md:last:pr-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-psi-deep text-xs font-black text-white">
                {indice + 1}
              </span>
              <div className="space-y-2">
                <Icone className="h-7 w-7 text-psi-deep" strokeWidth={1.5} />
                <h3 className="text-sm font-extrabold text-psi-darkest">{titulo}</h3>
                <p className="text-sm leading-relaxed text-muted">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
