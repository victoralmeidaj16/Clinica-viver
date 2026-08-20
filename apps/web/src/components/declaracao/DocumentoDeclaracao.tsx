import Image from 'next/image';
import { Globe, Phone } from 'lucide-react';
import { QrCodeConferencia } from './QrCodeConferencia';

/**
 * A declaração de horas como documento — a folha A4 que vai para a impressora.
 *
 * Separada da tela de emissão porque são duas coisas com ritmos diferentes: o
 * painel de emissão muda quando muda a regra de quem pode emitir, e esta folha
 * muda quando a clínica mexe no modelo em papel. Juntas num arquivo só, a
 * página passava de 400 linhas e qualquer ajuste no layout obrigava a ler o
 * fluxo de emissão inteiro para achar onde mexer.
 *
 * O layout segue o modelo da clínica: listras coloridas e marca no topo, corpo
 * serifado justificado, marca d'água do Complexo Educacional ao centro, duas
 * assinaturas e o rodapé em onda com os contatos.
 */

export interface DeclaracaoImpressa {
  codigo: string;
  urlConferencia: string;
  psicologoNome: string;
  psicologoCrp: string;
  /** "Pós-Graduanda" ou "Pós-Graduando": concordância vinda do cadastro. */
  tratamento: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalHoras: number;
  coordenadora: string;
  supervisora: string;
  emitidoEm: string;
}

