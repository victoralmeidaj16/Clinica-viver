import { describe, expect, it } from 'vitest';
import { descreverMudancas, diferencasDoCadastro } from './perfilPsicologoDiff';

const CAMPOS = new Set([
  'nomeSocial', 'whatsapp', 'fotoUrl', 'minibio', 'turnosDisponiveis',
  'servicosPrestados', 'especificarNecessidades', 'cidade',
]);

describe('diferencasDoCadastro', () => {
  it('não acusa mudança quando nada muda', () => {
    const cadastro = { nomeSocial: 'Ana', turnosDisponiveis: ['MANHA', 'TARDE'] };
    expect(diferencasDoCadastro(cadastro, { ...cadastro }, CAMPOS)).toEqual([]);
  });

  it('ignora reordenação de lista: os mesmos turnos não são uma alteração', () => {
    const antes = { turnosDisponiveis: ['MANHA', 'TARDE', 'NOITE'] };
    const depois = { turnosDisponiveis: ['NOITE', 'MANHA', 'TARDE'] };
    expect(diferencasDoCadastro(antes, depois, CAMPOS)).toEqual([]);
  });

  it('trata undefined, null e string vazia como a mesma ausência', () => {
    expect(diferencasDoCadastro({ minibio: undefined }, { minibio: '' }, CAMPOS)).toEqual([]);
    expect(diferencasDoCadastro({ nomeSocial: null }, { nomeSocial: '   ' }, CAMPOS)).toEqual([]);
  });

  it('descreve a entrada e a saída de um campo de texto', () => {
    const mudancas = diferencasDoCadastro({ cidade: 'Tubarão' }, { cidade: 'Criciúma' }, CAMPOS);
    expect(mudancas).toEqual([
      { campo: 'cidade', rotulo: 'Cidade', de: 'Tubarão', para: 'Criciúma' },
    ]);
  });

  it('formata lista, booleano e ausência de forma legível', () => {
    const mudancas = diferencasDoCadastro(
      { turnosDisponiveis: ['MANHA'], especificarNecessidades: false, nomeSocial: 'Ana' },
      { turnosDisponiveis: ['MANHA', 'NOITE'], especificarNecessidades: true, nomeSocial: undefined },
      CAMPOS
    );
    const porCampo = Object.fromEntries(mudancas.map((item) => [item.campo, item]));
    expect(porCampo.turnosDisponiveis).toMatchObject({ de: 'MANHA', para: 'MANHA, NOITE' });
    expect(porCampo.especificarNecessidades).toMatchObject({ de: 'Não', para: 'Sim' });
    expect(porCampo.nomeSocial).toMatchObject({ de: 'Ana', para: '—' });
  });

  it('não despeja o conteúdo da foto na descrição', () => {
    const gigante = `data:image/png;base64,${'A'.repeat(5000)}`;
    const mudancas = diferencasDoCadastro({ fotoUrl: undefined }, { fotoUrl: gigante }, CAMPOS);
    expect(mudancas).toEqual([
      { campo: 'fotoUrl', rotulo: 'Foto de perfil', de: '—', para: 'definida' },
    ]);
  });

  it('só olha os campos da allowlist', () => {
    const mudancas = diferencasDoCadastro({ status: 'EM_ANALISE' }, { status: 'APROVADO' }, CAMPOS);
    expect(mudancas).toEqual([]);
  });
});

describe('descreverMudancas', () => {
  it('detalha as mudanças e encerra com ponto', () => {
    const texto = descreverMudancas([
      { campo: 'cidade', rotulo: 'Cidade', de: 'Tubarão', para: 'Criciúma' },
      { campo: 'whatsapp', rotulo: 'WhatsApp', de: '—', para: '48999990000' },
    ]);
    expect(texto).toBe('Cidade: Tubarão → Criciúma; WhatsApp: — → 48999990000.');
  });

  it('resume o excedente em vez de virar parede de texto', () => {
    const mudancas = ['A', 'B', 'C', 'D', 'E', 'F'].map((letra) => ({
      campo: letra, rotulo: letra, de: '1', para: '2',
    }));
    expect(descreverMudancas(mudancas)).toBe('A: 1 → 2; B: 1 → 2; C: 1 → 2; D: 1 → 2 e mais 2 campos.');
  });

  it('encurta valores longos', () => {
    const texto = descreverMudancas([
      { campo: 'minibio', rotulo: 'Minibio', de: '—', para: 'x'.repeat(200) },
    ]);
    expect(texto).toContain('…');
    expect(texto.length).toBeLessThan(120);
  });
});
