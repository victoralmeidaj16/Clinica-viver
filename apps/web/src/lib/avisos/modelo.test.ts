import { describe, expect, it } from 'vitest';
import { CATALOGO_AVISOS, normalizarConfiguracao, avisoDoCatalogo } from './catalogo';
import { camposDoModelo, renderizarModelo, validarModelo } from './modelo';

describe('renderizarModelo', () => {
  it('preenche os campos e remove a linha de um campo opcional vazio', () => {
    const modelo = 'Olá, {{nome}}!\n{{opcional}}\nQuando: {{dia}}';
    expect(renderizarModelo(modelo, { nome: 'Ana', opcional: '', dia: 'sexta' })).toBe('Olá, Ana!\nQuando: sexta');
    expect(renderizarModelo(modelo, { nome: 'Ana', opcional: 'Linha extra', dia: 'sexta' }))
      .toBe('Olá, Ana!\nLinha extra\nQuando: sexta');
  });

  it('mantém linhas em branco do próprio texto', () => {
    expect(renderizarModelo('A\n\nB {{x}}', { x: '1' })).toBe('A\n\nB 1');
  });

  it('aceita espaços dentro das chaves', () => {
    expect(renderizarModelo('{{ nome }}', { nome: 'Ana' })).toBe('Ana');
  });
});

describe('validarModelo', () => {
  it('recusa campo desconhecido, obrigatório ausente e chaves soltas', () => {
    const problemas = validarModelo('Olá {{nome}} {{senha}} {{', ['nome', 'link'], ['link']).map((p) => p.tipo);
    expect(problemas).toEqual(['campo_desconhecido', 'campo_obrigatorio_ausente', 'chaves_soltas']);
  });

  it('recusa texto vazio', () => {
    expect(validarModelo('   ', ['nome']).map((p) => p.tipo)).toEqual(['texto_vazio']);
  });

  it('lista os campos sem repetição', () => {
    expect(camposDoModelo('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });
});

describe('catálogo de avisos', () => {
  it('cada texto padrão usa só os próprios campos e traz os obrigatórios', () => {
    for (const aviso of CATALOGO_AVISOS) {
      expect(validarModelo(aviso.modeloPadrao, aviso.campos.map((c) => c.nome), aviso.camposObrigatorios), aviso.finalidade)
        .toEqual([]);
      expect(aviso.canais).toContain(aviso.canalPadrao);
    }
  });

  it('finalidades não se repetem', () => {
    expect(new Set(CATALOGO_AVISOS.map((a) => a.finalidade)).size).toBe(CATALOGO_AVISOS.length);
  });

  it('essencial nunca fica desativado e complementar começa desligado', () => {
    const essencial = avisoDoCatalogo('agenda_confirmacao_paciente')!;
    const complementar = avisoDoCatalogo('lembrete_sessao_paciente')!;
    expect(normalizarConfiguracao(essencial, { ativo: false, canal: 'whatsapp', versao: 2 }).ativo).toBe(true);
    expect(normalizarConfiguracao(complementar, undefined).ativo).toBe(false);
  });

  it('canal fora da lista do aviso volta ao padrão', () => {
    const aviso = avisoDoCatalogo('agenda_cancelamento_paciente')!;
    expect(normalizarConfiguracao(aviso, { canal: 'email' }).canal).toBe('whatsapp');
  });

  it('o aviso com link de ativação não é reenviável pelo registro', () => {
    expect(avisoDoCatalogo('boas_vindas_psicologo')!.reenviavel).toBe(false);
  });
});
