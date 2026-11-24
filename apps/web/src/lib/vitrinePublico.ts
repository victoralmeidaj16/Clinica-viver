import type { PublicoVitrine } from '@thats-life/core';

export type ServicoVitrineKey =
  | 'PSICOTERAPIA'
  | 'PSICOTERAPIA_CASAL'
  | 'AVALIACAO'
  | 'ORIENTACAO_PROFISSIONAL'
  | 'ORIENTACAO_PARENTAL';

export type ModalidadeVitrineKey =
  | 'SOCIAL'
  | 'PARTICULAR'
  | 'CASAL_SOCIAL'
  | 'CASAL_PARTICULAR'
  | 'FAMILIA_SOCIAL'
  | 'FAMILIA_PARTICULAR';

const PUBLICOS_INDIVIDUAIS: readonly PublicoVitrine[] = [
  'Individual',
  'Infantil',
  'Adolescente',
  'Outro',
];

const MODALIDADES_POR_SERVICO: Readonly<Record<ServicoVitrineKey, readonly ModalidadeVitrineKey[]>> = {
  PSICOTERAPIA: ['SOCIAL', 'PARTICULAR'],
  PSICOTERAPIA_CASAL: ['CASAL_SOCIAL', 'CASAL_PARTICULAR'],
  AVALIACAO: ['SOCIAL', 'PARTICULAR'],
  ORIENTACAO_PROFISSIONAL: ['SOCIAL', 'PARTICULAR'],
  ORIENTACAO_PARENTAL: ['SOCIAL', 'PARTICULAR', 'FAMILIA_SOCIAL', 'FAMILIA_PARTICULAR'],
};

const SERVICOS = new Set<ServicoVitrineKey>(Object.keys(MODALIDADES_POR_SERVICO) as ServicoVitrineKey[]);

export function opcoesPublicoVitrine(
  servicoKey: ServicoVitrineKey,
  modalidade: ModalidadeVitrineKey,
): readonly PublicoVitrine[] {
  if (servicoKey === 'AVALIACAO') return ['Individual', 'Infantil', 'Adolescente'];
  if (servicoKey === 'PSICOTERAPIA_CASAL') return ['Casal'];
  if (servicoKey === 'ORIENTACAO_PARENTAL') {
    return modalidade.startsWith('FAMILIA') ? ['Família'] : ['Individual'];
  }
  return PUBLICOS_INDIVIDUAIS;
}

function publicoBase(publico: string): string {
  return publico.trim().toLowerCase().startsWith('outro:') ? 'Outro' : publico.trim();
}

export function publicoVitrinePermitido(
  servicoKey: string | undefined,
  modalidade: string | undefined,
  publico: string | undefined,
): boolean {
  if (!servicoKey || !modalidade || !publico || !SERVICOS.has(servicoKey as ServicoVitrineKey)) {
    return false;
  }

  const servico = servicoKey as ServicoVitrineKey;
  if (!MODALIDADES_POR_SERVICO[servico].includes(modalidade as ModalidadeVitrineKey)) return false;

  return opcoesPublicoVitrine(servico, modalidade as ModalidadeVitrineKey)
    .includes(publicoBase(publico) as PublicoVitrine);
}

export function ajustarPublicoVitrineAtual(
  servicoKey: ServicoVitrineKey,
  modalidade: ModalidadeVitrineKey,
  atual: string,
): string {
  const opcoes = opcoesPublicoVitrine(servicoKey, modalidade);
  if (opcoes.includes(publicoBase(atual) as PublicoVitrine)) return atual;
  return opcoes.length === 1 ? opcoes[0] : '';
}
