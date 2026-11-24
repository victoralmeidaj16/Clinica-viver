import { isValidAppointmentDuration } from '@thats-life/core/src/scheduling/validation';
import { CLINICAL_SERVICES } from './manualAppointment';

/**
 * Público e duração da sessão pela especificação final (§§ 7.04 e 14).
 *
 * Os conjuntos B e C preveem "50 minutos individual e 1h30 casal/grupo" para
 * Atendimento Psicológico, Orientação Parental, Orientação Vocacional e
 * Orientação Profissional. Avaliação (conjunto A) aceita 50, 1h30 ou duração
 * variável. A mesma regra serve ao link do paciente e à agenda manual; a única
 * diferença entre eles é o que fazer quando o público do vínculo não indica a
 * duração (ver `duracaoCompativelComPublico`).
 */

const LIMITE_PUBLICO = 160;
const COLETIVO = /\b(casal|casais|familia|grupo)\b/;

function normalizar(texto?: string): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ').toLowerCase();
}

/** Casal, família ou grupo: o conjunto atendido é uma única sessão de 1h30. */
export function publicoColetivo(publico?: string): boolean {
  return COLETIVO.test(normalizar(publico));
}

/**
 * O público gravado na própria sessão: um retrato da reserva, que não acompanha
 * edições posteriores da triagem.
 */
export function publicoDaSessao(input: {
  serviceKey?: string;
  duracaoMin: number;
  publicoDoVinculo?: string;
}): string | undefined {
  if (input.serviceKey === 'ORIENTACAO_PARENTAL' && input.duracaoMin === 90) return 'Família';
  const publico = input.publicoDoVinculo?.trim().slice(0, LIMITE_PUBLICO);
  if (publico) return publico;
  return input.serviceKey === 'PSICOTERAPIA_CASAL' ? 'Casal' : undefined;
}

/**
 * `origem` só pesa quando o público não decide a duração:
 * - na agenda manual o profissional escolhe 50 ou 1h30 (e, na Orientação
 *   Parental, o atendimento "em família" mesmo com público individual);
 * - no link o paciente não escolhe formato, então vale o que ele já recebia:
 *   50 minutos.
 */
export function duracaoCompativelComPublico(
  serviceKey: string,
  duracaoMin: number,
  publicoDoVinculo: string | undefined,
  origem: 'link' | 'manual'
): boolean {
  if (!CLINICAL_SERVICES.some((servico) => servico.key === serviceKey)) return false;
  if (serviceKey === 'AVALIACAO') return isValidAppointmentDuration(duracaoMin);
  if (serviceKey === 'PSICOTERAPIA_CASAL') return duracaoMin === 90;

  const conhecido = Boolean(publicoDoVinculo?.trim());
  if (publicoColetivo(publicoDoVinculo)) return duracaoMin === 90;

  if (serviceKey === 'ORIENTACAO_PARENTAL') {
    if (origem === 'manual' || !conhecido) return duracaoMin === 50 || duracaoMin === 90;
    return duracaoMin === 50;
  }
  if (conhecido || origem === 'link') return duracaoMin === 50;
  return duracaoMin === 50 || duracaoMin === 90;
}
