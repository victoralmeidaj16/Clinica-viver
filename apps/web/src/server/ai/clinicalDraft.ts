import { buildSoapPrompt, type SoapClinicalContent } from '@thats-life/core';
import {
  CLINICAL_MODEL,
  CLINICAL_PROMPT_VERSION,
  getAiClient,
} from './client';
import { getResolvedTranscript } from '../adapters/transcription';

/**
 * Geração real do rascunho SOAP.
 *
 * O prompt vem do core (`buildSoapPrompt`), que já carrega as travas éticas:
 * não inventar sinais não audíveis, escrever "não observável na fonte
 * fornecida" quando faltar evidência, e nunca aprovar o prontuário sozinho.
 * Este módulo só liga esse prompt ao modelo e valida o formato da resposta.
 *
 * O paciente é identificado por pseudônimo: nome, contato e documento nunca
 * entram no prompt.
 */

const SOAP_SCHEMA = {
  type: 'object',
  properties: {
    subjective: {
      type: 'string',
      description: 'Relatos, queixas e conteúdo emocional trazidos pelo paciente.',
    },
    objective: {
      type: 'string',
      description:
        'Apenas o que é audível ou explicitamente descrito na transcrição. Nunca postura, contato visual ou linguagem corporal.',
    },
    assessment: {
      type: 'string',
      description:
        'Hipóteses organizadas para revisão profissional, apresentadas como hipóteses e não como fatos.',
    },
    plan: {
      type: 'string',
      description: 'Intervenções combinadas, encaminhamentos e tarefas acordadas na sessão.',
    },
    extractedTasks: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Tarefas que o paciente concordou em fazer entre as sessões, em linguagem acessível e na segunda pessoa. Vazio se nenhuma foi combinada.',
    },
  },
  required: ['subjective', 'objective', 'assessment', 'plan', 'extractedTasks'],
  additionalProperties: false,
} as const;

export interface GeneratedDraft {
  readonly content: SoapClinicalContent;
  readonly provenance: {
    readonly provider: string;
    readonly model: string;
    readonly promptVersion: string;
    readonly transcriptionId: string;
    readonly generatedAt: string;
  };
}

function asSoapContent(value: unknown): SoapClinicalContent {
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta da IA não retornou um objeto SOAP.');
  }
  const raw = value as Record<string, unknown>;
  const text = (field: string): string => {
    const candidate = raw[field];
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      throw new Error(`Resposta da IA não trouxe o campo SOAP "${field}".`);
    }
    return candidate.trim();
  };

  const tasks = Array.isArray(raw.extractedTasks)
    ? raw.extractedTasks.filter((task): task is string => typeof task === 'string' && task.trim().length > 0)
    : [];

  return {
    subjective: text('subjective'),
    objective: text('objective'),
    assessment: text('assessment'),
    plan: text('plan'),
    extractedTasks: tasks.map((task) => task.trim()),
  };
}

export async function generateSoapDraft(input: {
  transcriptionId: string;
  patientReference: string;
  previousContext?: string;
}): Promise<GeneratedDraft> {
  const transcript = getResolvedTranscript(input.transcriptionId);
  if (!transcript) {
    throw new Error(`Transcrição ${input.transcriptionId} não encontrada para geração do rascunho.`);
  }

  const prompt = buildSoapPrompt({
    transcription: transcript.text,
    patientReference: input.patientReference,
    previousContext: input.previousContext,
  });

  const client = getAiClient();
  const stream = client.messages.stream({
    model: CLINICAL_MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: SOAP_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error(
      'O modelo recusou a geração do rascunho clínico. O prontuário permanece sem rascunho e exige redação manual.'
    );
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Resposta da IA não trouxe conteúdo textual.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('Resposta da IA não pôde ser interpretada como JSON.');
  }

  return {
    content: asSoapContent(parsed),
    provenance: {
      provider: 'anthropic',
      model: CLINICAL_MODEL,
      promptVersion: CLINICAL_PROMPT_VERSION,
      transcriptionId: transcript.id,
      generatedAt: new Date().toISOString(),
    },
  };
}
