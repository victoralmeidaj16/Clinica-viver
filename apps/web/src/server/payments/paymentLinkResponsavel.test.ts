import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db, query: db.query }) }));
vi.mock('./sessionChargeDueQueue', () => ({ hasPendingChargeDueReset: async () => false }));

import { reserveAppointmentCharge, type ReservedCheckout } from './paymentLinkRepository';

const RESPONSAVEL = { nome: 'Responsável Fictício', cpf: '11144477735', email: 'resp@example.com', telefone: '48977770000' };

beforeEach(() => {
  vi.clearAllMocks();
  db.execute.mockResolvedValue([{}]);
  db.query.mockImplementation(async (sql: string) => {
    if (sql.includes('information_schema')) return [[{ 1: 1 }]];
    if (sql.includes('AS agendamento_ref')) {
      return [[{
        agendamento_ref: 'ag-ficticio', sessao_clinica_ref: null, inicio: '2099-12-01 13:00:00.000', valor_centavos: 9000,
        cobranca_vence_em: '2099-12-01 12:00:00.000', organizacao_ref: 'org-ficticia', profissional_ref: 'prof-ficticio',
        profissional_nome: 'Psicóloga Fictícia', paciente_ref: 'paciente-ficticio', paciente_nome: 'Menor Fictício',
        custeado_pela_empresa: 0, paciente_cpf: null, paciente_telefone: '48988880000', paciente_email: 'menor@example.com',
        modalidade_triagem: 'PARTICULAR', responsavel_financeiro: JSON.stringify(RESPONSAVEL),
      }]];
    }
    return [[]];
  });
});

/** Menor sem CPF: a cobrança sai inteira em nome do responsável (§§ 6.03 e 6.04). */
it('usa o responsável financeiro do vínculo como pagador e aceita o CPF dele', async () => {
  const reserva = await reserveAppointmentCharge({ token: 'token-ficticio', cpf: RESPONSAVEL.cpf }) as ReservedCheckout;
  expect(reserva).toMatchObject({
    patientName: RESPONSAVEL.nome, patientCpf: RESPONSAVEL.cpf,
    patientEmail: RESPONSAVEL.email, patientPhone: RESPONSAVEL.telefone,
  });
  const [sql, params] = db.query.mock.calls.find(([texto]) => String(texto).includes('AS agendamento_ref'))!;
  expect(sql).toContain("JSON_EXTRACT(");
  expect(params).toEqual(['00000000-0000-0000-0000-000000000000', 'token-ficticio', RESPONSAVEL.cpf, RESPONSAVEL.cpf, RESPONSAVEL.cpf].map((valor, indice) =>
    indice === 0 ? expect.any(String) : valor));
});
