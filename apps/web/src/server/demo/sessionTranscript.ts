import type { RawUtterance } from '@thats-life/core';

/**
 * Transcrições de demonstração.
 *
 * Este é o único ponto do fluxo que é sintético: em produção o áudio da sessão
 * seria enviado ao provedor de transcrição. Daqui para frente tudo é real —
 * a diarização, a geração do SOAP pela IA, a aprovação humana e a projeção na
 * linha do tempo operam sobre estas falas exatamente como operariam sobre uma
 * transcrição de verdade.
 *
 * O locutor "A" é sempre quem abre a sessão (a profissional), o que permite à
 * calibração de `resolveSpeakerRoles` identificar os papéis sem depender de
 * metadados do fornecedor.
 */

export interface DemoTranscript {
  readonly utterances: readonly RawUtterance[];
  /** Fim da apresentação da profissional, usado para calibrar a diarização. */
  readonly professionalIntroEndMs: number;
}

const MARIANA: DemoTranscript = {
  professionalIntroEndMs: 18_000,
  utterances: [
    { speaker: 'A', start: 0, end: 9_000, text: 'Oi Mariana, boa tarde. Antes de começarmos, tudo certo com a gravação? Como combinamos, o áudio é descartado depois que a transcrição fica pronta.' },
    { speaker: 'A', start: 9_000, end: 18_000, text: 'Da última vez a gente tinha ficado no registro de pensamentos e nos exercícios de respiração. Queria começar ouvindo como foi a sua semana.' },
    { speaker: 'B', start: 19_000, end: 41_000, text: 'Foi pesada. Assumi a coordenação de dois projetos novos e sinto que não dou conta. Tenho acordado às quatro da manhã pensando em coisa de trabalho e não consigo mais voltar a dormir.' },
    { speaker: 'A', start: 42_000, end: 52_000, text: 'Quatro da manhã. Isso vem acontecendo todos os dias ou em dias específicos?' },
    { speaker: 'B', start: 53_000, end: 78_000, text: 'Quase todo dia útil. No fim de semana melhora um pouco. E aí no dia seguinte eu chego cansada e rendo menos, o que confirma exatamente o que eu tava pensando de madrugada, que eu não tô dando conta.' },
    { speaker: 'A', start: 79_000, end: 92_000, text: 'Então o cansaço vira prova da ideia. Você consegue lembrar de alguma reunião dessa semana em que isso apareceu?' },
    { speaker: 'B', start: 93_000, end: 128_000, text: 'Teve uma na terça. Eu apresentei o cronograma e um diretor perguntou por que uma entrega tinha atrasado. Eu travei. Respondi qualquer coisa e passei o resto do dia achando que todo mundo percebeu que eu não sei o que tô fazendo.' },
    { speaker: 'A', start: 129_000, end: 145_000, text: 'Você chegou a perguntar a alguém o que acharam, ou isso ficou como uma conclusão sua?' },
    { speaker: 'B', start: 146_000, end: 170_000, text: 'Ficou comigo. Mas a minha colega Paula me chamou depois pra dizer que a apresentação tinha ficado boa. Eu achei que ela tava sendo educada.' },
    { speaker: 'A', start: 171_000, end: 189_000, text: 'Percebe o que aconteceu? A evidência que confirma passou direto e a que contradiz foi descartada como gentileza. Isso é o padrão que a gente vinha mapeando.' },
    { speaker: 'B', start: 190_000, end: 208_000, text: 'É. Eu fiz o registro de pensamentos duas vezes essa semana, mas nos dias piores eu nem abri o caderno. Parecia que ia dar trabalho demais.' },
    { speaker: 'A', start: 209_000, end: 226_000, text: 'Duas vezes já é mais do que na semana anterior. E a respiração pela manhã, conseguiu?' },
    { speaker: 'B', start: 227_000, end: 247_000, text: 'Consegui quase todos os dias. Essa parte foi mais fácil, são dez minutos. Me ajuda antes das reuniões, sinto o corpo menos acelerado.' },
    { speaker: 'A', start: 248_000, end: 271_000, text: 'Vamos manter os dez minutos então, já que está funcionando. E vamos combinar uma coisa sobre o registro: nos dias difíceis, em vez do caderno inteiro, só uma linha com o pensamento. O objetivo é não quebrar a sequência.' },
    { speaker: 'B', start: 272_000, end: 285_000, text: 'Isso eu consigo. Uma linha é bem menos assustador do que a folha toda.' },
    { speaker: 'A', start: 286_000, end: 312_000, text: 'E queria propor mais uma. Você comentou que nunca chegou a alinhar com a gerência o volume de demandas. Que tal escrever um rascunho dessa conversa antes da nossa próxima sessão? Só o rascunho, sem precisar enviar.' },
    { speaker: 'B', start: 313_000, end: 331_000, text: 'Escrever eu consigo. Enviar já é outra história, mas escrever eu topo.' },
    { speaker: 'A', start: 332_000, end: 349_000, text: 'Combinado, fica só o rascunho. A gente olha junto na próxima e você decide o que fazer com ele. Como você está saindo da sessão hoje?' },
    { speaker: 'B', start: 350_000, end: 366_000, text: 'Mais leve. Ajudou perceber que eu tava tratando o cansaço como prova de incompetência.' },
  ],
};

