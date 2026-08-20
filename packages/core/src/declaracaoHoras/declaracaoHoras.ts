import type { ClinicalSessionStatus } from '../clinicalSession/types';

/**
 * Declaração de horas de atendimento — a parte que não depende de banco.
 *
 * A declaração é o documento que o psicólogo leva à coordenação do curso para
 * comprovar carga horária de estágio. Antes disto ela era um HTML impresso com
 * o total digitado à mão: quem recebia não tinha como distinguir uma
 * declaração emitida pela clínica de um PDF editado depois. Aqui ficam as três
 * peças que tornam o número conferível — o que conta como hora, o código que
 * leva à conferência, e o hash que denuncia adulteração.
 */

/**
 * Uma sessão realizada equivale a uma hora clínica.
 *
 * É a convenção da clínica, não uma medida de relógio: a sessão dura de 50 a
 * 60 minutos e conta como uma hora para a coordenação. Somar a duração real
 * daria um número menor do que o curso reconhece, então a conversão fica
 * explícita aqui em vez de escondida numa multiplicação qualquer.
 */
export const HORAS_POR_SESSAO = 1;

/**
 * Sessões que entram na conta.
 *
 * `completed` é o atendimento fechado. `awaiting_review` e `ready_to_complete`
 * também entram porque o atendimento **aconteceu** — o que falta neles é a
 * revisão do prontuário, que é trabalho posterior do profissional e não muda o
 * fato de o paciente ter sido atendido. Descontá-las puniria o psicólogo pelo
 * atraso na papelada.
 *
 * `no_show` e `cancelled` ficam de fora pelo motivo oposto: não houve
 * atendimento. `scheduled`, `confirmed` e `in_progress` são futuro ou presente,
 * e declaração não se emite sobre hora que ainda não terminou.
 */
export const STATUS_QUE_CONTAM_HORA: readonly ClinicalSessionStatus[] = [
  'completed',
  'ready_to_complete',
  'awaiting_review',
];

/** O bastante de uma sessão para apurar horas. `ClinicalSession` satisfaz. */
export interface SessaoContabilizavel {
  id: string;
  status: ClinicalSessionStatus;
  scheduledStart: string;
  actualEnd?: string;
}

export interface ApuracaoDeHoras {
  /** Ids das sessões contadas, ordenados — é a evidência do total. */
  sessaoIds: readonly string[];
  totalSessoes: number;
  totalHoras: number;
  /** `AAAA-MM-DD` da primeira e da última sessão contada. */
  periodoInicio: string;
  periodoFim: string;
}

/**
 * Instante que situa a sessão no tempo, para achar as bordas do período.
 *
 * `actualEnd` é quando o atendimento terminou de fato; quando ele falta — e
 * falta em sessão marcada como realizada sem o cockpit ter fechado o relógio —
 * o horário previsto é a melhor aproximação disponível.
 */
function instanteDaSessao(sessao: SessaoContabilizavel): string {
  return sessao.actualEnd ?? sessao.scheduledStart;
}

/**
 * Apura as horas de um psicólogo a partir das sessões dele.
 *
 * Devolve `null` quando nenhuma sessão conta. Quem chama precisa tratar esse
 * caso recusando a emissão: uma declaração de zero hora não tem uso, e um
 * total inventado para preencher a lacuna é justamente o que este módulo
 * existe para impedir.
 */
export function apurarHorasClinicas(
  sessoes: readonly SessaoContabilizavel[]
): ApuracaoDeHoras | null {
  const contadas = sessoes.filter((sessao) => STATUS_QUE_CONTAM_HORA.includes(sessao.status));
  if (contadas.length === 0) return null;

  const instantes = contadas.map(instanteDaSessao).sort();

  return {
    sessaoIds: contadas.map((sessao) => sessao.id).sort(),
    totalSessoes: contadas.length,
    totalHoras: contadas.length * HORAS_POR_SESSAO,
    periodoInicio: instantes[0].slice(0, 10),
    periodoFim: instantes[instantes.length - 1].slice(0, 10),
  };
}

