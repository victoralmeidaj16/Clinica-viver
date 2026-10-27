# Vitrine, públicos e regras das pós-graduações

**Data:** 23 de outubro de 2026

**Revisão de 27 de outubro de 2026:** Psicologia Perinatal e Parentalidade passou ao grupo restrito. O plano de 23 de outubro registra a regra anterior.

## Objetivo

Garantir que o credenciamento do psicólogo, a vitrine pública, a triagem, a escolha direta de profissional, o rodízio e o agendamento interno usem as mesmas regras de serviço, público e duração. A vitrine preserva seus rótulos simples para o paciente, mas a compatibilidade deve ser calculada a partir da tabela oficial das pós-graduações.

## Fonte de verdade das pós-graduações

### Grupo amplo

Cursos:

- Programa de Estudos e Pós-graduação em Psicanálise;
- Formação e Pós-graduação em Psicodrama;
- Formação e Pós-graduação em Psicologia Existencialista Clínica;
- Formação e Pós-graduação em Psicologia Junguiana Clínica;
- Pós-graduação em Psicoterapia da Sexualidade;
- Formação e Pós-graduação em Terapia Cognitivo-Comportamental;
- Pós-graduação em Terapias Cognitivo-Comportamentais de Terceira Geração;
- Formação e Pós-graduação em Terapia Familiar Sistêmica;
- Formação e Pós-graduação em Psicodrama Didata e Psicoterapeuta do Aluno - Nível II;
- Formação e Pós-graduação em Psicodrama Didata Orientador e Supervisor - Nível III.

Regras:

- serviços: Atendimento Psicológico, Orientação Vocacional e Profissional, Orientação Parental, Orientação Vocacional e Orientação Profissional;
- tempos cadastráveis: 50 e 90 minutos;
- públicos: Criança, Adolescente, Homens, Idoso, Casais, Família, Mulheres, Grupo e Outro.

### Grupo restrito

Cursos:

- Pós-graduação em Psicologia Perinatal e Parentalidade;
- Pós-graduação em Psicoterapia de Casal e Família;
- Pós-graduação em Psicoterapia Infantil e de Adolescentes.

Regras:

- serviços: Atendimento Psicológico, Orientação Parental e Orientação Vocacional e Profissional;
- tempos cadastráveis: 50 e 90 minutos;
- públicos: Criança, Adolescente, Homens, Idoso, Casais, Família, Mulheres, Grupo e Outro.

### Avaliação psicológica e neuropsicologia

Cursos:

- Pós-graduação em Avaliação Psicológica;
- Pós-graduação em Neuropsicologia Clínica.

Regras:

- serviço: somente Avaliação Psicológica;
- tempos cadastráveis: 50 e 90 minutos;
- públicos: Adolescente, Criança, Idoso, Homens e Mulheres.

No agendamento interno de uma avaliação, o psicólogo também pode definir manualmente uma duração entre 15 e 240 minutos. Essa possibilidade não é uma opção de duração do paciente e não altera os tempos cadastráveis da pós.

## Vocabulário público da vitrine

A experiência do paciente mantém os rótulos atuais. A aplicação deve convertê-los centralmente para os públicos declarados pelos profissionais:

| Rótulo da vitrine | Públicos profissionais compatíveis |
| --- | --- |
| Individual | Homens, Mulheres ou Idoso |
| Infantil | Criança |
| Adolescente | Adolescente |
| Casal | Casais |
| Família | Família |
| Outro | Outro |

A conversão deve tolerar singular, plural, acentos e registros legados equivalentes. Ela será a única regra usada tanto pela recomendação automática quanto pela escolha direta de psicólogo. Comparações independentes por substring na interface não podem decidir compatibilidade.

`Individual` representa qualquer um dos três públicos adultos aprovados: Homens, Mulheres ou Idoso. A vitrine não pedirá gênero ou faixa etária adicional para esse rótulo.

## Opções da vitrine por serviço

O público nunca deve poder selecionar uma combinação que a API recusará:

- Avaliação Psicológica: Individual, Infantil ou Adolescente;
- Psicoterapia de Casal: Casal;
- Orientação Parental individual: Individual;
- Orientação Parental em família: Família;
- Atendimento Psicológico individual e Orientação Profissional/Vocacional: Individual, Infantil, Adolescente ou Outro.

