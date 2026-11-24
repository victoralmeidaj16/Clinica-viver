/**
 * Ciclo de vida das turmas (especificação final, 1.01–1.05).
 *
 * Ao encerrar uma turma, começa o prazo de saída da vitrine (padrão: três
 * meses, configurável pela Gestão em quantidade e unidade). Durante o prazo o
 * psicólogo continua atendendo e na vitrine, e ele e a Gestão veem a contagem
 * regressiva. No fim, o vínculo daquela turma deixa de valer. A Gestão pode
 * reabrir, mudar a data de encerramento, prorrogar/antecipar a saída ou
 * interromper a retirada, e cada mudança fica no histórico da turma.
 *
 * Tudo aqui é puro e trabalha com datas `AAAA-MM-DD` no calendário de
 * Brasília, para o rodízio, a vitrine e as telas responderem igual.
 */

export type UnidadePrazoTurma = 'MESES' | 'DIAS';

export interface PrazoSaidaTurma {
  quantidade: number;
  unidade: UnidadePrazoTurma;
}

export const PRAZO_SAIDA_PADRAO: PrazoSaidaTurma = { quantidade: 3, unidade: 'MESES' };

export interface AvisosTurma {
  /** Dias antes da saída em que um novo aviso aparece. */
  diasAntes: readonly number[];
  textoPsicologo: string;
  textoGestao: string;
  /** Também envia por WhatsApp ao psicólogo. Desligado até a Gestão decidir. */
  enviarWhatsApp: boolean;
}

export const AVISOS_TURMA_PADRAO: AvisosTurma = {
  diasAntes: [60, 30, 15, 7, 1],
  textoPsicologo: 'Sua turma {turma} de {curso} foi encerrada em {encerramento}. Você continua na vitrine e recebendo encaminhamentos por este vínculo até {saida} ({restante}). Seus pacientes, agenda, prontuários e pagamentos não mudam.',
  textoGestao: 'Turma {turma} de {curso}, encerrada em {encerramento}: saída da vitrine prevista para {saida} ({restante}).',
  enviarWhatsApp: false,
};

export type AcaoTurma =
  | 'CRIADA' | 'IMPORTADA' | 'EDITADA' | 'ENCERRADA' | 'REABERTA'
  | 'ENCERRAMENTO_ALTERADO' | 'SAIDA_ALTERADA' | 'RETIRADA_INTERROMPIDA' | 'RETIRADA_RETOMADA';

export interface EventoTurma {
  acao: AcaoTurma;
  em: string;
  porUsuarioRef?: string;
  porNome?: string;
  detalhe?: string;
}

export interface TurmaRegistro {
  id: string;
  posGraduacao: string;
  codigo: string;
  dataInicio?: string;
  dataEncerramentoPrevista?: string;
  /** Encerramento registrado. Ausente = turma aberta. */
  encerradaEm?: string;
  /** Data de saída definida à mão (prorrogação ou antecipação). */
  saidaManual?: string;
  retiradaInterrompida?: boolean;
  historico: readonly EventoTurma[];
}

export type SituacaoTurma = 'ABERTA' | 'EM_SAIDA' | 'SAIDA_INTERROMPIDA' | 'DESLIGADA';

export const ROTULO_SITUACAO_TURMA: Record<SituacaoTurma, string> = {
  ABERTA: 'Aberta',
  EM_SAIDA: 'Encerrada — em prazo de saída',
  SAIDA_INTERROMPIDA: 'Encerrada — retirada interrompida',
  DESLIGADA: 'Encerrada — fora da vitrine',
};