/**
 * Alfabeto do código de verificação, sem os caracteres que se confundem à mão.
 *
 * Fora `0`/`O`, `1`/`I`/`L` — o código é lido de um papel impresso e digitado
 * por outra pessoa, e cada ambiguidade vira uma conferência que falha por
 * transcrição em vez de por fraude. `U` sai pela mesma razão do Crockford
 * base32: evita formar palavra indesejada por acaso.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Código de verificação no formato `VM-XXXX-XXXX`.
 *
 * Não é segredo — é endereço. Quem tem o código consulta a declaração, e é
 * esse o propósito. Os 8 caracteres existem para que ninguém chegue a uma
 * declaração alheia por tentativa: 30^8 ≈ 6,6·10^11 combinações, contra um
 * punhado de declarações reais.
 */
export function gerarCodigoVerificacao(): string {
  const bytes = new Uint8Array(8);
  const letras: string[] = [];

  // Amostragem por rejeição: 240 é o maior múltiplo de 30 abaixo de 256, e
  // usar o resto sem descartar o excedente tornaria os primeiros caracteres do
  // alfabeto mais prováveis que os últimos.
  while (letras.length < 8) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (letras.length === 8) break;
      if (byte >= 240) continue;
      letras.push(ALFABETO[byte % ALFABETO.length]);
    }
  }

  return `VM-${letras.slice(0, 4).join('')}-${letras.slice(4).join('')}`;
}

const CODIGO_CANONICO = /^VM-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;

/**
 * Normaliza o que a pessoa digitou na conferência.
 *
 * Quem recebe o documento digita o código de um papel: vai errar a caixa, vai
 * esquecer os hifens, vai colar com espaço. Nada disso é código inválido — é a
 * mesma sequência escrita de outro jeito. Devolve `null` só quando sobra algo
 * que não pode ser um código.
 */
export function normalizarCodigoVerificacao(bruto: string): string | null {
  const limpo = bruto.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const semPrefixo = limpo.startsWith('VM') ? limpo.slice(2) : limpo;
  if (semPrefixo.length !== 8) return null;

  const codigo = `VM-${semPrefixo.slice(0, 4)}-${semPrefixo.slice(4)}`;
  return CODIGO_CANONICO.test(codigo) ? codigo : null;
}

/** Conteúdo que a declaração afirma, e que o hash protege. */
export interface ConteudoDeclaracao {
  codigo: string;
  psicologoNome: string;
  psicologoCrp: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  emitidoEm: string;
  sessaoIds: readonly string[];
}

/**
 * Serialização canônica: mesma declaração, mesmo texto, sempre.
 *
 * A ordem é fixa e os ids das sessões são ordenados porque o hash precisa
 * sobreviver a uma consulta que devolva as linhas em outra ordem. Sem isso, a
 * conferência acusaria adulteração em declaração intacta — e um alarme que
 * dispara sozinho é pior que alarme nenhum, porque ensina a ignorá-lo.
 */
export function canonicalizarDeclaracao(conteudo: ConteudoDeclaracao): string {
  return JSON.stringify([
    conteudo.codigo,
    conteudo.psicologoNome,
    conteudo.psicologoCrp,
    conteudo.curso,
    conteudo.periodoInicio,
    conteudo.periodoFim,
    conteudo.totalSessoes,
    conteudo.totalHoras,
    conteudo.emitidoEm,
    [...conteudo.sessaoIds].sort(),
  ]);
}

/**
 * SHA-256 do conteúdo declarado.
 *
 * É o que separa esta declaração de um HTML impresso: a conferência recalcula
 * o hash a partir da linha do banco e o compara com o gravado na emissão. Uma
 * edição direta no banco — o total de horas, o nome, o período — quebra a
 * igualdade e a página de validação para de afirmar que o documento é válido.
 */
export async function calcularHashDeclaracao(conteudo: ConteudoDeclaracao): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizarDeclaracao(conteudo));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
