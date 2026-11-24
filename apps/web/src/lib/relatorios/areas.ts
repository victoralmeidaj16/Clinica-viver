/**
 * Relatórios por área da Gestão (especificação final, 13.05): colunas e
 * filtros de cada área. Sem dependência de servidor — a tela e a exportação
 * leem a mesma definição.
 *
 * Nenhuma área traz conteúdo de prontuário (13.03): só dados administrativos.
 */

export type FiltroRelatorio = 'periodo' | 'profissional' | 'paciente' | 'curso' | 'turma' | 'empresa' | 'modulo';
export type TipoColuna = 'texto' | 'data' | 'dataHora' | 'moeda' | 'numero';

export interface ColunaRelatorio {
  chave: string;
  rotulo: string;
  tipo: TipoColuna;
}

export interface AreaRelatorio {
  id: AreaRelatorioId;
  titulo: string;
  descricao: string;
  /** O que o filtro de período considera nesta área. */
  periodoSobre?: string;
  filtros: readonly FiltroRelatorio[];
  colunas: readonly ColunaRelatorio[];
}

export type AreaRelatorioId =
  | 'psicologos' | 'turmas' | 'pacientes' | 'fila' | 'agendamentos' | 'atendimentos'
  | 'horas_estagio' | 'financeiro' | 'convenios' | 'creditos' | 'alteracoes' | 'avisos';

const c = (chave: string, rotulo: string, tipo: TipoColuna = 'texto'): ColunaRelatorio => ({ chave, rotulo, tipo });

