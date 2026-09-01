import { normalizeBrazilPhone } from './brazilPhone';
import { validateGender, type GenderValue } from './gender';
import { normalizarTurnoPreferencia, type TurnoPreferencia } from './turnos';

/**
 * Saneamento do formulário público da vitrine.
 *
 * `POST /api/application/triagem` é a única rota de escrita que atende quem não
 * tem sessão: o formulário da vitrine cai direto nela, e cada lead aceito
 * consome uma vez do rodízio e dispara WhatsApp para o profissional da vez.
 * Sem freio, um script transforma a fila da clínica em ruído e queima o crédito
 * de mensagens — e o estrago não é lido como ataque, é lido como demanda.
 *
 * As defesas são três, e cada uma cobre o que a outra deixa passar:
 *
 *   1. **Campo-armadilha** ({@link CAMPO_ARMADILHA}) — invisível para quem
 *      preenche o formulário, irresistível para o robô que preenche todo input
 *      que encontra.
 *   2. **Validação e teto de tamanho** — o que entra na fila precisa ser um
 *      nome e um telefone brasileiro de verdade, com limite de tamanho por
 *      campo. Antes disto, `body.nome` ia para o banco como chegasse.
 *   3. **Janela de duplicidade** ({@link JANELA_DUPLICIDADE_MS}) — o mesmo
 *      telefone reenviando em seguida recebe o protocolo que já tem, em vez de
 *      um segundo lead.
 *
 * O limite por IP mora na rota, com o mesmo `rateLimited` das rotas de agenda e
 * pagamento. Este arquivo é puro de propósito: é o que permite testá-lo sem
 * subir servidor, e é o mesmo módulo que a vitrine importa para saber o nome do
 * campo-armadilha — dois lugares nunca podem discordar sobre qual campo é a
 * isca.
 */

/**
 * Nome do campo que nenhum humano preenche.
 *
 * Precisa parecer legítimo o bastante para o robô querer preencher: um campo
 * chamado `honeypot` é ignorado por qualquer raspador minimamente atento.
 */
export const CAMPO_ARMADILHA = 'confirmacaoEnderecoAlternativo';

/**
 * Teto do corpo da requisição.
 *
 * O formulário cheio, com todas as necessidades marcadas, não passa de poucos
 * quilobytes. O teto existe para que ninguém pague o custo de desserializar
 * megabytes antes da primeira validação.
 */
export const LIMITE_CORPO_BYTES = 16 * 1024;

/** Reenvio do mesmo telefone dentro desta janela devolve o protocolo existente. */
export const JANELA_DUPLICIDADE_MS = 15 * 60_000;

/**
 * Teto agregado de leads novos por hora.
 *
 * O limite por IP é a defesa que todo mundo escreve primeiro e é também a que
 * menos garante: nesta topologia a vitrine é servida pela Vercel e a chamada
 * chega à VPS por um proxy, então o endereço que a rota enxerga pode ser o do
 * proxy, e quem ataca de propósito troca de origem. Este teto não depende de
 * endereço nenhum — conta o que já está gravado na fila, dentro da mesma
 * transação que grava o próximo.
 *
 * O número é folgado em relação à operação real da clínica, que mede leads por
 * mês, e apertado em relação a um script, que faz centenas por minuto. Quando
 * ele barra alguém, a intenção é justamente essa: parar a fila e o gasto de
 * WhatsApp e deixar o registro no log para a gestão olhar — não filtrar
 * demanda legítima.
 */
export const TETO_LEADS_POR_HORA = 30;

const JANELA_TETO_MS = 60 * 60_000;

