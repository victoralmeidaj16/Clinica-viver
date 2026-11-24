import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { derivarServicosHabilitados } from '@/server/application/psychologistRegistration';
import { CLINICAL_SERVICES } from './manualAppointment';
import { servicesForRegistration, serviceName } from './patientCareOptions';
import { opcoesPublicoVitrine, publicoVitrinePermitido } from './vitrinePublico';
import { resolveAttendancePricing } from './attendancePricing';

// Orientação Vocacional e Profissional unificada na vitrine, cadastro, rodízio e agenda,
// preservando compatibilidade de leitura com registros legados (`ORIENTACAO_VOCACIONAL`).
describe('Orientação Vocacional e Profissional unificada', () => {
  it('deriva o rótulo unificado e rótulos legados para a chave única ORIENTACAO_PROFISSIONAL', () => {
    expect(derivarServicosHabilitados(['Orientação Vocacional e Profissional'])).toEqual(['ORIENTACAO_PROFISSIONAL']);
    expect(derivarServicosHabilitados(['Orientação Vocacional'])).toEqual(['ORIENTACAO_PROFISSIONAL']);
    expect(derivarServicosHabilitados(['Orientação Profissional'])).toEqual(['ORIENTACAO_PROFISSIONAL']);
  });

  it('oferece uma única opção no agendamento e no cadastro e traduz chave legada', () => {
    const servicos = new Map(CLINICAL_SERVICES.map((item) => [item.key, item.label]));
    expect(servicos.has('ORIENTACAO_VOCACIONAL')).toBe(false);
    expect(servicos.get('ORIENTACAO_PROFISSIONAL')).toBe('Orientação Vocacional e Profissional');
    expect(serviceName('ORIENTACAO_PROFISSIONAL')).toBe('Orientação Vocacional e Profissional');
    expect(serviceName('ORIENTACAO_VOCACIONAL')).toBe('Orientação Vocacional e Profissional');
  });

  it('libera a opção unificada quando o profissional possui a chave atual ou legada homologada', () => {
    const atual = servicesForRegistration({ status: 'APROVADO', servicosHabilitados: ['ORIENTACAO_PROFISSIONAL'] })
      .map(([key]) => key);
    const legado = servicesForRegistration({ status: 'APROVADO', servicosHabilitados: ['ORIENTACAO_VOCACIONAL'] })
      .map(([key]) => key);
    expect(atual).toEqual(['ORIENTACAO_PROFISSIONAL']);
    expect(legado).toEqual(['ORIENTACAO_PROFISSIONAL']);
  });

  it('aceita a modalidade unificada na vitrine com os públicos individuais e o preço individual', () => {
    expect(opcoesPublicoVitrine('ORIENTACAO_PROFISSIONAL', 'SOCIAL')).toEqual(['Individual', 'Infantil', 'Adolescente', 'Outro']);
    expect(publicoVitrinePermitido('ORIENTACAO_PROFISSIONAL', 'PARTICULAR', 'Adolescente')).toBe(true);
    expect(publicoVitrinePermitido('ORIENTACAO_VOCACIONAL', 'PARTICULAR', 'Adolescente')).toBe(false);
    expect(resolveAttendancePricing('ORIENTACAO_PROFISSIONAL', 'PARTICULAR').amountCents).toBe(13_000);
  });
});
