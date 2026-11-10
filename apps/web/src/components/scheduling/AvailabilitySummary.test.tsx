import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilitySummary } from './AvailabilitySummary';
import type { JanelaEditavel } from './availabilityEditorModel';

const janela: JanelaEditavel = {
  diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', duracaoMin: 90, intervaloMin: 0, modalidade: 'online',
};

describe('AvailabilitySummary', () => {
  it('mostra a grade salva com horários e durações diferentes por período', () => {
    const html = renderToStaticMarkup(<AvailabilitySummary onEditar={vi.fn()} janelas={[
      janela,
      { ...janela, horaInicio: '14:00', horaFim: '18:00', duracaoMin: 50, modalidade: 'presencial' },
      { ...janela, diaSemana: 3, horaInicio: '16:00', horaFim: '20:00' },
    ]} />);
    for (const valor of ['Segunda-feira', 'Quarta-feira', '08:00 às 12:00', '14:00 às 18:00', '16:00 às 20:00', '1h30min', '50 min', 'Presencial', 'Online']) {
      expect(html).toContain(valor);
    }
  });

  it('mostra a duração publicada e avisa quando precisa ser corrigida', () => {
    const html = renderToStaticMarkup(<AvailabilitySummary onEditar={vi.fn()} janelas={[janela]} duracoesFixas={[50]} />);
    expect(html).toContain('1h30min');
    expect(html).toContain('duração diferente das permitidas no seu cadastro');
    expect(html).toContain('salve para atualizar');
  });

  it('não inventa disponibilidade quando a grade está vazia', () => {
    const html = renderToStaticMarkup(<AvailabilitySummary onEditar={vi.fn()} janelas={[]} />);
    expect(html).toContain('Nenhum horário de atendimento cadastrado');
    expect(html).not.toContain('08:00');
  });
});
