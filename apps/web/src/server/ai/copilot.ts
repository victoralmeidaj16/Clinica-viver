import { resolveSpeakerRoles, type RawTranscript } from '@thats-life/core';
import { CLINICAL_MODEL, getAiClient } from './client';
import { getDemoTranscript } from '../demo/sessionTranscript';
import { renderTranscriptText } from '../adapters/transcription';

/**
 * Copiloto clínico de sessão.
 *
 * Opera sobre a transcrição acumulada até o instante em que o profissional
 * aciona o painel — nunca sobre a sessão inteira. É o que torna o "resumo
 * parcial" parcial de fato: aos oito minutos de sessão, o copiloto só viu oito
 * minutos.
 *
 * O copiloto sugere e nada mais. Não escreve no prontuário, não registra
 * conduta, não dispara mensagem. Toda saída é material de apoio para o
 * profissional decidir.
 */

export type CopilotAction = 'summary' | 'risk' | 'hypothesis' | 'intervention';

export const COPILOT_ACTIONS: readonly CopilotAction[] = [
  'summary',
  'risk',
  'hypothesis',
  'intervention',
];

export function isCopilotAction(value: unknown): value is CopilotAction {
  return typeof value === 'string' && (COPILOT_ACTIONS as readonly string[]).includes(value);
}

const SYSTEM_PROMPT = `Você é um copiloto clínico que apoia psicólogas e psicólogos DURANTE a sessão, em português do Brasil.

O profissional está atendendo neste exato momento e vai ler sua resposta em poucos segundos, entre uma fala e outra. Escreva para ser lido nesse contexto.

REGRAS:
- Trabalhe apenas com o que está na transcrição parcial. Ela cobre só o trecho já ocorrido da sessão.
- Nunca invente contato visual, postura, expressão facial, tom de voz ou qualquer sinal não audível.
- Quando não houver evidência suficiente, diga isso explicitamente em vez de completar por inferência.
- Não produza diagnóstico. Hipóteses são hipóteses e devem ser apresentadas como tal.
- Não sugira conduta medicamentosa nem encaminhamento compulsório.
- Você sugere; quem decide é o profissional. Não escreva como se a conduta já estivesse tomada.

FORMATO:
- Máximo de 90 palavras. O profissional está em atendimento e não tem tempo de ler mais.
- Vá direto ao ponto, sem preâmbulo e sem repetir a pergunta.
- Texto corrido ou no máximo três marcadores curtos. Nada de cabeçalhos.`;

const ACTION_PROMPTS: Record<CopilotAction, string> = {
  summary:
    'Resuma o que o paciente trouxe até aqui: queixa central, contexto e o que mudou desde a última sessão, se isso apareceu na fala.',
  risk:
    'Aponte indicadores de alerta observáveis na fala até aqui — sofrimento agudo, ideação, uso de substâncias, isolamento, sinais de estresse elevado. Se não houver indicador de risco agudo, diga isso claramente e registre o nível de sofrimento que a fala sustenta.',
  hypothesis:
    'Organize hipóteses de formulação psicoterapêutica compatíveis com o relato até aqui, sinalizando o que ainda falta investigar para sustentá-las.',
  intervention:
    'Sugira uma pergunta ou técnica aplicável neste momento da sessão, ancorada em algo que o paciente acabou de dizer. Explique em uma frase por que cabe agora.',
};

/**
 * Recorta a transcrição no ponto em que a sessão está. Falas que ainda não
 * aconteceram não podem ser vistas pelo copiloto.
 */
function transcriptUpTo(patientId: string, elapsedSeconds: number): string {
  const demo = getDemoTranscript(patientId);
  const elapsedMs = Math.max(0, elapsedSeconds) * 1000;
  const spoken = demo.utterances.filter((utterance) => utterance.start <= elapsedMs);

  if (spoken.length === 0) {
    return '';
  }

  const transcript: RawTranscript = {
    id: `partial-${patientId}`,
    status: 'processing',
    text: spoken.map((u) => u.text).join(' '),
    utterances: spoken,
  };
  const mapping = resolveSpeakerRoles(spoken, {
    professionalIntroEndMs: demo.professionalIntroEndMs,
  });

  return renderTranscriptText(transcript, mapping);
}

export interface CopilotSuggestion {
  readonly action: CopilotAction;
  readonly text: string;
  readonly transcriptCoverageSeconds: number;
}

export async function generateCopilotSuggestion(input: {
  patientId: string;
  patientReference: string;
  action: CopilotAction;
  elapsedSeconds: number;
}): Promise<CopilotSuggestion> {
  const transcript = transcriptUpTo(input.patientId, input.elapsedSeconds);

  if (!transcript) {
    return {
      action: input.action,
      text: 'Ainda não há fala suficiente nesta sessão para uma sugestão fundamentada. O copiloto responde a partir do que já foi dito.',
      transcriptCoverageSeconds: input.elapsedSeconds,
    };
  }

  const client = getAiClient();
  const stream = client.messages.stream({
    model: CLINICAL_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: `REFERÊNCIA PSEUDONIMIZADA DO PACIENTE: "${input.patientReference}"
TEMPO DECORRIDO DE SESSÃO: ${Math.floor(input.elapsedSeconds / 60)} min

TRANSCRIÇÃO PARCIAL (apenas o trecho já ocorrido):
"""
${transcript}
"""

TAREFA: ${ACTION_PROMPTS[input.action]}`,
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    return {
      action: input.action,
      text: 'O copiloto não pôde responder a esta solicitação. Siga com seu julgamento clínico.',
      transcriptCoverageSeconds: input.elapsedSeconds,
    };
  }

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

  return {
    action: input.action,
    text: text || 'O copiloto não retornou conteúdo para esta solicitação.',
    transcriptCoverageSeconds: input.elapsedSeconds,
  };
}
