'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, RefreshCw, Send, XCircle, type LucideIcon } from 'lucide-react';
import { TagStatus, type COR_ICONE } from '@/components/gestao/TagStatus';
import { avisoDoCatalogo, ROTULO_CANAL, ROTULO_DESTINATARIO, type CanalAviso, type DestinatarioAviso } from '@/lib/avisos/catalogo';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';

interface Envio {
  id: string;
  finalidade: string;
  canal: string;
  destinatarioTipo: string;
  destinoFinal?: string;
  referencia?: string;
  situacao: string;
  reenvioSeguro?: boolean;
  modeloVersao: number;
  tentativas: number;
  podeReenviar: boolean;
  reenvioDe?: string;
  reenviadoEm?: string;
  autorNome?: string;
  criadoEm: string;
}

// Tag neutra com a cor só no ícone (design.md).
const SITUACAO: Record<string, { rotulo: string; icone: LucideIcon; cor: keyof typeof COR_ICONE }> = {
  enviada: { rotulo: 'Entregue ao provedor', icone: CheckCircle2, cor: 'positivo' },
  registrado: { rotulo: 'Registrado no painel', icone: Circle, cor: 'neutro' },
  falha: { rotulo: 'Falhou', icone: XCircle, cor: 'negativo' },
  bloqueada_allowlist: { rotulo: 'Telefone recusado', icone: XCircle, cor: 'negativo' },
  provedor_desconfigurado: { rotulo: 'Integração desligada', icone: AlertTriangle, cor: 'atencao' },
  destinatario_invalido: { rotulo: 'Destino inválido', icone: XCircle, cor: 'negativo' },
};

const NAO_ENTREGUES = ['falha', 'bloqueada_allowlist', 'provedor_desconfigurado', 'destinatario_invalido'];

const EXTRAS: Record<string, string> = { alerta_coordenacao: 'Alerta de transbordo à coordenação', resposta_psicologo: 'Resposta ao psicólogo' };

function tituloDoAviso(finalidade: string): string {
  return avisoDoCatalogo(finalidade)?.titulo ?? EXTRAS[finalidade] ?? finalidade;
}

