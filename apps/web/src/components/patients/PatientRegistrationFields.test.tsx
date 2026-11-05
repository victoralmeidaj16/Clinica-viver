import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PatientRegistrationFields } from './PatientRegistrationFields';
import { EMPTY_PATIENT_REGISTRATION } from './patientRegistration';

describe('opções de atendimento do cadastro manual', () => {
  it('começa sem origem preenchida e permite não informar o período de preferência', () => {
    expect(EMPTY_PATIENT_REGISTRATION.origem).toBe('');
    const html = renderToStaticMarkup(<PatientRegistrationFields
      form={EMPTY_PATIENT_REGISTRATION} setForm={() => {}} convenios={[]} conveniosCarregando={false}
      conveniosIndisponiveis={false} temNomeSocial={false} onTemNomeSocialChange={() => {}}
      habilitacao={{ status: 'APROVADO', servicosHabilitados: ['PSICOTERAPIA'], modalidadesAtendidas: ['ACESSIVEL_SOCIAL'] }} />);
    expect(html).toContain('Como conheceu a clínica?');
    expect(html).not.toContain('Como conheceu a clínica? *');
    expect(html).toContain('Não informado');
    expect(html).not.toContain('Essa escolha será cruzada');
    const radiosTurno = html.match(/<input[^>]*name="turno"[^>]*>/g);
    expect(radiosTurno).toHaveLength(3);
    expect(radiosTurno?.every((input) => !input.includes('required'))).toBe(true);
  });

  it('mostra somente o serviço e a modalidade habilitados no perfil', () => {
    const html = renderToStaticMarkup(<PatientRegistrationFields
      form={{ ...EMPTY_PATIENT_REGISTRATION, servicoKey: 'PSICOTERAPIA' }} setForm={() => {}}
      convenios={[]} conveniosCarregando={false} conveniosIndisponiveis={false}
      temNomeSocial={false} onTemNomeSocialChange={() => {}}
      habilitacao={{ status: 'APROVADO', servicosHabilitados: ['PSICOTERAPIA'], modalidadesAtendidas: ['ACESSIVEL_SOCIAL'] }}
    />);
    expect(html).toContain('value="SOCIAL"');
    expect(html).not.toContain('value="PARTICULAR"');
    expect(html).not.toContain('value="AVALIACAO"');
    expect(html).not.toContain('value="ORIENTACAO_PARENTAL"');
  });
});
