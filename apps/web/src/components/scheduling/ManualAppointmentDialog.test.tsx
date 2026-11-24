import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManualAppointmentDialog, type ManualAppointmentPatient } from './ManualAppointmentDialog';

describe('ManualAppointmentDialog', () => {
  it('só lista pacientes com vínculo disponível', () => {
    const markup = renderToStaticMarkup(<ManualAppointmentDialog patients={[
      { id: 'a', displayName: 'Paciente ativo', status: 'active' },
      { id: 'b', displayName: 'Paciente pausado', status: 'paused' },
      { id: 'c', displayName: 'Paciente de alta', status: 'discharged' },
    ]} onClose={() => undefined} />);
    expect(markup).toContain('Paciente ativo');
    expect(markup).not.toContain('Paciente pausado');
    expect(markup).not.toContain('Paciente de alta');
  });

  it('oferece Orientação Parental individual e em família com duração fixa para cada opção', () => {
    const markup = renderToStaticMarkup(<ManualAppointmentDialog patients={[]} servicosHabilitados={['ORIENTACAO_PARENTAL']}
      onClose={() => undefined} />);
    expect(markup).toContain('Individual · 50 min');
    expect(markup).toContain('Em família · 1h30');
    expect(markup).not.toContain('Definir outro tempo');
  });

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

  it('oferece só os serviços homologados e já abre num deles', () => {
    const markup = renderToStaticMarkup(
      <ManualAppointmentDialog
        patients={[{ id: 'pac-1', displayName: 'Paciente', status: 'active' }]}
        servicosHabilitados={['AVALIACAO']}
        initialPatientId="pac-1"
        onClose={() => undefined}
      />
    );

    expect(markup).toContain('Avaliação Psicológica e Neuropsicológica');
    expect(markup).not.toContain('Psicoterapia Individual');
    expect(markup).not.toContain('Psicoterapia de Casal');
    expect(markup).not.toContain('Orientação Parental');
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

it('carrega a acessibilidade do paciente no agendamento manual', () => {
  const html = renderToStaticMarkup(<ManualAppointmentDialog initialPatientId="p"
    patients={[{ id: 'p', displayName: 'Paciente fictício', status: 'active',
      acessibilidade: { necessita: true, descricao: 'Acesso sem degraus' } }]} onClose={() => {}} />);
  expect(html).toContain('deficiência ou necessidade de acessibilidade?');
  expect(html).toContain('Acesso sem degraus');
});
