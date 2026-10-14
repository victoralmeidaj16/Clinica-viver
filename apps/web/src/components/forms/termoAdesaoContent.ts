export interface TermoClause {
  numero: string;
  titulo: string;
  paragrafos: string[];
}

export const TERMO_ADESAO_TITULO = 'Termo de Adesão e Condições de Uso';
export const VERSAO_TERMO_ADESAO = '2026.2';

export const TERMO_ADESAO_IDENTIFICACAO = [
  'INSTITUIÇÃO: VIVER MAIS PSICOLOGIA (VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS E CIA LTDA), pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 19.440.737/0001-53, com registro junto ao Conselho Regional de Psicologia sob o nº CRP 12/0598PJ, doravante denominada VIVER MAIS PSICOLOGIA ou INSTITUIÇÃO.',
  'PROFISSIONAL / USUÁRIO(A): Psicólogo(a) devidamente inscrito(a) e ativo(a) no Conselho Regional de Psicologia (CRP), regularmente matriculado(a) em curso de Formação e/ou Pós-Graduação da Viver Mais Psicologia e cadastrado(a) no Ambiente do Profissional da Plataforma Digital Viver Mais Psicologia.',
  'O presente instrumento estabelece os termos e condições aplicáveis à adesão ao Projeto da Clínica de Atendimento Psicológico e à utilização do novo sistema da Plataforma Digital Viver Mais Psicologia, com validação exclusivamente eletrônica.',
];

