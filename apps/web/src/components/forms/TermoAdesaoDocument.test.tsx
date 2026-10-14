import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ModalTermosParceria } from './ModalTermosParceria';
import { TermoAdesaoDocument } from './TermoAdesaoDocument';

describe('apresentação do Termo de Adesão', () => {
  it('renderiza o documento completo sem resíduos de revisão', () => {
    const html = renderToStaticMarkup(<TermoAdesaoDocument />);

    expect(html).toContain('Termo de Adesão e Condições de Uso da Plataforma Digital');
    expect(html).toContain('Do foro de eleição');
    expect(html).toContain('Avaliação Psicológica / Neuropsicológica');
    expect(html).not.toContain('PAINEL DE ACEITE DIGITADO');
  });

  it('mantém o aceite bloqueado antes da leitura completa', () => {
    const html = renderToStaticMarkup(
      <ModalTermosParceria isOpen onClose={vi.fn()} onAceitar={vi.fn()} />,
    );

    expect(html).toContain('Documento jurídico · Versão 2026.2');
    expect(html).toContain('Continue a leitura · 0% concluído');
    expect(html).toContain('disabled=""');
  });
});
