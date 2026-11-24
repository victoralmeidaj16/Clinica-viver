import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { periodoCompetencia, arquivoApuracao } from './educationalCreditReport';

it('fecha a competência no horário da clínica inclusive na virada do ano', () => {
  expect(periodoCompetencia('2026-12')).toEqual({ startDate: '2026-12-01T03:00:00.000Z', endDate: '2027-01-01T02:59:59.999Z' });
  expect(() => periodoCompetencia('2026-13')).toThrow();
});
it('exporta um mês vazio nos dois formatos de arquivo', async () => {
  const report = { mes: '2026-11', linhas: [], totalCentavos: 0 };
  expect((await arquivoApuracao(report, 'xlsx')).subarray(0, 2).toString()).toBe('PK');
  expect((await arquivoApuracao(report, 'pdf')).subarray(0, 4).toString()).toBe('%PDF');
});

it.runIf(process.env.VM_VALIDAR_EXPORTACOES === '1')('reabre o Excel e extrai o texto do PDF com quatro origens, referências e total', async () => {
  const { execFileSync } = await import('node:child_process');
  const linhas = (['payment','package','company_session','adjustment'] as const).map((source,i) => ({
    id:String(i), source, chargeId:'COB-'+i,sessionId:'s',patientId:'p',professionalId:'prof',profissional:'Profissional ficticio',
    origem:source,occurredAt:'2026-11-20T20:00:00Z',baseCents:[4000,40000,10000,0][i],creditCents:[2800,28000,7000,-2800][i],
    justification:i===3 ? 'Reembolso autorizado' : undefined,receiptRef:i===0 ? 'TRX-ficticia' : undefined,receiptUrl:i===0 ? 'https://www.asaas.com/comprovantes/teste' : undefined,
  }));
  const report = { mes:'2026-11',linhas,totalCentavos:35000 };
  const xlsx = await arquivoApuracao(report,'xlsx');
  const resultado = execFileSync('python3',['-c',[
    'import io,sys,json,openpyxl','s=openpyxl.load_workbook(io.BytesIO(sys.stdin.buffer.read()),data_only=True).active',
    'print(json.dumps([s["B2"].value,s["G2"].value,s["G5"].value,s["G6"].value,s["I2"].value,s["M2"].value]))',
  ].join('\n')],{input:xlsx,encoding:'utf8'});
  expect(JSON.parse(resultado)).toEqual(['Profissional ficticio',28,-28,350,'TRX-ficticia','https://www.asaas.com/comprovantes/teste']);
  const texto = execFileSync('pdftotext',['-','-'],{input:await arquivoApuracao(report,'pdf'),encoding:'utf8'});
  for (const trecho of ['TRX-ficticia','Abrir comprovante','350,00','Reembolso autorizado','COB-3']) expect(texto).toContain(trecho);
});