export const AREAS_RELATORIO: readonly AreaRelatorio[] = [
  {
    id: 'psicologos', titulo: 'Psicólogos', descricao: 'Cadastro, situação, curso, turma e ocupação de vagas.',
    periodoSobre: 'data do cadastro', filtros: ['periodo', 'profissional', 'curso', 'turma'],
    colunas: [c('nome', 'Psicólogo'), c('crp', 'CRP'), c('situacao', 'Situação'), c('curso', 'Curso'), c('turma', 'Turma'),
      c('ativos', 'Pacientes ativos', 'numero'), c('limite', 'Limite', 'numero'), c('vagas', 'Vagas livres', 'numero'),
      c('rodizio', 'Rodízio'), c('cadastro', 'Cadastro', 'data')],
  },
  {
    id: 'turmas', titulo: 'Turmas', descricao: 'Turmas por curso, situação, saída prevista e psicólogos vinculados.',
    periodoSobre: 'data de início', filtros: ['periodo', 'curso', 'turma'],
    colunas: [c('curso', 'Curso'), c('turma', 'Turma'), c('situacao', 'Situação'), c('inicio', 'Início', 'data'),
      c('encerramento', 'Encerramento', 'data'), c('saida', 'Saída da clínica', 'data'), c('psicologos', 'Psicólogos', 'numero'),
      c('nomes', 'Nomes')],
  },
  {
    id: 'pacientes', titulo: 'Pacientes', descricao: 'Pacientes cadastrados, situação, profissional, convênio e valor.',
    periodoSobre: 'data do cadastro', filtros: ['periodo', 'profissional', 'paciente', 'empresa'],
    colunas: [c('paciente', 'Paciente'), c('situacao', 'Situação'), c('profissional', 'Psicólogo'), c('convenio', 'Convênio'),
      c('pagador', 'Pagador'), c('categoria', 'Categoria do valor'), c('cadastro', 'Cadastro', 'data')],
  },
  {
    id: 'fila', titulo: 'Fila e solicitações', descricao: 'Pedidos recebidos, situação, oferta, aceite e lista de espera.',
    periodoSobre: 'data da solicitação', filtros: ['periodo', 'profissional', 'paciente'],
    colunas: [c('protocolo', 'Protocolo'), c('paciente', 'Paciente'), c('situacao', 'Situação'), c('servico', 'Serviço'),
      c('profissional', 'Psicólogo'), c('tipo', 'Origem da oferta'), c('solicitado', 'Solicitado em', 'dataHora'),
      c('oferecido', 'Oferecido em', 'dataHora'), c('aceito', 'Aceito em', 'dataHora'), c('transbordos', 'Transbordos', 'numero'),
      c('espera', 'Lista de espera')],
  },
  {
    id: 'agendamentos', titulo: 'Agendamentos', descricao: 'Todas as sessões marcadas no período, com situação e pagador.',
    periodoSobre: 'data da sessão', filtros: ['periodo', 'profissional', 'paciente', 'empresa'],
    colunas: [c('inicio', 'Sessão', 'dataHora'), c('paciente', 'Paciente'), c('profissional', 'Psicólogo'), c('situacao', 'Situação'),
      c('modalidade', 'Modalidade'), c('duracao', 'Minutos', 'numero'), c('pagador', 'Pagador'), c('valor', 'Valor', 'moeda')],
  },
  {
    id: 'atendimentos', titulo: 'Atendimentos', descricao: 'Sessões realizadas e faltas registradas no período.',
    periodoSobre: 'data da sessão', filtros: ['periodo', 'profissional', 'paciente', 'empresa'],
    colunas: [c('inicio', 'Sessão', 'dataHora'), c('paciente', 'Paciente'), c('profissional', 'Psicólogo'), c('situacao', 'Situação'),
      c('modalidade', 'Modalidade'), c('duracao', 'Minutos', 'numero'), c('pagador', 'Pagador'), c('valor', 'Valor', 'moeda')],
  },
  {
    id: 'horas_estagio', titulo: 'Horas de estágio', descricao: 'Horas clínicas realizadas por psicólogo, pela duração real das sessões.',
    periodoSobre: 'data da sessão', filtros: ['periodo', 'profissional', 'curso', 'turma'],
    colunas: [c('profissional', 'Psicólogo'), c('curso', 'Curso'), c('turma', 'Turma'), c('sessoes', 'Sessões realizadas', 'numero'),
      c('minutos', 'Minutos', 'numero'), c('horas', 'Horas')],
  },
  {
    id: 'financeiro', titulo: 'Financeiro', descricao: 'Cobranças das sessões: vencimento, valor, situação e pagador.',
    periodoSobre: 'vencimento', filtros: ['periodo', 'profissional', 'paciente', 'empresa'],
    colunas: [c('vencimento', 'Vencimento', 'data'), c('paciente', 'Paciente'), c('profissional', 'Psicólogo'), c('situacao', 'Situação'),
      c('pagador', 'Pagador'), c('valor', 'Valor', 'moeda'), c('recebido', 'Recebido', 'moeda'), c('referencia', 'Cobrança')],
  },
  {
    id: 'convenios', titulo: 'Convênios', descricao: 'Empresas conveniadas, acordo de custeio, pacientes e sessões provisionadas.',
    filtros: ['empresa'],
    colunas: [c('empresa', 'Empresa'), c('cnpj', 'CNPJ'), c('ativo', 'Situação'), c('custeio', 'Empresa paga'), c('cota', 'Sessões por paciente'),
      c('pacientes', 'Pacientes', 'numero'), c('custeados', 'Custeados', 'numero'), c('sessoes', 'Sessões provisionadas', 'numero'),
      c('provisionado', 'Valor provisionado', 'moeda')],
  },
  {
    id: 'creditos', titulo: 'Créditos Educacionais', descricao: 'Créditos de 70% gravados por recebimento, com origem e base.',
    periodoSobre: 'data do recebimento', filtros: ['periodo', 'profissional'],
    colunas: [c('data', 'Data', 'dataHora'), c('profissional', 'Psicólogo'), c('origem', 'Origem'), c('base', 'Base', 'moeda'),
      c('credito', 'Crédito', 'moeda'), c('referencia', 'Referência'), c('justificativa', 'Justificativa')],
  },
  {
    id: 'alteracoes', titulo: 'Histórico de alterações', descricao: 'Intervenções da Gestão com usuário, data, valor anterior e valor novo.',
    periodoSobre: 'data da alteração', filtros: ['periodo', 'modulo'],
    colunas: [c('data', 'Data', 'dataHora'), c('modulo', 'Módulo'), c('registro', 'Registro'), c('acao', 'Ação'), c('campo', 'Campo'),
      c('anterior', 'Valor anterior'), c('novo', 'Valor novo'), c('motivo', 'Motivo'), c('autor', 'Usuário')],
  },
  {
    id: 'avisos', titulo: 'Avisos enviados', descricao: 'Registro dos avisos: destinatário, canal, retorno da integração e versão do texto.',
    periodoSobre: 'data do envio', filtros: ['periodo'],
    colunas: [c('data', 'Data', 'dataHora'), c('aviso', 'Aviso'), c('destinatario', 'Destinatário'), c('canal', 'Canal'),
      c('situacao', 'Retorno'), c('versao', 'Versão do texto'), c('referencia', 'Origem')],
  },
];

export function areaRelatorio(id: string): AreaRelatorio | undefined {
  return AREAS_RELATORIO.find((area) => area.id === id);
}

export type LinhaRelatorio = Record<string, string | number | null>;

export interface FiltrosAplicados {
  desde?: string;
  ate?: string;
  profissional?: string;
  paciente?: string;
  curso?: string;
  turma?: string;
  empresa?: string;
  modulo?: string;
}

/** Texto contém o termo, sem diferença de acento ou maiúscula. */
export function contemTermo(valor: string | null | undefined, termo: string | undefined): boolean {
  if (!termo?.trim()) return true;
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  return normalizar(valor ?? '').includes(normalizar(termo.trim()));
}

/** Data ISO (ou YYYY-MM-DD) dentro do período, nas datas de Brasília. */
export function dentroDoPeriodo(iso: string | null | undefined, desde?: string, ate?: string): boolean {
  if (!desde && !ate) return true;
  if (!iso) return false;
  const dia = iso.length === 10 ? iso
    : new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return (!desde || dia >= desde) && (!ate || dia <= ate);
}

export function formatarCelula(valor: string | number | null | undefined, tipo: TipoColuna): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'moeda' && typeof valor === 'number') {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
  }
  if ((tipo === 'data' || tipo === 'dataHora') && typeof valor === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split('-').reverse().join('/');
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return tipo === 'data'
      ? data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return String(valor);
}
