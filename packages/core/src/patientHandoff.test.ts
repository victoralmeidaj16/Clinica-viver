import { describe, expect, it } from 'vitest';
import {
  approvePatientHandoff,
  createPatientHandoffDraft,
  markPatientHandoffDelivered,
} from './patientHandoff';

describe('patient handoff', () => {
  it('gera somente o contrato destinado ao paciente', () => {
    const handoff = createPatientHandoffDraft({
      patientId: 'pac-01',
      sessionId: 'session-01',
      summary:
        'Nesta sessão vocês trabalharam estratégias para lidar com a ansiedade em situações profissionais e reconhecer limites na rotina.',
      tasks: [
        'Praticar respiração por 10 minutos',
        'Praticar respiração por 10 minutos',
        'Registrar pensamentos automáticos',
      ],
      nextSessionLabel: 'Quarta-feira, 14h',
      professionalName: 'Dra. Camila',
    });

    expect(handoff.tasks).toHaveLength(2);
    expect(handoff.safetyWarnings).toEqual([]);
    expect(handoff).not.toHaveProperty('transcription');
    expect(handoff).not.toHaveProperty('assessment');
    expect(handoff).not.toHaveProperty('soap');
  });

  it('bloqueia conteúdo interno e diagnóstico', () => {
    const handoff = createPatientHandoffDraft({
      patientId: 'pac-01',
      sessionId: 'session-01',
      summary:
        'O prontuário SOAP apresenta hipótese diagnóstica que não deve ser enviada automaticamente ao paciente.',
      tasks: [],
      professionalName: 'Dra. Camila',
    });

    expect(handoff.safetyWarnings).toContain(
      'Remova referência a conteúdo interno do prontuário antes do envio.'
    );
    expect(handoff.safetyWarnings).toContain(
      'Remova hipótese ou conclusão diagnóstica antes do envio.'
    );
    expect(() =>
      approvePatientHandoff(handoff, 'psi-01', '2026-07-30T12:00:00.000Z')
    ).toThrow('Revise os alertas de segurança');
  });

  it('exige aprovação humana antes da entrega', () => {
    const handoff = createPatientHandoffDraft({
      patientId: 'pac-01',
      sessionId: 'session-01',
      summary:
        'Nesta sessão vocês organizaram estratégias práticas de autocuidado e combinaram ações para a próxima semana.',
      tasks: ['Registrar o humor uma vez ao dia'],
      professionalName: 'Dra. Camila',
    });
    const approved = approvePatientHandoff(
      handoff,
      'psi-01',
      '2026-07-30T12:00:00.000Z'
    );

    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('psi-01');

    const delivered = markPatientHandoffDelivered(
      approved,
      '2026-07-30T12:05:00.000Z'
    );
    expect(delivered.status).toBe('delivered');
    expect(delivered.deliveredAt).toBe('2026-07-30T12:05:00.000Z');
  });
});
