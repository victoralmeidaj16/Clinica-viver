import { describe, expect, it } from 'vitest';
import {
  CAMPO_ARMADILHA,
  JANELA_DUPLICIDADE_MS,
  TETO_LEADS_POR_HORA,
  leadRecenteDoMesmoTelefone,
  leadsNaUltimaHora,
  validarSubmissaoTriagem,
} from './triagemSubmissao';

const valido = {
  nome: 'Ana Clara Lima',
  whatsapp: '(51) 99999-9999',
  genero: 'FEMININO',
  servicoKey: 'PSICOTERAPIA',
  modalidade: 'SOCIAL',
  turno: 'VESPERTINO',
};

const endereco = {
  cep: '88900-000',
  logradouro: 'Rua das Flores',
  numeroResidencia: '205',
  complemento: 'Apto 4',
  bairro: 'Centro',
  cidade: 'Araranguá',
  estadoUf: 'sc',
};

describe('validação do formulário público de triagem', () => {
  it('aceita o envio mínimo e preenche os padrões da fila', () => {
    const resultado = validarSubmissaoTriagem(valido);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.dados.nome).toBe('Ana Clara Lima');
    expect(resultado.dados.telefone).toBe('(51) 99999-9999');
    expect(resultado.dados.convenioSelecionado).toBe('Nenhum');
    expect(resultado.dados.origem).toBe('Formulário Vitrine');
    expect(resultado.dados.turno).toBe('TARDE');
  });

  it('saneia a escolha explícita do profissional', () => {
    const resultado = validarSubmissaoTriagem({ ...valido, psicologoPreferidoId: '  psi-123  ' });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.psicologoPreferidoId).toBe('psi-123');
  });

  it.each(['MANHA', 'TARDE', 'NOITE'] as const)('aceita e preserva o turno canônico %s', (turno) => {
    const resultado = validarSubmissaoTriagem({ ...valido, turno });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.turno).toBe(turno);
  });

  it('exige uma preferência válida em vez de assumir um turno', () => {
    expect(validarSubmissaoTriagem({ ...valido, turno: '' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, turno: 'MADRUGADA' }).ok).toBe(false);
  });

  it('recusa o envio quando o campo-armadilha volta preenchido', () => {
    const resultado = validarSubmissaoTriagem({ ...valido, [CAMPO_ARMADILHA]: 'http://spam.example' });
    expect(resultado.ok).toBe(false);
  });

  it('não revela ao robô qual regra foi quebrada', () => {
    const armadilha = validarSubmissaoTriagem({ ...valido, [CAMPO_ARMADILHA]: 'x' });
    const link = validarSubmissaoTriagem({ ...valido, nome: 'compre em www.exemplo.com' });
    expect(armadilha.ok).toBe(false);
    expect(link.ok).toBe(false);
    if (armadilha.ok || link.ok) return;
    expect(armadilha.erro).toBe(link.erro);
  });

  it('ignora o campo-armadilha vazio, que é como o formulário legítimo chega', () => {
    expect(validarSubmissaoTriagem({ ...valido, [CAMPO_ARMADILHA]: '' }).ok).toBe(true);
  });

  it('exige um telefone brasileiro reconhecível', () => {
    expect(validarSubmissaoTriagem({ ...valido, whatsapp: '123' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, whatsapp: 'me liga' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, whatsapp: '+55 51 99999-9999' }).ok).toBe(true);
  });

  it('exige um nome plausível', () => {
    expect(validarSubmissaoTriagem({ ...valido, nome: '' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, nome: 'A' }).ok).toBe(false);
  });

  it('corta o texto que passa do limite em vez de recusar o lead', () => {
    const resultado = validarSubmissaoTriagem({ ...valido, nome: 'a'.repeat(500) });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.dados.nome).toHaveLength(120);
  });

  it('limita a lista de necessidades e descarta o que não é texto', () => {
    const resultado = validarSubmissaoTriagem({
      ...valido,
      necessidadesPaciente: [...Array(50).fill('Ansiedade'), 42, null],
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.dados.necessidadesPaciente).toHaveLength(20);
  });

  it('recusa CPF, CEP, e-mail e data de nascimento malformados', () => {
    expect(validarSubmissaoTriagem({ ...valido, cpf: '123' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, cep: '9' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, email: 'ana@' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, dataNascimento: '31/02/1990' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, dataNascimento: '2999-01-01' }).ok).toBe(false);
  });

  it('preserva o endereço fiscal completo e normaliza a UF', () => {
    const resultado = validarSubmissaoTriagem({ ...valido, ...endereco });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.dados).toMatchObject({
      cep: '88900000',
      logradouro: 'Rua das Flores',
      numeroResidencia: '205',
      complemento: 'Apto 4',
      bairro: 'Centro',
      cidade: 'Araranguá',
      estadoUf: 'SC',
    });
  });

  it('aceita o nome de campo UF usado pelo cadastro autenticado', () => {
    const resultado = validarSubmissaoTriagem({
      ...valido,
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numeroResidencia: endereco.numeroResidencia,
      complemento: endereco.complemento,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: 'sc',
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.dados.estadoUf).toBe('SC');
  });

  it('recusa endereço fiscal incompleto quando o CEP é informado', () => {
    expect(validarSubmissaoTriagem({ ...valido, ...endereco, bairro: '' }).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...valido, ...endereco, estadoUf: 'S' }).ok).toBe(false);
  });

  it('recusa corpo que não é objeto', () => {
    expect(validarSubmissaoTriagem(null).ok).toBe(false);
    expect(validarSubmissaoTriagem([valido]).ok).toBe(false);
    expect(validarSubmissaoTriagem('nome=ana').ok).toBe(false);
  });
});

