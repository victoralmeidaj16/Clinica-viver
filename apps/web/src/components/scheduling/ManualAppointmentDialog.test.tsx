import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManualAppointmentDialog, type ManualAppointmentPatient } from './ManualAppointmentDialog';

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

  describe('vencimento da cobrança', () => {
    const abrir = (paciente: Partial<ManualAppointmentPatient>) => renderToStaticMarkup(
      <ManualAppointmentDialog
        patients={[{ id: 'pac-1', displayName: 'Paciente', status: 'active', ...paciente }]}
        initialPatientId="pac-1"
        onClose={() => undefined}
      />
    );

    it('não pede vencimento quando a empresa custeia todas as sessões', () => {
      const markup = abrir({ custeioAoAgendar: 'empresa', convenioNome: 'Convênio fictício' });
      expect(markup).not.toContain('Vencimento da cobrança');
      expect(markup).not.toContain('receberá sua própria cobrança');
      expect(markup).toContain('Custeado por Convênio fictício');
    });

    it('mantém o vencimento sob limite, avisando que só vale para o que for cobrado', () => {
      const markup = abrir({ custeioAoAgendar: 'empresa_com_limite', convenioNome: 'Convênio fictício' });
      expect(markup).toContain('Vencimento da cobrança');
      expect(markup).toContain('até o limite do convênio');
    });

    it.each([['paciente' as const], [undefined]])('pede o vencimento quando o custeio é %s', (custeioAoAgendar) => {
      const markup = abrir({ custeioAoAgendar });
      expect(markup).toContain('Vencimento da cobrança');
      expect(markup).toContain('receberá sua própria cobrança');
      expect(markup).not.toContain('Custeado por');
    });
  });
});