/** Registro de envios com filtro dos não entregues e reenvio (12.04). */
export function PainelEnviosAvisos() {
  const [envios, setEnvios] = useState<Envio[] | null>(null);
  const [disponivel, setDisponivel] = useState(true);
  const [soFalhas, setSoFalhas] = useState(true);
  const [desde, setDesde] = useState('');
  const [ate, setAte] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [incerto, setIncerto] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const params = new URLSearchParams();
    if (soFalhas) params.set('situacao', 'nao_entregues');
    if (desde) params.set('desde', desde);
    if (ate) params.set('ate', ate);
    try {
      const dados = await chamarGestao<{ envios: Envio[]; disponivel: boolean }>(`/api/application/gestao/avisos/envios?${params}`);
      setEnvios(dados.envios);
      setDisponivel(dados.disponivel);
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar o registro.');
    }
  }, [soFalhas, desde, ate]);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  async function reenviar(envio: Envio, confirmarResultadoIncerto = false) {
    setReenviando(envio.id);
    setMensagem(null);
    try {
      const { situacao } = await chamarGestao<{ situacao: string }>(
        `/api/application/gestao/avisos/envios/${encodeURIComponent(envio.id)}/reenvio`, { confirmarResultadoIncerto });
      setIncerto(null);
      setMensagem(situacao === 'enviada' ? 'Aviso reenviado e entregue ao provedor.' : `Reenvio registrado: ${SITUACAO[situacao]?.rotulo ?? situacao}.`);
      await carregar();
    } catch (causa) {
      const codigo = (causa as { code?: string }).code;
      if (codigo === 'RESULTADO_INCERTO') setIncerto(envio.id);
      else setErro(causa instanceof Error ? causa.message : 'Falha ao reenviar.');
    } finally {
      setReenviando(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card">
        <label className="flex items-center gap-2 text-xs font-bold text-ink">
          <input type="checkbox" checked={soFalhas} onChange={(event) => setSoFalhas(event.target.checked)} />
          Só não entregues e ainda não reenviados
        </label>
        <label className="text-[11px] font-bold text-muted">De
          <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 block rounded-xl border border-psi-soft bg-white px-3 py-1.5 text-xs text-ink focus:border-psi-vibrant focus:outline-none" />
        </label>
        <label className="text-[11px] font-bold text-muted">Até
          <input type="date" value={ate} onChange={(event) => setAte(event.target.value)} className="mt-1 block rounded-xl border border-psi-soft bg-white px-3 py-1.5 text-xs text-ink focus:border-psi-vibrant focus:outline-none" />
        </label>
        <button type="button" onClick={() => void carregar()} className="btn-outline min-h-9 px-4 py-2 text-xs">
          <RefreshCw aria-hidden className="h-4 w-4 text-psi-vibrant" /> Atualizar
        </button>
      </div>
      {!disponivel && <p className="text-xs font-semibold text-amber-800">O registro de envios ainda não está disponível neste ambiente.</p>}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      {mensagem && <p role="status" className="flex items-center gap-1.5 text-xs font-semibold text-ink"><CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />{mensagem}</p>}
      <div className="overflow-x-auto rounded-2xl border border-psi-soft/60 bg-surface shadow-card">
        <table className="w-full min-w-[56rem] text-left text-xs">
          <thead className="border-b border-psi-soft/60 bg-psi-soft/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-3">Quando</th><th className="px-4 py-3">Aviso</th><th className="px-4 py-3">Destinatário</th>
              <th className="px-4 py-3">Origem</th><th className="px-4 py-3">Retorno</th><th className="px-4 py-3">Versão</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-psi-soft/40">
            {envios?.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">{soFalhas ? 'Nenhum aviso pendente de entrega.' : 'Nenhum envio no período.'}</td></tr>
            )}
            {envios?.map((envio) => {
              const situacao = SITUACAO[envio.situacao] ?? { rotulo: envio.situacao, icone: Circle, cor: 'neutro' as const };
              const incertoAqui = envio.situacao === 'falha' && envio.reenvioSeguro === false;
              const reenviavel = envio.canal === 'whatsapp' && !envio.reenviadoEm && NAO_ENTREGUES.includes(envio.situacao);
              return (
                <tr key={envio.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{dataHoraBr(envio.criadoEm)}</td>
                  <td className="px-4 py-3 font-semibold text-ink">
                    {tituloDoAviso(envio.finalidade)}
                    {envio.reenvioDe && <span className="block text-[10px] font-normal text-muted">Reenvio{envio.autorNome ? ` por ${envio.autorNome}` : ''}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {ROTULO_DESTINATARIO[envio.destinatarioTipo as DestinatarioAviso] ?? envio.destinatarioTipo}
                    <span className="block text-[10px]">{ROTULO_CANAL[envio.canal as CanalAviso] ?? envio.canal}{envio.destinoFinal ? ` · final ${envio.destinoFinal}` : ''}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">{envio.referencia ?? '—'}</td>
                  <td className="px-4 py-3">
                    <TagStatus icone={situacao.icone} cor={situacao.cor}>{situacao.rotulo}</TagStatus>
                    {incertoAqui && <span className="mt-1 block text-[10px] text-amber-800">Sem confirmação do provedor: pode ter chegado.</span>}
                    {envio.tentativas > 1 && <span className="mt-1 block text-[10px] text-muted">{envio.tentativas} tentativas</span>}
                    {envio.reenviadoEm && <span className="mt-1 block text-[10px] text-muted">Reenviado em {dataHoraBr(envio.reenviadoEm)}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{envio.modeloVersao ? `v${envio.modeloVersao}` : 'padrão'}</td>
                  <td className="px-4 py-3">
                    {reenviavel ? (
                      envio.podeReenviar ? (
                        incerto === envio.id ? (
                          <div className="space-y-1">
                            <p className="max-w-[14rem] text-[10px] text-amber-800">Confirme com o destinatário que a mensagem não chegou.</p>
                            <button type="button" disabled={reenviando === envio.id} onClick={() => void reenviar(envio, true)} className="btn-primary min-h-8 justify-center text-[11px]">
                              Conferi, reenviar
                            </button>
                          </div>
                        ) : (
                          <button type="button" disabled={reenviando === envio.id} onClick={() => void reenviar(envio)} className="btn-ghost min-h-8 justify-center text-[11px]">
                            <Send className="h-3.5 w-3.5" /> Reenviar
                          </button>
                        )
                      ) : (
                        <span className="text-[10px] text-muted">Reenvio pelo fluxo próprio</span>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
