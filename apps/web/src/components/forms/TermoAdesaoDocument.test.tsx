import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ModalTermosParceria } from './ModalTermosParceria';
import { TermoAdesaoDocument } from './TermoAdesaoDocument';
import { TERMO_ADESAO_TITULO, VERSAO_TERMO_ADESAO } from './termoAdesaoContent';

describe('apresentação do Termo de Adesão', () => {
  it('renderiza o documento completo fornecido pela equipe', () => {
    const html = renderToStaticMarkup(<TermoAdesaoDocument />);

    expect(html).toContain(TERMO_ADESAO_TITULO);
    expect(html).toContain('DO FORO DE ELEIÇÃO');
    expect(html).toContain('Avaliação Psicológica / Neuropsicológica');
    expect(html).toContain('PAINEL DE ACEITE DIGITADO');
  });

  it('mantém o aceite bloqueado antes da leitura completa', () => {
    const html = renderToStaticMarkup(
      <ModalTermosParceria isOpen onClose={vi.fn()} onAceitar={vi.fn()} />,
    );

    expect(html).toContain(`Documento jurídico · Versão ${VERSAO_TERMO_ADESAO}`);
    expect(html).toContain('Continue a leitura · 0% concluído');
    expect(html).toContain('disabled=""');
  });
});
