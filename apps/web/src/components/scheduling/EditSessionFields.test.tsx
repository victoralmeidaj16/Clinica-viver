import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditSessionFields } from './EditSessionFields';

const render = (canEditDuration: boolean) => renderToStaticMarkup(<EditSessionFields
  data="2026-11-01" hora="14:00" duracaoMin={50} canEditDuration={canEditDuration}
  modalidade="online" status="agendado" statusPendente="agendado"
  setData={vi.fn()} setHora={vi.fn()} setDuracaoMin={vi.fn()}
  setModalidade={vi.fn()} setStatus={vi.fn()} />);

describe('edição da duração', () => {
  it('exibe a duração sem controle de alteração para outros serviços', () => {
    const markup = render(false);
    expect(markup).toContain('50 minutos');
    expect(markup).not.toContain('Variável');
  });

  it('oferece 50 min, 1h30 e variável para avaliação', () => {
    const markup = render(true);
    expect(markup).toContain('50 min');
    expect(markup).toContain('1h30');
    expect(markup).toContain('Variável');
  });
});
