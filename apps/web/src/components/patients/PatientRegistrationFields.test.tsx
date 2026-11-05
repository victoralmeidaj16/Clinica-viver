import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PatientRegistrationFields } from './PatientRegistrationFields';
import { EMPTY_PATIENT_REGISTRATION } from './patientRegistration';

describe('opções de atendimento do cadastro manual', () => {
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