describe('janela de reenvio do mesmo telefone', () => {
  const agora = Date.parse('2026-08-18T12:00:00.000Z');
  const lead = (telefone: string, minutosAtras: number) => ({
    protocolo: 'VM-100200',
    telefone,
    criadoEm: new Date(agora - minutosAtras * 60_000).toISOString(),
  });

  it('reconhece o mesmo número escrito de outra forma', () => {
    const fila = [lead('5551999999999', 2)];
    expect(leadRecenteDoMesmoTelefone(fila, '(51) 99999-9999', agora)?.protocolo).toBe('VM-100200');
  });

  it('deixa passar quem volta depois da janela', () => {
    const fila = [lead('(51) 99999-9999', JANELA_DUPLICIDADE_MS / 60_000 + 1)];
    expect(leadRecenteDoMesmoTelefone(fila, '(51) 99999-9999', agora)).toBeUndefined();
  });

  it('não confunde telefones diferentes', () => {
    const fila = [lead('(51) 98888-8888', 1)];
    expect(leadRecenteDoMesmoTelefone(fila, '(51) 99999-9999', agora)).toBeUndefined();
  });

  it('ignora registro sem data ou com telefone ilegível', () => {
    expect(leadRecenteDoMesmoTelefone([{ telefone: '(51) 99999-9999' }], '(51) 99999-9999', agora)).toBeUndefined();
    expect(leadRecenteDoMesmoTelefone([lead('', 1)], '(51) 99999-9999', agora)).toBeUndefined();
  });
});

describe('teto agregado de leads por hora', () => {
  const agora = Date.parse('2026-08-18T12:00:00.000Z');
  const fila = (quantidade: number, minutosAtras: number) =>
    Array.from({ length: quantidade }, () => ({
      criadoEm: new Date(agora - minutosAtras * 60_000).toISOString(),
    }));

  it('conta apenas o que entrou na última hora', () => {
    expect(leadsNaUltimaHora([...fila(5, 10), ...fila(40, 90)], agora)).toBe(5);
  });

  it('não conta registro sem data ou com data ilegível', () => {
    expect(leadsNaUltimaHora([{}, { criadoEm: 'ontem' }], agora)).toBe(0);
  });

  it('deixa o volume real da clínica bem abaixo do teto', () => {
    expect(leadsNaUltimaHora(fila(6, 30), agora)).toBeLessThan(TETO_LEADS_POR_HORA);
  });
});