export function dataValida(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const data = new Date(`${valor}T12:00:00Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor ? undefined : valor;
}

/** `AAAA-MM-DD` ou ISO → `DD/MM/AAAA`, sem passar por fuso. */
export function formatarDataCurta(valor: string): string {
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Soma o prazo a uma data. Meses mantêm o dia, recuando ao fim do mês quando
 * ele não existe. Data ilegível devolve a própria data (saída no encerramento)
 * em vez de derrubar a leitura de todas as turmas.
 */
export function somarPrazo(data: string, prazo: PrazoSaidaTurma): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number);
  if (![ano, mes, dia].every(Number.isInteger)) return data.slice(0, 10);
  if (prazo.unidade === 'DIAS') {
    return new Date(Date.UTC(ano, mes - 1, dia + prazo.quantidade)).toISOString().slice(0, 10);
  }
  const alvo = new Date(Date.UTC(ano, mes - 1 + prazo.quantidade, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
}

export function lerPrazoSaida(valor: unknown): PrazoSaidaTurma {
  const fonte = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>;
  const unidade = fonte.unidade === 'DIAS' ? 'DIAS' : fonte.unidade === 'MESES' ? 'MESES' : PRAZO_SAIDA_PADRAO.unidade;
  const quantidade = Number(fonte.quantidade);
  const limite = unidade === 'MESES' ? 24 : 730;
  return Number.isInteger(quantidade) && quantidade >= 0 && quantidade <= limite
    ? { quantidade, unidade }
    : PRAZO_SAIDA_PADRAO;
}

export function lerAvisosTurma(valor: unknown): AvisosTurma {
  const fonte = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>;
  const diasAntes = Array.isArray(fonte.diasAntes)
    ? [...new Set(fonte.diasAntes.map(Number).filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 365))].sort((a, b) => b - a)
    : AVISOS_TURMA_PADRAO.diasAntes;
  const texto = (campo: unknown, padrao: string) =>
    typeof campo === 'string' && campo.trim() ? campo.trim().slice(0, 1000) : padrao;
  return {
    diasAntes,
    textoPsicologo: texto(fonte.textoPsicologo, AVISOS_TURMA_PADRAO.textoPsicologo),
    textoGestao: texto(fonte.textoGestao, AVISOS_TURMA_PADRAO.textoGestao),
    enviarWhatsApp: fonte.enviarWhatsApp === true,
  };
}

/** Data em que o vínculo da turma deixa de valer na vitrine. */
export function dataDeSaida(turma: Pick<TurmaRegistro, 'encerradaEm' | 'saidaManual'>, prazo: PrazoSaidaTurma): string | undefined {
  if (!turma.encerradaEm) return undefined;
  return turma.saidaManual ?? somarPrazo(turma.encerradaEm, prazo);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

export function situacaoDaTurma(
  turma: Pick<TurmaRegistro, 'encerradaEm' | 'saidaManual' | 'retiradaInterrompida'>,
  prazo: PrazoSaidaTurma,
  hoje: string
): SituacaoTurma {
  const saida = dataDeSaida(turma, prazo);
  if (!saida) return 'ABERTA';
  if (turma.retiradaInterrompida) return 'SAIDA_INTERROMPIDA';
  return hoje >= saida ? 'DESLIGADA' : 'EM_SAIDA';
}

/** "faltam 12 dias", "falta 1 dia", "sai hoje". */
export function rotuloRestante(dias: number): string {
  if (dias <= 0) return 'sai hoje';
  return dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`;
}

/**
 * O marco de aviso vigente: o menor "dias antes" já alcançado. Cada marco é
 * um aviso novo no sino (e no WhatsApp, quando ligado), sem repetir o mesmo.
 */
export function marcoDoAviso(diasRestantes: number, avisos: Pick<AvisosTurma, 'diasAntes'>): number | undefined {
  const alcancados = avisos.diasAntes.filter((dias) => diasRestantes <= dias);
  return alcancados.length ? Math.min(...alcancados) : undefined;
}

/** Preenche o texto editável da Gestão. Marcadores desconhecidos ficam como estão. */
export function textoDoAviso(
  modelo: string,
  dados: { turma: string; curso: string; encerradaEm: string; saidaEm: string; diasRestantes: number }
): string {
  const valores: Record<string, string> = {
    turma: dados.turma,
    curso: dados.curso,
    encerramento: formatarDataCurta(dados.encerradaEm),
    saida: formatarDataCurta(dados.saidaEm),
    restante: rotuloRestante(dados.diasRestantes),
  };
  return modelo.replace(/\{(turma|curso|encerramento|saida|restante)\}/g, (_, chave: string) => valores[chave]);
}

export function normalizarCodigoTurma(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const codigo = valor.trim().toUpperCase().replace(/^TURMA\s+/, '');
  return /^[A-Z0-9][A-Z0-9 ._-]{0,14}$/.test(codigo) ? codigo : undefined;
}
