'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { PARAM_FOCO } from '@/lib/focoNotificacao';

/**
 * Leva a tela até o item que a notificação clicada menciona.
 *
 * A página escreve `data-foco` na linha, no cartão ou na seção; o endereço
 * traz `?foco=<mesmo valor>`. Este componente não desenha nada: ele procura o
 * alvo, rola até ele e o realça por alguns segundos.
 *
 * A busca é por tentativas em vez de uma leitura única porque o alvo quase
 * nunca existe quando a página monta — a lista ainda está sendo carregada da
 * API. Desistir depois de alguns segundos evita ficar procurando para sempre
 * um paciente que saiu da fila entre o aviso e o clique.
 */

const CLASSE_REALCE = 'foco-notificacao';
const INTERVALO_TENTATIVA_MS = 150;
const ESPERA_MAXIMA_MS = 8_000;
const DURACAO_REALCE_MS = 4_000;

/**
 * Reclique no mesmo aviso, já estando na página de destino.
 *
 * `router.push` para o endereço em que já se está não muda os parâmetros, e o
 * efeito não voltaria a rodar — o clique pareceria não fazer nada. O sino
 * avisa por este evento, e o realce acontece de novo.
 */
export const EVENTO_FOCO = 'viver-mais:foco';

export function dispararFoco(foco: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENTO_FOCO, { detail: foco }));
}

interface Props {
  /**
   * Chamado quando um foco chega pelo endereço, antes da busca pelo alvo.
   * É por aqui que uma página abre a aba certa ou troca o mês exibido — sem
   * isso o alvo nunca chegaria a existir no DOM.
   */
  aoFocar?: (foco: string, parametros: URLSearchParams) => void;
}

function realcar(foco: string): () => void {
  const inicio = Date.now();
  let timerBusca: ReturnType<typeof setTimeout> | undefined;
  let timerRealce: ReturnType<typeof setTimeout> | undefined;
  let alvoRealcado: HTMLElement | undefined;

  const procurar = () => {
    // A mesma linha costuma existir duas vezes — o cartão do celular e a linha
    // da tabela larga, uma delas sempre escondida pelo breakpoint. Rolar até a
    // escondida não move a tela; a visível é a única que serve.
    const candidatos = document.querySelectorAll<HTMLElement>(
      `[data-foco="${CSS.escape(foco)}"]`
    );
    const alvo = Array.from(candidatos).find((elemento) => elemento.getClientRects().length > 0);
    if (!alvo) {
      if (Date.now() - inicio < ESPERA_MAXIMA_MS) {
        timerBusca = setTimeout(procurar, INTERVALO_TENTATIVA_MS);
      }
      return;
    }
    const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: semAnimacao ? 'auto' : 'smooth', block: 'center' });
    // Reaplicar a classe reinicia a animação, que é o que um segundo clique no
    // mesmo aviso precisa.
    alvo.classList.remove(CLASSE_REALCE);
    void alvo.offsetWidth;
    alvo.classList.add(CLASSE_REALCE);
    alvoRealcado = alvo;
    timerRealce = setTimeout(() => alvo.classList.remove(CLASSE_REALCE), DURACAO_REALCE_MS);
  };

  procurar();

  return () => {
    if (timerBusca) clearTimeout(timerBusca);
    if (timerRealce) clearTimeout(timerRealce);
    alvoRealcado?.classList.remove(CLASSE_REALCE);
  };
}

function FocoInterno({ aoFocar }: Props) {
  const parametros = useSearchParams();
  const foco = parametros.get(PARAM_FOCO);

  // O callback muda de identidade a cada render do pai; guardá-lo numa ref
  // mantém o efeito preso ao endereço, que é o que de fato dispara o foco.
  // A sincronia vem antes do efeito de foco: efeitos rodam na ordem em que
  // são declarados, então a ref já está em dia quando o foco é lido.
  const callback = useRef(aoFocar);
  useEffect(() => {
    callback.current = aoFocar;
  });

  useEffect(() => {
    if (!foco) return;
    callback.current?.(foco, new URLSearchParams(parametros.toString()));
    return realcar(foco);
    // `parametros` acompanha `foco`: os dois vêm do mesmo endereço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  useEffect(() => {
    const aoReceber = (evento: Event) => {
      const alvo = (evento as CustomEvent<string>).detail;
      if (alvo) realcar(alvo);
    };
    window.addEventListener(EVENTO_FOCO, aoReceber);
    return () => window.removeEventListener(EVENTO_FOCO, aoReceber);
  }, []);

  return null;
}

/**
 * `useSearchParams` obriga uma fronteira de Suspense na compilação estática.
 * Ela mora aqui para que cada página gaste uma linha, e não um envelope em
 * volta da tela inteira.
 */
export function FocoDeNotificacao(props: Props) {
  return (
    <Suspense fallback={null}>
      <FocoInterno {...props} />
    </Suspense>
  );
}
