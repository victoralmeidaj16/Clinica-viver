import { NextResponse } from 'next/server';
import { processarRespostaDoPsicologo } from '@/server/application/viverMaisRespostaPsicologo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook da Evolution API.
 *
 * Hoje serve a um único fluxo: a resposta que o psicólogo manda depois de
 * receber um paciente — `CONTATO` para confirmar que já falou com ele,
 * `ENCAMINHAR` para devolvê-lo à fila. Os dois caminhos passam exatamente pelas
 * funções que o link de confirmação e a varredura de SLA usam, para não existir
 * uma segunda regra de rodízio vivendo aqui dentro.
 *
 * A rota responde `200` mesmo quando ignora o evento. Devolver erro para o que
 * não interessa faria a Evolution reentregar em laço uma mensagem que nunca
 * será processada.
 */

/** Mensagens já processadas neste processo, contra a reentrega da Evolution. */
const jaProcessadas = new Set<string>();

function autorizado(request: Request): boolean {
  const esperado = process.env.EVOLUTION_WEBHOOK_TOKEN?.trim();
  // Falha fechada: sem token configurado a rota não existe na prática. O
  // contrário — aceitar tudo enquanto ninguém configurou — deixaria qualquer um
  // que descobrisse a URL confirmar contato em nome de um profissional.
  if (!esperado) return false;

  const recebido =
    request.headers.get('x-evolution-token')?.trim() ||
    request.headers.get('apikey')?.trim() ||
    new URL(request.url).searchParams.get('token')?.trim() ||
    '';
  return recebido.length === esperado.length && recebido === esperado;
}

interface MensagemRecebida {
  id: string;
  telefone: string;
  texto: string;
}

/** Extrai o que interessa do envelope da Evolution, tolerando as variações da v2. */
function lerMensagem(payload: unknown): MensagemRecebida | null {
  const corpo = payload as {
    event?: string;
    data?: unknown;
  };

  const evento = String(corpo?.event ?? '').toLowerCase().replace(/_/g, '.');
  if (evento && evento !== 'messages.upsert') return null;

  const dados = Array.isArray(corpo?.data) ? corpo.data[0] : corpo?.data;
  const item = dados as
    | {
        key?: { id?: string; remoteJid?: string; fromMe?: boolean };
        message?: {
          conversation?: string;
          extendedTextMessage?: { text?: string };
          ephemeralMessage?: { message?: { conversation?: string; extendedTextMessage?: { text?: string } } };
        };
      }
    | undefined;

  if (!item?.key || item.key.fromMe) return null;

  const remoteJid = String(item.key.remoteJid ?? '');
  // Grupo e status não são conversa com profissional; não há a quem responder.
  if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.startsWith('status@')) return null;

  const interna = item.message?.ephemeralMessage?.message ?? item.message;
  const texto = interna?.conversation ?? interna?.extendedTextMessage?.text ?? '';
  if (!texto.trim()) return null;

  return {
    id: String(item.key.id ?? `${remoteJid}:${texto}`),
    telefone: remoteJid.split('@')[0]!.split(':')[0]!,
    texto,
  };
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ success: false, error: 'Token inválido.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: true, ignorado: 'corpo_invalido' });
  }

  const mensagem = lerMensagem(payload);
  if (!mensagem) return NextResponse.json({ success: true, ignorado: 'evento_sem_uso' });

  if (jaProcessadas.has(mensagem.id)) {
    return NextResponse.json({ success: true, ignorado: 'reentrega' });
  }
  jaProcessadas.add(mensagem.id);

  try {
    const resultado = await processarRespostaDoPsicologo(mensagem.telefone, mensagem.texto);
    // O texto recebido nunca vai para o log: pode conter dado de paciente.
    console.info(`[whatsapp] Resposta de psicólogo processada: ${resultado.situacao}.`);
    return NextResponse.json({ success: true, situacao: resultado.situacao });
  } catch (erro) {
    // Solta a chave para a reentrega da Evolution ter uma segunda chance.
    jaProcessadas.delete(mensagem.id);
    console.error('Erro ao processar resposta de WhatsApp:', erro);
    return NextResponse.json({ success: false, error: 'Falha ao processar a resposta.' }, { status: 500 });
  }
}
