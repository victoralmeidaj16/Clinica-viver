import { minutos, ordenar, type JanelaEditavel } from './availabilityEditorModel';

/**
 * A grade semanal vista como uma regra só: os mesmos períodos, a mesma duração
 * e a mesma modalidade em todos os dias marcados.
 *
 * O banco continua guardando uma janela por dia e período. Esta forma existe
 * para a configuração em passos, que pergunta "em que dias" e "em que horário"
 * uma vez só, em vez de abrir dia por dia.
 */
export interface ConfigDisponibilidade {
  dias: number[];
  periodos: { horaInicio: string; horaFim: string }[];
  duracaoMin: number;
  modalidade: JanelaEditavel['modalidade'];
}

/** Segunda primeiro, domingo por último: a ordem em que o profissional pensa a semana. */
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const NOMES_CURTOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const CONFIG_INICIAL: ConfigDisponibilidade = {
  dias: [1, 2, 3, 4, 5],
  periodos: [{ horaInicio: '08:00', horaFim: '12:00' }],
  duracaoMin: 50,
  modalidade: 'online',
};

function regraDoDia(janelas: readonly JanelaEditavel[]) {
  return JSON.stringify(janelas.map(({ horaInicio, horaFim, duracaoMin, modalidade }) => (
    { horaInicio, horaFim, duracaoMin, modalidade }
  )));
}

/**
 * Lê a grade salva como uma regra única. `uniforme` é falso quando os dias têm
 * horários, durações ou modalidades diferentes: nesse caso a regra devolvida é
 * a do primeiro dia da semana, e salvar a aplica a todos os dias marcados.
 */
export function configDaGrade(janelas: readonly JanelaEditavel[]): {
  config: ConfigDisponibilidade;
  uniforme: boolean;
} {
  const ordenadas = ordenar(janelas);
  const dias = ORDEM_SEMANA.filter((dia) => ordenadas.some((janela) => janela.diaSemana === dia));
  if (dias.length === 0) return { config: { ...CONFIG_INICIAL, dias: [...CONFIG_INICIAL.dias] }, uniforme: true };

  const doDia = (dia: number) => ordenadas.filter((janela) => janela.diaSemana === dia);
  const base = doDia(dias[0]);
  const regraBase = regraDoDia(base);
  const uniforme = dias.every((dia) => regraDoDia(doDia(dia)) === regraBase)
    && base.every((janela) => janela.duracaoMin === base[0].duracaoMin && janela.modalidade === base[0].modalidade);

  return {
    config: {
      dias,
      periodos: base.map(({ horaInicio, horaFim }) => ({ horaInicio, horaFim })),
      duracaoMin: base[0].duracaoMin,
      modalidade: base[0].modalidade,
    },
    uniforme,
  };
}

export function gradeDaConfig(config: ConfigDisponibilidade): JanelaEditavel[] {
  return ordenar(config.dias.flatMap((diaSemana) => config.periodos.map((periodo) => ({
    diaSemana,
    horaInicio: periodo.horaInicio,
    horaFim: periodo.horaFim,
    duracaoMin: config.duracaoMin,
    modalidade: config.modalidade,
  }))));
}

export function erroDaConfig(config: ConfigDisponibilidade): string | undefined {
  if (config.periodos.length === 0) return 'Adicione ao menos um período de atendimento.';
  for (const [indice, periodo] of config.periodos.entries()) {
    if (!periodo.horaInicio || !periodo.horaFim) return `Período ${indice + 1}: preencha o início e o fim.`;
    if (periodo.horaFim <= periodo.horaInicio) return `Período ${indice + 1}: o horário final deve ser posterior ao inicial.`;
  }
  const ordenados = [...config.periodos].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  for (let indice = 1; indice < ordenados.length; indice += 1) {
    if (ordenados[indice].horaInicio < ordenados[indice - 1].horaFim) return 'Os períodos de atendimento se sobrepõem.';
  }
}

function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Os inícios de sessão que o paciente verá em cada dia marcado, como o servidor os gera. */
export function horariosDoDia(config: ConfigDisponibilidade): string[] {
  if (config.duracaoMin <= 0) return [];
  return [...config.periodos]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .flatMap((periodo) => {
      const inicios: string[] = [];
      const fim = minutos(periodo.horaFim);
      for (let inicio = minutos(periodo.horaInicio); inicio + config.duracaoMin <= fim; inicio += config.duracaoMin) {
        inicios.push(hhmm(inicio));
      }
      return inicios;
    });
}

export function rotuloDias(dias: readonly number[]): string {
  const nomes = ORDEM_SEMANA.filter((dia) => dias.includes(dia)).map((dia) => NOMES_CURTOS[dia]);
  if (nomes.length === 0) return 'Nenhum dia selecionado';
  if (nomes.length === 7) return 'Todos os dias';
  if (nomes.join() === 'Segunda,Terça,Quarta,Quinta,Sexta') return 'Segunda a sexta';
  if (nomes.length === 1) return /^(Sábado|Domingo)$/.test(nomes[0]) ? nomes[0] : `${nomes[0]}-feira`;
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

export function rotuloDuracao(duracaoMin: number): string {
  if (duracaoMin < 60) return `${duracaoMin} min`;
  const resto = duracaoMin % 60;
  return `${Math.floor(duracaoMin / 60)}h${resto ? `${String(resto).padStart(2, '0')}min` : ''}`;
}

export function rotuloPeriodos(config: ConfigDisponibilidade): string {
  return [...config.periodos]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .map((periodo) => `${periodo.horaInicio} às ${periodo.horaFim}`)
    .join(' · ');
}
