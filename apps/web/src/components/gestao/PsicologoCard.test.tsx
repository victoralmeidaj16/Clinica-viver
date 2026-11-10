import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PsicologoCard, type PsicologoCardProps } from './PsicologoCard';

const props: PsicologoCardProps = {
  p: { id: 'ficticio', nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '', status: 'APROVADO',
    rodizio: { posicao: 3, total: 12 } },
  ocupado: null, onAprovar: vi.fn(), onRecusar: vi.fn(), onAlternarRodizio: vi.fn(), onEditar: vi.fn(),
  onAjustarLimite: vi.fn(), onPriorizar: vi.fn(), onReenviarConvite: vi.fn(),
};

describe('posição do psicólogo visível no cartão fechado', () => {
  it('mostra posição geral e explica a compatibilidade sem abrir detalhes', () => {
    const html = renderToStaticMarkup(<PsicologoCard {...props} />);
    expect(html).toContain('Rodízio geral: 3º de 12');
    expect(html).toContain('A indicação depende da compatibilidade com o paciente.');
  });

  it('mostra o motivo de exclusão sem afirmar que está no rodízio', () => {
    const html = renderToStaticMarkup(<PsicologoCard {...props} p={{ ...props.p,
      rodizio: { posicao: null, total: 12, motivo: 'Capacidade esgotada' },
    }} />);
    expect(html).toContain('Fora do rodízio: Capacidade esgotada');
    expect(html).not.toContain('No rodízio');
    expect(html).not.toContain('0º');
  });

  it('não inventa uma posição caso a API ainda não forneça o dado', () => {
    const html = renderToStaticMarkup(<PsicologoCard {...props} p={{ ...props.p, rodizio: undefined }} />);
    expect(html).toContain('Posição no rodízio indisponível');
  });
});
