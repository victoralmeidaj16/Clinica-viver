import { describe, expect, it } from 'vitest';
import {
  apurarHorasClinicas,
  calcularHashDeclaracao,
  gerarCodigoVerificacao,
  normalizarCodigoVerificacao,
  type ConteudoDeclaracao,
  type SessaoContabilizavel,
} from './declaracaoHoras';

function sessao(
  id: string,
  status: SessaoContabilizavel['status'],
  scheduledStart: string,
  actualEnd?: string
): SessaoContabilizavel {
  return { id, status, scheduledStart, actualEnd };
}

describe('apurarHorasClinicas', () => {
  it('conta apenas as sessões em que houve atendimento', () => {
    const apuracao = apurarHorasClinicas([
      sessao('s1', 'completed', '2026-03-02T13:00:00.000Z'),
      sessao('s2', 'awaiting_review', '2026-04-06T13:00:00.000Z'),
      sessao('s3', 'ready_to_complete', '2026-05-04T13:00:00.000Z'),
      sessao('s4', 'no_show', '2026-06-01T13:00:00.000Z'),
      sessao('s5', 'cancelled', '2026-06-08T13:00:00.000Z'),
      sessao('s6', 'scheduled', '2026-12-01T13:00:00.000Z'),
      sessao('s7', 'confirmed', '2026-12-08T13:00:00.000Z'),
      sessao('s8', 'in_progress', '2026-12-15T13:00:00.000Z'),
    ]);

    expect(apuracao).not.toBeNull();
    expect(apuracao!.sessaoIds).toEqual(['s1', 's2', 's3']);
    expect(apuracao!.totalSessoes).toBe(3);
    expect(apuracao!.totalHoras).toBe(3);
  });

  /**
   * O caso que originou o módulo: sem sessão nenhuma, a rota antiga devolvia
   * 180 horas fixas. Uma declaração de estágio com número inventado é o pior
   * defeito possível neste documento.
   */
  it('devolve null quando nada conta, em vez de um total inventado', () => {
    expect(apurarHorasClinicas([])).toBeNull();
    expect(
      apurarHorasClinicas([
        sessao('s1', 'no_show', '2026-03-02T13:00:00.000Z'),
        sessao('s2', 'cancelled', '2026-03-09T13:00:00.000Z'),
      ])
    ).toBeNull();
  });

  it('deriva o período das bordas, e não da ordem em que as sessões chegaram', () => {
    const apuracao = apurarHorasClinicas([
      sessao('s2', 'completed', '2026-05-04T13:00:00.000Z', '2026-05-04T14:00:00.000Z'),
      sessao('s1', 'completed', '2026-03-02T13:00:00.000Z', '2026-03-02T14:00:00.000Z'),
      sessao('s3', 'completed', '2026-08-10T13:00:00.000Z', '2026-08-10T14:00:00.000Z'),
    ]);

    expect(apuracao!.periodoInicio).toBe('2026-03-02');
    expect(apuracao!.periodoFim).toBe('2026-08-10');
  });

  it('usa o horário previsto quando o cockpit não fechou o relógio da sessão', () => {
    const apuracao = apurarHorasClinicas([
      sessao('s1', 'completed', '2026-03-02T13:00:00.000Z'),
    ]);

    expect(apuracao!.periodoInicio).toBe('2026-03-02');
    expect(apuracao!.periodoFim).toBe('2026-03-02');
  });
});

describe('código de verificação', () => {
  it('gera no formato VM-XXXX-XXXX, sem caracteres ambíguos', () => {
    for (let tentativa = 0; tentativa < 200; tentativa += 1) {
      const codigo = gerarCodigoVerificacao();
      expect(codigo).toMatch(/^VM-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/);
      expect(codigo.slice(3)).not.toMatch(/[01OILU]/);
    }
  });

  it('não repete o código entre emissões', () => {
    const codigos = new Set(Array.from({ length: 500 }, () => gerarCodigoVerificacao()));
    expect(codigos.size).toBe(500);
  });

  it('aceita o código como a pessoa o digita do papel', () => {
    const canonico = 'VM-A2B3-C4D5';
    expect(normalizarCodigoVerificacao('vm-a2b3-c4d5')).toBe(canonico);
    expect(normalizarCodigoVerificacao('VMA2B3C4D5')).toBe(canonico);
    expect(normalizarCodigoVerificacao('  VM A2B3 C4D5  ')).toBe(canonico);
    expect(normalizarCodigoVerificacao('A2B3-C4D5')).toBe(canonico);
  });

  it('recusa o que não pode ser código', () => {
    expect(normalizarCodigoVerificacao('VM-A2B3')).toBeNull();
    expect(normalizarCodigoVerificacao('VM-A2B3-C4D5E')).toBeNull();
    expect(normalizarCodigoVerificacao('')).toBeNull();
    // `0`, `1` e `O` não existem no alfabeto: quem os digitou leu errado.
    expect(normalizarCodigoVerificacao('VM-01OI-C4D5')).toBeNull();
  });
});

describe('hash da declaração', () => {
  const base: ConteudoDeclaracao = {
    codigo: 'VM-A2B3-C4D5',
    psicologoNome: 'Fulana de Tal',
    psicologoCrp: '12/34567',
    curso: 'Pós-graduação em Neuropsicologia Clínica — Turma 04',
    periodoInicio: '2026-03-02',
    periodoFim: '2026-08-10',
    totalSessoes: 3,
    totalHoras: 3,
    emitidoEm: '2026-08-20T12:00:00.000Z',
    sessaoIds: ['s1', 's2', 's3'],
  };

  it('é estável quando só muda a ordem em que as sessões voltaram do banco', async () => {
    const original = await calcularHashDeclaracao(base);
    const reordenado = await calcularHashDeclaracao({ ...base, sessaoIds: ['s3', 's1', 's2'] });
    expect(reordenado).toBe(original);
  });

  it('muda quando o total de horas é adulterado', async () => {
    const original = await calcularHashDeclaracao(base);
    const adulterado = await calcularHashDeclaracao({ ...base, totalHoras: 180, totalSessoes: 180 });
    expect(adulterado).not.toBe(original);
  });

  it('muda quando o nome do psicólogo é trocado', async () => {
    const original = await calcularHashDeclaracao(base);
    const outro = await calcularHashDeclaracao({ ...base, psicologoNome: 'Outra Pessoa' });
    expect(outro).not.toBe(original);
  });

  it('muda quando uma sessão é acrescentada à evidência', async () => {
    const original = await calcularHashDeclaracao(base);
    const inflado = await calcularHashDeclaracao({ ...base, sessaoIds: ['s1', 's2', 's3', 's4'] });
    expect(inflado).not.toBe(original);
  });
});
