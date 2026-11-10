import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SessionChargeDueModal } from './SessionChargeDueModal';
import { SessionMonthlyCoverageModal } from './SessionMonthlyCoverageModal';
import { EditSessionModal } from './EditSessionModal';

const session = { id: 'apt', pacienteNome: 'Paciente fictício', inicio: '2099-01-01T15:00:00Z',
  vencimentoCobrancaEm: '2099-01-02T22:30:00Z', convenioNome: 'Empresa fictícia', custeioCota: 4, custeioCiclo: 'mensal' as const };
const callbacks = { onClose: vi.fn(), onSaved: vi.fn(), onBack: vi.fn() };

it('abre o vencimento atual no fuso da clínica, independentemente do horário da sessão', () => {
  const html = renderToStaticMarkup(<SessionChargeDueModal session={session} {...callbacks} />);
  expect(html).toContain('value="2099-01-02"');
  expect(html).toContain('value="19:30"');
});

it('preenche o limite mensal e explica que vale para o paciente e os excedentes', () => {
  const html = renderToStaticMarkup(<SessionMonthlyCoverageModal session={session} {...callbacks} />);
  expect(html).toContain('value="4"');
  expect(html).toContain('o excedente é cobrado do paciente');
  expect(html).toContain('Salvar limite mensal');
});

it('exibe o pacote herdado sem permitir salvar uma cota ignorada', () => {
  const html = renderToStaticMarkup(<SessionMonthlyCoverageModal session={{ ...session, pacoteSessoes: 6, pacoteSessoesCiclo: 'mensal' }} {...callbacks} />);
  expect(html).toContain('pacote de 6 sessões por mês');
  expect(html).not.toContain('type="number"');
  expect(html).not.toContain('Salvar limite mensal');
});

it('mostra a opção mensal somente na edição da gestão com convênio', () => {
  expect(renderToStaticMarkup(<EditSessionModal admin isOpen session={session} {...callbacks} />)).toContain('Sessões por mês');
  expect(renderToStaticMarkup(<EditSessionModal isOpen session={session} {...callbacks} />)).not.toContain('Sessões por mês');
  expect(renderToStaticMarkup(<EditSessionModal admin isOpen session={{ ...session, convenioNome: undefined }} {...callbacks} />)).not.toContain('Sessões por mês');
});
