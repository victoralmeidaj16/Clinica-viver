import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { custeioDoAgendamentoSql, custeioEfetivoSql } from './custeioSql';

describe('custeioEfetivoSql', () => {
  const sql = custeioEfetivoSql({ paciente: 'pa', convenio: 'conv' });

  it('paciente sem convênio paga a própria sessão', () => {
    expect(sql).toContain('WHEN pa.convenio_ref IS NULL THEN 0');
  });

  it('a exceção gravada no paciente vence a política do convênio', () => {
    expect(sql).toContain('COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) = 0 THEN 0');
  });

  it('sem cota, o custeio vale para todas as sessões', () => {
    expect(sql).toContain('WHEN pa.custeio_sessoes_cota IS NULL THEN 1');
  });

  it('conta apenas sessões já decididas, nunca agendamentos futuros', () => {
    expect(sql).toContain('cota_ag.custeado_pela_empresa = 1');
    expect(sql).toContain('< pa.custeio_sessoes_cota THEN 1');
  });

  it('o ciclo mensal recorta a contagem pela competência de referência', () => {
    expect(sql).toContain("pa.custeio_sessoes_ciclo <> 'mensal'");
    expect(sql).toContain("DATE_FORMAT(CURRENT_TIMESTAMP(3), '%Y-%m')");
    expect(custeioEfetivoSql({ paciente: 'pa', convenio: 'conv', referencia: 'a.inicio' }))
      .toContain("DATE_FORMAT(a.inicio, '%Y-%m')");
  });
});

describe('custeioDoAgendamentoSql', () => {
  const sql = custeioDoAgendamentoSql({ agendamento: 'a', paciente: 'pa', convenio: 'conv' });

  it('a decisão gravada na sessão vence o recálculo', () => {
    expect(sql.startsWith('COALESCE(a.custeado_pela_empresa,')).toBe(true);
  });

  it('e o ciclo mensal passa a ser o da própria sessão', () => {
    expect(sql).toContain("DATE_FORMAT(a.inicio, '%Y-%m')");
  });
});