/** "Março de 2025" — o modelo em papel nomeia o mês, não a data cheia. */
function mesAno(iso: string): string {
  const rotulo = new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

/**
 * "06 de Agosto de 2026", com o mês em maiúscula como no modelo em papel.
 *
 * O `pt-BR` do `Intl` escreve o mês em minúscula, que é a norma culta — mas
 * aqui o que manda é o documento que a clínica já usa, e divergir dele numa
 * declaração que a coordenação compara com outras é ruído desnecessário.
 */
function dataPorExtenso(iso: string): string {
  const formatada = new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
  return formatada.replace(/ de ([a-zà-ú])/, (_, letra: string) => ` de ${letra.toUpperCase()}`);
}

export function DocumentoDeclaracao({ declaracao }: { declaracao: DeclaracaoImpressa }) {
  return (
    <div className="declaracao-documento max-w-[794px] mx-auto bg-white min-h-[1123px] relative overflow-hidden flex flex-col shadow-2xl rounded-sm print:shadow-none print:m-0 print:w-full print:max-w-none print:min-h-screen print:rounded-none">
      {/*
        Marca d'água do Complexo Educacional, como no modelo em papel:
        texto em círculo com a marca esmaecida ao centro. `aria-hidden`
        porque é ornamento — um leitor de tela anunciando as letras soltas
        do círculo atrapalharia quem lê a declaração.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="relative w-[430px] h-[430px] opacity-[0.06]">
          <svg viewBox="0 0 430 430" className="absolute inset-0 w-full h-full">
            <defs>
              {/*
                O arco começa no topo (`m 0,-180`) e não à esquerda: com o
                início à esquerda, a frase nascia na lateral e o meio dela caía
                de cabeça para baixo na parte de cima do círculo. `textLength`
                distribui a frase por uma volta exata, o que dispensa acertar o
                espaçamento entre letras por tentativa.
              */}
              <path
                id="trilhaMarcaDagua"
                d="M 215,215 m 0,-180 a 180,180 0 1,1 -0.01,0"
                fill="none"
              />
            </defs>
            <text
              fill="#4c1d95"
              fontSize="27"
              fontWeight="700"
              fontFamily="'Times New Roman', Times, serif"
            >
              <textPath href="#trilhaMarcaDagua" startOffset="0%" textLength="1130">
                COMPLEXO EDUCACIONAL · ESPAÇO PSICOLOGIA ·
              </textPath>
            </text>
          </svg>
          <Image
            src="/logo-viver-mais.png"
            alt=""
            width={317}
            height={60}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-auto"
          />
        </div>
      </div>

      <div className="relative px-12 pt-12">
        {/* Cabeçalho: listras coloridas à esquerda, marca à direita. */}
        <div className="flex items-end gap-[7px] h-16 mb-10">
          {[
            { cor: '#6d28d9', altura: '100%' },
            { cor: '#f97316', altura: '72%' },
            { cor: '#22d3ee', altura: '92%' },
            { cor: '#7c3aed', altura: '58%' },
            { cor: '#ef4444', altura: '100%' },
            { cor: '#0ea5e9', altura: '80%' },
            { cor: '#f59e0b', altura: '64%' },
            { cor: '#8b5cf6', altura: '96%' },
            { cor: '#06b6d4', altura: '70%' },
            { cor: '#f472b6', altura: '86%' },
            { cor: '#5b21b6', altura: '54%' },
          ].map((listra, indice) => (
            <span
              key={indice}
              className="w-[9px] rounded-full shrink-0"
              style={{ backgroundColor: listra.cor, height: listra.altura }}
            />
          ))}

          <Image
            src="/logo-viver-mais.png"
            alt="Viver Mais Psicologia"
            width={317}
            height={60}
            priority
            className="ml-auto w-[200px] h-auto"
          />
        </div>

        <div className="text-center mt-16">
          <h2 className="text-xl font-bold text-slate-900">VIVER MAIS PSICOLOGIA</h2>
          <h3 className="text-lg font-bold text-slate-900 mt-14">DECLARAÇÃO</h3>
        </div>

        <div className="text-slate-900 text-[15px] leading-[1.9] text-justify mt-14">
          <p>
            Eu, {declaracao.coordenadora}, coordenadora da Clínica de Atendimento Psicológico Viver Mais,
            inscrita no CNPJ 19.440.737/0001-53, declaro, para fins de comprovação de cumprimento da carga
            horária de estágio em atendimento psicológico, que {declaracao.psicologoNome}, CRP{' '}
            {declaracao.psicologoCrp}, {declaracao.tratamento} em {declaracao.curso}, realizou atendimentos
            psicológicos no período de {mesAno(declaracao.periodoInicio)} a {mesAno(declaracao.periodoFim)},
            totalizando {declaracao.totalHoras} horas de atendimento clínico nesta instituição.
          </p>
        </div>
      </div>

      <div className="relative mt-auto px-12">
        <div className="text-right text-[15px] text-slate-900 mt-24 mb-24">
          Tubarão, {dataPorExtenso(declaracao.emitidoEm)}.
        </div>

        <div className="grid grid-cols-2 gap-10 text-center mb-10">
          <div className="flex flex-col items-center">
            <div className="w-full border-t-[3px] border-purple-900 mb-3" />
            <span className="font-bold italic text-[13px] uppercase text-purple-900 tracking-wide">
              {declaracao.coordenadora}
            </span>
            <span className="text-[13px] font-bold text-slate-900 mt-3">Coordenadora</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full border-t-[3px] border-purple-900 mb-3" />
            <span className="font-bold italic text-[13px] uppercase text-purple-900 tracking-wide">
              {declaracao.supervisora}
            </span>
            <span className="text-[13px] font-bold text-slate-900 mt-3">Psicóloga</span>
          </div>
        </div>

        {/* Bloco de conferência: é o que separa este papel de uma cópia editada. */}
        <div className="flex items-center gap-4 px-4 py-3 mb-6 border border-purple-200 rounded-lg bg-purple-50/60">
          <QrCodeConferencia valor={declaracao.urlConferencia} tamanho={78} className="shrink-0" />
          <div className="text-[10px] text-purple-950 leading-relaxed font-sans">
            <p className="font-bold">Confira a autenticidade desta declaração</p>
            <p>
              Acesse <strong>{declaracao.urlConferencia}</strong> ou informe o código
            </p>
            <p className="font-mono font-black text-[13px] tracking-widest text-purple-900 mt-0.5">
              {declaracao.codigo}
            </p>
          </div>
        </div>
      </div>

      {/*
        Rodapé: a onda colorida e, abaixo dela, os contatos em fundo branco —
        é assim no modelo em papel. Pôr o texto sobre a onda, como numa
        primeira tentativa, custava contraste: branco sobre laranja claro fica
        ilegível na impressão em preto e branco, que é como a coordenação do
        curso costuma arquivar o documento.
      */}
      <div>
        <svg viewBox="0 0 794 96" className="w-full h-[74px] block" preserveAspectRatio="none">
          <path d="M0,30 C170,-10 330,74 500,34 C620,5 700,20 794,42 L794,96 L0,96 Z" fill="#f87171" />
          <path d="M0,48 C180,4 340,92 512,50 C632,22 706,36 794,58 L794,96 L0,96 Z" fill="#fb923c" opacity="0.9" />
          <path d="M0,66 C190,22 350,104 524,66 C644,40 712,52 794,72 L794,96 L0,96 Z" fill="#5b21b6" />
        </svg>

        <div className="px-12 py-4 flex items-start justify-between text-[10px] text-purple-950 font-sans font-semibold bg-white">
          <div className="space-y-1.5">
            <span className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-sky-600" />
              (48) 99904-8086
            </span>
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-blue-700" fill="currentColor" aria-hidden>
                <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.27-.13-2.41-.13-2.38 0-4.01 1.45-4.01 4.12v2.3H7.6V13h2.68v8h3.22z" />
              </svg>
              vivermaispsicologia
            </span>
          </div>

          <div className="space-y-1.5 text-right">
            <span className="flex items-center gap-2 justify-end">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-pink-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="3.6" />
                <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
              </svg>
              vivermaispsicologia
            </span>
            <span className="flex items-center gap-2 justify-end">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              www.vivermaispsicologia.com.br
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
