import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ManualRecordForm, RascunhoPendenteAviso } from './ManualRecordForm';
import { novoRascunho } from './fichaAtiva';

const rascunho = { ...novoRascunho('paciente-a'), titulo: 'Sessão fictícia', subjetivo: 'Relato fictício.' };

const formulario = (extra: { salvando?: boolean; erro?: string; complemento?: boolean } = {}) => renderToStaticMarkup(
  <ManualRecordForm
    patientName="Paciente Fictícia A"
    rascunho={rascunho}
    onChange={vi.fn()}
    onCancel={vi.fn()}
    onSubmit={vi.fn()}
    salvando={extra.salvando ?? false}
    erro={extra.erro}
    complemento={extra.complemento}
  />
);

describe('formulário de prontuário manual', () => {
  it('identifica o paciente do rascunho e mostra o texto dele', () => {
    const markup = formulario();
    expect(markup).toContain('Novo Registro de Prontuário Manual — Paciente Fictícia A');
    expect(markup).toContain('value="Sessão fictícia"');
    expect(markup).toContain('Relato fictício.');
    expect(markup).toContain('Salvar no Prontuário');
  });

  it('no vínculo encerrado, deixa claro que é um complemento e que o original fica preservado', () => {
    const markup = formulario({ complemento: true });
    expect(markup).toContain('Complemento ao Prontuário — Paciente Fictícia A');
    expect(markup).toContain('O registro original não é alterado');
    expect(markup).not.toContain('Novo Registro de Prontuário Manual');
  });

  it('mostra a falha de gravação dentro do próprio formulário', () => {
    expect(formulario({ erro: 'Não foi possível salvar o prontuário.' })).toContain('Não foi possível salvar o prontuário.');
  });

  it('bloqueia o envio repetido enquanto salva', () => {
    const markup = formulario({ salvando: true });
    expect(markup).toContain('Salvando…');
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});

describe('rascunho deixado em outra ficha', () => {
  it('avisa de quem é o rascunho e oferece voltar ou descartar', () => {
    const markup = renderToStaticMarkup(
      <RascunhoPendenteAviso patientName="Paciente Fictícia A" onVoltar={vi.fn()} onDescartar={vi.fn()} />
    );
    expect(markup).toContain('Há um rascunho de prontuário não salvo de Paciente Fictícia A.');
    expect(markup).toContain('Ele só pode ser salvo na ficha dessa pessoa.');
    expect(markup).toContain('Voltar para a ficha');
    expect(markup).toContain('Descartar rascunho');
  });
});
