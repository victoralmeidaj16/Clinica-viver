import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { derivarServicosHabilitados } from '@/server/application/psychologistRegistration';
import { CLINICAL_SERVICES } from './manualAppointment';
import { servicesForRegistration, serviceName } from './patientCareOptions';
import { opcoesPublicoVitrine, publicoVitrinePermitido } from './vitrinePublico';
import { resolveAttendancePricing } from './attendancePricing';

// Especificação final, seção 15: Orientação Vocacional e Orientação
// Profissional são modalidades diferentes e não podem ser unidas.
describe('Orientação Vocacional separada de Orientação Profissional', () => {
  it('deriva cada rótulo para a sua própria chave', () => {
    expect(derivarServicosHabilitados(['Orientação Vocacional'])).toEqual(['ORIENTACAO_VOCACIONAL']);
    expect(derivarServicosHabilitados(['Orientação Profissional'])).toEqual(['ORIENTACAO_PROFISSIONAL']);
  });

  it('o rótulo combinado do curso habilita as duas modalidades', () => {
    expect(derivarServicosHabilitados(['Orientação Vocacional e Profissional']).sort())
      .toEqual(['ORIENTACAO_PROFISSIONAL', 'ORIENTACAO_VOCACIONAL']);
  });

  it('oferece as duas como serviços distintos no agendamento e no cadastro', () => {
    const servicos = new Map(CLINICAL_SERVICES.map((item) => [item.key, item.label]));
    expect(servicos.get('ORIENTACAO_VOCACIONAL')).toBe('Orientação Vocacional');
    expect(servicos.get('ORIENTACAO_PROFISSIONAL')).toBe('Orientação Profissional');
    expect(serviceName('ORIENTACAO_VOCACIONAL')).toBe('Orientação Vocacional');
    expect(serviceName('ORIENTACAO_PROFISSIONAL')).toBe('Orientação Profissional');
  });

  it('só libera ao paciente a orientação que o profissional tem homologada', () => {
    const chaves = servicesForRegistration({ status: 'APROVADO', servicosHabilitados: ['ORIENTACAO_VOCACIONAL'] })
      .map(([key]) => key);
    expect(chaves).toEqual(['ORIENTACAO_VOCACIONAL']);
  });

  it('aceita a Orientação Vocacional na vitrine com os públicos individuais e o preço individual', () => {
    expect(opcoesPublicoVitrine('ORIENTACAO_VOCACIONAL', 'SOCIAL')).toEqual(['Individual', 'Infantil', 'Adolescente', 'Outro']);
    expect(publicoVitrinePermitido('ORIENTACAO_VOCACIONAL', 'PARTICULAR', 'Adolescente')).toBe(true);
    expect(resolveAttendancePricing('ORIENTACAO_VOCACIONAL', 'PARTICULAR').amountCents).toBe(13_000);
  });
});
