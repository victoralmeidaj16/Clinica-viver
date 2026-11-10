import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgendaBlocks } from './AgendaBlocks';
import { AvailabilitySteps } from './AvailabilitySteps';
import { AvailabilityEditor } from './AvailabilityEditor';
import type { JanelaEditavel } from './availabilityEditorModel';

const janela = (diaSemana: number, horaInicio: string, horaFim: string): JanelaEditavel => ({
  diaSemana, horaInicio, horaFim, duracaoMin: 50, intervaloMin: 0, modalidade: 'online',
});

describe('AvailabilitySteps', () => {
  it.each([false, true])('inicia a grade vazia com o tempo cadastrado de 90 minutos (variável: %s)', (permiteDuracaoVariavel) => {
    const html = renderToStaticMarkup(<AvailabilitySteps janelas={[]} duracoesFixas={[90]} permiteDuracaoVariavel={permiteDuracaoVariavel} onSalvar={vi.fn()} bloqueios={null} />);
    expect(html).toMatch(/<option(?=[^>]*value="90")(?=[^>]*selected="")[^>]*>/);
    expect(html).not.toContain('value="50"');
    expect(html).toContain('sessões de 1h30min');
  });

  it.each([AvailabilitySteps, AvailabilityEditor])('corrige no rascunho a duração antiga incompatível com o cadastro', (Editor) => {
    const html = renderToStaticMarkup(<Editor janelas={[janela(1, '08:00', '12:00')]} duracoesFixas={[90]} onSalvar={vi.fn()} bloqueios={null} />);
    expect(html).toMatch(/<option(?=[^>]*value="90")(?=[^>]*selected="")[^>]*>/);
    expect(html).not.toContain('value="50"');
    expect(html).toContain('alterações');
  });

  it.each([AvailabilitySteps, AvailabilityEditor])('preserva uma duração variável permitida para avaliação', (Editor) => {
    const html = renderToStaticMarkup(<Editor
      janelas={[{ ...janela(1, '08:00', '12:00'), duracaoMin: 120 }]}
      duracoesFixas={[50, 90]} permiteDuracaoVariavel onSalvar={vi.fn()} bloqueios={null}
    />);
    expect(html).toContain('value="120"');
    expect(html).not.toContain('Você tem alterações');
  });

  it('mostra os quatro passos com o resumo da grade salva', () => {
    const html = renderToStaticMarkup(
      <AvailabilitySteps
        janelas={[1, 2, 3, 4, 5].map((dia) => janela(dia, '18:00', '22:00'))}
        onSalvar={vi.fn()}
        bloqueios={<AgendaBlocks bloqueios={[]} onAdicionar={vi.fn()} onRemover={vi.fn()} />}
      />
    );
    for (const passo of [1, 2, 3, 4]) expect(html).toContain(`id="agenda-passo-${passo}"`);
    expect(html).toContain('Segunda a sexta');
    expect(html).toContain('18:00 às 22:00');
    expect(html).toContain('4 horários');
    expect(html).toContain('Adicionar bloqueio');
    expect(html).toContain('Salvar disponibilidade');
  });

  it('abre o editor dia a dia quando os dias têm horários diferentes', () => {
    const html = renderToStaticMarkup(
      <AvailabilitySteps janelas={[janela(1, '08:00', '12:00'), janela(3, '14:00', '18:00')]} onSalvar={vi.fn()} bloqueios={null} />
    );
    expect(html).not.toContain('id="agenda-passo-1"');
    expect(html).toContain('Disponibilidade semanal');
    expect(html).toContain('Usar o mesmo horário em todos os dias');
  });
});
