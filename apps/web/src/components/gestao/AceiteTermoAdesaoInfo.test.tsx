import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AceiteTermoAdesaoInfo } from './AceiteTermoAdesaoInfo';
import type { PsicologoItem } from './types';

const base: PsicologoItem = {
  id: 'psi-teste',
  nomeCompleto: 'Profissional de teste',
  crp: '00/00000',
  whatsapp: '',
  status: 'EM_ANALISE',
};

describe('prova do aceite na gestão', () => {
  it('mostra versão, data do servidor, IP, navegador e hash', () => {
    const html = renderToStaticMarkup(
      <AceiteTermoAdesaoInfo
        psicologo={{
          ...base,
          aceiteTermoAdesao: {
            versao: '2026.2',
            aceitoEm: '2026-10-15T17:32:10.000Z',
            ip: '203.0.113.7',
            navegador: 'Mozilla/5.0 Safari',
            hashAlgoritmo: 'SHA-256',
            hashTexto: 'a'.repeat(64),
          },
        }}
      />
    );

    expect(html).toContain('Aceite do Termo de Adesão');
    expect(html).toContain('2026.2');
    expect(html).toContain('15/10/2026, 14:32:10');
    expect(html).toContain('203.0.113.7');
    expect(html).toContain('Mozilla/5.0 Safari');
    expect(html).toContain('a'.repeat(64));
  });

  it('avisa quando o cadastro não tem prova registrada pelo servidor', () => {
    const html = renderToStaticMarkup(<AceiteTermoAdesaoInfo psicologo={base} />);
    expect(html).toContain('Sem prova de aceite do Termo de Adesão');
  });
});

describe('via em PDF do termo na gestão', () => {
  it('mostra para quem o comprovante foi enviado e oferece o download', () => {
    const html = renderToStaticMarkup(
      <AceiteTermoAdesaoInfo
        psicologo={{
          ...base,
          aceiteTermoAdesao: {
            versao: '2026.2',
            aceitoEm: '2026-10-15T17:32:10.000Z',
            hashAlgoritmo: 'SHA-256',
            comprovante: { arquivo: 'termo.pdf', sha256: 'd'.repeat(64), codigoVerificacao: 'e'.repeat(64) },
            envioComprovante: {
              situacao: 'enviada',
              tentadoEm: '2026-10-15T17:32:11.000Z',
              paraProfissional: true,
              paraClinica: true,
            },
          },
        }}
      />
    );
    expect(html).toContain('enviado em 15/10/2026, 14:32 para profissional e clínica');
    expect(html).toContain('d'.repeat(64));
    expect(html).toContain('/api/application/credenciamento-psicologo/psi-teste/comprovante-termo');
  });

  it('avisa quando o envio falhou', () => {
    const html = renderToStaticMarkup(
      <AceiteTermoAdesaoInfo
        psicologo={{
          ...base,
          aceiteTermoAdesao: {
            versao: '2026.2',
            aceitoEm: '2026-10-15T17:32:10.000Z',
            hashAlgoritmo: 'SHA-256',
            envioComprovante: { situacao: 'provedor_desconfigurado', tentadoEm: '2026-10-15T17:32:11.000Z' },
          },
        }}
      />
    );
    expect(html).toContain('não enviado em 15/10/2026, 14:32 (provedor de e-mail desconfigurado)');
    expect(html).toContain('Enviar às duas partes');
  });
});