const LUCAS: DemoTranscript = {
  professionalIntroEndMs: 14_000,
  utterances: [
    { speaker: 'A', start: 0, end: 14_000, text: 'Oi Lucas, tudo bem? Na semana passada a gente conversou sobre a exposição gradual às situações sociais. Queria saber como foi.' },
    { speaker: 'B', start: 15_000, end: 44_000, text: 'Eu fui no aniversário. Fiquei quarenta minutos, que era o combinado, e não saí antes. Foi desconfortável no começo, mas depois passou um pouco.' },
    { speaker: 'A', start: 45_000, end: 58_000, text: 'Quarenta minutos inteiros. Como estava a sua ansiedade no começo e no fim, naquela escala de zero a dez?' },
    { speaker: 'B', start: 59_000, end: 82_000, text: 'Começou em oito. Na saída tava uns quatro, quatro e meio. Eu esperava que fosse subindo, mas foi ao contrário.' },
    { speaker: 'A', start: 83_000, end: 101_000, text: 'Esse é exatamente o ponto do exercício. A previsão era de piora contínua e o que aconteceu foi habituação. Vale registrar isso.' },
    { speaker: 'B', start: 102_000, end: 124_000, text: 'Registrei sim, no aplicativo. Mas ainda evito almoçar com a equipe. Isso eu não consegui encarar essa semana.' },
    { speaker: 'A', start: 125_000, end: 148_000, text: 'Tudo bem, é um degrau mais alto. Vamos deixar o almoço para quando o aniversário tiver ficado mais confortável. Por enquanto, que tal um café com uma pessoa só?' },
    { speaker: 'B', start: 149_000, end: 163_000, text: 'Com uma pessoa eu topo. Tem um colega que já me chamou algumas vezes.' },
  ],
};

const ANA: DemoTranscript = {
  professionalIntroEndMs: 12_000,
  utterances: [
    { speaker: 'A', start: 0, end: 12_000, text: 'Oi Ana. Você tinha me contado que o sono estava melhor depois que ajustamos a rotina noturna. Isso se manteve?' },
    { speaker: 'B', start: 13_000, end: 39_000, text: 'Manteve. Tô dormindo por volta das onze e acordando às sete sem despertador na maior parte dos dias. Faz tempo que não era assim.' },
    { speaker: 'A', start: 40_000, end: 54_000, text: 'E o que você percebeu que mudou durante o dia com esse sono?' },
    { speaker: 'B', start: 55_000, end: 84_000, text: 'Tenho mais paciência com as crianças. Antes eu explodia por qualquer coisa de manhã e depois me sentia péssima o resto do dia. Isso diminuiu bastante.' },
    { speaker: 'A', start: 85_000, end: 104_000, text: 'Então o ganho não ficou só no sono, apareceu na relação também. Tem alguma parte da rotina que você sente que ainda está frágil?' },
    { speaker: 'B', start: 105_000, end: 131_000, text: 'O celular. Eu tinha combinado de deixar fora do quarto e nos últimos dias voltei a levar. Ainda não atrapalhou, mas eu sei onde isso vai dar.' },
    { speaker: 'A', start: 132_000, end: 150_000, text: 'Bom você ter notado antes de virar problema. Vamos retomar o combinado do celular fora do quarto e seguir acompanhando.' },
  ],
};

const BY_PATIENT: Record<string, DemoTranscript> = {
  'patient-1': MARIANA,
  'pac-01': MARIANA,
  'patient-2': LUCAS,
  'patient-3': ANA,
};

export function getDemoTranscript(patientId: string): DemoTranscript {
  return BY_PATIENT[patientId] ?? MARIANA;
}
