'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';

export type AbaAgenda = 'agenda' | 'sessoes';

interface Etapa {
  alvo?: string;
  aba?: AbaAgenda;
  titulo: string;
  texto: string;
  dica?: string;
  ultima?: boolean;
}

const ETAPAS: Etapa[] = [
  { titulo: 'Boas-vindas à sua agenda',
    texto: 'Aqui você acompanha seu calendário, configura quando atende e vê suas sessões. Vamos conhecer cada parte em menos de 1 minuto.',
    dica: 'Para rever este passo a passo, use o botão "Ver passo a passo" no topo da página.' },
  { alvo: 'agenda-link', aba: 'agenda', titulo: 'Seu link de agendamento',
    texto: 'Envie este link para seus pacientes. Eles informam o CPF e escolhem um horário livre, sem precisar falar com você.',
    dica: 'O botão "WhatsApp" abre a mensagem pronta com o link.' },
  { alvo: 'agenda-agendar', aba: 'agenda', titulo: 'Agendar por conta própria',
    texto: 'Combinou uma sessão por fora? Use este botão para marcar escolhendo paciente, dia e horário.' },
  { alvo: 'agenda-abas', aba: 'agenda', titulo: 'Duas abas',
    texto: '"Agenda e disponibilidade" é onde você configura seus horários e, no fim, vê o calendário do mês. "Sessões e confirmações" lista seus atendimentos.' },
  { alvo: 'agenda-passo-1', aba: 'agenda', titulo: 'Passo 1: seus dias',
    texto: 'Clique nos dias da semana em que você atende. Os dias marcados ficam roxos.' },
  { alvo: 'agenda-passo-2', aba: 'agenda', titulo: 'Passo 2: horário e duração',
    texto: 'Escolha o período em que atende, quanto dura cada sessão e a modalidade. O sistema monta os horários sozinho.',
    dica: 'Atende de manhã e à noite? Use "Adicionar outro período".' },
  { alvo: 'agenda-passo-3', aba: 'agenda', titulo: 'Passo 3: bloqueios',
    texto: 'Vai tirar férias ou uma folga? Clique em "Adicionar bloqueio" e escolha as datas. Esses dias somem do seu link.' },
  { alvo: 'agenda-passo-4', aba: 'agenda', titulo: 'Passo 4: confira o resumo',
    texto: 'Aqui aparece como ficou sua disponibilidade e os horários exatos que o paciente vai ver no link.' },
  { alvo: 'agenda-salvar', aba: 'agenda', titulo: 'Salve para valer',
    texto: 'As mudanças só chegam aos pacientes depois que você clica em "Salvar disponibilidade".' },
  { alvo: 'agenda-calendario-mes', aba: 'agenda', titulo: 'O calendário do mês',
    texto: 'O número verde num dia indica quantas sessões há nele. Bolinha amarela é bloqueio. Clique numa data para ver os horários dela ao lado.' },
  { alvo: 'agenda-calendario-dia', aba: 'agenda', titulo: 'Os horários do dia',
    texto: 'Em verde, os horários já marcados. Nos livres, marque a caixinha para bloquear só aquele horário, ou use "Bloquear dia inteiro".' },
  { alvo: 'agenda-sessoes', aba: 'sessoes', titulo: 'Sessões e confirmações',
    texto: 'Cada sessão tem os botões para editar, reagendar ou cancelar. Depois do atendimento, clique em "Confirmar que ocorreu" para liberar a cobrança.',
    dica: 'Use a busca logo acima para ver só as sessões de um paciente.' },
  { aba: 'agenda', ultima: true, titulo: 'Tudo pronto!',
    texto: 'Agora é só configurar sua disponibilidade, compartilhar seu link e acompanhar suas sessões por aqui.',
    dica: 'Dúvidas? O menu "Ajuda", na lateral, explica cada parte do portal.' },
];

const CHAVE_VISTO = 'viver-mais:agenda-tour-visto';
const MARGEM = 16;
const FOLGA = 8;

/** Abre o passo a passo sozinho só na primeira visita do navegador. */
export function tourJaVisto(): boolean {
  try { return window.localStorage.getItem(CHAVE_VISTO) === '1'; } catch { return true; }
}

function marcarVisto() {
  try { window.localStorage.setItem(CHAVE_VISTO, '1'); } catch { /* navegação privada */ }
}

interface Props {
  onTrocarAba: (aba: AbaAgenda) => void;
  onFechar: () => void;
}

/**
 * Passo a passo da agenda: escurece a página, recorta a área explicada e
 * mostra um cartão ao lado dela. Muda de aba sozinho quando a etapa mora na
 * outra, e termina sempre na aba de disponibilidade.
 */
