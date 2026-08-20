'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleSlash,
  Clock,
  GraduationCap,
  Loader2,
  ShieldX,
  User,
} from 'lucide-react';

/**
 * Conferência de uma declaração de horas.
 *
 * Busca pela API em vez de consultar o banco no servidor, e a razão é de
 * topologia: o endereço impresso na declaração é o domínio público, servido
 * pela Vercel, que não tem — nem deve ter — `DATABASE_URL`. Só `/api/...`
 * atravessa o proxy até a VPS, onde o banco vive. Um componente de servidor
 * lendo o MySQL funcionaria em `app.clinicavivermais.cloud` e falharia
 * justamente no endereço que a coordenação do curso vai digitar.
 */

interface Resultado {
  situacao: 'valida' | 'revogada' | 'adulterada';
  codigo: string;
  psicologoNome: string;
  psicologoCrp: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  emitidoEm: string;
  revogacaoMotivo?: string;
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'encontrada'; resultado: Resultado }
  | { fase: 'ausente' }
  | { fase: 'limite' }
  | { fase: 'indisponivel' };

function dataLonga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function Moldura({
  tom,
  icone,
  titulo,
  descricao,
  children,
}: {
  tom: 'valida' | 'alerta' | 'negada';
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}) {
  const cores = {
    valida: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    alerta: 'border-amber-200 bg-amber-50 text-amber-900',
    negada: 'border-red-200 bg-red-50 text-red-900',
  }[tom];

  return (
    <div className="space-y-6">
      <div className={`rounded-3xl border p-6 flex items-start gap-4 ${cores}`}>
        <div className="shrink-0 mt-0.5">{icone}</div>
        <div className="space-y-1">
          <h2 className="font-black text-base leading-tight">{titulo}</h2>
          <p className="text-sm leading-relaxed opacity-90">{descricao}</p>
        </div>
      </div>

      {children}

      <div className="text-center">
        <Link
          href="/validar"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Conferir outro código
        </Link>
      </div>
    </div>
  );
}

function Dados({ resultado }: { resultado: Resultado }) {
  const linhas = [
    {
      icone: <User className="w-4 h-4" />,
      rotulo: 'Psicólogo(a)',
      valor: `${resultado.psicologoNome} — CRP ${resultado.psicologoCrp}`,
    },
    { icone: <GraduationCap className="w-4 h-4" />, rotulo: 'Curso', valor: resultado.curso },
    {
      icone: <Clock className="w-4 h-4" />,
      rotulo: 'Período declarado',
      valor: `${dataLonga(resultado.periodoInicio)} a ${dataLonga(resultado.periodoFim)}`,
    },
  ];

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 space-y-5 shadow-card">
      <div className="text-center pb-5 border-b border-line">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Carga horária declarada</p>
        <p className="text-4xl font-black text-psi-deep mt-1">
          {resultado.totalHoras}
          <span className="text-base font-bold text-muted ml-1.5">horas</span>
        </p>
        <p className="text-[11px] text-muted mt-1">
          {resultado.totalSessoes}{' '}
          {resultado.totalSessoes === 1 ? 'atendimento realizado' : 'atendimentos realizados'}
        </p>
      </div>

      <dl className="space-y-4">
        {linhas.map((linha) => (
          <div key={linha.rotulo} className="flex items-start gap-3">
            <span className="text-psi-vibrant mt-0.5 shrink-0">{linha.icone}</span>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{linha.rotulo}</dt>
              <dd className="text-sm font-semibold text-ink mt-0.5">{linha.valor}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="pt-4 border-t border-line flex flex-wrap gap-2 items-center justify-between text-[11px] text-muted">
        <span className="font-mono font-bold tracking-wider text-ink">{resultado.codigo}</span>
        <span>Emitida em {dataHora(resultado.emitidoEm)}</span>
      </div>
    </div>
  );
}

export default function ValidarDeclaracaoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  useEffect(() => {
    let ativo = true;

    fetch(`/api/application/declaracao-horas/validar/${encodeURIComponent(codigo)}`)
      .then(async (resposta) => {
        if (!ativo) return;
        if (resposta.status === 429) return setEstado({ fase: 'limite' });
        if (resposta.status === 404) return setEstado({ fase: 'ausente' });
        if (!resposta.ok) return setEstado({ fase: 'indisponivel' });

        const corpo = (await resposta.json()) as { ok?: boolean; data?: Resultado };
        if (!ativo) return;
        setEstado(corpo.ok && corpo.data ? { fase: 'encontrada', resultado: corpo.data } : { fase: 'indisponivel' });
      })
      .catch(() => {
        if (ativo) setEstado({ fase: 'indisponivel' });
      });

    return () => {
      ativo = false;
    };
  }, [codigo]);

  if (estado.fase === 'carregando') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
        <Loader2 className="w-7 h-7 animate-spin text-psi-vibrant" />
        <p className="text-sm font-semibold">Conferindo a declaração…</p>
      </div>
    );
  }

  if (estado.fase === 'limite') {
    return (
      <Moldura
        tom="alerta"
        icone={<AlertTriangle className="w-7 h-7" />}
        titulo="Muitas consultas deste acesso"
        descricao="Aguarde alguns minutos antes de conferir outro código. Se você precisa conferir várias declarações, fale com a clínica."
      />
    );
  }

  if (estado.fase === 'indisponivel') {
    return (
      <Moldura
        tom="alerta"
        icone={<AlertTriangle className="w-7 h-7" />}
        titulo="Não foi possível conferir agora"
        descricao="Houve uma falha ao consultar o registro da declaração. Tente novamente em alguns minutos."
      />
    );
  }

  if (estado.fase === 'ausente') {
    return (
      <Moldura
        tom="negada"
        icone={<CircleSlash className="w-7 h-7" />}
        titulo="Nenhuma declaração com este código"
        descricao="Confira se o código foi digitado exatamente como aparece no documento. Se ele estiver correto, a declaração não foi emitida pela Viver Mais Psicologia."
      />
    );
  }

  const { resultado } = estado;

  if (resultado.situacao === 'adulterada') {
    return (
      <Moldura
        tom="negada"
        icone={<ShieldX className="w-7 h-7" />}
        titulo="Este documento não confere"
        descricao="O registro desta declaração não corresponde ao que foi emitido. Não a aceite como comprovação e procure a coordenação da clínica."
      >
        <Dados resultado={resultado} />
      </Moldura>
    );
  }

  if (resultado.situacao === 'revogada') {
    return (
      <Moldura
        tom="alerta"
        icone={<AlertTriangle className="w-7 h-7" />}
        titulo="Declaração revogada pela clínica"
        descricao={
          resultado.revogacaoMotivo
            ? `Esta declaração foi emitida e depois revogada: ${resultado.revogacaoMotivo}`
            : 'Esta declaração foi emitida e depois revogada pela clínica. Ela não vale como comprovação.'
        }
      >
        <Dados resultado={resultado} />
      </Moldura>
    );
  }

  return (
    <Moldura
      tom="valida"
      icone={<BadgeCheck className="w-7 h-7" />}
      titulo="Declaração autêntica"
      descricao="Este documento foi emitido pela Viver Mais Psicologia e não foi alterado desde a emissão."
    >
      <Dados resultado={resultado} />
    </Moldura>
  );
}
