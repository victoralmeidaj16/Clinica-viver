import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManualAppointmentDialog } from './ManualAppointmentDialog';

describe('ManualAppointmentDialog', () => {
  it('oferece atalhos de 50 min e 1h30 para avaliação', () => {
    const markup = renderToStaticMarkup(
      <ManualAppointmentDialog
        patients={[{ id: 'pac-1', displayName: 'Paciente', status: 'active' }]}
        servicosHabilitados={['AVALIACAO']}
        onClose={() => undefined}
      />
    );

    expect(markup).toContain('50min');
    expect(markup).toContain('1h30min');
    expect(markup).toContain('Definir outro tempo');
    expect(markup).not.toContain('type="number"');
  });
});
