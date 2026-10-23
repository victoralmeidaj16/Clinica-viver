# Extração da plataforma educacional

**Data:** 23 de outubro de 2026

## Objetivo

Retirar da aplicação Clínica Viver Mais as funcionalidades acadêmicas e de certificados de cursos, transferindo-as para um produto independente chamado **Viver Mais Educacional**. A extração deve preservar a aparência, o comportamento, os dados e os endereços públicos atuais, sem redesenhar a experiência ou adicionar funcionalidades.

Ao final, cada produto terá código, deploy, banco, usuários administrativos e sessões próprios. A única convivência operacional será o uso inicial da mesma instância MySQL física e o encaminhamento explícito das rotas acadêmicas pelo domínio da clínica.

## Decisões aprovadas

- O novo projeto ficará em uma pasta irmã de `Clinica Viver Mais`, com o nome `Viver Mais Educacional`.
- O repositório Git, o `package.json`, o histórico e o projeto de deploy serão independentes.
- A aplicação educacional terá o banco lógico `viver_mais_educacional` e um usuário MySQL exclusivo.
- O banco educacional ficará inicialmente na mesma instância MySQL da clínica, sem permissão para ler ou gravar tabelas clínicas.
- Gestores acadêmicos terão contas próprias; credenciais e sessões de gestores da clínica não serão reutilizadas.
- Alunos continuarão com contas e sessões acadêmicas próprias.
- A primeira entrega será uma extração funcional, sem redesign.
- A migração será gradual, com operação paralela, virada controlada e possibilidade de rollback.
- As tabelas acadêmicas antigas permanecerão somente leitura por 30 dias depois da virada e só serão removidas em uma alteração posterior, explicitamente aprovada.

## Arquitetura de destino

### Clínica Viver Mais

Permanece responsável por:

- prontuários, pacientes, agenda, financeiro e comunicação clínica;
- cadastro dos psicólogos, incluindo pós-graduação cursada;
- gestão das turmas que participam da clínica-escola;
- declarações de horas clínicas;
- certificado digital ICP-Brasil e emissão de NFS-e;
- autenticação e autorização de gestores e psicólogos da clínica.

A aplicação clínica não acessará o banco educacional depois da virada. Ela manterá apenas redirecionamentos e encaminhamentos HTTP de compatibilidade.

### Viver Mais Educacional

Será responsável por:

- autenticação e administração dos gestores acadêmicos;
- autenticação, conta e troca de senha dos alunos;
- cadastro de alunos;
- catálogo de cursos de pós-graduação e cursos online;
- módulos, aulas Vimeo e progresso;
- matrículas;
- geração automática de certificados por conclusão;
- emissão manual, upload e administração de certificados;
- modelos, PDF, QR Code e validação pública de certificados de cursos.

O domínio acadêmico e as regras de certificados deixarão de ser exportados pelo pacote clínico depois que os consumidores forem transferidos.

## Repositórios e deploy

A estrutura desejada é:

```text
Downloads/
├── Clinica Viver Mais/
└── Viver Mais Educacional/
```

O novo repositório será uma aplicação Next.js independente, construída e publicada sem reconstruir a aplicação clínica. Ele receberá inicialmente cópias dos módulos existentes; a remoção das origens ocorrerá somente depois da validação da nova aplicação.

O domínio público continuará sendo o da clínica. A aplicação de entrada encaminhará somente os prefixos acadêmicos conhecidos ao deploy educacional:

- `/aluno` e `/aluno/:path*`;
- `/academico` e `/academico/:path*`;
- `/api/academico/:path*`;
- `/api/certificados/:path*`;
- `/api/public/certificados/:path*`;
- `/validar-certificado` e `/validar-certificado/:path*`;
- o alias `/validarcertificados`;
- um prefixo exclusivo para assets estáticos da aplicação educacional.

Não será criado rewrite global de `/:path*`. Como os dois projetos usam Next.js, o educacional terá um prefixo de assets exclusivo para que seu conteúdo estático não colida com `/_next` da clínica. A rota antiga `/gestao/academico` redirecionará para `/academico`; as rotas de `painel-certificados` redirecionarão para a seção equivalente da gestão acadêmica.

O endereço impresso em certificados antigos, `vivermaispsicologia.com.br/validarcertificados`, continuará funcionando permanentemente. Certificados antigos e novos manterão validação por código e QR Code.

## Bancos, permissões e identidade

### Isolamento

Serão usados dois bancos lógicos na mesma instância:

```text
<banco clínico atual>
viver_mais_educacional
```

Cada aplicação receberá uma credencial MySQL diferente. A credencial educacional terá privilégios somente sobre `viver_mais_educacional`; um teste operacional deve comprovar que ela não consegue consultar tabelas clínicas.

