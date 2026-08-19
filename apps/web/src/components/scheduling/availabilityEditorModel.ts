export interface JanelaEditavel {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoMin: number;
  modalidade: 'presencial' | 'online';
}

export const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DURACOES = [30, 45, 50, 60, 90];

export function ordenar(janelas: readonly JanelaEditavel[]) {
  return [...janelas].sort(
    (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio)
  );
}

export function assinatura(janelas: readonly JanelaEditavel[]) {
  return JSON.stringify(ordenar(janelas));
}

export function minutos(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function quantidadeSlots(janela: JanelaEditavel) {
  return Math.max(0, Math.floor((minutos(janela.horaFim) - minutos(janela.horaInicio)) / janela.duracaoMin));
}

export function erroDaGrade(janelas: readonly JanelaEditavel[]): string | undefined {
  for (const janela of janelas) {
    if (janela.horaFim <= janela.horaInicio) {
      return `${DIAS[janela.diaSemana]}: o horário final deve ser posterior ao inicial.`;
    }
  }

  for (const dia of Array.from({ length: 7 }, (_, indice) => indice)) {
    const janelasDoDia = ordenar(janelas.filter((janela) => janela.diaSemana === dia));
    for (let indice = 1; indice < janelasDoDia.length; indice += 1) {
      if (janelasDoDia[indice].horaInicio < janelasDoDia[indice - 1].horaFim) {
        return `${DIAS[dia]}: existem períodos sobrepostos.`;
      }
    }
  }
}

export function padraoDaGrade(janelas: readonly JanelaEditavel[]) {
  const primeira = janelas[0];
  return {
    duracaoMin: primeira?.duracaoMin ?? 50,
    modalidade: primeira?.modalidade ?? 'online' as const,
  };
}
