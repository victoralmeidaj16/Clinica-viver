import 'server-only';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { isWhatsAppRecipientAllowed } from '@/server/adapters/whatsappAllowlist';
import { avisarRecebimentoPaciente, type ResultadoEnvio } from './viverMaisWhatsApp';
import type { TriagemPacienteRecord } from './persistence';

/** Falha técnica não equivale a número inexistente e não impede registrar o pedido. */
export async function verificarWhatsApp(telefone: string): Promise<'existe' | 'inexistente' | 'indisponivel'> {
  const number = normalizeBrazilPhone(telefone);
  if (!number) return 'inexistente';
  const url = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instancia = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  if (!url || !apiKey || !instancia || !isWhatsAppRecipientAllowed(telefone)) return 'indisponivel';
  try {
    const response = await fetch(`${url}/chat/whatsappNumbers/${instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ numbers: [number] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return 'indisponivel';
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return 'indisponivel';
    const item = body.find((entry) => entry && entry.number === number);
    return item?.exists === true ? 'existe' : item?.exists === false ? 'inexistente' : 'indisponivel';
  } catch {
    return 'indisponivel';
  }
}

type Tentativa = {
  inicio: number;
  promessa: Promise<ResultadoEnvio | null>;
  resultado?: ResultadoEnvio;
};
const tentativas = new Map<string, Tentativa>();
const JANELA_MS = 15 * 60_000;

/**
 * Reenvio só repete falha conhecida neste processo, com intervalo de um minuto.
 * Após restart não sabemos se houve envio: não arriscamos duplicar mensagens.
 * Promessa compartilhada impede dois pedidos concorrentes de dispararem juntos.
 */
export function receberTriagemWhatsApp(lead: TriagemPacienteRecord, reenvio = false): Promise<ResultadoEnvio | null> {
  const agora = Date.now();
  for (const [id, tentativa] of tentativas) {
    if (agora - tentativa.inicio > JANELA_MS) tentativas.delete(id);
  }
  const anterior = tentativas.get(lead.id);
  if (anterior && (!anterior.resultado?.reenvioSeguro || agora - anterior.inicio < 60_000)) {
    return anterior.promessa;
  }
  if (reenvio && !anterior) return Promise.resolve(null);
  const tentativa: Tentativa = { inicio: agora, promessa: Promise.resolve(null) };
  tentativa.promessa = Promise.resolve().then(() => avisarRecebimentoPaciente(lead)).catch((): ResultadoEnvio => ({
    finalidade: 'recebimento_paciente', chaveDedupe: `recebimento:${lead.id}`, situacao: 'falha',
  })).then((resultado) => {
    tentativa.resultado = resultado;
    return resultado;
  });
  tentativas.set(lead.id, tentativa);
  return tentativa.promessa;
}