O banco educacional terá uma representação local da instituição para preservar o isolamento e as chaves referenciais. O identificador institucional atual será mantido na cópia para preservar o vínculo dos registros. Não haverá chave estrangeira atravessando bancos.

### Gestores

Uma tabela própria armazenará gestores acadêmicos, com pelo menos identificador, nome, e-mail normalizado, hash de senha, papel, status e datas de criação e alteração de senha. Não haverá senha padrão no código. O primeiro gestor será criado por um comando administrativo seguro que recebe a senha fora dos argumentos registrados no histórico do shell.

As sessões de gestor e aluno usarão cookies diferentes entre si e diferentes do cookie clínico. Todos serão `HttpOnly`, `Secure` em produção e terão validação de expiração e revogação por alteração de senha.

### Dados acadêmicos

A migração copiará, preservando identificadores e datas, os dados correspondentes a:

- instituições usadas pelo domínio acadêmico;
- alunos;
- cursos de pós-graduação e cursos online;
- módulos e aulas;
- matrículas;
- progresso de aulas;
- certificados;
- modelos de certificados.

Para reduzir o risco da primeira extração, os nomes e formatos atuais das tabelas acadêmicas serão preservados no novo banco. Renomeá-las para remover o prefixo `clinica_` será uma refatoração posterior, sem valor funcional para esta migração.

Dados clínicos, cadastros de pacientes, prontuários, agenda, cobranças e credenciais da clínica não serão copiados.

## Fronteira de código

### Conteúdo transferido

O novo repositório receberá os equivalentes de:

- `apps/web/src/app/aluno/**`;
- `apps/web/src/app/api/academico/**`;
- `apps/web/src/app/gestao/academico/**`;
- `apps/web/src/components/academic/**`;
- `apps/web/src/server/academic/**`;
- páginas, componentes, APIs e persistência de certificados educacionais;
- `packages/core/src/academic/**`;
- `packages/core/src/certificados/**`;
- migrations acadêmicas e de certificados necessárias para montar um banco educacional vazio;
- testes unitários, de rota e de interface associados.

Os imports de infraestrutura hoje acoplados à clínica, como pool MySQL, mapeadores, respostas HTTP, autenticação de gestão e proxy de backend, ganharão implementações locais no novo projeto. O novo repositório não dependerá de `@thats-life/core` nem importará arquivos por caminho relativo do repositório clínico.

### Conteúdo preservado na clínica

Arquivos fiscais com `certificado` no nome não pertencem ao domínio educacional. Permanecem na clínica:

- geração, leitura e validação do certificado ICP-Brasil;
- assinatura XML e emissão de NFS-e;
- declarações de horas e documentos psicológicos;
- regras de atendimento vinculadas à pós-graduação do psicólogo;
- fechamento de turmas da clínica-escola.

`certificateAssets.ts` é usado tanto por PDFs educacionais quanto pelo comprovante clínico do termo de adesão. Antes da remoção, a dependência será dividida: o projeto educacional receberá os recursos necessários aos certificados e a clínica manterá um helper neutro para seus próprios documentos.

## Comportamento preservado

O fluxo funcional continuará sendo:

1. O gestor cadastra aluno, curso, módulos e aulas.
2. O gestor matricula o aluno.
3. O aluno acessa as aulas autorizadas e registra conclusões.
4. O servidor calcula o progresso usando somente aulas publicadas.
5. Ao atingir 100%, o servidor cria ou recupera idempotentemente o certificado do aluno e curso.
6. O aluno consulta e baixa o PDF.
7. Qualquer pessoa com o código ou QR Code consulta a autenticidade pela rota pública.

A emissão automática continuará usando dados autoritativos do servidor. Nome, curso, carga horária, professor, modelo e elegibilidade não serão aceitos do navegador como fonte de verdade.

Os quatro cursos online que possuem professor, duração oficial e texto especial manterão exatamente suas configurações atuais. Os demais cursos preservarão o modelo padrão. Certificados já emitidos conservarão os dados copiados no momento da emissão, mesmo que o curso seja alterado depois.

## Estratégia de migração

### Preparação

1. Criar o repositório e o projeto de deploy educacional.
2. Criar o banco, o usuário MySQL restrito e as migrations independentes.
3. Copiar os módulos e adaptar somente as fronteiras necessárias.
4. Criar o primeiro gestor acadêmico por comando seguro.
5. Publicar o sistema em uma origem técnica temporária, ainda sem tráfego público.

### Cópia e validação

1. Fazer backup verificável do banco clínico.
2. Executar uma cópia inicial dos dados acadêmicos com preservação de IDs.
3. Reconciliar contagens, chaves, códigos e campos relevantes.
4. Testar jornadas de aluno, gestor, conclusão e certificado.
5. Comparar conteúdo e renderização dos PDFs entre a aplicação antiga e a nova.

### Virada

