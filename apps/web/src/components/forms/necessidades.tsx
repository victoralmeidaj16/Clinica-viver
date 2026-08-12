'use client';

/**
 * Lista de necessidades e o seletor compartilhado entre o formulário de
 * triagem do paciente, o cadastro de psicólogo e as telas de gestão. Ficava
 * dentro de `app/vitrine/page.tsx`; foi movido para cá para que o formulário de
 * cadastro de psicólogo pudesse virar componente sem import circular.
 */
export const LISTA_NECESSIDADES = [
  'Depressão',
  'Transtornos de Ansiedade',
  'Traumas',
  'LGBTQIAPN+',
  'Luto',
  'Autoconhecimento',
  'Violência doméstica e abuso sexual',
  'Transtorno Borderline',
  'Desregulação de humor',
  'Sofrimento Psíquico Importante',
  'Maternidade',
  'Autoestima',
  'Burnout',
  'Relacionamentos',
  'Transtornos Alimentares',
  'TDAH',
  'Dependência emocional',
  'Dependência química',
  'Transtorno Disfórico Pré-menstrual',
  'Transtorno Bipolar',
  'Transtornos de personalidade',
  'Transtorno de Humor',
  'Ansiedade',
  'Toxicomania',
  'Transtorno do Espectro Autista (TEA)',
  'Psicodiagnóstico e Avaliação Psicológica em Adultos e Idosos',
  'Fobia Social',
  'Relacionamento abusivo',
  'Sexualidade',
  'Conflitos Familiares',
  'Pacientes e familiares oncológicos',
  'Distúrbios de sono',
  'Agressividade',
  'Dificuldades de Aprendizagem',
  'Estresse',
  'Empoderamento feminino',
  'Inteligência Emocional',
  'Autoconfiança',
  'Brasileiros no exterior e adaptação cultural',
  'Nômades digitais',
  'Habilidades sociais',
  'Transtornos do desenvolvimento global',
  'Violências sexuais',
  'Desenvolvimento pessoal',
  'Autonomia emocional',
  'Construção de sentido à existência',
  'Racismo',
  'Dificuldade na tomada de decisões',
  'Regulação emocional',
  'Dificuldades comportamentais',
  'Questões de Gênero',
  'Demandas adotivas de filhos por adoção, pretendentes e adotantes',
  'Menopausa',
  'Envelhecimento',
  'Paternidade',
  'Masculinidade',
] as const;

export const OPCOES_AVALIACAO_PSICOLOGICA = [
  'Avaliação psicológica - Cirurgia Bariátrica',
  'Avaliação psicológica - Estética e Reparadora',
  'Avaliação psicológica - Normas Regulamentadoras (NRs)',
  'Avaliação psicológica - Agência Nacional de Aviação Civil (ANAC)',
  'Avaliação psicológica - Forense',
  'Avaliação psicológica - Concursos',
  'Avaliação psicológica - TDAH',
  'Avaliação psicológica - Dinâmica Familiar e Parentabilidade',
  'Avaliação psicológica - de Personalidade.',
] as const;

export function NecessidadesSelector({
  prefix,
  especificar,
  onEspecificarChange,
  selecionados,
  onSelecionadosChange,
  outro,
  onOutroChange,
}: {
  prefix: string;
  especificar: boolean;
  onEspecificarChange: (val: boolean) => void;
  selecionados: readonly string[];
  onSelecionadosChange: (lista: string[]) => void;
  outro: string;
  onOutroChange: (val: string) => void;
}) {
  return (
    <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
      <div>
        <label className="font-bold text-slate-800 text-xs sm:text-sm block">
          VOCÊ GOSTARIA DE ESPECIFICAR SUA NECESSIDADE?
        </label>
        <span className="text-[11px] text-slate-500 block mt-0.5">
          Usado como filtro. Selecione um ou mais.
        </span>
      </div>

      <div className="flex items-center gap-6 text-xs sm:text-sm font-bold">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`${prefix}-especificar`}
            checked={especificar === true}
            onChange={() => onEspecificarChange(true)}
            className="w-4 h-4 accent-purple-600 cursor-pointer"
          />
          <span>SIM</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`${prefix}-especificar`}
            checked={especificar === false}
            onChange={() => {
              onEspecificarChange(false);
              onSelecionadosChange([]);
              onOutroChange('');
            }}
            className="w-4 h-4 accent-purple-600 cursor-pointer"
          />
          <span>NÃO</span>
        </label>
      </div>

      {especificar && (
        <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-in fade-in duration-200">
          <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {LISTA_NECESSIDADES.map((item) => {
              const checked = selecionados.includes(item);
              return (
                <label
                  key={item}
                  className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition-all ${
                    checked
                      ? 'bg-purple-50 border-purple-400 text-purple-900 font-semibold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (checked) {
                        onSelecionadosChange(selecionados.filter((s) => s !== item));
                      } else {
                        onSelecionadosChange([...selecionados, item]);
                      }
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-purple-600 cursor-pointer shrink-0"
                  />
                  <span className="leading-tight">{item}</span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-200/60 space-y-1">
            <label className="font-semibold text-xs text-slate-700 block">
              Outro <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={outro}
              onChange={(e) => onOutroChange(e.target.value)}
              placeholder="Escrever outra necessidade..."
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}