export const TERMO_ADESAO_CLAUSULAS: TermoClause[] = [
  {
    numero: '01',
    titulo: 'Do objeto e escopo da plataforma digital',
    paragrafos: [
      '1.1. O presente Termo tem por objetivo regulamentar a adesão e participação voluntária do(a) PSICÓLOGO(A) no Projeto da Clínica de Atendimento Psicológico Viver Mais Psicologia, bem como disciplinar o acesso e uso da nova Plataforma Digital Viver Mais Psicologia (Ambiente do Profissional).',
      '1.2. A utilização do Ambiente do Profissional destina-se à gestão simplificada e organizada da rotina clínica, abrangendo funcionalidades para visualização de carteira de pacientes, acompanhamento e atualização de atendimentos, gestão de agenda, registros clínicos eletrônicos e acompanhamento de movimentações operacionais e financeiras em tempo real disponibilizados pela plataforma.',
      '1.3. Os atendimentos realizados no âmbito da Clínica Viver Mais Psicologia gerarão créditos educacionais, destinados prioritariamente ao abatimento e auxílio no pagamento de valores vinculados aos cursos de Formação e/ou Pós-Graduação fornecidos pela Viver Mais Psicologia, podendo',
      '1.3.1. Caso o(a) psicólogo(a) não possua valores pendentes vinculados aos cursos de Formação e/ou Pós-Graduação, os créditos educacionais poderão ser utilizados em outros serviços oferecidos pela Viver Mais Psicologia, tais como cursos livres, acesso à plataforma de streaming ou outros serviços fornecidos pela instituição, mediante autorização e conforme regras internas.',
      '1.4. As horas de atendimento clínico efetivamente prestadas poderão ser validadas como horas de experiência prática para os cursos da instituição, mediante emissão de declaração oficial da coordenação.',
    ],
  },
  {
    numero: '02',
    titulo: 'Da natureza jurídica e autonomia profissional',
    paragrafos: [
      '2.1. A adesão a este Termo e o uso da Plataforma Digital não estabelecem vínculo empregatício, contratual de trabalho, societário ou associativo entre o(a) PSICÓLOGO(A) e a Viver Mais Psicologia.',
      '2.2. O(a) PSICÓLOGO(A) atua com total autonomia técnica e científica na condução dos processos psicoterapêuticos e avaliativos, inexistindo subordinação jurídica, controle de ponto ou obrigatoriedade de jornada fixa, devendo apenas observar as regras institucionais e o Código de Ética Profissional do Psicólogo.',
      '2.3. Os créditos educacionais gerados não possuem natureza de salário, remuneração, comissão ou contraprestação em dinheiro, sendo um benefício educativo estritamente vinculado à formação acadêmica.',
      '2.4. Para atuação na clínica, psicólogos(as) matriculados(as) nos cursos de Pós-Graduação em Avaliação Psicológica e Neuropsicológica que desejarem realizar atendimentos em psicoterapia deverão possuir experiência mínima de 2 anos em prática clínica ou curso de formação em uma abordagem específica para atuação clínica em psicoterapia.',
      '2.5. Na ausência dos requisitos indicados no item anterior, a coordenação poderá limitar a atuação do(a) psicólogo(a) a atividades compatíveis com o curso em que está matriculado(a).',
      '2.6. A aquisição, licença, manutenção e uso de testes, instrumentos, protocolos, materiais técnicos e sistemas de correção necessários serão de responsabilidade do(a) psicólogo(a).',
    ],
  },
  {
    numero: '03',
    titulo: 'Do fluxo operacional e prazos obrigatórios',
    paragrafos: [
      '3.1. Recebimento de Paciente e Primeiro Contato: Após o agendamento realizado pelo paciente no site da Viver Mais Psicologia, os dados do atendimento serão disponibilizados no Ambiente do Profissional e encaminhados via e-mail e/ou WhatsApp. O(a) PSICÓLOGO(A) deverá obrigatoriamente realizar o primeiro contato com o paciente em até 24 horas úteis após o agendamento (solicitações em finais de semana/feriados contam a partir do primeiro dia útil).',
      '3.1.1 Para fins de contagem do prazo de 24 (vinte e quatro) horas úteis, serão desconsiderados sábados, domingos e feriados (nacionais). Em solicitações realizadas em dias não úteis, a contagem do prazo iniciará a partir do primeiro minuto do primeiro dia útil subsequente.',
      '3.2. Em situações de descumprimento grave das normas da clínica, falta ética, violação de sigilo, recebimento direto de valores ou captação indevida de pacientes, a Viver Mais Psicologia poderá encerrar imediatamente a participação do(a) psicólogo(a) no projeto, independentemente de aviso prévio, garantindo a análise da situação pela coordenação e a adoção das providências necessárias para preservar os pacientes, a instituição e o funcionamento adequado da clínica.',
      '3.2.1 Penalidade por Atraso no Contato: Caso o contato não seja realizado no prazo de 24h úteis, o paciente será reencaminhado a outro profissional. O descumprimento injustificado do prazo de contato por mais de 2 (duas) vezes implicará o desligamento automático do(a) profissional da clínica.',
      '3.3. Acolhimento Inicial: No primeiro contato, o(a) PSICÓLOGO(A) deve se apresentar como profissional da Viver Mais Psicologia e em caso de não resposta, oferecer um bate-papo inicial de 10 a 15 minutos sem custo para explicar sua abordagem, alinhar expectativas, esclarecer horários e compreender a demanda do paciente.',
      '3.4. Duração das Sessões: As sessões devem respeitar rigorosamente a duração padrão:\na) Psicoterapia Individual, Orientação parental, profissional e vocacional: 50 minutos de duração;\nb) Psicoterapia de Casal, Família ou Grupo: 1 hora e 30 minutos (90 minutos) de duração;\nc) Avaliação Psicológica e Neuropsicológica: a duração estimada da sessão é variável conforme testes e manejo do profissional.',
      '3.5. Reunião de Integração: A participação na Reunião de Integração é pré-requisito obrigatório para o início e manutenção do perfil ativo no site. A ausência manterá o perfil suspenso.',
    ],
  },
  {
    numero: '04',
    titulo: 'Do atendimento de menores e manejo de crises',
    paragrafos: [
      '4.1. Atendimento de Crianças e Adolescentes: Exige obrigatoriamente contato prévio com ao menos um responsável legal antes da primeira sessão, além da obtenção da assinatura do Termo de Consentimento Livre e Esclarecido específico.',
      '4.2. Situações de Crise Grave e Emergência: Não é permitido o atendimento e manutenção na Clínica Viver Mais Psicologia de pacientes em situação de crise grave, ideação suicida ativa, risco de vida imediato ou surto psicótico. Identificada a situação, o(a) PSICÓLOGO(A) deve adotar imediatamente as medidas éticas de acolhimento e realizar o encaminhamento seguro para a rede de urgência e emergência (CVV 188, SAMU 192, CAPS ou Pronto Atendimento).',
    ],
  },
  {
    numero: '05',
    titulo: 'Tabela de honorários e convênios empresariais',
    paragrafos: [
      '5.1. Os valores estabelecidos para os atendimentos vinculados à Clínica Viver Mais Psicologia observam a seguinte tabela oficial:',
      '5.1.1. Regra de Desconto para Pagamento Unificado: O desconto de 10% (dez por cento) nos pacotes com 4 (quatro) ou mais atendimentos aplica-se exclusivamente mediante o pagamento unificado das sessões e desde que todas as sessões selecionadas pertençam ao mesmo mês vigente. Não é permitida a unificação ou o agrupamento de sessões de meses distintos para fins de concessão do referido desconto.',
      '5.2. Convênios Empresariais: A Viver Mais Psicologia possui parcerias com empresas (ex.: Cristalcopo, que custeia de 2 a 4 sessões mensais aos seus colaboradores). Nos agendamentos provenientes de convênios, aplica-se fixamente a tarifa da modalidade Acessível. Nos atendimentos vinculados a convênios e empresas parceiras, o faturamento e a emissão de documentos fiscais seguirão os procedimentos de faturamento consolidado da instituição.',
    ],
  },
  {
    numero: '06',
    titulo: 'Dos procedimentos financeiros e créditos educacionais',
    paragrafos: [
      '6.1. Divisão e Taxa Administrativa: Do valor bruto das sessões pagas pelos pacientes, 30% é destinado à taxa administrativa da clínica (manutenção de sistemas, marketing, equipe e captação de pacientes) e 70% é convertido em créditos educacionais em favor do(a) PSICÓLOGO(A). Todos os pagamentos realizados pelos pacientes deverão ocorrer exclusivamente pelos meios oficiais indicados pela Viver Mais Psicologia. A apuração e a disponibilização dos créditos educacionais ocorrerão de forma automatizada por meio do extrato financeiro no Ambiente do Profissional, com base no status dos atendimentos atualizados pelo(a) psicólogo(a).',
      '6.2. Lançamento: Os atendimentos realizados por meio da clínica gerarão créditos educacionais, que serão utilizados para auxiliar no pagamento de valores vinculados aos cursos de Formação e/ou Pós-Graduação da Viver Mais Psicologia.',
      'a) Nos planos de pagamento integral, os créditos educacionais serão aplicados como desconto no boleto com vencimento mais próximo, observada a data de lançamento dos créditos pela Viver Mais Psicologia.',
      'b) Nos planos de pagamento progressivos, parcelados, flexibilizados ou personalizados, os créditos educacionais serão aplicados prioritariamente para abatimento de valores residuais do plano de pagamento. Para fins deste Termo, consideram-se valores residuais as diferenças entre o valor integral da mensalidade do curso e o valor efetivamente pago nas parcelas reduzidas, conforme o plano de pagamento contratado pelo(a) psicólogo(a). Nesses casos, os créditos educacionais serão utilizados para reduzir o saldo residual existente e, quando aplicável, diminuir valores pendentes ao final do plano de pagamento, parcelas futuras ou outros valores vinculados ao curso, conforme cálculo interno da Viver Mais Psicologia.',
      '6.3. Outras finalidades: Caso o(a) psicólogo(a) não possua valores pendentes vinculados aos cursos de Formação e/ou Pós-Graduação, os créditos educacionais poderão ser utilizados em outros serviços oferecidos pela Viver Mais Psicologia, tais como cursos livres, acesso à plataforma de streaming ou outros serviços fornecidos pela instituição, mediante autorização e conforme regras internas.',
      '6.4. Formato do Crédito: Os créditos educacionais não são convertíveis em dinheiro, não possuem natureza salarial ou remuneratória e não poderão ser transferidos a terceiros sem autorização expressa da Viver Mais Psicologia.',
      '6.5. Validade Pós-Desligamento: Os créditos educacionais terão validade de 12 (doze) meses após o desligamento do(a) psicólogo(a) da clínica, salvo regra específica formalmente autorizada pela Viver Mais Psicologia.',
    ],
  },
  {
    numero: '07',
    titulo: 'Da atualização contínua da plataforma e suspensão de perfil',
    paragrafos: [
      '7.1. Gestão e Atualização em Tempo Real no Sistema: O(a) PSICÓLOGO(A) compromete-se a manter as informações da sua rotina clínica integralmente atualizadas em tempo real diretamente dentro da Plataforma Digital Viver Mais Psicologia (Ambiente do Profissional), inserindo e atualizando o status dos agendamentos, confirmações de atendimento, remarcações, pausas na agenda, desistências, evolução dos atendimentos e qualquer atualização necessária para o funcionamento legal dos processos administrativos da clínica.',
      '7.2. Responsabilidade pela Fidelidade dos Dados: O acompanhamento institucional dos casos e a apuração dos créditos educacionais serão realizados exclusivamente com base nas informações e no status dos atendimentos mantidos e atualizados pelo(a) próprio(a) profissional dentro do sistema da clínica.',
      '7.3. Suspensão por Desatualização ou Inatividade: A falta de atualização contínua do sistema, a desatualização das informações de atendimento ou a inatividade dos registros na plataforma por período superior a 30 (trinta) dias ensejará o fechamento e a suspensão automática do perfil do(a) profissional no site da clínica e no Ambiente do Profissional até a devida regularização.',
      '7.3.1 Exceção de Pausa Registrada: Não configurará inatividade a ausência de registros motivada por pausa de agenda, férias ou licenças previamente cadastradas e registradas pelo(a) próprio(a) profissional dentro da plataforma.',
    ],
  },
  {
    numero: '08',
    titulo: 'Da exclusividade, sigilo e proteção de dados (LGPD)',
    paragrafos: [
      '8.1. Vedação de Captação Externa: É expressamente proibido ao(à) PSICÓLOGO(A) captar, direcionar ou atender por fora da clínica pacientes cujos primeiros contatos tenham sido originados pelos canais, site ou redes sociais da Viver Mais Psicologia.',
      '8.2. Sigilo e LGPD: O(a) PSICÓLOGO(A) é integralmente responsável pelo sigilo dos prontuários e pelo tratamento seguro dos dados pessoais dos pacientes, em estrita conformidade com o Código de Ética Profissional e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
      '8.3. Caso a plataforma disponibilize recursos tecnológicos auxiliares de gestão ou apoio acadêmico (como ferramentas de auxílio em prontuários ou ambientes virtuais de supervisão), o tratamento dos dados observará rigorosamente os critérios de anonimização e sigilo previstos na legislação vigente.',
    ],
  },
  {
    numero: '09',
    titulo: 'Da vigência e permanência pós-conclusão',
    paragrafos: [
      '9.1. Desligamento Voluntário: Poderá ocorrer por qualquer das partes mediante comunicação prévia formal com antecedência mínima de 15 (quinze) dias.',
      '9.2. Permanência Pós-Curso: Após a conclusão do curso de Pós-Graduação, o(a) PSICÓLOGO(A) poderá manter seu perfil ativo por até 6 (seis) meses para finalização e encerramento ético dos casos em andamento, sendo vedado o recebimento de novos pacientes no período.',
    ],
  },
  {
    numero: '10',
    titulo: 'Do aceite eletrônico e da validade jurídica digital',
    paragrafos: [
      '10.1. Modalidade de Aceite Digital: As partes declaram e concordam expressamente que este Termo de Adesão e Uso é pactuado exclusivamente em ambiente digital, dispensando a necessidade de assinatura física em papel ou envio de documentos impressos.',
      '10.2. Validade Legal nos Termos da MP 2.200-2/2001 e Lei 14.063/2020: A concordância do(a) PSICÓLOGO(A) manifestada eletronicamente na Plataforma Viver Mais Psicologia — mediante o clique no botão « ✓ Li e Aceito os Termos » e após a confirmação do sistema (« ✓ Leitura completa confirmada ») — possui plena validade jurídica e eficácia executiva, constituindo meio idôneo de comprovação de autoria, integridade e consentimento, conforme o art. 10, §2º da Medida Provisória nº 2.200-2/2001 e do art. 5º da Lei Federal nº 14.063/2020.',
      '10.3. Rastreabilidade Eletrônica: O sistema do Ambiente do Profissional registrará de forma automatizada o IP de conexão, data, hora, conta de usuário, e-mail e número de inscrição no CRP, associando permanentemente o aceite eletrônico ao cadastro individual do(a) profissional.',
    ],
  },
  {
    numero: '11',
    titulo: 'Da disponibilidade da plataforma e limitação de responsabilidade',
    paragrafos: [
      '11.1. A VIVER MAIS PSICOLOGIA empenhará seus melhores esforços para manter a Plataforma Digital acessível de forma contínua. Contudo, não se responsabiliza por indisponibilidades temporárias decorrentes de falhas na rede mundial de computadores, manutenções técnicas necessárias, instabilidades de provedores terceiros ou eventos de caso fortuito e força maior.',
      '11.2. Eventuais instabilidades temporárias da plataforma não eximem o(a) PSICÓLOGO(A) de suas obrigações éticas de atendimento e contato com os pacientes previamente agendados.',
    ],
  },
  {
    numero: '12',
    titulo: 'Das alterações e atualizações do termo de uso',
    paragrafos: [
      '12.1. A VIVER MAIS PSICOLOGIA poderá, a qualquer tempo, alterar ou atualizar o presente Termo para adequação às evoluções tecnológicas da plataforma, alterações legislativas ou regulatórias do Conselho Federal de Psicologia (CFP).',
      '12.2. As alterações serão comunicadas ao(à) PSICÓLOGO(A) por meio da Plataforma Digital, ficando a continuidade do uso do sistema e do recebimento de pacientes condicionada à emissão de novo aceite eletrônico do termo atualizado.',
    ],
  },
  {
    numero: '13',
    titulo: 'Do foro de eleição',
    paragrafos: [
      '13.1. As partes elegem o Foro da Comarca da Sede da VIVER MAIS PSICOLOGIA (Estado de Santa Catarina) para dirimir quaisquer dúvidas, controvérsias ou litígios decorrentes do presente Termo de Adesão e Uso, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    ],
  },
];

export const TERMO_ADESAO_HONORARIOS = [
  { servico: 'Psicoterapia Individual (50 min)', particular: 'R$ 130,00', social: 'R$ 75,00' },
  { servico: 'Orientação Profissional/Vocacional / Parental (50 min)', particular: 'R$ 130,00', social: 'R$ 75,00' },
  { servico: 'Psicoterapia de Casal / Família (1h30min)', particular: 'R$ 260,00', social: 'R$ 150,00' },
  { servico: 'Avaliação Psicológica / Neuropsicológica', particular: 'R$ 150,00', social: 'R$ 100,00' },
];
