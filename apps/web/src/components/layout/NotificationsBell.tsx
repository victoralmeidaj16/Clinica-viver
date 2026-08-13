'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, CheckCheck, CircleAlert, Info, Loader2 } from 'lucide-react';

/**
 * O sino do header, para gestão e psicólogo.
 *
 * A lista vem de `/api/application/notificacoes`, que a deriva da fila de
 * triagem e do credenciamento — o mesmo estado que o cockpit mostra. Não há
 * lista de exemplo nem contador fixo: quando não há nada, o sino diz que não há
 * nada.
 *
 * A atualização é por consulta periódica em vez de conexão persistente. Com um
 * punhado de pessoas logadas e eventos que se medem em horas (o SLA é de 24 h),
 * um WebSocket custaria infraestrutura para ganhar segundos que ninguém espera.
 */

type Severidade = 'INFO' | 'ATENCAO' | 'CRITICO';

interface Notificacao {
  chave: string;
  tipo: string;
  titulo: string;
  descricao: string;
  ocorridoEm: string;
  severidade: Severidade;
  href: string;
  lida: boolean;
}

interface ListaNotificacoes {
  itens: Notificacao[];
  naoLidas: number;
}

/** Intervalo entre consultas enquanto a aba está visível. */
const INTERVALO_MS = 60_000;

const ESTILO_SEVERIDADE: Record<Severidade, { icone: typeof Info; classe: string }> = {
  INFO: { icone: Info, classe: 'text-psi-deep bg-psi-soft' },
  ATENCAO: { icone: AlertTriangle, classe: 'text-amber-700 bg-amber-100' },
  CRITICO: { icone: CircleAlert, classe: 'text-coral-dark bg-coral-light/60' },
};

/** "há 3 h", "há 2 d" — a precisão que uma lista de avisos comporta. */
function tempoRelativo(iso: string): string {
  const instante = new Date(iso).getTime();
  if (!Number.isFinite(instante)) return '';
  const minutos = Math.round((Date.now() - instante) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function NotificationsBell() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<ListaNotificacoes>({ itens: [], naoLidas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/application/notificacoes', { cache: 'no-store' });
      const corpo = await resposta.json();
      if (!resposta.ok || !corpo.success) {
        setErro(corpo.error ?? 'Não foi possível carregar as notificações.');
        return;
      }
      setLista(corpo.data as ListaNotificacoes);
      setErro(null);
    } catch {
      setErro('Não foi possível carregar as notificações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // A carga sai do corpo do efeito para um microtask: assim o primeiro
  // `setState` acontece depois do render, e não dentro dele.
  useEffect(() => {
    void Promise.resolve().then(carregar);
    const timer = setInterval(() => {
      // Aba em segundo plano não consulta: o sino não é urgente o bastante para
      // manter tráfego em janela que ninguém está olhando.
      if (document.visibilityState === 'visible') void carregar();
    }, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [carregar]);

  // Abrir é o momento em que a lista precisa estar fresca.
  useEffect(() => {
    if (aberto) void Promise.resolve().then(carregar);
  }, [aberto, carregar]);

  useEffect(() => {
    if (!aberto) return;
    const clique = (evento: MouseEvent) => {
      if (!container.current?.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', clique);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', clique);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const marcar = useCallback(async (corpo: { chaves?: string[]; todas?: boolean }) => {
    // A lista devolvida pela marcação já vem com o estado novo — evita uma
    // segunda consulta e mantém o contador coerente com o servidor.
    try {
      const resposta = await fetch('/api/application/notificacoes/leitura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json();
      if (resposta.ok && dados.success) setLista(dados.data as ListaNotificacoes);
    } catch {
      // Falhar em marcar como lida deixa o aviso visível de novo, que é o lado
      // seguro do erro: nada se perde.
    }
  }, []);

  const abrirItem = (item: Notificacao) => {
    setAberto(false);
    if (!item.lida) void marcar({ chaves: [item.chave] });
    router.push(item.href);
  };

  const naoLidas = lista.naoLidas;

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="relative p-2.5 rounded-xl text-muted hover:text-ink hover:bg-psi-light transition-colors"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={
          naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : 'Notificações: nenhuma não lida'
        }
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-[26rem] bg-white border border-psi-soft rounded-2xl shadow-lift z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-psi-soft/70">
            <div>
              <p className="text-xs font-bold text-ink">Notificações</p>
              <p className="text-[10px] text-muted font-medium">
                {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Tudo em dia'}
              </p>
            </div>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={() => void marcar({ todas: true })}
                className="flex items-center gap-1.5 text-[10px] font-bold text-psi-deep hover:text-psi-darkest transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[60vh] sm:max-h-[26rem] overflow-y-auto">
            {carregando && (
              <p className="flex items-center gap-2 px-4 py-6 text-xs text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando…
              </p>
            )}

            {!carregando && erro && (
              <p className="px-4 py-6 text-xs text-coral-dark">{erro}</p>
            )}

            {!carregando && !erro && lista.itens.length === 0 && (
              <p className="px-4 py-8 text-xs text-muted text-center">
                Nenhuma notificação por aqui.
              </p>
            )}

            {!carregando &&
              !erro &&
              lista.itens.map((item) => {
                const { icone: Icone, classe } = ESTILO_SEVERIDADE[item.severidade];
                return (
                  <button
                    key={item.chave}
                    type="button"
                    onClick={() => abrirItem(item)}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-psi-soft/50 last:border-b-0 hover:bg-psi-light transition-colors ${
                      item.lida ? 'bg-white' : 'bg-psi-light/60'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${classe}`}
                    >
                      <Icone className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs leading-tight ${item.lida ? 'font-semibold text-ink/80' : 'font-bold text-ink'}`}
                        >
                          {item.titulo}
                        </span>
                        <span className="text-[10px] text-muted whitespace-nowrap pt-0.5">
                          {tempoRelativo(item.ocorridoEm)}
                        </span>
                      </span>
                      <span className="block text-[11px] text-muted leading-snug mt-1">
                        {item.descricao}
                      </span>
                    </span>
                    {!item.lida && (
                      <span
                        className="w-2 h-2 rounded-full bg-psi-vibrant shrink-0 mt-1.5"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
