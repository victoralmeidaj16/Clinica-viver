'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  MapPin,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Send,
  UserPlus,
  Plus,
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
  const precos = {
    PSICOTERAPIA: {
      titulo: 'Psicoterapia',
      resumo: 'Escuta contínua',
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
      resumo: 'Mapa clínico',
      descricao: 'A Avaliação Psicológica é um serviço clínico que busca compreender as particularidades de cada indivíduo, analisando aspectos como personalidade, comportamentos, habilidades e desafios emocionais.',
      imagem: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 100,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 150,00' }
      ]
    },
    ORIENTACAO_PROFISSIONAL: {
      titulo: 'Orientação Profissional/Vocacional',
      resumo: 'Escolha de rumo',
      descricao: 'A Orientação Profissional auxilia no planejamento de sua carreira ou transição profissional. A Orientação Vocacional ajuda jovens e adolescentes a descobrir suas aptidões e interesses.',
      imagem: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    },
    ORIENTACAO_PARENTAL: {
      titulo: 'Orientação Parental',
      resumo: 'Vínculo familiar',
      descricao: 'A Orientação Parental oferece suporte especializado para pais e responsáveis que desejam compreender melhor as necessidades emocionais e comportamentais de seus filhos, construindo relações saudáveis.',
      imagem: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80',
      opcoes: [
        { tipo: 'SOCIAL', label: 'Agendamento Acessível', preco: 'R$ 75,00' },
        { tipo: 'PARTICULAR', label: 'Agendamento Particular', preco: 'R$ 130,00' }
      ]
    }
  };

  const passos = [
    {
      n: '01',
      titulo: 'Escolha o serviço e a modalidade',
      texto: 'Psicoterapia, Avaliação ou Orientação. Você decide entre o agendamento Acessível (a partir de R$ 75) ou Particular (a partir de R$ 130).',
    },
    {
      n: '02',
      titulo: 'Preencha seus dados',
      texto: 'Informe seu contato de WhatsApp e endereço. O sistema aloca um psicólogo especializado por rodízio ético e transparente.',
    },
    {
      n: '03',
      titulo: 'Confirmação em até 24 horas',
      texto: 'Seu psicólogo entra em contato no WhatsApp com o link Pix dinâmico para combinar o dia e o horário ideais para você.',
    },
  ];

  const faq = [
    {
      q: 'As sessões de Psicoterapia são on-line ou presenciais?',
      a: 'Oferecemos atendimento em ambas modalidades, on-line para qualquer lugar do mundo e presencial em algumas regiões cadastradas.',
    },
    {
      q: 'Quanto tempo dura a sessão?',
      a: 'A psicoterapia individual dura em média 50 minutos. A psicoterapia de casal/família dura em média 1h30.',
    },
    {
      q: 'Como marcar um dia e horário para minha sessão?',
      a: 'Escolha o serviço desejado, selecione a modalidade de pagamento e preencha as informações solicitadas. Um psicólogo entrará em contato para agendar o dia e horário ideais.',
    },
    {
      q: 'Como é feito o pagamento?',
      a: 'O pagamento é realizado de forma segura por Pix (QR Code/Copia e Cola) ou Cartão de Crédito.',
    },
  ];

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Leva o usuário até o formulário recém-renderizado, e não ao topo da hero
  const scrollToMain = () => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSelectServiceAndPrice = (serviceKey: keyof typeof precos, modalidadeType: string) => {
    setSelectedService(serviceKey);
    setSelectedModalidade(modalidadeType as any);
    setStep('FORMULARIO');
    scrollToMain();
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

  const goHome = () => {
    setStep('SERVICOS');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="vitrine min-h-screen font-sans antialiased selection:bg-psi-vibrant/25 selection:text-psi-darkest">
      {/* ————— Cabeçalho ————— */}
      <header className="sticky top-0 z-40 border-b border-psi-darkest/10 bg-[#f4efe9]/85 backdrop-blur-md">
        <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <button type="button" onClick={goHome} className="flex items-center gap-3 text-left">
            <span className="arch-sm flex h-9 w-8 items-end justify-center bg-psi-darkest pb-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f4efe9]" />
            </span>
            <span className="leading-none">
              <span className="display block text-[19px] font-semibold text-psi-darkest">Viver Mais</span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.28em] text-psi-darkest/45">
                Psicologia
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => { setStep('CADASTRO_PSICOLOGO'); scrollToMain(); }}
              className="hidden items-center gap-1.5 rounded-full border border-psi-darkest/20 px-4 py-2 text-[11px] font-bold text-psi-darkest transition-colors hover:border-psi-darkest/50 hover:bg-psi-darkest/5 sm:flex"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Sou psicólogo
            </button>
            <a
              href="#servicos"
              onClick={() => setStep('SERVICOS')}
              className="group flex items-center gap-1.5 rounded-full bg-psi-darkest px-5 py-2.5 text-[11px] font-bold text-[#f4efe9] transition-all hover:bg-[var(--ochre)] active:scale-[0.97]"
            >
              Agendar consulta
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ————— Hero editorial ————— */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-14 pt-16 sm:pt-24">
        <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="rise flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--ochre)]" style={{ animationDelay: '60ms' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Cuidar da mente é viver mais
            </p>

            <h1
              className="rise display mt-7 text-[42px] font-normal leading-[0.98] text-psi-darkest sm:text-[64px]"
              style={{ animationDelay: '150ms' }}
            >
              Um lugar para
              <br />
              ser escutado
              <br />
              <em className="underline-brush font-light italic text-[var(--iris-mid)]">sem pressa.</em>
            </h1>

            <p
              className="rise mt-8 max-w-lg text-[15px] leading-relaxed text-psi-darkest/70"
              style={{ animationDelay: '260ms' }}
            >
              Encontre o psicólogo certo para o seu momento, on-line ou presencial. Agendamento ágil,
              valores acessíveis e resguardo ético em todas as etapas do cuidado.
            </p>

            <div className="rise mt-9 flex flex-wrap items-center gap-x-7 gap-y-4" style={{ animationDelay: '360ms' }}>
              <a
                href="#servicos"
                className="group flex items-center gap-2 rounded-full bg-[var(--iris-mid)] px-7 py-4 text-xs font-bold text-white transition-all hover:bg-psi-darkest active:scale-[0.97]"
              >
                Ver modalidades e agendar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <span className="flex items-center gap-2 text-[11px] font-semibold text-psi-darkest/60">
                <ShieldCheck className="h-4 w-4 text-[var(--iris-soft)]" />
                Sigilo CFP &amp; LGPD garantidos
              </span>
            </div>
          </div>

          {/* Retrato em arco — a soleira do consultório */}
          <div className="rise relative lg:col-span-5" style={{ animationDelay: '480ms' }}>
            <div className="arch absolute -left-4 -top-4 h-full w-full border border-psi-darkest/15" aria-hidden="true" />
            <div className="arch relative overflow-hidden bg-psi-darkest">
              <img
                src="/landing_hero_psychology.png"
                alt="Consultório de psicologia da Clínica Viver Mais"
                className="h-[380px] w-full object-cover lg:h-[440px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-psi-darkest via-psi-darkest/45 to-transparent" />
              <div className="absolute inset-x-6 bottom-6">
                <span className="block text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">
                  Atendimento humanizado
                </span>
                <span className="display mt-1 block text-lg leading-snug text-white">
                  Sessões on-line ou presenciais
                </span>
              </div>
            </div>
            <div className="absolute -right-4 top-10 rounded-2xl border border-psi-darkest/10 bg-[#f4efe9] px-4 py-3 text-right shadow-[0_10px_30px_rgba(67,38,94,0.14)] sm:-right-6">
              <span className="display block text-2xl leading-none text-psi-darkest">24h</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-psi-darkest/50">
                Retorno garantido
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ————— Fluxo em 3 passos ————— */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="rule" />
        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-14">
          {passos.map((passo) => (
            <div key={passo.n} className="relative">
              <span className="display block text-[56px] font-light leading-none text-psi-darkest/15">{passo.n}</span>
              <h3 className="display mt-3 text-xl leading-snug text-psi-darkest">{passo.titulo}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-psi-darkest/65">{passo.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ————— Fluxos interativos ————— */}
      <main id="servicos" className="relative z-10 mx-auto max-w-6xl px-6 pb-24 scroll-mt-20">
        {step === 'SERVICOS' && (
          <div className="space-y-24">
            {/* Índice dos serviços */}
            <div>
              <div className="flex flex-col gap-5 border-t border-psi-darkest/15 pt-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--ochre)]">
                    Nossas especialidades
                  </span>
                  <h2 className="display mt-3 text-[32px] leading-tight text-psi-darkest sm:text-[42px]">
                    Serviços clínicos
                  </h2>
                </div>
                <p className="max-w-xs text-[13px] leading-relaxed text-psi-darkest/60">
                  Valores transparentes, alocação ética por rodízio e sessões de 50 minutos.
                </p>
              </div>

              <nav className="mt-8 flex flex-wrap gap-2">
                {Object.entries(precos).map(([key, service]) => (
                  <a
                    key={key}
                    href={`#detalhes-${key}`}
                    className="group flex items-center gap-2 rounded-full border border-psi-darkest/15 px-4 py-2 text-[11px] font-bold text-psi-darkest/75 transition-all hover:border-psi-darkest hover:bg-psi-darkest hover:text-[#f4efe9]"
                  >
                    {service.titulo}
                    <ArrowRight className="h-3 w-3 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </a>
                ))}
              </nav>
            </div>

            {/* Serviços em linhas editoriais alternadas */}
            <div className="space-y-24">
              {Object.entries(precos).map(([key, service], index) => (
                <article
                  key={key}
                  id={`detalhes-${key}`}
                  className="grid scroll-mt-24 grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14"
                >
                  <div className={`lg:col-span-5 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <div className="arch relative overflow-hidden bg-psi-darkest">
                      <img
                        src={service.imagem}
                        alt={service.titulo}
                        className="h-[300px] w-full object-cover transition-transform duration-[900ms] hover:scale-[1.04] sm:h-[360px]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-psi-darkest/70 via-transparent to-transparent" />
                      <span className="display absolute bottom-5 left-6 text-base italic text-white/85">
                        {service.resumo}
                      </span>
                    </div>
                  </div>

                  <div className={`flex flex-col justify-center lg:col-span-7 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <span className="display text-[13px] italic text-[var(--ochre)]">
                      {String(index + 1).padStart(2, '0')} / 04
                    </span>
                    <h3 className="display mt-2 text-[30px] leading-tight text-psi-darkest sm:text-[36px]">
                      {service.titulo}
                    </h3>
                    <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-psi-darkest/70">
                      {service.descricao}
                    </p>

                    <ul className="mt-8 border-t border-psi-darkest/12">
                      {service.opcoes.map((opcao) => (
                        <li
                          key={opcao.tipo}
                          className="group flex flex-wrap items-center justify-between gap-4 border-b border-psi-darkest/12 py-4 transition-colors hover:bg-white/50"
                        >
                          <div>
                            <span className="block text-[13px] font-bold text-psi-darkest">{opcao.label}</span>
                            <span className="display mt-0.5 block text-[15px] text-[var(--iris-mid)]">
                              {opcao.preco}
                              <span className="ml-1.5 font-sans text-[11px] font-medium not-italic text-psi-darkest/45">
                                / sessão de 50 min
                              </span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectServiceAndPrice(key as any, opcao.tipo)}
                            className="flex items-center gap-1.5 rounded-full border border-psi-darkest/25 px-5 py-2.5 text-[11px] font-bold text-psi-darkest transition-all hover:border-psi-darkest hover:bg-psi-darkest hover:text-[#f4efe9] active:scale-[0.97]"
                          >
                            Agendar
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>

            {/* Faixa escura — momento de alto contraste */}
            <section className="overflow-hidden rounded-[32px] bg-psi-darkest text-[#f4efe9]">
              <div className="grid grid-cols-1 items-center gap-10 p-9 sm:p-14 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--iris-soft)]">
                    Equipe credenciada
                  </span>
                  <h3 className="display mt-4 text-[30px] leading-tight text-white sm:text-[40px]">
                    Por que fazer psicoterapia
                    <br />
                    <em className="font-light italic text-[var(--iris-soft)]">na Viver Mais?</em>
                  </h3>
                  <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-white/70">
                    A psicoterapia é um ambiente seguro e sigiloso de escuta técnica para atravessar desafios
                    emocionais, ansiedade e momentos de transição. Nossos profissionais passam por rigoroso
                    processo de credenciamento e supervisão clínica contínua.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2.5">
                    <span className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold text-white/85">
                      Acessível · R$ 75,00
                    </span>
                    <span className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold text-white/85">
                      Particular · R$ 130,00
                    </span>
                    <span className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold text-white/85">
                      Supervisão clínica contínua
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <img
                    src="/psychologist_team.png"
                    alt="Equipe de psicólogos da Clínica Viver Mais"
                    className="arch-sm h-64 w-full border border-white/10 object-cover"
                  />
                </div>
              </div>
            </section>

            {/* Dúvidas frequentes */}
            <section>
              <div className="flex flex-col gap-4 border-t border-psi-darkest/15 pt-8 sm:flex-row sm:items-end sm:justify-between">
                <h3 className="display text-[30px] leading-tight text-psi-darkest sm:text-[40px]">
                  Dúvidas frequentes
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--ochre)]">
                  Antes de agendar
                </span>
              </div>

              <div className="mt-8">
                {faq.map((item) => (
                  <details key={item.q} className="group border-b border-psi-darkest/12">
                    <summary className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[var(--iris-mid)]">
                      <span className="display text-[17px] leading-snug text-psi-darkest sm:text-[19px]">
                        {item.q}
                      </span>
                      <Plus className="faq-plus h-4 w-4 shrink-0 text-[var(--iris-mid)] transition-transform duration-300" />
                    </summary>
                    <p className="max-w-2xl pb-6 text-[13px] leading-relaxed text-psi-darkest/65">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        )}

        {step === 'FORMULARIO' && selectedService && selectedModalidade && (
          <div className="rise mx-auto max-w-xl" style={{ animationDelay: '0ms' }}>
            <div className="arch border border-psi-darkest/12 bg-white/80 px-7 pb-9 pt-12 backdrop-blur-sm sm:px-10">
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--ochre)]">
                  Solicitação de consulta
                </span>
                <h3 className="display mt-3 text-[26px] leading-tight text-psi-darkest">
                  {precos[selectedService].titulo}
                </h3>
                {(() => {
                  const opcao = precos[selectedService].opcoes.find((o) => o.tipo === selectedModalidade);
                  return opcao ? (
                    <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-psi-darkest/15 bg-psi-soft/50 px-4 py-1.5 text-[11px] font-bold text-psi-darkest">
                      {opcao.label}
                      <span className="text-[var(--iris-mid)]">{opcao.preco}</span>
                    </p>
                  ) : null;
                })()}
                <p className="mt-3 text-[12px] text-psi-darkest/55">
                  Preencha os dados abaixo para concluir seu agendamento.
                </p>
              </div>

              <div className="my-8 h-px bg-psi-darkest/12" />

              <form onSubmit={handleSubmitPaciente} className="space-y-5">
                <div>
                  <label className="label">Nome completo *</label>
                  <input
                    type="text"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Como você se chama?"
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label">Telefone *</label>
                    <input
                      type="text"
                      required
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">Confirme o telefone *</label>
                    <input
                      type="text"
                      required
                      value={form.whatsappConfirmacao}
                      onChange={(e) => setForm({ ...form, whatsappConfirmacao: maskPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label">Idade *</label>
                    <input
                      type="number"
                      required
                      value={form.idade}
                      onChange={(e) => setForm({ ...form, idade: e.target.value })}
                      placeholder="Ex: 34"
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">E-mail *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="voce@email.com"
                      className="field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label">CPF *</label>
                    <input
                      type="text"
                      required
                      value={form.cpf}
                      onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">CEP *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={form.cep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        className="field"
                      />
                      {loadingCep && (
                        <span className="absolute right-3 top-3 animate-pulse text-[10px] font-bold text-[var(--iris-mid)]">
                          Buscando…
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {enderecoInfo.cidade && (
                  <div className="rise rounded-xl border border-psi-darkest/12 bg-psi-soft/50 p-3.5 text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold text-psi-darkest">
                      <MapPin className="h-3.5 w-3.5 text-[var(--iris-mid)]" /> Endereço localizado
                    </span>
                    <p className="mt-1 text-psi-darkest/70">
                      {enderecoInfo.logradouro ? `${enderecoInfo.logradouro}, ` : ''}
                      {enderecoInfo.bairro ? `${enderecoInfo.bairro} — ` : ''}
                      <span className="font-semibold text-psi-darkest">
                        {enderecoInfo.cidade}/{enderecoInfo.uf}
                      </span>
                    </p>
                  </div>
                )}

                <div>
                  <label className="label">Você é conveniado com alguma empresa parceira? *</label>
                  <div className="flex items-center gap-5 text-[13px] text-psi-darkest">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="possuiConvenio"
                        value="SIM"
                        checked={form.possuiConvenio === 'SIM'}
                        onChange={() => setForm({ ...form, possuiConvenio: 'SIM' })}
                        className="accent-[#5C397D]"
                      />
                      Sim
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="possuiConvenio"
                        value="NAO"
                        checked={form.possuiConvenio === 'NAO'}
                        onChange={() => setForm({ ...form, possuiConvenio: 'NAO', convenioSelecionado: '' })}
                        className="accent-[#5C397D]"
                      />
                      Não
                    </label>
                  </div>
                </div>

                {form.possuiConvenio === 'SIM' && (
                  <div className="rise">
                    <label className="label">Selecione seu convênio *</label>
                    <select
                      required
                      value={form.convenioSelecionado}
                      onChange={(e) => setForm({ ...form, convenioSelecionado: e.target.value })}
                      className="field"
                    >
                      <option value="">Selecione seu convênio</option>
                      {conveniosDisponiveis.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Como ficou sabendo da clínica? *</label>
                  <select
                    value={form.origem}
                    onChange={(e) => setForm({ ...form, origem: e.target.value })}
                    className="field"
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

                <div>
                  <label className="label">Períodos de preferência *</label>
                  <div className="flex items-center gap-5 text-[13px] text-psi-darkest">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="turno"
                        value="VESPERTINO"
                        checked={form.turno === 'VESPERTINO'}
                        onChange={() => setForm({ ...form, turno: 'VESPERTINO' })}
                        className="accent-[#5C397D]"
                      />
                      Vespertino (tarde)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="turno"
                        value="NOTURNO"
                        checked={form.turno === 'NOTURNO'}
                        onChange={() => setForm({ ...form, turno: 'NOTURNO' })}
                        className="accent-[#5C397D]"
                      />
                      Noturno (noite)
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-psi-darkest py-4 text-[12px] font-bold text-[#f4efe9] transition-all hover:bg-[var(--iris-mid)] active:scale-[0.98] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? 'Enviando…' : 'Finalizar agendamento'}
                </button>

                <button
                  type="button"
                  onClick={goHome}
                  className="w-full text-[11px] font-semibold text-psi-darkest/50 transition-colors hover:text-psi-darkest"
                >
                  ← Voltar aos serviços
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'CADASTRO_PSICOLOGO' && (
          <div className="rise mx-auto max-w-xl">
            <div className="arch border border-psi-darkest/12 bg-white/80 px-7 pb-9 pt-12 backdrop-blur-sm sm:px-10">
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--ochre)]">
                  Credenciamento clínico
                </span>
                <h3 className="display mt-3 text-[26px] leading-tight text-psi-darkest">
                  Atenda na Clínica Viver Mais
                </h3>
                <p className="mt-2 text-[12px] text-psi-darkest/55">
                  Preencha seus dados profissionais para iniciar a verificação.
                </p>
              </div>

              <div className="my-8 h-px bg-psi-darkest/12" />

              <form onSubmit={handleSubmitPsicologo} className="space-y-5">
                <div>
                  <label className="label">Nome completo *</label>
                  <input
                    type="text"
                    required
                    value={formPsicologo.nomeCompleto}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeCompleto: e.target.value })}
                    placeholder="Seu nome completo"
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label">Registro CRP *</label>
                    <input
                      type="text"
                      required
                      value={formPsicologo.crp}
                      onChange={(e) => setFormPsicologo({ ...formPsicologo, crp: e.target.value })}
                      placeholder="Ex: CRP 07/12345"
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp com DDD *</label>
                    <input
                      type="text"
                      required
                      value={formPsicologo.whatsapp}
                      onChange={(e) => setFormPsicologo({ ...formPsicologo, whatsapp: e.target.value })}
                      placeholder="(51) 99999-9999"
                      className="field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label">E-mail profissional *</label>
                    <input
                      type="email"
                      required
                      value={formPsicologo.email}
                      onChange={(e) => setFormPsicologo({ ...formPsicologo, email: e.target.value })}
                      placeholder="seuemail@exemplo.com"
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">Cidade / Estado *</label>
                    <input
                      type="text"
                      required
                      value={formPsicologo.cidadeUf}
                      onChange={(e) => setFormPsicologo({ ...formPsicologo, cidadeUf: e.target.value })}
                      placeholder="Ex: Porto Alegre/RS"
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Abordagem / especialidade principal *</label>
                  <select
                    value={formPsicologo.especialidade}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, especialidade: e.target.value })}
                    className="field"
                  >
                    <option value="Cognitivo-Comportamental (TCC)">Terapia Cognitivo-Comportamental (TCC)</option>
                    <option value="Psicanálise">Psicanálise</option>
                    <option value="Humanista / Gestalt">Humanista / Gestalt-terapia</option>
                    <option value="Avaliação Psicológica / Neuropsicologia">Avaliação Psicológica / Neuropsicologia</option>
                    <option value="Orientação Parental e Carreira">Orientação Parental e Carreira</option>
                  </select>
                </div>

                <div>
                  <label className="label">Modalidade de interesse *</label>
                  <div className="flex flex-wrap items-center gap-5 text-[13px] text-psi-darkest">
                    {(['ONLINE', 'PRESENCIAL', 'AMBOS'] as const).map((mod) => (
                      <label key={mod} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="modalidadeAtendimento"
                          value={mod}
                          checked={formPsicologo.modalidadeAtendimento === mod}
                          onChange={() => setFormPsicologo({ ...formPsicologo, modalidadeAtendimento: mod })}
                          className="accent-[#5C397D]"
                        />
                        {mod === 'ONLINE' ? 'Online' : mod === 'PRESENCIAL' ? 'Presencial' : 'Ambos'}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Breve apresentação clínica</label>
                  <textarea
                    rows={3}
                    value={formPsicologo.minibio}
                    onChange={(e) => setFormPsicologo({ ...formPsicologo, minibio: e.target.value })}
                    placeholder="Conte um pouco sobre sua trajetória clínica e área de atuação…"
                    className="field resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-psi-darkest py-4 text-[12px] font-bold text-[#f4efe9] transition-all hover:bg-[var(--iris-mid)] active:scale-[0.98] disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {isSubmitting ? 'Enviando…' : 'Enviar cadastro de psicólogo'}
                </button>

                <button
                  type="button"
                  onClick={goHome}
                  className="w-full text-[11px] font-semibold text-psi-darkest/50 transition-colors hover:text-psi-darkest"
                >
                  ← Voltar ao início
                </button>
              </form>
            </div>
          </div>
        )}

        {(step === 'SUCESSO' || step === 'SUCESSO_PSICOLOGO') && (
          <div className="rise mx-auto max-w-md text-center">
            <div className="arch border border-psi-darkest/12 bg-white/80 px-8 pb-10 pt-14 backdrop-blur-sm">
              <span className="arch-sm mx-auto flex h-14 w-12 items-end justify-center bg-psi-darkest pb-3">
                <Check className="h-5 w-5 text-[#f4efe9]" />
              </span>

              <h3 className="display mt-7 text-[30px] leading-tight text-psi-darkest">
                {step === 'SUCESSO' ? 'Solicitação recebida' : 'Cadastro enviado'}
              </h3>

              <p className="mx-auto mt-4 max-w-sm text-[13px] leading-relaxed text-psi-darkest/65">
                {step === 'SUCESSO'
                  ? 'Nossos psicoterapeutas entrarão em contato direto no seu WhatsApp em até 24 horas para combinar o melhor dia e horário para a sua sessão.'
                  : 'Seu acesso está sendo conferido. Entraremos em contato assim que a verificação do seu registro for concluída.'}
              </p>

              {step === 'SUCESSO' && (
                <div className="mt-7 rounded-xl border border-psi-darkest/12 bg-psi-soft/50 px-4 py-3.5">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-psi-darkest/50">
                    Protocolo da solicitação
                  </span>
                  <span className="mt-1 block font-mono text-sm font-bold text-psi-darkest">{protocolo}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  goHome();
                  setSelectedService(null);
                  setSelectedModalidade(null);
                }}
                className="mt-8 rounded-full bg-psi-darkest px-7 py-3.5 text-[11px] font-bold text-[#f4efe9] transition-all hover:bg-[var(--iris-mid)] active:scale-[0.97]"
              >
                Voltar ao início
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ————— Rodapé ————— */}
      <footer className="relative z-10 border-t border-psi-darkest/12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-3">
          <div>
            <span className="display block text-[22px] text-psi-darkest">Viver Mais</span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.28em] text-psi-darkest/45">
              Psicologia
            </span>
            <p className="mt-4 max-w-[16rem] text-[12px] leading-relaxed text-psi-darkest/55">
              Cuidado psicológico acessível, ético e humano — on-line ou presencial.
            </p>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-psi-darkest/40">Serviços</span>
            <ul className="mt-4 space-y-2">
              {Object.entries(precos).map(([key, service]) => (
                <li key={key}>
                  <a
                    href={`#detalhes-${key}`}
                    onClick={() => setStep('SERVICOS')}
                    className="text-[12px] text-psi-darkest/70 transition-colors hover:text-[var(--iris-mid)]"
                  >
                    {service.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-psi-darkest/40">Para psicólogos</span>
            <button
              type="button"
              onClick={() => { setStep('CADASTRO_PSICOLOGO'); scrollToMain(); }}
              className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-psi-darkest/70 transition-colors hover:text-[var(--iris-mid)]"
            >
              Quero me credenciar <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <p className="mt-5 flex items-center gap-1.5 text-[11px] text-psi-darkest/50">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sigilo CFP &amp; LGPD
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-8">
          <div className="rule" />
          <p className="mt-5 text-[10px] uppercase tracking-[0.16em] text-psi-darkest/35">
            © {new Date().getFullYear()} Viver Mais Psicologia — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