export function AgendaTour({ onTrocarAba, onFechar }: Props) {
  const [atual, setAtual] = useState(0);
  const [recorte, setRecorte] = useState<{ top: number; left: number; width: number; height: number }>();
  const [posicao, setPosicao] = useState<{ top: number; left: number }>();
  const cartao = useRef<HTMLDivElement>(null);
  const etapa = ETAPAS[atual];
  const centro = !etapa.alvo;

  const posicionar = useCallback(() => {
    const card = cartao.current;
    if (!card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const elemento = etapa.alvo ? document.getElementById(etapa.alvo) : null;
    if (!elemento) {
      setRecorte(undefined);
      setPosicao({ top: Math.max(MARGEM, (vh - ch) / 2), left: Math.max(MARGEM, (vw - cw) / 2) });
      return;
    }
    const r = elemento.getBoundingClientRect();
    const top = Math.max(FOLGA, r.top - FOLGA);
    const bottom = Math.min(vh - FOLGA, r.bottom + FOLGA);
    setRecorte({ top, left: r.left - FOLGA, width: r.width + FOLGA * 2, height: Math.max(0, bottom - top) });

    const gap = 16;
    if (vw < 620) { setPosicao({ top: vh - ch - MARGEM, left: MARGEM }); return; }
    if (vh - bottom >= ch + gap * 2) { setPosicao({ top: bottom + gap, left: Math.min(Math.max(MARGEM, r.left), vw - cw - MARGEM) }); return; }
    if (top >= ch + gap * 2) { setPosicao({ top: top - ch - gap, left: Math.min(Math.max(MARGEM, r.left), vw - cw - MARGEM) }); return; }
    if (vw - r.right - FOLGA >= cw + gap * 2) { setPosicao({ top: Math.min(Math.max(MARGEM, top), vh - ch - MARGEM), left: r.right + FOLGA + gap }); return; }
    if (r.left - FOLGA >= cw + gap * 2) { setPosicao({ top: Math.min(Math.max(MARGEM, top), vh - ch - MARGEM), left: r.left - FOLGA - gap - cw }); return; }
    setPosicao({ top: vh - ch - gap, left: vw - cw - MARGEM });
  }, [etapa.alvo]);

  useLayoutEffect(() => {
    if (etapa.aba) onTrocarAba(etapa.aba);
  }, [etapa.aba, onTrocarAba]);

  useEffect(() => {
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A aba nova só existe no DOM depois do próximo quadro.
    const quadro = requestAnimationFrame(() => {
      if (etapa.alvo) document.getElementById(etapa.alvo)?.scrollIntoView({ block: 'center', behavior: reduzir ? 'auto' : 'smooth' });
      posicionar();
    });
    const timer = window.setTimeout(posicionar, reduzir ? 0 : 400);
    cartao.current?.focus({ preventScroll: true });
    return () => { cancelAnimationFrame(quadro); window.clearTimeout(timer); };
  }, [etapa.alvo, posicionar]);

  useEffect(() => {
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, { passive: true });
    return () => {
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar);
    };
  }, [posicionar]);

  const fechar = useCallback(() => {
    marcarVisto();
    onTrocarAba('agenda');
    onFechar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [onFechar, onTrocarAba]);

  const avancar = useCallback(() => {
    if (ETAPAS[atual].ultima) fechar();
    else setAtual((valor) => valor + 1);
  }, [atual, fechar]);

  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fechar();
      if (evento.key === 'ArrowRight') avancar();
      if (evento.key === 'ArrowLeft') setAtual((valor) => Math.max(0, valor - 1));
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [avancar, fechar]);

  const rotuloEtapa = centro
    ? (etapa.ultima ? 'Fim do passo a passo' : 'Passo a passo')
    : `Passo ${atual} de ${ETAPAS.length - 2}`;

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        aria-hidden
        className="pointer-events-none fixed z-[91] rounded-[20px] transition-all duration-300 motion-reduce:transition-none"
        style={recorte
          ? { ...recorte, boxShadow: '0 0 0 4px rgba(158,107,207,.9), 0 0 0 9999px rgba(22,10,34,.74)' }
          : { top: '50%', left: '50%', width: 0, height: 0, boxShadow: '0 0 0 9999px rgba(22,10,34,.74)' }}
      />
      <div
        ref={cartao}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-tour-titulo"
        tabIndex={-1}
        className="fixed z-[92] flex w-[min(380px,calc(100vw-32px))] flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-[0_24px_60px_rgba(22,10,34,.4)] outline-none transition-all duration-300 motion-reduce:transition-none"
        style={posicao ?? { top: -9999, left: -9999 }}
      >
        {centro && (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-psi-soft"><CalendarCheck2 className="h-6 w-6 text-psi-deep" /></span>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-psi-vibrant">{rotuloEtapa}</span>
          {!etapa.ultima && <button type="button" onClick={fechar} className="p-1 text-xs font-bold text-muted hover:text-ink">Pular</button>}
        </div>
        <h3 id="agenda-tour-titulo" className="text-lg font-black text-ink [text-wrap:balance]">{etapa.titulo}</h3>
        <p className="text-[13.5px] leading-relaxed text-[#4A3D58]">{etapa.texto}</p>
        {etapa.dica && <p className="rounded-xl bg-canvas px-3 py-2.5 text-[12.5px] font-semibold leading-relaxed text-psi-deep">{etapa.dica}</p>}
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" aria-hidden>
            {ETAPAS.map((_, indice) => (
              <i key={indice} className={`h-1.5 rounded-full transition-all ${indice === atual ? 'w-[18px] bg-psi-vibrant' : indice < atual ? 'w-1.5 bg-[#C9AEE6]' : 'w-1.5 bg-psi-soft'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {atual > 0 && <button type="button" onClick={() => setAtual((valor) => valor - 1)} className="rounded-xl border border-psi-soft bg-white px-3 py-1.5 text-[11px] font-bold text-psi-darkest hover:bg-psi-soft">Voltar</button>}
            <button type="button" onClick={avancar} className="rounded-xl bg-psi-deep px-3 py-1.5 text-[11px] font-bold text-white hover:bg-psi-darkest">
              {atual === 0 ? 'Começar' : etapa.ultima ? 'Começar a usar' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
