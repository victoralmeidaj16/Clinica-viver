import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VinculosEncerradosLista } from './VinculosEncerrados';

describe('acesso aos prontuários de vínculos encerrados', () => {
  it('não aparece para quem não tem vínculo encerrado com registros', () => {
    expect(renderToStaticMarkup(<VinculosEncerradosLista pacientes={[]} />)).toBe('');
  });

  it('leva a autora direto ao prontuário de cada paciente transferido', () => {
    const markup = renderToStaticMarkup(
      <VinculosEncerradosLista pacientes={[{ patientId: 'paciente-transferido', displayName: 'Paciente Transferida' }]} />
    );
    expect(markup).toContain('Prontuários de vínculos encerrados');
    expect(markup).toContain('Paciente Transferida');
    expect(markup).toContain('href="/linha-do-tempo?patientId=paciente-transferido"');
  });
});
