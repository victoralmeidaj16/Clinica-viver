/**
 * Vocabulário e casamento da auditoria de desistências.
 *
 * A auditoria deixou de ser uma tela própria (`/retencao`, com nome de paciente
 * e de psicólogo digitados à mão) e passou a viver dentro do cadastro, na
 * gestão de pacientes. O que a mudança exige é justamente isto: uma forma de
 * dizer, sem ambiguidade, a qual linha da fila um registro pertence.
 *
 * O módulo é puro para poder ser lido dos dois lados — a rota resolve o
 * registro no servidor, o painel do drawer o exibe no navegador — e para o
 * casamento poder ser testado sem subir banco nem servidor.
 */

export const MOTIVOS_DESISTENCIA = [
  ['FINANCEIRO', 'Financeiro / valor da sessão'],
  ['INSATISFACAO_CONDUTA', 'Insatisfação com a conduta clínica'],
  ['TROCA_ABORDAGEM', 'Busca por outra abordagem'],
  ['MOTIVOS_PESSOAIS', 'Motivos pessoais / mudança de rotina'],
  ['OUTRO', 'Outro motivo'],
] as const;

export type MotivoDesistencia = (typeof MOTIVOS_DESISTENCIA)[number][0];

const MOTIVOS = new Set<string>(MOTIVOS_DESISTENCIA.map(([valor]) => valor));

export function motivoValido(valor: unknown): valor is MotivoDesistencia {
  return typeof valor === 'string' && MOTIVOS.has(valor);
}

export function rotuloMotivo(valor: string): string {
  return MOTIVOS_DESISTENCIA.find(([chave]) => chave === valor)?.[1] ?? valor;
}

/** Chaves pelas quais uma linha da fila pode ser reconhecida num registro. */
export interface ChavesDoPaciente {
  patientId?: string;
  leadId?: string;
}

interface RegistroCasavel {
  pacienteId?: string;
  leadId?: string;
  dataDesistencia?: string;
}

/**
 * O registro de desistência daquele paciente, se houver.
 *
 * Casa por duas chaves porque a fila tem dois tipos de linha: quem já virou
 * paciente tem `pacienteId`, e quem ainda é lead da triagem só tem `leadId`.
 * Um registro antigo, gravado quando o formulário só pedia nomes, não tem
 * nenhuma das duas e por isso não casa com ninguém — é o comportamento
 * pretendido: ele não pertence a este paciente nem a nenhum outro, e inventar
 * um dono por semelhança de nome seria pior do que não exibi-lo.
 *
 * Entre vários registros do mesmo paciente devolve o mais recente por data, sem
 * depender da ordem em que a coleção foi gravada.
 */
export function desistenciaDoPaciente<T extends RegistroCasavel>(
  registros: readonly T[],
  chaves: ChavesDoPaciente
): T | undefined {
  const { patientId, leadId } = chaves;
  if (!patientId && !leadId) return undefined;

  const candidatos = registros.filter(
    (registro) =>
      (Boolean(patientId) && registro.pacienteId === patientId) ||
      (Boolean(leadId) && registro.leadId === leadId)
  );
  if (candidatos.length <= 1) return candidatos[0];

  return [...candidatos].sort((a, b) => instante(b.dataDesistencia) - instante(a.dataDesistencia))[0];
}

function instante(valor: string | undefined): number {
  const momento = valor ? Date.parse(valor) : Number.NaN;
  return Number.isNaN(momento) ? 0 : momento;
}
