'use client';

import React, { useEffect, useState } from 'react';
import { VitrineCarrossel, PsicologoVitrineItem } from '@/components/vitrineCarrossel';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';
import { GenderFields } from '@/components/forms/GenderFields';
import { maskBrazilPhoneInput, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { validateGender, type GenderValue } from '@/lib/gender';
import {
  Sparkles,
  Heart,
  Calendar,
  CheckCircle2,
  Phone,
  User,
  Mail,
  MapPin,
  HelpCircle,
  Clock,
  ArrowRight,
  Brain,
  ShieldCheck,
  Check,
  Building2,
  DollarSign,
  Send,
  UserPlus,
  Upload
} from 'lucide-react';

type ServicoKey =
  | 'PSICOTERAPIA'
  | 'PSICOTERAPIA_CASAL'
  | 'AVALIACAO'
  | 'ORIENTACAO_PROFISSIONAL'
  | 'ORIENTACAO_PARENTAL';

type ModalidadeKey = 'SOCIAL' | 'PARTICULAR' | 'CASAL_SOCIAL' | 'CASAL_PARTICULAR';

interface OpcaoPreco {
  tipo: ModalidadeKey;
  label: string;
  preco: string;
}

interface ServicoVitrine {
  titulo: string;
  descricao: string;
  duracao: string;
  imagem: string;
  opcoes: OpcaoPreco[];
}

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

function NecessidadesSelector({
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

export default function ViverMaisLandingPage() {
  const [selectedService, setSelectedService] = useState<ServicoKey | null>(null);
  const [selectedModalidade, setSelectedModalidade] = useState<ModalidadeKey | null>(null);
  const [step, setStep] = useState<'SERVICOS' | 'FORMULARIO' | 'CADASTRO_PSICOLOGO' | 'SUCESSO' | 'SUCESSO_PSICOLOGO'>('SERVICOS');
  
  const [temNomeSocialPaciente, setTemNomeSocialPaciente] = useState(false);
  const [temNomeSocialPsicologo, setTemNomeSocialPsicologo] = useState(false);
  const [temSegundaPos, setTemSegundaPos] = useState(false);
  const [segundaPosGraduacao, setSegundaPosGraduacao] = useState('');

  const [form, setForm] = useState({
    nome: '',
    nomeSocial: '',
    whatsapp: '',
    whatsappConfirmacao: '',
    idade: '',
    email: '',
    cpf: '',
    cep: '',
    numeroResidencia: '',
    ruaManual: '',
    bairroManual: '',
    possuiConvenio: 'NAO',
    convenioSelecionado: '',
    origem: 'Facebook',
    turno: 'VESPERTINO',
    paraQuemE: '',
    paraQuemEOutro: '',
    especificarNecessidades: false,
    necessidadesPaciente: [] as string[],
    necessidadesOutro: '',
    opcaoAvaliacaoPsicologica: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
  });

  const [formPsicologo, setFormPsicologo] = useState({
    nomeCompleto: '',
    nomeSocial: '',
    crp: '',
    whatsapp: '',
    email: '',
    fotoUrl: '',
    modalidadeAtendimento: 'AMBOS',
    atendimentoPreferencia: 'AMBOS' as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
    estadoUf: '',
    cidade: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    turmaViverMais: '22A',
    posGraduacaoViverMais: 'Especialização em Psicoterapia Cognitivo-Comportamental',
    servicosPrestados: ['Atendimento Psicológico'] as string[],
    publicoAlvo: ['Adulto'] as string[],
    publicoAlvoOutro: '',
    especificarNecessidades: false,
    necessidadesAtendidas: [] as string[],
    necessidadesOutro: '',
    disponibilidadeTurnos: ['MANHA', 'TARDE'],
  });

  const [protocolo, setProtocolo] = useState('');
  const [enderecoInfo, setEnderecoInfo] = useState({ logradouro: '', bairro: '', cidade: '', uf: '' });
  const [loadingCep, setLoadingCep] = useState(false);
  const [psicologosCredenciados, setPsicologosCredenciados] = useState<PsicologoVitrineItem[]>([]);

  useEffect(() => {
    fetch('/api/application/credenciamento-psicologo/public', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { success?: boolean; data?: PsicologoVitrineItem[] }) => {
        if (body.success && Array.isArray(body.data)) setPsicologosCredenciados(body.data);
      })
      .catch(() => undefined);
  }, []);

  // Máscara CPF: 000.000.000-00
  const maskCPF = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14);
  };

  // Máscara Telefone: (00) 00000-0000
  const maskPhone = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  };

  // Máscara CEP: 00000-000
  const maskCEP = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/^(\d{5})(\d)/, '$1-$2')
      .substring(0, 9);
  };

  // Busca automática via CEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const masked = maskCEP(rawValue);
    setForm((prev) => ({ ...prev, cep: masked }));

    const cleanCep = masked.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await resp.json();
        if (!data.erro) {
          setEnderecoInfo({
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            uf: data.uf || '',
          });
        }
      } catch (err) {
        console.error('Erro ao consultar ViaCEP:', err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Lista de convênios das imagens do usuário
  const conveniosDisponiveis = [
    'Alvet Hospital Veterinário',
    'AMPE Tubarão',
    'Bebidas Nuernberg',
    'Canguru Embalagens',
    'Cerealista Vista Alegre',
    'CFC Placar',
    'Colégio Éthicos/ Escola Catavento',
    'Colorminas',
    'Concordia Logistica Portuária',
    'Copaza Descartáveis',
    'Cristalcopo (empresa paga as sessões)',
    'Damyller',
    'Engeplus',
    'ESUCRI',
    'EUpsico',
    'Fundicar',
    'Grupo Ramage',
    'Hospital Florianópolis',
    'Imbralit',
    'Jean Querino sobrancelha e Beleza',
    'KFG',
    'Loja Tchê',
    'Maré Alta',
    'MJP/MMC Metalúrgica',
    'Pagé',
    'Sempre Real',
    'STAR PROTECAO VEICULAR',
    'UNICER',
    'UNIFEBE',
    'UNISUL (Curso de psicologia)',
    'UNINASSAU (Curso de psicologia)',
    'Weg'
  ];

  // Tabela de preços e serviços da vitrine
  const precos: Record<ServicoKey, ServicoVitrine> = {
    PSICOTERAPIA: {
      titulo: 'Psicoterapia Individual',
      descricao: 'É a modalidade mais conhecida de acompanhamento psicológico. Nela são trabalhadas diferentes demandas, como ansiedade, estresse, depressão, dificuldades nos relacionamentos, luto, autoestima, autoconhecimento, entre outras, sempre respeitando as necessidades de cada pessoa.',
      duracao: '50min',
      imagem: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    },
    PSICOTERAPIA_CASAL: {
      titulo: 'Psicoterapia de Casal',
      descricao: 'Voltada para casais que desejam fortalecer a comunicação, resolver conflitos e construir uma relação mais saudável.',
      duracao: '1h30min',
      imagem: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'CASAL_SOCIAL', label: 'Agendamento Acessível (Casal)', preco: 'R$ 150,00' },
        { tipo: 'CASAL_PARTICULAR', label: 'Agendamento Particular (Casal)', preco: 'R$ 260,00' }
      ]
    },
    AVALIACAO: {
      titulo: 'Avaliação Psicológica e Avaliação Neuropsicológica',
      descricao: 'É um processo realizado para investigar possíveis diagnósticos e compreender aspectos cognitivos, emocionais e comportamentais. Geralmente é solicitada por médicos ou outros profissionais da saúde para auxiliar na definição de um diagnóstico ou conduta. A quantidade de sessões varia conforme a demanda.',
      duracao: 'variável conforme testes e manejo do profissional',
      imagem: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 100,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 150,00' }
      ]
    },
    ORIENTACAO_PROFISSIONAL: {
      titulo: 'Orientação Profissional/Vocacional',
      descricao: 'Auxilia na escolha ou replanejamento da carreira, considerando interesses, habilidades e objetivos profissionais.',
      duracao: '50min',
      imagem: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    },
    ORIENTACAO_PARENTAL: {
      titulo: 'Orientação Parental',
      descricao: 'Oferece suporte aos pais e responsáveis, auxiliando na compreensão das necessidades emocionais e comportamentais dos filhos, além de orientar sobre estratégias para lidar com os desafios do desenvolvimento e da educação.',
      duracao: '50min',
      imagem: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectServiceAndPrice = (serviceKey: ServicoKey, modalidadeType: ModalidadeKey) => {
    setSelectedService(serviceKey);
    setSelectedModalidade(modalidadeType);
    setStep('FORMULARIO');
  };

  const handleSubmitPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    const idadeNum = Number(form.idade);
    if (isNaN(idadeNum) || idadeNum <= 0) {
      alert('Informe uma idade válida (maior que zero).');
      return;
    }
    if (form.whatsapp !== form.whatsappConfirmacao) {
      alert('Os números de telefone informados não coincidem!');
      return;
    }
    if (!validateGender(form.genero, form.generoOutro)) {
      alert('Selecione o gênero e, se escolher Outro, informe a descrição.');
      return;
    }
    if (enderecoInfo.cidade) {
      const temRua = (enderecoInfo.logradouro || form.ruaManual).trim();
      const temBairro = (enderecoInfo.bairro || form.bairroManual).trim();
      if (!temRua) {
        alert('Informe o nome da sua rua / logradouro.');
        return;
      }
      if (!temBairro) {
        alert('Informe o seu bairro.');
        return;
      }
    }
    if (selectedService !== 'ORIENTACAO_PARENTAL' && form.paraQuemE === 'Outro' && !form.paraQuemEOutro.trim()) {
      alert('Especifique para quem é o atendimento.');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          paraQuemE: selectedService === 'ORIENTACAO_PARENTAL' ? undefined : (form.paraQuemE === 'Outro' && form.paraQuemEOutro.trim() ? `Outro: ${form.paraQuemEOutro.trim()}` : form.paraQuemE),
          servico: selectedService ? precos[selectedService]?.titulo : '',
          servicoKey: selectedService,
          modalidade: selectedModalidade,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setProtocolo(data.protocolo);
        setStep('SUCESSO');
      } else {
        alert('Erro ao enviar solicitação. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao enviar formulário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPsicologo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeBrazilPhone(formPsicologo.whatsapp)) {
      alert('Informe um telefone brasileiro válido com DDD.');
      return;
    }
    if (!formPsicologo.estadoUf || !formPsicologo.cidade) {
      alert('Selecione o estado e uma cidade da lista.');
      return;
    }
    if (!validateGender(formPsicologo.genero, formPsicologo.generoOutro)) {
      alert('Selecione o gênero e, se escolher Outro, informe a descrição.');
      return;
    }
    if (formPsicologo.servicosPrestados.length === 0) {
      alert('Selecione ao menos um serviço prestado.');
      return;
    }
    if (formPsicologo.publicoAlvo.length === 0) {
      alert('Selecione ao menos um público alvo.');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formPsicologo,
          segundaPosGraduacao: temSegundaPos ? segundaPosGraduacao : undefined,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setStep('SUCESSO_PSICOLOGO');
      } else {
        alert('Erro ao cadastrar psicólogo. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao enviar credenciamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-purple-100 selection:text-purple-900">
      {/* Banner / Header */}
      <header className="bg-white border-b border-purple-100 py-4 px-6 sticky top-0 z-40 backdrop-blur-md bg-white/90 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div 
            onClick={() => setStep('SERVICOS')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">Viver Mais</h1>
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Psicologia</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('CADASTRO_PSICOLOGO')}
              className="text-xs font-extrabold text-purple-700 hover:text-purple-900 px-4 py-2 rounded-xl hover:bg-purple-50 transition-all border border-purple-200 flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4 text-purple-600" />
              <span>Quero me cadastrar (Sou Psicólogo)</span>
            </button>
            <a
              href="#servicos"
              onClick={() => setStep('SERVICOS')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.98]"
            >
              Agendar Consulta
            </a>
          </div>
        </div>
      </header>

      {/* Hero Banner Card Section com Imagem Premium de Fundo */}
      <section className="px-6 pt-8 pb-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden bg-slate-950 text-white rounded-3xl p-8 sm:p-14 shadow-2xl border border-purple-900/40 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Background Decorativo */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(158,107,207,0.25),transparent_60%)] pointer-events-none"></div>
            
            <div className="space-y-6 relative z-10 lg:col-span-7">
              <div className="inline-flex items-center gap-2 bg-psi-deep/40 backdrop-blur-md text-purple-200 border border-purple-400/30 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full">
                <Sparkles className="w-4 h-4 text-psi-vibrant" />
                Cuidar da mente é Viver Mais!
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-white">
                Cuidado Psicológico Pensado para Você
              </h2>
              <p className="text-sm sm:text-base text-purple-100/90 leading-relaxed max-w-xl font-normal">
                A partir das informações preenchidas neste formulário, faremos o direcionamento para um profissional conforme a modalidade de atendimento e a disponibilidade da nossa equipe, sempre com cuidado, acolhimento e resguardo ético.
              </p>
              
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <a
                  href="#modalidades"
                  className="bg-psi-vibrant hover:bg-psi-deep text-white font-black text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lift flex items-center gap-2 active:scale-95"
                >
                  Ver Modalidades & Agendar <ArrowRight className="w-4 h-4" />
                </a>
                <div className="flex items-center gap-2 text-xs text-purple-200 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sigilo CFP & LGPD Garantidos</span>
                </div>
              </div>
            </div>
            
            {/* Imagem Premium de Consultório na Hero */}
            <div className="relative z-10 lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl group">
                <img
                  src="/landing_hero_psychology.png"
                  alt="Consultório de Psicologia Viver Mais"
                  className="w-full h-72 lg:h-80 object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-md p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-psi-vibrant font-extrabold uppercase block">Atendimento Humanizado</span>
                    <span className="text-xs text-white font-extrabold">Sessões Online ou Presenciais</span>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    SLA 24h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 3 Passos: Como Funciona o Seu Agendamento */}
      <section className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-surface rounded-3xl p-8 border border-line shadow-card space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="chip-accent text-[11px]">Jornada Descomplicada</span>
              <h3 className="text-xl sm:text-2xl font-black text-ink">Como Funciona o Seu Agendamento em 3 Passos</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-canvas border border-psi-soft/60 space-y-3 relative">
                <span className="w-8 h-8 rounded-xl bg-psi-deep text-white font-black text-xs flex items-center justify-center">1</span>
                <h4 className="font-extrabold text-sm text-ink">Escolha o Serviço & Modalidade</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Selecione entre Psicoterapia, Avaliação ou Orientação. Escolha o agendamento Acessível (R$ 75) ou Particular (R$ 130).
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-canvas border border-psi-soft/60 space-y-3 relative">
                <span className="w-8 h-8 rounded-xl bg-psi-vibrant text-white font-black text-xs flex items-center justify-center">2</span>
                <h4 className="font-extrabold text-sm text-ink">Preencha Seus Dados</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Informe seu contato no WhatsApp e endereço. O sistema encaminha para um psicólogo especializado via rodízio inteligente.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-canvas border border-psi-soft/60 space-y-3 relative">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">3</span>
                <h4 className="font-extrabold text-sm text-ink">Confirmação via WhatsApp (24h)</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Seu psicólogo entra em contato no WhatsApp em até 24 horas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Flow Section */}
      <main id="modalidades" className="max-w-6xl mx-auto px-6 py-8">
        {step === 'SERVICOS' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* NOVO LAYOUT REELABORADO: CARDS DE SERVIÇOS PREMIUM */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="chip-accent text-[11px]">Nossas Especialidades</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-ink mt-1">Serviços Clínicos Oferecidos</h3>
                  <p className="text-xs text-muted">Escolha o serviço mais adequado para o seu momento de vida</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                {Object.entries(precos).map(([key, service]) => (
                  <div
                    key={key}
                    className="bg-surface rounded-3xl border border-psi-soft/80 p-5 flex flex-col justify-between shadow-card hover:shadow-lift transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-psi-soft/40 rounded-full blur-2xl group-hover:bg-psi-vibrant/20 transition-all"></div>
                    
                    <div className="space-y-3 relative z-10">
                      <div className="w-10 h-10 rounded-2xl bg-psi-soft text-psi-deep flex items-center justify-center border border-psi-soft/80 group-hover:scale-110 group-hover:bg-psi-deep group-hover:text-white transition-all">
                        <Heart className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-ink leading-snug group-hover:text-psi-deep transition-colors">{service.titulo}</h4>
                      <p className="text-xs text-muted leading-relaxed">{service.descricao}</p>
                      
                      <div className="flex items-center gap-1.5 text-[11px] text-purple-800 font-extrabold bg-purple-50/80 p-2 rounded-xl border border-purple-100">
                        <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Duração: {service.duracao}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-psi-soft/50 mt-4 relative z-10">
                      <a
                        href={`#detalhes-${key}`}
                        className="w-full bg-canvas hover:bg-psi-soft/80 border border-psi-soft text-psi-darkest font-extrabold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 group-hover:bg-psi-deep group-hover:text-white group-hover:border-psi-deep"
                      >
                        Ver Valores e Agendar <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carrossel de Psicólogos Credenciados */}
            <VitrineCarrossel
              psicologos={psicologosCredenciados}
            />

            {/* Banner Informativo Psicoterapia com Equipe */}
            <div className="bg-surface rounded-3xl p-8 border border-line shadow-card grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <span className="chip-accent text-[11px]">Equipe Qualificada</span>
                <h3 className="text-2xl font-black text-ink">Por que fazer Psicoterapia na Viver Mais?</h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  A psicoterapia é um espaço de escuta técnica e acolhimento, conduzido por profissionais devidamente registrados no Conselho Regional de Psicologia (CRP). Isso significa que todos os psicólogos da Clínica Viver Mais possuem registro profissional ativo e estão habilitados a exercer a profissão, seguindo as normas éticas e técnicas da profissão, garantindo responsabilidade e segurança em todo o processo.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="bg-psi-soft text-psi-darkest font-extrabold text-[11px] px-3 py-1 rounded-full border border-psi-soft">
                    Modalidade Acessível (R$ 75,00)
                  </span>
                  <span className="bg-psi-soft text-psi-darkest font-extrabold text-[11px] px-3 py-1 rounded-full border border-psi-soft">
                    Modalidade Particular (R$ 130,00)
                  </span>
                </div>
              </div>
              <div className="lg:col-span-5">
                <img
                  src="/psychologist_team.png"
                  alt="Equipe de Psicólogos Viver Mais"
                  className="rounded-2xl border border-line shadow-md w-full h-56 object-cover"
                />
              </div>
            </div>

            {/* Tabela de Preços e Ações por Serviço */}
            <div className="space-y-10">
              <div className="text-center max-w-xl mx-auto">
                <h3 className="text-2xl font-black text-ink">Escolha Seu Serviço & Agende em 1-Clique</h3>
                <p className="text-xs text-muted mt-1">Valores transparentes e encaminhamento ético garantido</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Object.entries(precos).map(([key, service]) => (
                  <div
                    key={key}
                    id={`detalhes-${key}`}
                    className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden flex flex-col justify-between hover:shadow-lift transition-all scroll-mt-24"
                  >
                    <div>
                      {/* Banner de Imagem com Gradiente */}
                      <div className="relative h-48 w-full overflow-hidden bg-psi-darkest">
                        <img
                          src={service.imagem}
                          alt={service.titulo}
                          className="w-full h-full object-cover opacity-90 hover:scale-105 transition-all duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>
                        <div className="absolute bottom-4 left-6 right-6">
                          <span className="text-[10px] text-psi-vibrant font-extrabold uppercase tracking-wider bg-psi-darkest/90 backdrop-blur-md px-3 py-1 rounded-full border border-psi-vibrant/30">
                            Atendimento Especializado
                          </span>
                          <h4 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
                            {service.titulo}
                          </h4>
                        </div>
                      </div>

                      <div className="p-6">
                        <p className="text-xs text-muted leading-relaxed pb-3">{service.descricao}</p>
                        <div className="flex items-center gap-1.5 text-xs text-purple-800 font-extrabold border-t border-b border-purple-100 py-2.5 my-1 bg-purple-50/60 px-3 rounded-xl">
                          <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>Duração da sessão: {service.duracao}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 pt-0 space-y-3">
                      {service.opcoes.map((opcao) => (
                        <div
                          key={opcao.tipo}
                          className="flex items-center justify-between p-4 rounded-2xl bg-canvas border border-psi-soft/80 hover:bg-psi-soft/40 transition-colors"
                        >
                          <div>
                            <span className="text-xs font-extrabold text-ink block">{opcao.label}</span>
                            <span className="text-[11px] text-psi-deep font-black">{opcao.preco} / sessão</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectServiceAndPrice(key as ServicoKey, opcao.tipo)}
                            className="bg-psi-deep hover:bg-psi-darkest text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                          >
                            Agendar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dúvidas Frequentes */}
            <div className="bg-white rounded-3xl p-8 border border-purple-100 shadow-sm space-y-6">
              <h3 className="text-xl font-black text-slate-900 border-b border-purple-50 pb-4">Dúvidas Frequentes</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900">As sessões de Psicoterapia são on-line ou presenciais?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Oferecemos atendimento em ambas modalidades, on-line para qualquer lugar do mundo e presencial em algumas regiões cadastradas.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900">Quanto tempo dura a sessão?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    A psicoterapia individual dura em média 50 minutos. A psicoterapia de casal/família dura em média 1h30.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900">Como marcar um dia e horário para minha sessão?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Escolha o serviço desejado, selecione a modalidade de pagamento e preencha as informações solicitadas. Um psicólogo entrará em contato para agendar o dia e horário ideais.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900">Como é feito o pagamento?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    O pagamento é realizado de forma segura por Pix (QR Code/Copia e Cola) ou Cartão de Crédito.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORMULARIO' && selectedService && selectedModalidade && (
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-purple-50 pb-4">
              <div>
                <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Solicitação de Consulta</span>
                <h3 className="text-lg font-black text-slate-900">
                  Preencha o formulário abaixo para concluir seu agendamento!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStep('SERVICOS')}
                className="text-xs text-slate-500 hover:text-slate-900 hover:underline font-bold"
              >
                Voltar
              </button>
            </div>

            <form onSubmit={handleSubmitPaciente} className="space-y-4 text-xs">
              {/* Nome Completo */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Completo <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome Completo"
                  className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-200"
                />
                <div className="mt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={temNomeSocialPaciente}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTemNomeSocialPaciente(checked);
                        if (!checked) {
                          setForm((prev) => ({ ...prev, nomeSocial: '' }));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                    />
                    <span>Possui Nome Social?</span>
                  </label>
                </div>
              </div>

              {/* Nome Social (exibido apenas após marcar o campo) */}
              {temNomeSocialPaciente && (
                <div className="animate-in fade-in duration-200">
                  <label className="font-bold text-slate-700 block mb-1">
                    Nome Social <span className="text-slate-400 font-normal">(como prefere ser chamado)</span>
                  </label>
                  <input
                    type="text"
                    value={form.nomeSocial}
                    onChange={(e) => setForm({ ...form, nomeSocial: e.target.value })}
                    placeholder="Digite seu nome social"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-200"
                  />
                </div>
              )}

              {/* Telefone e Confirme Telefone com Máscara */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Confirme o Telefone <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.whatsappConfirmacao}
                    onChange={(e) => setForm({ ...form, whatsappConfirmacao: maskPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Idade e E-mail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Idade <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.idade}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || Number(val) > 0) {
                        setForm({ ...form, idade: val });
                      }
                    }}
                    placeholder="Idade"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">E-mail <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="E-mail"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <GenderFields
                idPrefix="paciente"
                gender={form.genero}
                other={form.generoOutro}
                onGenderChange={(genero) => setForm((current) => ({ ...current, genero }))}
                onOtherChange={(generoOutro) => setForm((current) => ({ ...current, generoOutro }))}
              />

              {/* CPF, CEP e Número da Residência */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CPF <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CEP <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={form.cep}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                    />
                    {loadingCep && (
                      <span className="absolute right-3 top-3 text-[10px] text-purple-600 font-bold animate-pulse">
                        Buscando...
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nº Residência <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.numeroResidencia}
                    onChange={(e) => setForm({ ...form, numeroResidencia: e.target.value })}
                    placeholder="Ex: 123 ou Apto 4"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Endereço auto-preenchido pelo ViaCEP ou manual caso não venha rua/bairro */}
              {enderecoInfo.cidade && (
                <div className="bg-purple-50/60 border border-purple-100 p-4 rounded-2xl text-[11px] space-y-3 animate-in fade-in">
                  <span className="font-bold text-purple-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-600" /> Endereço Localizado:
                  </span>
                  <p className="text-slate-600">
                    {enderecoInfo.logradouro ? `${enderecoInfo.logradouro}` : (form.ruaManual || 'Rua a informar')}
                    {form.numeroResidencia ? `, nº ${form.numeroResidencia}` : ''}
                    {enderecoInfo.bairro ? ` — ${enderecoInfo.bairro}` : (form.bairroManual ? ` — ${form.bairroManual}` : '')} —{' '}
                    <span className="font-semibold text-slate-800">{enderecoInfo.cidade}/{enderecoInfo.uf}</span>
                  </p>

                  {/* Exigir Nome da Rua e/ou Bairro caso o CEP não traga */}
                  {(!enderecoInfo.logradouro || !enderecoInfo.bairro) && (
                    <div className="pt-2 border-t border-purple-100/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {!enderecoInfo.logradouro && (
                        <div>
                          <label className="font-bold text-purple-900 block mb-1">
                            Nome da Rua / Logradouro <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={form.ruaManual}
                            onChange={(e) => setForm({ ...form, ruaManual: e.target.value })}
                            placeholder="Digite o nome da sua rua"
                            className="w-full border border-purple-200 bg-white rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-purple-600 text-xs"
                          />
                        </div>
                      )}
                      {!enderecoInfo.bairro && (
                        <div>
                          <label className="font-bold text-purple-900 block mb-1">
                            Bairro <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={form.bairroManual}
                            onChange={(e) => setForm({ ...form, bairroManual: e.target.value })}
                            placeholder="Digite seu bairro"
                            className="w-full border border-purple-200 bg-white rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-purple-600 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Você é conveniado com alguma empresa parceira? */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Você é conveniado com alguma empresa parceira? <span className="text-rose-500">*</span></label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="possuiConvenio"
                      value="SIM"
                      checked={form.possuiConvenio === 'SIM'}
                      onChange={() => setForm({ ...form, possuiConvenio: 'SIM' })}
                      className="accent-purple-600"
                    />
                    Sim
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="possuiConvenio"
                      value="NAO"
                      checked={form.possuiConvenio === 'NAO'}
                      onChange={() => setForm({ ...form, possuiConvenio: 'NAO', convenioSelecionado: '' })}
                      className="accent-purple-600"
                    />
                    Não
                  </label>
                </div>
              </div>

              {/* Dropdown condicional de Convênio */}
              {form.possuiConvenio === 'SIM' && (
                <div className="animate-in fade-in duration-200">
                  <label className="font-bold text-slate-700 block mb-1">Selecione seu convênio <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={form.convenioSelecionado}
                    onChange={(e) => setForm({ ...form, convenioSelecionado: e.target.value })}
                    className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  >
                    <option value="">Selecione seu convênio</option>
                    {conveniosDisponiveis.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Para quem é o atendimento? (opcional) - Oculto em Orientação Parental */}
              {selectedService !== 'ORIENTACAO_PARENTAL' && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="font-bold text-slate-700 block">
                      Para quem é o atendimento?: <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Selecione a opção que mais combina com o que você procura.
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      'Criança',
                      'Adolescente',
                      'Homem',
                      'Mulher',
                      'Idoso',
                      'Casal',
                      'Família',
                      'Pessoas LGBTQIA+',
                      'Grupo',
                      'Outro',
                    ].map((opcao) => {
                      const isSelected = form.paraQuemE === opcao;
                      return (
                        <button
                          key={opcao}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              paraQuemE: isSelected ? '' : opcao,
                            }))
                          }
                          className={`p-2.5 rounded-xl border text-left font-semibold transition-all ${
                            isSelected
                              ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {opcao}
                        </button>
                      );
                    })}
                  </div>

                  {/* Habilitar campo se for selecionada a opção Outro */}
                  {form.paraQuemE === 'Outro' && (
                    <div className="animate-in fade-in duration-200 pt-2">
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        Especifique para quem é o atendimento <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.paraQuemEOutro}
                        onChange={(e) => setForm({ ...form, paraQuemEOutro: e.target.value })}
                        placeholder="Digite para quem é o atendimento..."
                        className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Opções de Avaliação Psicológica se o serviço selecionado for AVALIACAO */}
              {selectedService === 'AVALIACAO' && (
                <div className="space-y-2.5 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl animate-in fade-in duration-200">
                  <div>
                    <label className="font-bold text-purple-950 block text-xs sm:text-sm">
                      Qual o objetivo da sua Avaliação Psicológica? <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-purple-700 block mt-0.5">
                      Selecione a opção que melhor se aplica ao seu caso.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {OPCOES_AVALIACAO_PSICOLOGICA.map((opcao) => {
                      const isSelected = form.opcaoAvaliacaoPsicologica === opcao;
                      return (
                        <button
                          key={opcao}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, opcaoAvaliacaoPsicologica: opcao }))}
                          className={`p-3 rounded-xl border text-left font-semibold transition-all ${
                            isSelected
                              ? 'bg-purple-700 border-purple-700 text-white font-bold shadow-xs'
                              : 'bg-white border-purple-200 text-slate-800 hover:bg-purple-100/60'
                          }`}
                        >
                          {opcao}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VOCÊ GOSTARIA DE ESPECIFICAR SUA NECESSIDADE? - Oculto em Orientação Parental */}
              {selectedService !== 'ORIENTACAO_PARENTAL' && (
                <NecessidadesSelector
                  prefix="paciente"
                  especificar={form.especificarNecessidades}
                  onEspecificarChange={(especificar) => setForm((prev) => ({ ...prev, especificarNecessidades: especificar }))}
                  selecionados={form.necessidadesPaciente}
                  onSelecionadosChange={(necessidadesPaciente) => setForm((prev) => ({ ...prev, necessidadesPaciente }))}
                  outro={form.necessidadesOutro}
                  onOutroChange={(necessidadesOutro) => setForm((prev) => ({ ...prev, necessidadesOutro }))}
                />
              )}

              {/* Como ficou sabendo da clínica? */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Como ficou sabendo da clínica? <span className="text-rose-500">*</span></label>
                <select
                  value={form.origem}
                  onChange={(e) => setForm({ ...form, origem: e.target.value })}
                  className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600"
                >
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google">Google</option>
                  <option value="Whatsapp">Whatsapp</option>
                  <option value="Sou aluno">Sou aluno</option>
                  <option value="Conveniado">Conveniado</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Períodos de preferência */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Períodos de preferência: <span className="text-rose-500">*</span></label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="turno"
                      value="VESPERTINO"
                      checked={form.turno === 'VESPERTINO'}
                      onChange={() => setForm({ ...form, turno: 'VESPERTINO' })}
                      className="accent-purple-600"
                    />
                    Vespertino (tarde)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="turno"
                      value="NOTURNO"
                      checked={form.turno === 'NOTURNO'}
                      onChange={() => setForm({ ...form, turno: 'NOTURNO' })}
                      className="accent-purple-600"
                    />
                    Noturno (noite)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-purple-700/25 transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
              >
                <Send className="w-4 h-4" />
                Finalizar agendamento
              </button>
            </form>
          </div>
        )}

        {step === 'CADASTRO_PSICOLOGO' && (
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-purple-50 pb-4">
              <div>
                <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Credenciamento Clínico</span>
                <h3 className="text-lg font-black text-slate-900">
                  Faça seu cadastro para atender na Clínica Viver Mais
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStep('SERVICOS')}
                className="text-xs text-slate-500 hover:text-slate-900 hover:underline font-bold"
              >
                Voltar
              </button>
            </div>

            <form
              onSubmit={handleSubmitPsicologo}
              className="space-y-4 text-xs"
            >
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome Completo <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formPsicologo.nomeCompleto}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeCompleto: e.target.value })}
                    placeholder="Seu nome completo"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                  <div className="mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={temNomeSocialPsicologo}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTemNomeSocialPsicologo(checked);
                          if (!checked) {
                            setFormPsicologo((prev) => ({ ...prev, nomeSocial: '' }));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                      />
                      <span>Possui Nome Social?</span>
                    </label>
                  </div>
                </div>

                {temNomeSocialPsicologo && (
                  <div className="animate-in fade-in duration-200">
                    <label className="font-bold text-slate-700 block mb-1">
                      Nome Social <span className="text-slate-400 font-normal">(como prefere ser chamado)</span>
                    </label>
                    <input
                      type="text"
                      value={formPsicologo.nomeSocial}
                      onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeSocial: e.target.value })}
                      placeholder="Digite seu nome social"
                      className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Foto de Perfil <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                {formPsicologo.fotoUrl ? (
                  <div className="flex items-center gap-4 p-3 border border-purple-200 bg-purple-50/50 rounded-2xl">
                    <img
                      src={formPsicologo.fotoUrl}
                      alt="Foto de Perfil"
                      className="w-16 h-16 rounded-full object-cover border-2 border-purple-500 shadow-sm"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-purple-900">Foto carregada com sucesso</span>
                      <button
                        type="button"
                        onClick={() => setFormPsicologo({ ...formPsicologo, fotoUrl: '' })}
                        className="text-xs text-rose-600 hover:text-rose-800 font-extrabold text-left underline"
                      >
                        Remover / Trocar foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-500 bg-purple-50/30 hover:bg-purple-50/70 p-4 rounded-2xl cursor-pointer transition-all">
                    <Upload className="w-6 h-6 text-purple-600 mb-1" />
                    <span className="text-xs font-bold text-purple-900">Clique para enviar uma foto de perfil</span>
                    <span className="text-[10px] text-slate-500">Envie um arquivo de imagem (PNG, JPG, WEBP)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setFormPsicologo((prev) => ({ ...prev, fotoUrl: String(event.target?.result) }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Registro CRP <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formPsicologo.crp}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, crp: e.target.value })}
                    placeholder="Ex: CRP 07/12345"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Turma Viver Mais <span className="text-rose-500">*</span></label>
                  <select
                    value={formPsicologo.turmaViverMais}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, turmaViverMais: e.target.value })}
                    className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 font-bold"
                  >
                    <option value="22A">Turma 22A</option>
                    <option value="22B">Turma 22B</option>
                    <option value="23A">Turma 23A</option>
                    <option value="23B">Turma 23B</option>
                    <option value="24A">Turma 24A</option>
                    <option value="24B">Turma 24B</option>
                    <option value="25A">Turma 25A</option>
                    <option value="25B">Turma 25B</option>
                    <option value="26A">Turma 26A</option>
                    <option value="26B">Turma 26B</option>
                  </select>
                </div>
              </div>

              {/* Pós-Graduação Principal Viver Mais */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pós-Graduação na Viver Mais Psicologia <span className="text-rose-500">*</span></label>
                <select
                  value={formPsicologo.posGraduacaoViverMais}
                  onChange={(e) => setFormPsicologo({ ...formPsicologo, posGraduacaoViverMais: e.target.value })}
                  className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 font-medium"
                >
                  <option value="Especialização em Psicoterapia Cognitivo-Comportamental">Especialização em Psicoterapia Cognitivo-Comportamental</option>
                  <option value="Especialização em Avaliação Psicológica">Especialização em Avaliação Psicológica</option>
                  <option value="Especialização em Psicanálise e Clínica Contemporânea">Especialização em Psicanálise e Clínica Contemporânea</option>
                  <option value="Especialização em Terapia Sistêmica de Casal e Família">Especialização em Terapia Sistêmica de Casal e Família</option>
                </select>

                {/* Checkbox para Segunda Pós-Graduação */}
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={temSegundaPos}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTemSegundaPos(checked);
                        if (!checked) {
                          setSegundaPosGraduacao('');
                        } else if (!segundaPosGraduacao) {
                          setSegundaPosGraduacao('Especialização em Avaliação Psicológica');
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                    />
                    <span>Possui 2ª Pós-Graduação?</span>
                  </label>
                </div>
              </div>

              {/* Campo para Selecionar a Segunda Pós-Graduação */}
              {temSegundaPos && (
                <div className="animate-in fade-in duration-200 bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-2">
                  <label className="font-bold text-purple-900 block mb-1">
                    Selecione a Segunda Pós-Graduação <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={segundaPosGraduacao}
                    onChange={(e) => setSegundaPosGraduacao(e.target.value)}
                    className="w-full border border-purple-200 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 font-medium text-slate-800"
                  >
                    <option value="Especialização em Avaliação Psicológica">Especialização em Avaliação Psicológica</option>
                    <option value="Especialização em Psicoterapia Cognitivo-Comportamental">Especialização em Psicoterapia Cognitivo-Comportamental</option>
                    <option value="Especialização em Psicanálise e Clínica Contemporânea">Especialização em Psicanálise e Clínica Contemporânea</option>
                    <option value="Especialização em Terapia Sistêmica de Casal e Família">Especialização em Terapia Sistêmica de Casal e Família</option>
                    <option value="Outra Pós-Graduação">Outra Pós-Graduação</option>
                  </select>
                </div>
              )}

              {/* SERVIÇO PRESTADO */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">
                  SERVIÇO PRESTADO <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    'Atendimento Psicológico',
                    'Avaliação Psicológica',
                    'Orientação Vocacional e Profissional',
                    'Orientação Parental',
                    'Orientação Vocacional',
                    'Orientação Profissional',
                  ].map((servico) => {
                    const checked = formPsicologo.servicosPrestados.includes(servico);
                    return (
                      <label
                        key={servico}
                        className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border transition-all ${
                          checked
                            ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const newServicos = checked
                              ? formPsicologo.servicosPrestados.filter((s) => s !== servico)
                              : [...formPsicologo.servicosPrestados, servico];
                            setFormPsicologo({ ...formPsicologo, servicosPrestados: newServicos });
                          }}
                          className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                        />
                        <span>{servico}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* PÚBLICO ALVO */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">
                  PÚBLICO ALVO <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    'Criança',
                    'Adolescente',
                    'Adulto',
                    'Idoso',
                    'Casais',
                    'Família',
                    'LGBT',
                    'Mulheres',
                    'Grupo',
                    'Outro',
                  ].map((publico) => {
                    const checked = formPsicologo.publicoAlvo.includes(publico);
                    return (
                      <label
                        key={publico}
                        className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border transition-all ${
                          checked
                            ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const newPublico = checked
                              ? formPsicologo.publicoAlvo.filter((p) => p !== publico)
                              : [...formPsicologo.publicoAlvo, publico];
                            setFormPsicologo({ ...formPsicologo, publicoAlvo: newPublico });
                          }}
                          className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                        />
                        <span>{publico}</span>
                      </label>
                    );
                  })}
                </div>

                {formPsicologo.publicoAlvo.includes('Outro') && (
                  <div className="animate-in fade-in duration-200 pt-1">
                    <input
                      type="text"
                      value={formPsicologo.publicoAlvoOutro}
                      onChange={(e) => setFormPsicologo({ ...formPsicologo, publicoAlvoOutro: e.target.value })}
                      placeholder="Especifique o público alvo (ex: Gestantes, Atletas...)"
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
                    />
                  </div>
                )}
              </div>

              {/* VOCÊ GOSTARIA DE ESPECIFICAR SUA NECESSIDADE? */}
              <NecessidadesSelector
                prefix="psicologo"
                especificar={formPsicologo.especificarNecessidades}
                onEspecificarChange={(especificar) => setFormPsicologo((prev) => ({ ...prev, especificarNecessidades: especificar }))}
                selecionados={formPsicologo.necessidadesAtendidas}
                onSelecionadosChange={(necessidadesAtendidas) => setFormPsicologo((prev) => ({ ...prev, necessidadesAtendidas }))}
                outro={formPsicologo.necessidadesOutro}
                onOutroChange={(necessidadesOutro) => setFormPsicologo((prev) => ({ ...prev, necessidadesOutro }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">E-mail Profissional <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={formPsicologo.email}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, email: e.target.value })}
                    placeholder="seuemail@exemplo.com"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    required
                    value={formPsicologo.whatsapp}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, whatsapp: maskBrazilPhoneInput(e.target.value) })}
                    placeholder="(48) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <GenderFields
                idPrefix="psicologo"
                gender={formPsicologo.genero}
                other={formPsicologo.generoOutro}
                onGenderChange={(genero) => setFormPsicologo((current) => ({ ...current, genero }))}
                onOtherChange={(generoOutro) => setFormPsicologo((current) => ({ ...current, generoOutro }))}
              />

              <BrazilLocationFields
                estadoUf={formPsicologo.estadoUf}
                cidade={formPsicologo.cidade}
                onEstadoChange={(estadoUf) => setFormPsicologo((current) => ({ ...current, estadoUf, cidade: '' }))}
                onCidadeChange={(cidade) => setFormPsicologo((current) => ({ ...current, cidade }))}
              />

              {/* Tipo de Atendimento (Particular, Social ou Ambos) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Tipo de Atendimento <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { value: 'PARTICULAR', label: 'Atendimento Particular' },
                    { value: 'SOCIAL', label: 'Atendimento Social' },
                    { value: 'AMBOS', label: 'Ambos' },
                  ].map((opcao) => (
                    <label
                      key={opcao.value}
                      className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl border text-xs font-bold transition-all ${
                        formPsicologo.atendimentoPreferencia === opcao.value
                          ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="atendimentoPreferencia"
                        value={opcao.value}
                        checked={formPsicologo.atendimentoPreferencia === opcao.value}
                        onChange={() =>
                          setFormPsicologo((prev) => ({
                            ...prev,
                            atendimentoPreferencia: opcao.value as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
                          }))
                        }
                        className="accent-purple-600"
                      />
                      <span>{opcao.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Modalidade de Interesse <span className="text-rose-500">*</span></label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modalidadeAtendimento"
                      value="ONLINE"
                      checked={formPsicologo.modalidadeAtendimento === 'ONLINE'}
                      onChange={() => setFormPsicologo({ ...formPsicologo, modalidadeAtendimento: 'ONLINE' })}
                      className="accent-purple-600"
                    />
                    Online
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modalidadeAtendimento"
                      value="PRESENCIAL"
                      checked={formPsicologo.modalidadeAtendimento === 'PRESENCIAL'}
                      onChange={() => setFormPsicologo({ ...formPsicologo, modalidadeAtendimento: 'PRESENCIAL' })}
                      className="accent-purple-600"
                    />
                    Presencial
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modalidadeAtendimento"
                      value="AMBOS"
                      checked={formPsicologo.modalidadeAtendimento === 'AMBOS'}
                      onChange={() => setFormPsicologo({ ...formPsicologo, modalidadeAtendimento: 'AMBOS' })}
                      className="accent-purple-600"
                    />
                    Ambos
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-purple-700/25 transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                ENVIAR CADASTRO DE PSICÓLOGO
              </button>
            </form>
          </div>
        )}

        {step === 'SUCESSO_PSICOLOGO' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-purple-100 shadow-xl text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto border border-purple-200">
              <Check className="w-8 h-8" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-900">Cadastro Enviado com Sucesso!</h3>
              <p className="text-sm font-bold text-purple-700 bg-purple-50 p-4 rounded-2xl border border-purple-100 leading-relaxed">
                Seu acesso esta sendo conferido e iremos fazer contato assim que verificarmos
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('SERVICOS')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md"
            >
              Voltar ao Início
            </button>
          </div>
        )}

        {step === 'SUCESSO' && (
          <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-purple-100 shadow-xl text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto border border-purple-200">
              <Check className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Solicitação Recebida!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Nossos psicoterapeutas entrarão em contato direto no seu **WhatsApp** em até **24 horas** para combinar o melhor dia e horário para a sua sessão.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 font-mono text-[11px] text-purple-800">
              Protocolo da Solicitação: <span className="font-bold text-purple-900">{protocolo}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('SERVICOS');
                setSelectedService(null);
                setSelectedModalidade(null);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all"
            >
              Voltar ao Início
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