1. Abrir uma janela curta de manutenção apenas para as áreas acadêmicas.
2. Bloquear novas gravações acadêmicas na aplicação antiga.
3. Copiar e reconciliar o delta final.
4. Habilitar os encaminhamentos específicos para o novo deploy.
5. Executar testes de fumaça em produção.
6. Encerrar a manutenção acadêmica.

A clínica, sua agenda, seus prontuários e seu financeiro não entram em manutenção durante essa virada.

### Retenção e remoção

As tabelas acadêmicas do banco antigo permanecerão intactas e somente leitura por 30 dias. Durante esse período, a aplicação clínica não poderá gravá-las. A exclusão dessas tabelas e dos últimos arquivos de compatibilidade será uma atividade posterior, com backup e aprovação específicos.

## Rollback

Antes da virada será ensaiado um rollback. Se a nova aplicação apresentar falha material:

1. suspender novamente gravações acadêmicas;
2. reconciliar qualquer escrita feita no novo banco durante a janela;
3. restaurar os encaminhamentos para a aplicação antiga;
4. reabilitar as gravações antigas somente depois da reconciliação.

O rollback não dependerá de recriar tabelas, pois o banco antigo será preservado. A estratégia não usará dual-write permanente; isso aumentaria o risco de divergência sem necessidade para esta migração.

## Tratamento de falhas

- Falha de conexão com o banco educacional deve produzir erro de serviço; em produção não haverá fallback para memória nem para o banco clínico.
- A validação pública indisponível deve informar “serviço temporariamente indisponível”, nunca classificar o certificado como inválido por causa de falha técnica.
- Código inexistente, certificado revogado e indisponibilidade técnica continuarão sendo estados distintos.
- Conclusão repetida e emissão concorrente continuarão idempotentes.
- Falha na emissão do certificado não apagará a conclusão da aula; a emissão poderá ser retomada com segurança.
- APIs protegidas derivarão o aluno ou gestor da sessão, sem aceitar identificadores de autoridade enviados pelo cliente.
- Logs não conterão senhas, hashes, CPF completo, cookies ou dados clínicos.

## Testes e critérios de aceitação

### Dados

- Contagens por tabela conferem entre origem e destino no momento da virada.
- IDs de aluno, curso, aula, matrícula, certificado e modelo são preservados.
- Não existem matrículas, progressos ou certificados órfãos.
- Códigos de certificados permanecem únicos.
- Imagens, textos, datas, professores, cargas horárias e status são preservados.

### Jornadas

- O aluno entra, troca senha quando exigido, lista cursos, assiste aula, conclui conteúdo e consulta certificados.
- O gestor entra com a nova conta e administra alunos, cursos, módulos, aulas, matrículas e certificados.
- A conclusão integral cria somente um certificado por aluno e curso.
- O aluno não acessa dados de outro aluno.
- Gestores e alunos não conseguem usar as sessões uns dos outros.

### Compatibilidade

- `/aluno` mantém aparência e comportamento atuais.
- `/gestao/academico` chega à nova gestão acadêmica.
- Rotas antigas do painel de certificados chegam ao destino equivalente.
- `vivermaispsicologia.com.br/validarcertificados` valida certificados antigos e novos.
- QR Codes e links já impressos continuam válidos.
- PDFs antigos e novos preservam conteúdo e layout, tolerando apenas metadados técnicos não visíveis que variem entre gerações.
- Assets da aplicação educacional não colidem com os assets da clínica.

### Isolamento e regressão

- A credencial MySQL educacional é recusada ao tentar acessar tabelas clínicas.
- A aplicação educacional não contém imports do repositório clínico.
- Lint, typecheck, testes e build passam nos dois repositórios.
- Um banco educacional vazio pode ser criado somente com as migrations do novo repositório.
- Um banco clínico vazio pode ser criado depois da retirada das migrations acadêmicas, sem dependências quebradas.
- O deploy clínico continua partindo da raiz do monorepo e não ganha rewrite global.
- O rollback é testado antes da alteração pública de rotas.

## Critério de conclusão

A extração estará concluída quando alunos e gestores executarem no novo projeto todas as jornadas existentes, o novo banco for a única fonte de verdade acadêmica, certificados antigos e novos permanecerem acessíveis pelos endereços aprovados, a clínica não depender de código ou dados educacionais e os dois produtos puderem ser construídos e publicados de forma independente.

## Fora de escopo

- Redesign da área do aluno ou da gestão;
- novas funcionalidades de curso, prova, nota, frequência ou pagamento;
- login único entre clínica e educação;
- reutilização das contas dos gestores clínicos;
- mudança do domínio público aprovado;
- mudança do provedor de vídeo;
- renomeação das tabelas acadêmicas durante a primeira extração;
- transferência imediata do banco para outra instância MySQL;
- remoção das tabelas antigas antes do período de retenção e de nova aprovação.
