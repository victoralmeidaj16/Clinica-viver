'use client';

import React, { useState } from 'react';
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
  UserPlus
} from 'lucide-react';

type ServicoKey =
  | 'PSICOTERAPIA'
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
  imagem: string;
  opcoes: OpcaoPreco[];
}

export default function ViverMaisLandingPage() {
  const [selectedService, setSelectedService] = useState<ServicoKey | null>(null);
  const [selectedModalidade, setSelectedModalidade] = useState<ModalidadeKey | null>(null);
  const [step, setStep] = useState<'SERVICOS' | 'FORMULARIO' | 'CADASTRO_PSICOLOGO' | 'SUCESSO' | 'SUCESSO_PSICOLOGO'>('SERVICOS');
  
  const [form, setForm] = useState({
    nome: '',
    whatsapp: '',
    whatsappConfirmacao: '',
    idade: '',
    email: '',
    cpf: '',
    cep: '',
    possuiConvenio: 'NAO',
    convenioSelecionado: '',
    origem: 'Facebook',
    turno: 'VESPERTINO',
  });

  const [formPsicologo, setFormPsicologo] = useState({
    nomeCompleto: '',
    crp: '',
    whatsapp: '',
    email: '',
    modalidadeAtendimento: 'AMBOS',
    especialidade: 'Cognitivo-Comportamental (TCC)',
    cidadeUf: 'Porto Alegre/RS',
    disponibilidadeTurnos: ['MANHA', 'TARDE'],
    minibio: '',
  });

  const [protocolo, setProtocolo] = useState('');
  const [enderecoInfo, setEnderecoInfo] = useState({ logradouro: '', bairro: '', cidade: '', uf: '' });
  const [loadingCep, setLoadingCep] = useState(false);

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

  // Tabela de preços correspondente ao que foi solicitado
  const precos: Record<ServicoKey, ServicoVitrine> = {
    PSICOTERAPIA: {
      titulo: 'Psicoterapia',
      descricao: 'Atendimento on-line ou presencial. Atendemos crianças, adolescentes, adultos e idosos, com sessões individuais, em casal ou em grupo.',
      imagem: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível (Individual)', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular (Individual)', preco: 'R$ 130,00' },
        { tipo: 'CASAL_SOCIAL', label: 'Agendamento Acessível (Casal)', preco: 'R$ 150,00' },
        { tipo: 'CASAL_PARTICULAR', label: 'Agendamento Particular (Casal)', preco: 'R$ 260,00' }
      ]
    },
    AVALIACAO: {
      titulo: 'Avaliação Psicológica',
      descricao: 'A Avaliação Psicológica é um serviço clínico que busca compreender as particularidades de cada indivíduo, analisando aspectos como personalidade, comportamentos, habilidades e desafios emocionais.',
      imagem: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 100,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 150,00' }
      ]
    },
    ORIENTACAO_PROFISSIONAL: {
      titulo: 'Orientação Profissional/Vocacional',
      descricao: 'A Orientação Profissional auxilia no planejamento de sua carreira ou transição profissional. A Orientação Vocacional ajuda jovens e adolescentes a descobrir suas aptidões e interesses.',
      imagem: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    },
    ORIENTACAO_PARENTAL: {
      titulo: 'Orientação Parental',
      descricao: 'A Orientação Parental oferece suporte especializado para pais e responsáveis que desejam compreender melhor as necessidades emocionais e comportamentais de seus filhos, construindo relações saudáveis.',
      imagem: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectServiceAndPrice = (serviceKey: ServicoKey, modalidadeType: ModalidadeKey) => {
    setSelectedService(serviceKey);
    setSelectedModalidade(modalidadeType);
    setStep('FORMULARIO');
  };

  const handleSubmitPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.whatsapp !== form.whatsappConfirmacao) {
      alert('Os números de telefone informados não coincidem!');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          servico: selectedService ? precos[selectedService]?.titulo : '',
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
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPsicologo),
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
                Acolhimento Humano e Inteligência Clínica ao Seu Alcance
              </h2>
              <p className="text-sm sm:text-base text-purple-100/90 leading-relaxed max-w-xl font-normal">
                Encontre o psicólogo ideal para suas necessidades em consultas presenciais ou on-line. Agendamento ágil, valores acessíveis e resguardo ético em todas as etapas.
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
                  Informe seu contato no WhatsApp e endereço. O sistema aloca um psicólogo especializado via rodízio inteligente.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-canvas border border-psi-soft/60 space-y-3 relative">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">3</span>
                <h4 className="font-extrabold text-sm text-ink">Confirmação via WhatsApp (24h)</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Seu psicólogo entra em contato no WhatsApp em até 24 horas com o link Pix dinâmico para agendar o horário ideal.
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(precos).map(([key, service]) => (
                  <div
                    key={key}
                    className="bg-surface rounded-3xl border border-psi-soft/80 p-6 flex flex-col justify-between shadow-card hover:shadow-lift transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-psi-soft/40 rounded-full blur-2xl group-hover:bg-psi-vibrant/20 transition-all"></div>
                    
                    <div className="space-y-4 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-psi-soft text-psi-deep flex items-center justify-center border border-psi-soft/80 group-hover:scale-110 group-hover:bg-psi-deep group-hover:text-white transition-all">
                        <Heart className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-black text-ink leading-snug group-hover:text-psi-deep transition-colors">{service.titulo}</h4>
                      <p className="text-xs text-muted leading-relaxed line-clamp-4">{service.descricao}</p>
                    </div>

                    <div className="pt-6 border-t border-psi-soft/50 mt-6 relative z-10">
                      <a
                        href={`#detalhes-${key}`}
                        className="w-full bg-canvas hover:bg-psi-soft/80 border border-psi-soft text-psi-darkest font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 group-hover:bg-psi-deep group-hover:text-white group-hover:border-psi-deep"
                      >
                        Ver Valores e Agendar <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Banner Informativo Psicoterapia com Equipe */}
            <div className="bg-surface rounded-3xl p-8 border border-line shadow-card grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <span className="chip-accent text-[11px]">Equipe Credenciada</span>
                <h3 className="text-2xl font-black text-ink">Por que fazer Psicoterapia na Viver Mais?</h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  A psicoterapia é um ambiente seguro e sigiloso de escuta técnica para superar desafios emocionais, ansiedade e momentos de transição. Nossos profissionais passam por rigoroso processo de credenciamento e supervisão clínica contínua.
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
                <p className="text-xs text-muted mt-1">Valores transparentes e alocação ética garantida</p>
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
                        <p className="text-xs text-muted leading-relaxed border-b border-line pb-4">{service.descricao}</p>
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
                            <span className="text-[11px] text-psi-deep font-black">{opcao.preco} / sessão (50 min)</span>
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
              </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Idade <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={form.idade}
                    onChange={(e) => setForm({ ...form, idade: e.target.value })}
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

              {/* CPF e CEP com Máscara e ViaCEP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              {/* Endereço auto-preenchido pelo ViaCEP */}
              {enderecoInfo.cidade && (
                <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-2xl text-[11px] space-y-1 animate-in fade-in">
                  <span className="font-bold text-purple-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-600" /> Endereço Localizado:
                  </span>
                  <p className="text-slate-600">
                    {enderecoInfo.logradouro ? `${enderecoInfo.logradouro}, ` : ''}
                    {enderecoInfo.bairro ? `${enderecoInfo.bairro} — ` : ''}
                    <span className="font-semibold text-slate-800">{enderecoInfo.cidade}/{enderecoInfo.uf}</span>
                  </p>
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
                  <label className="font-bold text-slate-700 block mb-1">WhatsApp com DDD <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formPsicologo.whatsapp}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, whatsapp: e.target.value })}
                    placeholder="(51) 99999-9999"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

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
                  <label className="font-bold text-slate-700 block mb-1">Cidade / Estado <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formPsicologo.cidadeUf}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, cidadeUf: e.target.value })}
                    placeholder="Ex: Porto Alegre/RS"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Abordagem / Especialidade Principal <span className="text-rose-500">*</span></label>
                <select
                  value={formPsicologo.especialidade}
                  onChange={(e) => setFormPsicologo({ ...formPsicologo, especialidade: e.target.value })}
                  className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600"
                >
                  <option value="Cognitivo-Comportamental (TCC)">Terapia Cognitivo-Comportamental (TCC)</option>
                  <option value="Psicanálise">Psicanálise</option>
                  <option value="Humanista / Gestalt">Humanista / Gestalt-terapia</option>
                  <option value="Avaliação Psicológica / Neuropsicologia">Avaliação Psicológica / Neuropsicologia</option>
                  <option value="Orientação Parental e Carreira">Orientação Parental e Carreira</option>
                </select>
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

              <div>
                <label className="font-bold text-slate-700 block mb-1">Breve Apresentação Clínica / Mini Biografia</label>
                <textarea
                  rows={3}
                  value={formPsicologo.minibio}
                  onChange={(e) => setFormPsicologo({ ...formPsicologo, minibio: e.target.value })}
                  placeholder="Conte um pouco sobre sua trajetória clínica e área de atuação..."
                  className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                ></textarea>
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