O conjunto acima trata o formato do serviço separadamente do público profissional. A modalidade comercial — social/acessível ou particular — continua sendo definida pela opção de preço escolhida.

## Durações

Na vitrine, o paciente apenas vê a informação de duração do serviço; ele não escolhe a duração da sessão.

- Atendimento individual e orientação individual: 50 minutos;
- Casal e família: 90 minutos;
- Avaliação: duração definida pelo psicólogo depois do encaminhamento.

No ambiente interno do psicólogo, Avaliação Psicológica oferece os atalhos 50min e 1h30min e a ação “Definir outro tempo”. O campo manual só aparece ao psicólogo e aceita valores de 15 a 240 minutos em passos de 5 minutos.

## Arquitetura

### Regra compartilhada de públicos

O pacote `packages/core` deve fornecer funções puras para:

- normalizar um público profissional;
- resolver um rótulo da vitrine para um conjunto de públicos profissionais compatíveis;
- verificar se um perfil atende ao público solicitado;
- listar os rótulos permitidos na vitrine para cada combinação de serviço e modalidade comercial.

O motor de matching deve consumir essa regra. A aplicação web também deve usá-la ao filtrar o carrossel e construir as opções do formulário público.

### Validação no servidor

A API de triagem deve validar novamente a combinação de `servicoKey`, modalidade comercial e `paraQuemE`. Dados incompatíveis ou valores desconhecidos recebem erro de entrada e não são persistidos. A interface não é a fronteira de confiança.

Registros antigos com `Individual`, `Infantil`, singular/plural ou acentuação diferente continuam aceitos pelo matching por meio da normalização compartilhada. Não haverá migração destrutiva de dados.

### Fluxo completo

1. O paciente escolhe serviço e preço na vitrine.
2. A vitrine oferece somente os públicos válidos para essa escolha.
3. O paciente escolhe diretamente um psicólogo ou pede recomendação automática.
4. Ambos os caminhos usam a mesma função de compatibilidade por serviço, público, turno e demais critérios existentes.
5. A API valida a combinação antes de gravar a triagem.
6. O profissional recebe somente solicitações compatíveis com `servicosHabilitados` e `publicoAlvo`.
7. Depois do contato, o psicólogo agenda a sessão com as durações permitidas em seu ambiente interno.

## Tratamento de falhas

- Nenhum profissional compatível: a solicitação permanece pendente para a gestão, sem ignorar os filtros escolhidos.
- Público incompatível com o serviço: a interface impede a escolha e a API recusa requisições adulteradas.
- Perfil sem públicos cadastrados: preservar o comportamento legado atual apenas se explicitamente suportado pelo motor; o teste deve fixar essa decisão para evitar ampliação silenciosa da fila.
- Perfil sem serviços habilitados: não deve ser apresentado como compatível com qualquer serviço apenas por ausência de configuração.

## Testes e critérios de aceitação

- Cada curso retorna exatamente serviços, tempos e públicos definidos nesta especificação.
- Perinatal recebe as opções do grupo restrito, inclusive quando aparece como segunda pós sem curso do grupo amplo.
- Avaliação e Neuropsicologia retornam somente Avaliação Psicológica e os cinco públicos autorizados.
- `Infantil` encontra profissionais com público `Criança`.
- `Individual` encontra profissionais com `Homens`, `Mulheres` ou `Idoso`, mas não perfis exclusivos de Casais, Família ou Grupo.
- `Casal` encontra `Casais`; Adolescente e Família mantêm correspondência direta.
- A escolha direta e o rodízio devolvem o mesmo conjunto de profissionais para os mesmos critérios.
- A API recusa público incompatível com o serviço.
- A vitrine não apresenta controle de duração ao paciente.
- O agendamento interno de avaliação oferece 50min, 1h30min e duração manual de 15 a 240 minutos.
- Typecheck, testes direcionados, suíte web, suíte core e build de produção passam.
- O deploy continua sendo feito pela raiz do monorepo e não cria rewrite global de `/:path*`.

## Fora de escopo

- Alterar preços dos serviços;
- pedir idade ou gênero ao paciente na etapa pública;
- migrar registros históricos somente para trocar rótulos;
- criar um serviço público específico para grupos;
- alterar o fluxo de cobrança ou o SLA de contato pelo WhatsApp.