const LINK = /https?:\/\/|www\.|\.[a-z]{2,}\/|<\s*a\s|\[url/i;

export interface DadosTriagem {
  nome: string;
  /**
   * Telefone como a pessoa digitou, apenas aparado.
   *
   * A forma canônica serve à comparação, não ao armazenamento: a fila mostra
   * este campo direto na tela e os registros anteriores foram gravados assim.
   * Guardar `5551999999999` no lugar de `(51) 99999-9999` trocaria uma defesa
   * por uma regressão de leitura na tela da gestão.
   */
  telefone: string;
  genero: GenderValue;
  generoOutro?: string;
  dataNascimento?: string;
  idade?: string;
  email?: string;
  cpf?: string;
  cep?: string;
  logradouro?: string;
  numeroResidencia?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estadoUf?: string;
  possuiConvenio?: string;
  convenioSelecionado: string;
  origem: string;
  turno: TurnoPreferencia;
  servico?: string;
  servicoKey?: string;
  modalidade?: string;
  paraQuemE?: string;
  especificarNecessidades: boolean;
  necessidadesPaciente: readonly string[];
  necessidadesOutro?: string;
  opcaoAvaliacaoPsicologica?: string;
  /** Presente apenas quando o paciente escolheu alguém no catálogo público. */
  psicologoPreferidoId?: string;
}

export type ResultadoValidacao =
  | { ok: true; dados: DadosTriagem }
  | { ok: false; erro: string; status: 400 };

function texto(valor: unknown, limite: number): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  if (!limpo) return undefined;
  return limpo.slice(0, limite);
}

function recusa(erro: string): ResultadoValidacao {
  return { ok: false, erro, status: 400 };
}

/**
 * Valida e sane o corpo enviado pelo formulário público.
 *
 * Rejeita com mensagem única quando a armadilha é acionada: dizer ao robô qual
 * regra ele quebrou é ensiná-lo a passar na próxima.
 */
export function validarSubmissaoTriagem(corpo: unknown): ResultadoValidacao {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return recusa('Não foi possível ler os dados enviados.');
  }
  const body = corpo as Record<string, unknown>;

  const armadilha = body[CAMPO_ARMADILHA];
  if (typeof armadilha === 'string' && armadilha.trim()) {
    return recusa('Não foi possível validar o envio do formulário.');
  }

  const nome = texto(body.nome, 120);
  if (!nome || nome.length < 2) {
    return recusa('Informe o nome completo de quem será atendido.');
  }
  if (LINK.test(nome)) {
    return recusa('Não foi possível validar o envio do formulário.');
  }

  const telefoneDigitado = texto(body.whatsapp, 32);
  if (!telefoneDigitado || !normalizeBrazilPhone(telefoneDigitado)) {
    return recusa('Informe um WhatsApp válido, com DDD.');
  }

  const genero = validateGender(body.genero, body.generoOutro);
  if (!genero) {
    return recusa('Selecione o gênero e informe a descrição quando escolher Outro.');
  }

  const turno = normalizarTurnoPreferencia(body.turno);
  if (!turno) {
    return recusa('Selecione o período de preferência: manhã, tarde ou noite.');
  }

  const email = texto(body.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return recusa('O e-mail informado não parece válido.');
  }

  const cpfBruto = texto(body.cpf, 20);
  const cpf = cpfBruto ? cpfBruto.replace(/\D/g, '') : undefined;
  if (cpf && cpf.length !== 11) {
    return recusa('O CPF informado não parece válido.');
  }

  const cepBruto = texto(body.cep, 12);
  const cep = cepBruto ? cepBruto.replace(/\D/g, '') : undefined;
  if (cep && cep.length !== 8) {
    return recusa('O CEP informado não parece válido.');
  }

  const logradouro = texto(body.logradouro, 255);
  const numeroResidencia = texto(body.numeroResidencia, 32);
  const complemento = texto(body.complemento, 120);
  const bairro = texto(body.bairro, 120);
  const cidade = texto(body.cidade, 120);
  const estadoUf = texto(body.estadoUf, 2)?.toLocaleUpperCase('pt-BR');
  const informouEndereco = Boolean(cep || logradouro || numeroResidencia || bairro || cidade || estadoUf);
  if (informouEndereco && (!cep || !logradouro || !numeroResidencia || !bairro || !cidade || !estadoUf)) {
    return recusa('Confirme o endereço completo: CEP, rua, número, bairro, cidade e UF.');
  }
  if (estadoUf && !/^[A-Z]{2}$/.test(estadoUf)) {
    return recusa('A UF informada não parece válida.');
  }

  const dataNascimento = texto(body.dataNascimento, 10);
  if (dataNascimento && !dataNascimentoPlausivel(dataNascimento)) {
    return recusa('A data de nascimento informada não parece válida.');
  }

  const idadeBruta = texto(body.idade, 3);
  if (idadeBruta && !/^\d{1,3}$/.test(idadeBruta)) {
    return recusa('A idade informada não parece válida.');
  }
  const idade = idadeBruta && Number(idadeBruta) <= 120 ? idadeBruta : undefined;
  if (idadeBruta && !idade) {
    return recusa('A idade informada não parece válida.');
  }

  const necessidades = Array.isArray(body.necessidadesPaciente)
    ? body.necessidadesPaciente
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 20)
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean)
    : [];

  const livres = [texto(body.necessidadesOutro, 300), texto(body.paraQuemE, 160)];
  if (livres.some((campo) => campo && LINK.test(campo))) {
    return recusa('Não foi possível validar o envio do formulário.');
  }

  return {
    ok: true,
    dados: {
      nome,
      telefone: telefoneDigitado,
      genero: genero.gender,
      generoOutro: genero.other,
      dataNascimento,
      idade,
      email,
      cpf,
      cep,
      logradouro,
      numeroResidencia,
      complemento,
      bairro,
      cidade,
      estadoUf,
      possuiConvenio: texto(body.possuiConvenio, 20),
      convenioSelecionado: texto(body.convenioSelecionado, 120) ?? 'Nenhum',
      origem: texto(body.origem, 80) ?? 'Formulário Vitrine',
      turno,
      servico: texto(body.servico, 120),
      servicoKey: texto(body.servicoKey, 40),
      modalidade: texto(body.modalidade, 40),
      paraQuemE: livres[1],
      especificarNecessidades: Boolean(body.especificarNecessidades),
      necessidadesPaciente: necessidades,
      necessidadesOutro: livres[0],
      opcaoAvaliacaoPsicologica: texto(body.opcaoAvaliacaoPsicologica, 120),
      psicologoPreferidoId: texto(body.psicologoPreferidoId, 120),
    },
  };
}

