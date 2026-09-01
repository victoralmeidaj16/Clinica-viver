'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { VitrineCarrossel, PsicologoVitrineItem } from '@/components/vitrineCarrossel';
import { GenderFields } from '@/components/forms/GenderFields';
import { CadastroPsicologoForm } from '@/components/forms/CadastroPsicologoForm';
import { TurnoPreferenceField } from '@/components/forms/TurnoPreferenceField';
import { LISTA_NECESSIDADES } from '@/components/forms/necessidades';
import { validateGender, type GenderValue } from '@/lib/gender';
import { CAMPO_ARMADILHA } from '@/lib/triagemSubmissao';
import { normalizarTurnoPreferencia, type TurnoPreferencia } from '@/lib/turnos';
import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';
import FloatingWhatsAppButton from '@/components/layout/FloatingWhatsAppButton';
import { BookingProgress, type BookingStep } from '@/components/vitrine/BookingProgress';
import { SecaoVitrineNav, SECOES_VITRINE, type SecaoVitrine } from '@/components/vitrine/SecaoVitrineNav';
import {
  Sparkles,
  Heart,
  User,
  MapPin,
  Clock,
  ArrowRight,
  Check,
  Building2,
  Send,
  ChevronDown,
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

interface PassoJornada {
  titulo: string;
  resumo: string;
  detalhes: string[];
  observacao?: string;
}

/** Espelha as etapas mostradas no header, para a explicação e o fluxo não divergirem. */
const PASSOS_AGENDAMENTO: PassoJornada[] = [
  {
    titulo: 'Serviço',
    resumo: 'Escolha a modalidade',
    detalhes: [
      'Selecione entre Psicoterapia Individual, Psicoterapia de Casal, Avaliação Psicológica e Neuropsicológica, Orientação Profissional/Vocacional ou Orientação Parental.',
      'Depois escolha entre o agendamento Acessível ou Particular — os valores de cada serviço aparecem logo abaixo.',
    ],
  },
  {
    titulo: 'Preferência',
    resumo: 'Defina como escolher',
    detalhes: [
      'Escolha diretamente no catálogo ou responda três perguntas para receber uma recomendação compatível.',
    ],
  },
  {
    titulo: 'Profissional',
    resumo: 'Encontre seu psicólogo',
    detalhes: [
      'Veja quem atende o serviço escolhido, com formação, foco de atuação clínica e períodos disponíveis, e escolha quem você preferir.',
    ],
  },
  {
    titulo: 'Seus dados',
    resumo: 'Finalize a solicitação',
    detalhes: [
      'Somente no último passo você informa seus dados. O psicólogo entra em contato no WhatsApp em até 24 horas.',
      'Se após 24 horas você ainda não tiver recebido o contato do seu psicoterapeuta, por favor, nos avise para que possamos ajudar.',
    ],
    observacao:
      '(→ Se o prazo de 24h coincidir com finais de semana ou feriados, ele será automaticamente estendido até o próximo dia útil.)',
  },
];

const PASSOS_CREDENCIAMENTO: PassoJornada[] = [
  {
    titulo: 'Perfil & CRP',
    resumo: 'Preencha seu cadastro',
    detalhes: [
      'Informe seus dados profissionais, serviços prestados, turnos disponíveis e cidades de atendimento.',
    ],
  },
  {
    titulo: 'Validação',
    resumo: 'Conferência ética',
    detalhes: [
      'Nossa equipe confere as credenciais junto ao Conselho e valida o alinhamento com a diretriz clínica.',
    ],
  },
  {
    titulo: 'Ativação',
    resumo: 'Entrada no rodízio',
    detalhes: [
      'Você passa a receber novos pacientes automaticamente e ganha acesso ao cockpit com prontuários via IA.',
    ],
  },
];

export default function ViverMaisLandingPage() {
  const [selectedService, setSelectedService] = useState<ServicoKey | null>(null);
  const [selectedModalidade, setSelectedModalidade] = useState<ModalidadeKey | null>(null);
  const [step, setStep] = useState<BookingStep | 'CADASTRO_PSICOLOGO' | 'SUCESSO_PSICOLOGO'>('SERVICOS');
  const [caminho, setCaminho] = useState<'MATCH' | 'PROFISSIONAL' | null>(null);
  const [psicologoEscolhido, setPsicologoEscolhido] = useState<PsicologoVitrineItem | null>(null);
  const [secaoVitrineAtiva, setSecaoVitrineAtiva] = useState<SecaoVitrine>('SERVICOS');
  
  const [temNomeSocialPaciente, setTemNomeSocialPaciente] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    nomeSocial: '',
    whatsapp: '',
    whatsappConfirmacao: '',
    dataNascimento: '',
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
    turno: '' as TurnoPreferencia | '',
    paraQuemE: '',
    paraQuemEOutro: '',
    especificarNecessidades: false,
    necessidadesPaciente: [] as string[],
    necessidadesOutro: '',
    opcaoAvaliacaoPsicologica: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
  });

  const [enderecoInfo, setEnderecoInfo] = useState({ logradouro: '', bairro: '', cidade: '', uf: '' });
  const [loadingCep, setLoadingCep] = useState(false);
  const [psicologosCredenciados, setPsicologosCredenciados] = useState<PsicologoVitrineItem[]>([]);
  const [conveniosDisponiveis, setConveniosDisponiveis] = useState<string[]>([]);
  const [conveniosLoading, setConveniosLoading] = useState(true);
  const [conveniosError, setConveniosError] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (
        searchParams.get('cadastro') === 'psicologo' ||
        searchParams.get('step') === 'CADASTRO_PSICOLOGO' ||
        window.location.hash === '#cadastro-psicologo'
      ) {
        // Fora do corpo síncrono do efeito: definir o passo aqui dispararia o
        // render em cascata que o lint aponta.
        void Promise.resolve().then(() => setStep('CADASTRO_PSICOLOGO'));
      }
    }
    fetch('/api/application/credenciamento-psicologo/public', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { success?: boolean; data?: PsicologoVitrineItem[] }) => {
        if (body.success && Array.isArray(body.data)) setPsicologosCredenciados(body.data);
      })
      .catch(() => undefined);
    fetch('/api/convenios/publicos', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { convenios?: Array<{ nome?: string }> }) => {
        const names = Array.isArray(body.convenios)
          ? body.convenios.map((item) => String(item.nome ?? '').trim()).filter(Boolean)
          : [];
        setConveniosDisponiveis(names);
        setConveniosError(names.length === 0);
      })
      .catch(() => setConveniosError(true))
      .finally(() => setConveniosLoading(false));
  }, []);

  useEffect(() => {
    if (step !== 'SERVICOS') return;

    const alvos = SECOES_VITRINE
      .map((secao) => ({ id: secao.id, el: document.getElementById(secao.ancora) }))
      .filter((alvo): alvo is { id: SecaoVitrine; el: HTMLElement } => Boolean(alvo.el));
    if (alvos.length === 0) return;

    // A faixa central da tela decide a seção: quando mais de uma cai nela, vale
    // a primeira na ordem da página, senão o destaque pularia para trás.
    const visiveis = new Set<SecaoVitrine>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const alvo = alvos.find((item) => item.el === entry.target);
          if (!alvo) continue;
          if (entry.isIntersecting) visiveis.add(alvo.id);
          else visiveis.delete(alvo.id);
        }

        const primeiraVisivel = SECOES_VITRINE.find((secao) => visiveis.has(secao.id));
        if (primeiraVisivel) setSecaoVitrineAtiva(primeiraVisivel.id);
      },
      { rootMargin: '-25% 0px -55% 0px' }
    );

    alvos.forEach((alvo) => observer.observe(alvo.el));
    return () => observer.disconnect();
  }, [step]);

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
      descricao: 'Voltada para casais que desejam melhorar a comunicação, compreender conflitos e trabalhar questões relacionadas à vida e à dinâmica do relacionamento.',
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

  const isPsicologo = step === 'CADASTRO_PSICOLOGO' || step === 'SUCESSO_PSICOLOGO';

  const handleIrParaCadastroPsicologo = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setStep('CADASTRO_PSICOLOGO');
    setTimeout(() => {
      const el = document.getElementById('modalidades');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleIrParaAgendar = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setStep('SERVICOS');
    setTimeout(() => {
      const el = document.getElementById('secao-escolha-servico') || document.getElementById('servicos-cards') || document.getElementById('modalidades');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleAgendarConsultaScroll = (e?: React.MouseEvent) => {
    handleIrParaAgendar(e);
  };

  const navegarParaSecaoVitrine = (secao: SecaoVitrine) => {
    setSecaoVitrineAtiva(secao);
    setStep('SERVICOS');
    setTimeout(() => {
      const ancora = SECOES_VITRINE.find((item) => item.id === secao)?.ancora;
      if (ancora) {
        document.getElementById(ancora)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Campo-armadilha. Fica fora da tela e fora da navegação por teclado, então
   * ninguém que preenche o formulário chega nele; robô que preenche tudo o que
   * encontra, sim. O servidor recusa o envio quando ele volta preenchido.
   */
  const [armadilha, setArmadilha] = useState('');

  const handleSelectServiceAndPrice = (serviceKey: ServicoKey, modalidadeType: ModalidadeKey) => {
    setSelectedService(serviceKey);
    setSelectedModalidade(modalidadeType);
    setForm((prev) => {
      let paraQuemE = prev.paraQuemE;
      if (serviceKey === 'ORIENTACAO_PARENTAL') {
        paraQuemE = '';
      } else if (serviceKey === 'PSICOTERAPIA_CASAL') {
        if (paraQuemE !== 'Casal' && paraQuemE !== 'Outro') {
          paraQuemE = 'Casal';
        }
      } else if (serviceKey === 'AVALIACAO') {
        if (!['Criança', 'Adolescente', 'Homem', 'Mulher', 'Idoso'].includes(paraQuemE)) {
          paraQuemE = '';
        }
      } else if (['Casal', 'Família', 'Grupo'].includes(paraQuemE)) {
        paraQuemE = '';
      }
      return { ...prev, paraQuemE };
    });
    setCaminho(null);
    setPsicologoEscolhido(null);
    setStep('CAMINHO');
  };

  const continuarMatch = () => {
    const paraQuem = form.paraQuemE === 'Outro' ? form.paraQuemEOutro.trim() : form.paraQuemE;
    const informouNecessidade = form.necessidadesPaciente.length > 0 || Boolean(form.necessidadesOutro.trim());
    if (!paraQuem || !informouNecessidade || !form.turno) {
      alert('Responda às três perguntas para continuar.');
      return;
    }
    setForm((prev) => ({ ...prev, especificarNecessidades: true }));
    setStep('MATCH_RECOMENDACOES');
  };

  const psicologoAtendeModalidade = (modalidades: readonly string[] | undefined, modalidadeDesejada: ModalidadeKey | null) => {
    if (!modalidades || modalidades.length === 0) return true;
    const isParticular = modalidadeDesejada?.includes('PARTICULAR');
    if (isParticular) {
      return modalidades.some((m) => m === 'PARTICULAR' || m === 'CASAL_PARTICULAR');
    }
    return modalidades.some((m) => m === 'SOCIAL' || m === 'CASAL_SOCIAL' || m === 'ACESSIVEL_SOCIAL');
  };

  const psicologosRecomendadosMatch = useMemo(() => {
    if (!form.turno) return [];

    const turnoNormalizado = normalizarTurnoPreferencia(form.turno);
    const paraQuemNorm = (form.paraQuemE === 'Outro' ? form.paraQuemEOutro : form.paraQuemE)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const candidatos = psicologosCredenciados.filter((psi) => {
      if (psi.disponivelParaNovosPacientes === false) return false;
      if (selectedService && psi.servicosHabilitados.length > 0 && !psi.servicosHabilitados.includes(selectedService)) {
        return false;
      }
      const atendeModalidade = psicologoAtendeModalidade(psi.modalidadesAtendidas, selectedModalidade);
      if (!atendeModalidade) return false;

      // Turno precisa coincidir
      const atendeTurno = psi.turnosDisponiveis?.some((t) => normalizarTurnoPreferencia(t) === turnoNormalizado);
      if (!atendeTurno) return false;

      return true;
    });

    // Pontuar candidatos por match de público e necessidades
    const pontuados = candidatos.map((psi) => {
      let score = 1; // base por bater turno e modalidade

      // Match público alvo
      if (paraQuemNorm && psi.publicoAlvo?.length) {
        const matchPublico = psi.publicoAlvo.some((pa) => {
          const normPa = pa.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return normPa.includes(paraQuemNorm) || paraQuemNorm.includes(normPa);
        });
        if (matchPublico) score += 3;
      }

      // Match demandas/necessidades
      if (form.necessidadesPaciente.length > 0 && psi.necessidadesAtendidas?.length) {
        const normAtendidas = psi.necessidadesAtendidas.map((n) =>
          n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        const matchesCount = form.necessidadesPaciente.filter((nec) => {
          const normNec = nec.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return normAtendidas.some((a) => a.includes(normNec) || normNec.includes(a));
        }).length;
        score += matchesCount * 2;
      }

      return { psi, score };
    });

    pontuados.sort((a, b) => b.score - a.score);
    return pontuados.slice(0, 3).map((item) => item.psi);
  }, [psicologosCredenciados, form.turno, form.paraQuemE, form.paraQuemEOutro, form.necessidadesPaciente, selectedService, selectedModalidade]);

  const profissionaisCompativeis = psicologosCredenciados.filter((psi) => {
    if (psi.disponivelParaNovosPacientes === false) return false;
    if (selectedService && psi.servicosHabilitados.length > 0 && !psi.servicosHabilitados.includes(selectedService)) return false;
    const atendeModalidade = psicologoAtendeModalidade(psi.modalidadesAtendidas, selectedModalidade);
    return atendeModalidade && Boolean(psi.turnosDisponiveis?.some((turno) => normalizarTurnoPreferencia(turno)));
  });


  const handleSubmitPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
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
          [CAMPO_ARMADILHA]: armadilha,
          paraQuemE: form.paraQuemE === 'Outro' && form.paraQuemEOutro.trim() ? `Outro: ${form.paraQuemEOutro.trim()}` : form.paraQuemE,
          servico: selectedService ? precos[selectedService]?.titulo : '',
          servicoKey: selectedService,
          modalidade: selectedModalidade,
          psicologoPreferidoId: caminho === 'PROFISSIONAL' ? psicologoEscolhido?.id : undefined,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setStep('SUCESSO');
      } else {
        alert(data.error || 'Erro ao enviar solicitação. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao enviar formulário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-purple-100 selection:text-purple-900">
      {/* Banner / Header Unificado */}
      <PublicHeader
        modoAtivo={isPsicologo ? 'ESPECIALISTA' : 'PACIENTE'}
        onSelecionarModo={(modo) => {
          if (modo === 'ESPECIALISTA') {
            handleIrParaCadastroPsicologo();
          } else {
            handleIrParaAgendar();
          }
        }}
        onAgendarClick={handleIrParaAgendar}
        onCredenciarClick={handleIrParaCadastroPsicologo}
        barraInferior={
          isPsicologo ? undefined : step === 'SERVICOS' ? (
            <SecaoVitrineNav ativa={secaoVitrineAtiva} onNavegar={navegarParaSecaoVitrine} />
          ) : (
            <BookingProgress step={step as BookingStep} />
          )
        }
      />

      {/* Hero Banner Card Section com Imagem Premium e Conteúdo Personalizado */}
      <section className="px-6 pt-8 pb-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="relative overflow-hidden bg-slate-950 text-white rounded-3xl p-8 sm:p-14 shadow-2xl border border-purple-900/40 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Background Decorativo */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(158,107,207,0.3),transparent_60%)] pointer-events-none"></div>

            {/* Conteúdo Dinâmico do Hero */}
            <div className="space-y-6 relative z-10 lg:col-span-7 animate-in fade-in duration-300">
              {isPsicologo ? (
                <>
                  <div className="inline-flex items-center gap-2 bg-psi-deep/50 backdrop-blur-md text-purple-200 border border-purple-400/30 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full">
                    <Building2 className="w-4 h-4 text-psi-vibrant" />
                    Credenciamento Aberto • Faça Parte da Rede Clínica
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-white">
                    Expanda seus Atendimentos com a Clínica Viver Mais
                  </h2>
                  <p className="text-sm sm:text-base text-purple-100/90 leading-relaxed max-w-xl font-normal">
                    Conecte-se a novos pacientes com o apoio da nossa plataforma integrada: rodízio inteligente de triagem, prontuário estruturado com inteligência artificial (SOAP), gestão de cobranças descomplicada e total autonomia da sua agenda clínica.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-[10px] font-extrabold uppercase text-psi-vibrant">Captação</p>
                      <p className="mt-0.5 text-xs font-bold text-white">Rodízio Contínuo</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-[10px] font-extrabold uppercase text-psi-vibrant">Prontuário</p>
                      <p className="mt-0.5 text-xs font-bold text-white">IA Clínica (SOAP)</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-[10px] font-extrabold uppercase text-psi-vibrant">Flexibilidade</p>
                      <p className="mt-0.5 text-xs font-bold text-white">100% Autônomo</p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={handleIrParaCadastroPsicologo}
                      className="bg-psi-vibrant hover:bg-psi-deep text-white font-black text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lift flex items-center gap-2 active:scale-95"
                    >
                      Preencher Cadastro de Credenciamento <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 bg-psi-deep/40 backdrop-blur-md text-purple-200 border border-purple-400/30 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full">
                    <Sparkles className="w-4 h-4 text-psi-vibrant" />
                    Cuidar da mente é Viver Mais!
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-white">
                    Cuidado Psicológico Pensado para Você
                  </h2>
                  <p className="text-sm sm:text-base text-purple-100/90 leading-relaxed max-w-xl font-normal">
                    A partir das suas preferências e demandas, direcionamos você ao psicólogo ideal conforme a modalidade de atendimento (online ou presencial) e disponibilidade da nossa equipe, sempre com cuidado, acolhimento e resguardo ético.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-[10px] font-extrabold uppercase text-psi-vibrant">Acessível</p>
                      <p className="mt-0.5 text-xs font-bold text-white">A partir de R$ 75</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-[10px] font-extrabold uppercase text-psi-vibrant">Modalidades</p>
                      <p className="mt-0.5 text-xs font-bold text-white">Online & Presencial</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-[10px] font-extrabold uppercase text-psi-vibrant">Agilidade</p>
                      <p className="mt-0.5 text-xs font-bold text-white">Retorno em até 24h</p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-4">
                    <a
                      href="#secao-escolha-servico"
                      onClick={handleAgendarConsultaScroll}
                      className="bg-psi-vibrant hover:bg-psi-deep text-white font-black text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lift flex items-center gap-2 active:scale-95"
                    >
                      Ver Modalidades & Agendar <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Imagem Premium de Consultório na Hero */}
            <div className="relative z-10 lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl group">
                <img
                  src={isPsicologo ? '/hero_psychologist.jpg' : '/hero_patient.jpg'}
                  alt={isPsicologo ? 'Psicóloga credenciada em consultório acolhedor' : 'Sessão de acolhimento psicológico Viver Mais'}
                  className="w-full h-72 lg:h-80 object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção da Jornada — espelha as etapas do header */}
      <section className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
            <div className="mx-auto max-w-2xl space-y-2 text-center">
              <span className="chip-accent text-[11px]">
                {isPsicologo ? 'Jornada do Profissional' : 'Jornada Descomplicada'}
              </span>
              <h3 className="text-xl font-black text-ink sm:text-2xl">
                {isPsicologo
                  ? `Como Funciona o Credenciamento em ${PASSOS_CREDENCIAMENTO.length} Passos`
                  : `Como Funciona o Seu Agendamento em ${PASSOS_AGENDAMENTO.length} Passos`}
              </h3>
            </div>

            <ol
              className={`mt-7 grid gap-4 sm:grid-cols-2 ${
                isPsicologo ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
              }`}
            >
              {(isPsicologo ? PASSOS_CREDENCIAMENTO : PASSOS_AGENDAMENTO).map((passo, indice, passos) => (
                <li
                  key={passo.titulo}
                  className="relative flex flex-col gap-3 rounded-2xl border border-psi-soft/60 bg-canvas p-5 transition-all hover:border-psi-vibrant/50 hover:shadow-card"
                >
                  {/* Fio ligando um passo ao seguinte, só onde eles ficam lado a lado */}
                  {indice < passos.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-4 top-[2.25rem] hidden h-px w-4 bg-psi-soft lg:block"
                    />
                  )}

                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-psi-vibrant text-xs font-black text-white shadow-sm shadow-psi-vibrant/30">
                      {indice + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-ink">{passo.titulo}</h4>
                      <p className="text-[11px] font-bold text-psi-vibrant">{passo.resumo}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-line/60 pt-3 text-xs leading-relaxed text-muted">
                    {passo.detalhes.map((detalhe) => (
                      <p key={detalhe}>{detalhe}</p>
                    ))}
                    {passo.observacao && (
                      <p className="text-[10px] italic text-muted/80">{passo.observacao}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Main Flow Section */}
      <main id="modalidades" className="max-w-6xl mx-auto px-6 py-8">
        {step === 'SERVICOS' && (
          <div id="servicos-cards" className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Escolha Seu Serviço & Agende em 1-Clique com Cards Completos */}
            <div id="secao-escolha-servico" className="scroll-mt-28 space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <span className="chip-accent text-[11px]">Agendamento em 1-Clique</span>
                <h3 className="text-2xl sm:text-3xl font-black text-ink">
                  Escolha Seu Serviço &amp; Agende em 1-Clique
                </h3>
                <p className="text-xs sm:text-sm text-muted">
                  Valores transparentes, cuidado ético e encaminhamento descomplicado para o seu momento de vida
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(precos).map(([key, service]) => {
                  const servicoKey = key as ServicoKey;
                  return (
                    <div
                      key={key}
                      id={`detalhes-${key}`}
                      className="bg-surface rounded-3xl border border-psi-soft shadow-card hover:shadow-lift transition-all duration-300 overflow-hidden flex flex-col justify-between group hover:-translate-y-1"
                    >
                      <div>
                        {/* Banner de Imagem com Gradiente */}
                        <div className="relative h-48 w-full overflow-hidden bg-psi-darkest">
                          <img
                            src={service.imagem}
                            alt={service.titulo}
                            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                          <div className="absolute bottom-4 left-5 right-5">
                            <span className="text-[10px] text-psi-vibrant font-extrabold uppercase tracking-wider bg-psi-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-psi-vibrant/30">
                              Atendimento Especializado
                            </span>
                            <h4 className="text-base sm:text-lg font-black text-white mt-1.5 leading-snug">
                              {service.titulo}
                            </h4>
                          </div>
                        </div>

                        {/* Descrição e Duração do Serviço */}
                        <div className="p-5 sm:p-6 space-y-4">
                          <p className="text-xs leading-relaxed text-muted">
                            {service.descricao}
                          </p>

                          <div className="flex items-center gap-1.5 rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2 text-xs font-extrabold text-purple-800">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                            <span>Duração da sessão: {service.duracao}</span>
                          </div>
                        </div>
                      </div>

                      {/* Opções de Agendamento (Valores) */}
                      <div className="p-5 sm:p-6 pt-0 space-y-2.5 border-t border-psi-soft/50 mt-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted block pt-3">
                          Selecione a Modalidade:
                        </span>
                        {service.opcoes.map((opcao) => (
                          <div
                            key={opcao.tipo}
                            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-canvas border border-psi-soft hover:border-psi-vibrant/50 hover:bg-psi-soft/30 transition-all"
                          >
                            <div className="min-w-0">
                              <span className="block text-xs font-extrabold text-ink">{opcao.label}</span>
                              <span className="text-[11px] font-black text-psi-deep">{opcao.preco} / sessão</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectServiceAndPrice(servicoKey, opcao.tipo)}
                              className="shrink-0 bg-psi-deep hover:bg-psi-darkest text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                            >
                              Agendar <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Carrossel de Psicólogos Credenciados */}
            <div id="secao-profissionais" className="scroll-mt-28">
              <VitrineCarrossel psicologos={psicologosCredenciados} autoDeslizar />
            </div>

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

            {/* Dúvidas Frequentes */}
            <div id="secao-duvidas" className="scroll-mt-28 bg-white rounded-3xl p-8 border border-purple-100 shadow-sm space-y-6">
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

        {step === 'CAMINHO' && selectedService && selectedModalidade && (
          <section className="mx-auto max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2">
              <span className="chip-accent text-[11px]">Serviço e valor escolhidos</span>
              <h3 className="text-2xl sm:text-3xl font-black text-ink">Como você prefere encontrar seu psicólogo?</h3>
              <p className="text-xs text-muted">Você pode escolher alguém da equipe ou deixar que a gente encontre o perfil mais compatível.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setCaminho('PROFISSIONAL');
                  setStep('PROFISSIONAIS');
                }}
                className="group rounded-3xl border border-psi-soft bg-surface p-7 text-left shadow-card transition-all hover:-translate-y-1 hover:border-psi-vibrant hover:shadow-lift"
              >
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-psi-soft text-psi-deep group-hover:bg-psi-deep group-hover:text-white">
                  <User className="h-5 w-5" />
                </span>
                <h4 className="text-lg font-black text-ink">Escolher o profissional</h4>
                <p className="mt-2 text-xs leading-relaxed text-muted">Conheça os psicólogos disponíveis, veja os períodos de atendimento e escolha quem você prefere.</p>
                <span className="mt-5 flex items-center gap-2 text-xs font-black text-psi-deep">Ver profissionais <ArrowRight className="h-4 w-4" /></span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCaminho('MATCH');
                  setStep('MATCH');
                }}
                className="group relative overflow-hidden rounded-3xl border border-psi-vibrant bg-psi-darkest p-7 text-left text-white shadow-lift transition-all hover:-translate-y-1"
              >
                <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">Recomendado</span>
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-psi-soft">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h4 className="text-lg font-black">Escolha conforme minhas necessidades</h4>
                <p className="mt-2 text-xs leading-relaxed text-purple-100/80">Responda somente três perguntas. O sistema filtra a equipe e encaminha o primeiro profissional compatível da fila.</p>
                <span className="mt-5 flex items-center gap-2 text-xs font-black text-psi-soft">Começar recomendação <ArrowRight className="h-4 w-4" /></span>
              </button>
            </div>

            <button type="button" onClick={() => setStep('SERVICOS')} className="mx-auto block text-xs font-bold text-muted hover:text-ink hover:underline">
              Voltar aos valores
            </button>
          </section>
        )}

        {step === 'MATCH' && selectedService && selectedModalidade && (
          <section className="mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8 animate-in fade-in duration-300">
            <div className="mb-7 flex items-start justify-between gap-4 border-b border-line pb-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-psi-vibrant">Recomendação inteligente · 3 perguntas</span>
                <h3 className="mt-1 text-2xl font-black text-ink">Conte só o necessário</h3>
                <p className="mt-1 text-xs text-muted">Nenhum dado pessoal será pedido nesta etapa.</p>
              </div>
              <button type="button" onClick={() => setStep('CAMINHO')} className="text-xs font-bold text-muted hover:text-ink">Voltar</button>
            </div>

            <div className="space-y-7">
              <div className="space-y-3">
                <label className="text-sm font-black text-ink">1. Para quem é o atendimento? <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {['Individual', 'Casal', 'Infantil', 'Adolescente', 'Família', 'Outro'].map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, paraQuemE: opcao }))}
                      className={`rounded-xl border p-3 text-left text-xs font-bold transition-all ${form.paraQuemE === opcao ? 'border-psi-vibrant bg-psi-soft text-psi-darkest' : 'border-line bg-white text-muted hover:border-psi-soft'}`}
                    >
                      {opcao}
                    </button>
                  ))}
                </div>
                {form.paraQuemE === 'Outro' && (
                  <input
                    value={form.paraQuemEOutro}
                    onChange={(e) => setForm((prev) => ({ ...prev, paraQuemEOutro: e.target.value }))}
                    placeholder="Especifique para quem é o atendimento"
                    className="input text-xs"
                  />
                )}
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-black text-ink">2. Qual é a sua queixa ou necessidade? <span className="text-rose-500">*</span></legend>
                <p className="text-[11px] text-muted">Selecione uma ou mais opções.</p>
                <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {LISTA_NECESSIDADES.map((necessidade) => {
                    const selecionada = form.necessidadesPaciente.includes(necessidade);
                    return (
                      <button
                        key={necessidade}
                        type="button"
                        aria-pressed={selecionada}
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          especificarNecessidades: true,
                          necessidadesPaciente: selecionada
                            ? prev.necessidadesPaciente.filter((item) => item !== necessidade)
                            : [...prev.necessidadesPaciente, necessidade],
                        }))}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-left text-xs font-bold leading-snug transition-all ${
                          selecionada
                            ? 'border-psi-vibrant bg-psi-soft text-psi-darkest'
                            : 'border-line bg-white text-muted hover:border-psi-soft hover:text-ink'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selecionada ? 'border-psi-vibrant bg-psi-vibrant text-white' : 'border-line bg-white'}`}>
                          {selecionada && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        {necessidade}
                      </button>
                    );
                  })}
                </div>
                <label className="block space-y-2 border-t border-line pt-3">
                  <span className="text-xs font-bold text-ink">Outro <span className="font-normal text-muted">(opcional)</span></span>
                  <input
                    type="text"
                    maxLength={300}
                    value={form.necessidadesOutro}
                    onChange={(e) => setForm((prev) => ({ ...prev, especificarNecessidades: true, necessidadesOutro: e.target.value }))}
                    placeholder="Escreva outra necessidade"
                    className="input text-xs"
                  />
                </label>
              </fieldset>

              <div className="space-y-2">
                <span className="text-sm font-black text-ink">3. Qual período você prefere? <span className="text-rose-500">*</span></span>
                <TurnoPreferenceField value={form.turno} onChange={(turno) => setForm((prev) => ({ ...prev, turno }))} />
              </div>

              <button type="button" onClick={continuarMatch} className="btn-accent w-full justify-center py-4 text-xs">
                Ver Psicólogos Recomendados <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {step === 'MATCH_RECOMENDACOES' && selectedService && selectedModalidade && (
          <section className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-psi-vibrant">
                  Recomendação Inteligente • Passo 2 de 3
                </span>
                <h3 className="mt-1 text-2xl font-black text-ink">Profissionais Compatíveis com Você</h3>
                <p className="mt-1 text-xs text-muted">
                  Encontramos estes psicólogos da nossa equipe alinhados às suas preferências de turno e demandas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('MATCH')}
                className="text-xs font-bold text-muted hover:text-ink hover:underline"
              >
                Voltar às perguntas
              </button>
            </div>

            {psicologosRecomendadosMatch.length > 0 ? (
              <div className="space-y-6">
                <VitrineCarrossel
                  psicologos={psicologosRecomendadosMatch}
                  selecionadoId={psicologoEscolhido?.id}
                  titulo="Selecione seu Profissional Recomendado"
                  subtitulo="Clique no profissional que você mais se identificar para seguir com o agendamento"
                  onSelecionar={(psicologo) => {
                    setPsicologoEscolhido(psicologo);
                    setStep('FORMULARIO');
                  }}
                />

                {/* Opção Alternativa: Atribuição Automática / Fila Inteligente */}
                <div className="bg-purple-50/70 border border-purple-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <h4 className="text-sm font-black text-purple-950">Prefere não escolher um nome específico?</h4>
                    <p className="text-xs text-purple-800/80">
                      Nosso sistema alocará o primeiro psicólogo compatível disponível da fila para entrar em contato com você em até 24h.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPsicologoEscolhido(null);
                      setStep('FORMULARIO');
                    }}
                    className="bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-md shadow-purple-700/20 whitespace-nowrap shrink-0"
                  >
                    Alocar Automaticamente <ArrowRight className="w-4 h-4 inline-block ml-1" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-3xl border border-amber-200 p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-black text-ink">Nenhum profissional com agenda imediata específica</h4>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Não se preocupe! Conclua seus dados de contato e nossa equipe alocará o próximo profissional compatível da fila para acolher o seu caso.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPsicologoEscolhido(null);
                    setStep('FORMULARIO');
                  }}
                  className="bg-psi-deep hover:bg-psi-darkest text-white text-xs font-black px-6 py-3 rounded-2xl transition-all shadow-md"
                >
                  Continuar Cadastro de Atendimento <ArrowRight className="w-4 h-4 inline-block ml-1" />
                </button>
              </div>
            )}
          </section>
        )}

        {step === 'PROFISSIONAIS' && selectedService && selectedModalidade && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-psi-vibrant">Catálogo compatível</span>
                <h3 className="mt-1 text-2xl font-black text-ink">Escolha seu profissional</h3>
                <p className="mt-1 text-xs text-muted">Mostramos somente profissionais habilitados para o serviço e a faixa de valor escolhidos.</p>
              </div>
              <button type="button" onClick={() => setStep('CAMINHO')} className="text-xs font-bold text-muted hover:text-ink">Voltar</button>
            </div>

            {profissionaisCompativeis.length > 0 ? (
              <VitrineCarrossel
                psicologos={profissionaisCompativeis}
                selecionadoId={psicologoEscolhido?.id}
                mostrarFiltros
                layout="lista"
                onSelecionar={(psicologo) => {
                  setPsicologoEscolhido(psicologo);
                  setForm((prev) => ({ ...prev, turno: '' }));
                }}
              />
            ) : (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">
                Nenhum profissional está disponível para esta combinação agora. Volte e use a recomendação inteligente para entrar na fila de atendimento.
              </div>
            )}

            {psicologoEscolhido && (
              <div className="sticky bottom-4 mx-auto max-w-2xl rounded-3xl border border-psi-vibrant/30 bg-white/95 p-5 shadow-2xl backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">Horários disponíveis de {psicologoEscolhido.nomeSocial || psicologoEscolhido.nome}</p>
                <p className="mb-3 mt-1 text-xs text-muted">Escolha um período disponível. O profissional entrará em contato para confirmar o melhor dia e horário.</p>
                <TurnoPreferenceField
                  value={form.turno}
                  allowedValues={(psicologoEscolhido.turnosDisponiveis ?? [])
                    .map(normalizarTurnoPreferencia)
                    .filter((turno): turno is TurnoPreferencia => Boolean(turno))}
                  onChange={(turno) => setForm((prev) => ({ ...prev, turno }))}
                />
                <button
                  type="button"
                  disabled={!form.turno}
                  onClick={() => setStep('FORMULARIO')}
                  className="btn-accent mt-4 w-full justify-center py-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Agendar com este profissional <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        )}

        {step === 'FORMULARIO' && selectedService && selectedModalidade && (
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-purple-50 pb-4">
              <div>
                <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Últimos passos</span>
                <h3 className="text-lg font-black text-slate-900">
                  Termine seu cadastro para concluir
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {caminho === 'MATCH'
                    ? (psicologoEscolhido
                        ? `Você escolheu a recomendação de ${psicologoEscolhido.nomeSocial || psicologoEscolhido.nome}. Preencha seus dados de contato para finalizar.`
                        : 'Suas preferências foram salvas. Complete seus dados de contato para enviarmos ao primeiro profissional disponível da fila.')
                    : `Você escolheu ${psicologoEscolhido?.nomeSocial || psicologoEscolhido?.nome}. Complete seus dados para enviar a solicitação.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(caminho === 'MATCH' ? 'MATCH_RECOMENDACOES' : 'PROFISSIONAIS')}
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

              {/* Data de Nascimento e E-mail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Data de Nascimento <span className="text-slate-400 font-normal text-[11px]">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.dataNascimento}
                    onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600 text-slate-700"
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
                  {conveniosError ? (
                    <>
                      <input
                        required
                        value={form.convenioSelecionado}
                        onChange={(e) => setForm({ ...form, convenioSelecionado: e.target.value })}
                        placeholder="Digite o nome da empresa"
                        className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600"
                      />
                      <p className="mt-1 text-xs text-amber-700">A lista não carregou, mas você pode informar a empresa normalmente.</p>
                    </>
                  ) : (
                    <select
                      required={!conveniosLoading}
                      disabled={conveniosLoading}
                      value={form.convenioSelecionado}
                      onChange={(e) => setForm({ ...form, convenioSelecionado: e.target.value })}
                      className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 disabled:opacity-60"
                    >
                      <option value="">{conveniosLoading ? 'Carregando convênios…' : 'Selecione seu convênio'}</option>
                      {conveniosDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
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

              <button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-purple-700/25 transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
              >
                <Send className="w-4 h-4" />
                Finalizar agendamento
              </button>
              {/* Campo-armadilha: invisível para quem preenche, isca para robô. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={CAMPO_ARMADILHA}>Não preencha este campo</label>
                <input
                  id={CAMPO_ARMADILHA}
                  name={CAMPO_ARMADILHA}
                  type="text"
                  value={armadilha}
                  onChange={(e) => setArmadilha(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
            </form>
          </div>
        )}

        {step === 'CADASTRO_PSICOLOGO' && (
          <CadastroPsicologoForm
            onCancelar={() => setStep('SERVICOS')}
            onSucesso={() => setStep('SUCESSO_PSICOLOGO')}
          />
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
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-900">Solicitação Recebida!</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Seu psicólogo credenciado entrará em contato via WhatsApp em até <strong>24 horas</strong> para alinhar o melhor dia e horário.
              </p>
              <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3.5 text-[11px] text-purple-900 text-left space-y-1">
                <p>• Enviamos uma confirmação detalhada para o seu e-mail e WhatsApp.</p>
                <p className="text-slate-500 italic">
                  *Se o prazo de 24h coincidir com finais de semana ou feriados, o contato ocorrerá no próximo dia útil.
                </p>
              </div>

              {/* Alerta Ético CVV 188 */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-left space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                  ⚠️ Suporte em Crise ou Emergência
                </span>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  Em caso de sofrimento agudo, crise emocional ou risco à vida, ligue gratuitamente para o <strong>CVV no 188</strong> (24h) ou procure o serviço de emergência mais próximo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('SERVICOS');
                setSelectedService(null);
                setSelectedModalidade(null);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md"
            >
              Voltar ao Início
            </button>
          </div>
        )}
      </main>

      <FloatingWhatsAppButton />

      <PublicFooter onIrParaAgendar={handleIrParaAgendar} />
    </div>
  );
}
