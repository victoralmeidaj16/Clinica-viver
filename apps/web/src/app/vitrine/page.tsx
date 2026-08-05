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

export default function ViverMaisLandingPage() {
  const [selectedService, setSelectedService] = useState<'PSICOTERAPIA' | 'AVALIACAO' | 'ORIENTACAO_PROFISSIONAL' | 'ORIENTACAO_PARENTAL' | null>(null);
  const [selectedModalidade, setSelectedModalidade] = useState<'SOCIAL' | 'PARTICULAR' | 'CASAL_SOCIAL' | 'CASAL_PARTICULAR' | null>(null);
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
  const precos = {
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

  const handleSelectServiceAndPrice = (serviceKey: keyof typeof precos, modalidadeType: string) => {
    setSelectedService(serviceKey);
    setSelectedModalidade(modalidadeType as any);
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

      {/* Hero Banner Card Section */}
      <section className="px-6 pt-10 pb-2">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(147,51,234,0.15),transparent_45%)]"></div>
            
            <div className="space-y-6 max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-purple-200 border border-white/10 text-[11px] font-bold px-3 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                Cuidar da mente é Viver Mais!
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
                Nossos Serviços de Psicologia
              </h2>
              <p className="text-sm sm:text-base text-purple-100/80 leading-relaxed max-w-xl">
                Conheça nossos serviços oferecidos por profissionais capacitados prontos para acolher você. Oferecemos atendimento online ou presencial.
              </p>
            </div>
            
            <div className="relative z-10 shrink-0 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm max-w-xs text-center space-y-4">
              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block">Agendamento Simplificado</span>
              <p className="text-xs text-purple-100/90 leading-snug">Escolha a melhor modalidade (acessível ou particular) e seja acolhido em até 24 horas.</p>
              <a 
                href="#servicos"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition-all shadow-md inline-block"
              >
                Ver Modalidades & Preços
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Flow Section */}
      <main id="servicos" className="max-w-6xl mx-auto px-6 py-12">
        {step === 'SERVICOS' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* 4 Cards de Serviços */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(precos).map(([key, service]) => (
                <div
                  key={key}
                  className="bg-white rounded-3xl border border-purple-100 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                      <Heart className="w-5 h-5 fill-purple-100" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 leading-snug">{service.titulo}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{service.descricao}</p>
                  </div>
                  <a
                    href={`#detalhes-${key}`}
                    className="text-[11px] font-extrabold text-purple-600 hover:text-purple-700 mt-6 inline-flex items-center gap-1 hover:underline"
                  >
                    Ver Valores e Agendar <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>

            {/* Psicoterapia Explicativo */}
            <div className="bg-white rounded-3xl p-8 border border-purple-100 shadow-sm space-y-6">
              <div className="max-w-3xl space-y-4">
                <h3 className="text-xl font-black text-slate-900">Por que fazer Psicoterapia?</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Fazer psicoterapia é um processo de autodescoberta e transformação. É a oportunidade de compreender melhor seus sentimentos, pensamentos e comportamentos, ajudando a enfrentar desafios como ansiedade, tristeza, estresse ou conflitos nos relacionamentos. Com o apoio de profissionais qualificados, você encontra um espaço seguro e acolhedor para explorar as questões que impactam sua vida.
                </p>
                <p className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-lg inline-block">
                  Oferecemos atendimento psicológico on-line e presencial, com valores acessíveis (R$75,00) e particular (R$ 130,00).
                </p>
              </div>
            </div>

            {/* Tabela de Preços e Ações */}
            <div className="space-y-12">
              <h3 className="text-2xl font-black text-slate-900 text-center">Nossas Modalidades e Valores</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Object.entries(precos).map(([key, service]) => (
                  <div
                    key={key}
                    id={`detalhes-${key}`}
                    className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all scroll-mt-24"
                  >
                    <div>
                      {/* Banner de Imagem com Gradiente */}
                      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                        <img
                          src={service.imagem}
                          alt={service.titulo}
                          className="w-full h-full object-cover opacity-90 hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
                        <div className="absolute bottom-4 left-6 right-6">
                          <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider bg-purple-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-purple-400/30">
                            Serviço Especializado
                          </span>
                          <h4 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
                            {service.titulo}
                          </h4>
                        </div>
                      </div>

                      <div className="p-6">
                        <p className="text-xs text-slate-500 leading-relaxed border-b border-purple-50 pb-4">{service.descricao}</p>
                      </div>
                    </div>

                    <div className="p-6 pt-0 space-y-3">
                      {service.opcoes.map((opcao) => (
                        <div
                          key={opcao.tipo}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100/60 hover:bg-purple-50 transition-colors"
                        >
                          <div>
                            <span className="text-xs font-extrabold text-slate-800 block">{opcao.label}</span>
                            <span className="text-[11px] text-purple-600 font-bold">{opcao.preco} / sessão</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectServiceAndPrice(key as any, opcao.tipo)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
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

              {/* Telefone e Confirme Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="Telefone"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Confirme o Telefone <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.whatsappConfirmacao}
                    onChange={(e) => setForm({ ...form, whatsappConfirmacao: e.target.value })}
                    placeholder="Telefone"
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

              {/* CPF e CEP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CPF <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    placeholder="CPF"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CEP <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: e.target.value })}
                    placeholder="CEP"
                    className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

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