function dataNascimentoPlausivel(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  if (Number.isNaN(data.getTime())) return false;
  const ano = data.getUTCFullYear();
  return ano >= 1900 && data.getTime() <= Date.now();
}

/**
 * Lead recente do mesmo telefone, se houver.
 *
 * Compara por número normalizado, não por texto: `(51) 99999-9999` e
 * `5551999999999` são a mesma pessoa, e os registros antigos foram gravados
 * como chegaram. Quem clica duas vezes no botão — ou insiste porque a página
 * demorou — recebe de volta o protocolo que já tem, sem consumir outra vez o
 * rodízio nem disparar um segundo WhatsApp.
 */
export function leadRecenteDoMesmoTelefone<T extends { telefone?: string; criadoEm?: string }>(
  triagens: readonly T[],
  telefone: string,
  agora: number = Date.now()
): T | undefined {
  const alvo = normalizeBrazilPhone(telefone);
  if (!alvo) return undefined;
  return triagens.find((item) => {
    if (!item.criadoEm) return false;
    const criadoEm = new Date(item.criadoEm).getTime();
    if (Number.isNaN(criadoEm) || agora - criadoEm > JANELA_DUPLICIDADE_MS || criadoEm > agora) {
      return false;
    }
    return normalizeBrazilPhone(item.telefone ?? '') === alvo;
  });
}

/** Quantos leads entraram na última hora. Base do teto agregado. */
export function leadsNaUltimaHora(
  triagens: readonly { criadoEm?: string }[],
  agora: number = Date.now()
): number {
  return triagens.filter((item) => {
    if (!item.criadoEm) return false;
    const criadoEm = new Date(item.criadoEm).getTime();
    return !Number.isNaN(criadoEm) && criadoEm <= agora && agora - criadoEm <= JANELA_TETO_MS;
  }).length;
}
