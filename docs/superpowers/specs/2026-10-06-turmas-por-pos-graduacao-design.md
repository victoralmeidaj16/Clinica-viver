# Turmas por pós-graduação

## Contexto

O painel de turmas identifica hoje uma turma apenas pelo código (`24A`, `25A`
etc.). Esse modelo mistura psicólogos de pós-graduações diferentes quando eles
compartilham o mesmo código e faz o encerramento retirar todos do rodízio e da
vitrine.

A gestão precisa tratar cada combinação de pós-graduação e código como uma
turma independente. Por exemplo, `Formação e Pós-graduação em Psicodrama · 25A`
não pode afetar outra formação que também use o código `25A`.

## Objetivos

- Identificar uma turma pela combinação `pós-graduação + código`.
- Mostrar somente combinações que possuam pelo menos um psicólogo aprovado.
- Encerrar ou reabrir apenas a combinação selecionada.
- Aplicar o encerramento de forma consistente no painel, na vitrine e no
  rodízio.
- Preservar os encerramentos existentes durante a migração do modelo atual.

## Fora do escopo

- Criar turmas manualmente sem psicólogos.
- Alterar o catálogo de pós-graduações ou os códigos permitidos no cadastro.
- Usar a segunda pós-graduação para compor uma turma. A turma acadêmica continua
  vinculada exclusivamente a `posGraduacaoViverMais` e `turmaViverMais`.
- Alterar pausas manuais, férias ou outros motivos que retiram um profissional do
  rodízio.

## Experiência da gestão

O painel usará uma lista agrupada por pós-graduação, em vez de uma grade de
cards. Cada grupo exibe o nome completo da formação e a quantidade de turmas.
Dentro dele, cada linha representa uma única combinação e contém:

- código da turma;
- quantidade de psicólogos aprovados;
- estado `Em curso` ou `Encerrada em DD/MM/AAAA`;
- ação `Encerrar turma` ou `Reabrir`.

Os grupos e suas linhas serão ordenados alfabeticamente pela pós-graduação e,
depois, pelo código. Em telas estreitas, a linha se reorganiza verticalmente,
mantendo contagem, estado e ação legíveis.

O diálogo de confirmação citará o nome completo da pós-graduação, o código e
quantos psicólogos sairão ou voltarão à vitrine e ao rodízio. Durante a requisição,
somente a ação daquela combinação ficará desabilitada.

Uma combinação aparece quando existe pelo menos um cadastro com estado
`APROVADO` e com ambos os campos acadêmicos preenchidos. Cadastros aprovados sem
pós-graduação ou sem código não formam uma turma acionável; o painel mostrará um
aviso resumido quando houver registros assim, para que a gestão corrija o
cadastro sem criar uma identidade acadêmica ambígua.

Turmas encerradas continuam visíveis enquanto conservarem ao menos um psicólogo
aprovado. Se a última pessoa deixar de ser aprovada ou mudar de combinação, o
registro de encerramento permanece persistido, mas deixa de aparecer no painel e
não afeta outras combinações.

## Identidade e normalização

O domínio passará a representar um encerramento com:

```ts
interface TurmaEncerrada {
  turma: string;
  posGraduacao: string;
  encerradaEm: string;
}
```

Uma função compartilhada construirá a chave composta usada por painel e
servidor. Os dois valores serão aparados antes da comparação. O código será
normalizado para maiúsculas; o nome da pós-graduação preservará o rótulo do
catálogo. A chave interna não será obtida por concatenação visual com um
separador; ela usará uma serialização inequívoca dos dois campos.

`segundaPosGraduacao` não participa da chave nem da contagem.

## API e validação

As operações de encerramento e reabertura receberão os dois campos:

```json
{
  "turma": "25A",
  "posGraduacao": "Formação e Pós-graduação em Psicodrama"
}
```

A API continuará exigindo acesso de gestão. Ela validará o código contra a lista
de turmas permitidas, a pós-graduação contra o catálogo do formulário e rejeitará
campos vazios. O servidor não confiará em uma chave composta enviada pelo
cliente; construirá a identidade a partir dos campos validados.

O `DELETE` usará `turma` e `posGraduacao` como parâmetros de busca. Respostas de
erro manterão o contrato atual `{ success: false, error }`.

## Persistência e migração

Uma nova migração acrescentará `pos_graduacao` à tabela
`clinica_turmas_encerradas` e substituirá a restrição única atual por:

```text
instituicao_id + organizacao_ref + pos_graduacao + turma
```

Para cada encerramento antigo, a migração criará uma linha para cada
`pos_graduacao_viver_mais` distinta que possua um psicólogo `APROVADO` com o
mesmo código, preservando `encerrada_em` e `encerrada_por`. Depois da expansão,
a linha antiga será removida. Se não houver combinação aprovada correspondente,
o encerramento antigo não produzirá uma nova linha, pois não existe turma que o
novo painel possa administrar ou que o rodízio possa utilizar.

A migração será idempotente e adequada tanto para uma instalação existente
quanto para um banco novo que execute todas as migrações em sequência.

O repositório MySQL passará a listar, encerrar e reabrir pelo par. O adaptador de
arquivo adotará um formato versionado com uma lista de registros contendo os
dois campos. Na leitura do roster, `comTurmasEncerradas` já recebe os cadastros e
usará os psicólogos aprovados para expandir cada chave antiga, composta apenas
pelo código, para as combinações correspondentes. Em seguida, pedirá ao
repositório de arquivo que grave atomicamente o formato novo. Assim, a migração
local segue a mesma regra da migração MySQL e não transforma o código antigo em
um curinga permanente para futuras formações.

## Aplicação no roster

Ao carregar cadastros, `comTurmasEncerradas` indexará os encerramentos pela
chave composta. Um psicólogo receberá `turmaEncerrada` somente quando
`turmaViverMais` e `posGraduacaoViverMais` coincidirem com a mesma linha
persistida.

O restante do fluxo permanecerá derivado: `desligadoPorTurma` remove o perfil do
rodízio e da vitrine sem alterar `pausadoNoRodizio`. Reabrir uma combinação
remove somente seu encerramento; pausas manuais e ausências continuam intactas.

## Compatibilidade e falhas

- A ausência da nova coluna/tabela continuará produzindo uma mensagem de
  migração pendente nas escritas e degradação segura nas leituras.
- Uma falha ao ler encerramentos não derrubará o roster; como hoje, profissionais
  permanecerão disponíveis até a persistência voltar a responder.
- Valores acadêmicos legados que não pertençam ao catálogo poderão aparecer no
  agrupamento para correção cadastral, mas não poderão gerar um novo encerramento
  pela API até serem normalizados.

## Testes e verificação

Os testes automatizados devem cobrir:

- agrupamento por pós-graduação e código;
- contagem exclusiva de psicólogos aprovados;
- exclusão de registros incompletos, em análise ou recusados;
- independência entre duas pós-graduações com o mesmo código;
- confirmação e estado ocupado da combinação correta;
- validação dos dois campos na API;
- operações MySQL e de arquivo pela chave composta;
- migração de um encerramento antigo para todas as combinações aprovadas
  correspondentes;
- efeito isolado no rodízio e na vitrine;
- preservação de pausa manual e ausência de agenda.

Ao final, devem ser executados os testes direcionados, a suíte relevante, o
lint e o build da aplicação web. A interface deve ser conferida em larguras de
desktop e celular, incluindo nomes longos, estado encerrado e múltiplas turmas
no mesmo grupo.

## Critérios de aceitação

1. `Psicodrama · 25A` e outra pós `25A` aparecem e são administradas como
   turmas distintas.
2. Encerrar uma delas retira somente seus psicólogos aprovados da vitrine e do
   rodízio.
3. Reabrir uma delas não altera a outra nem desfaz pausas por outros motivos.
4. O painel não cria combinações vazias e não conta cadastros que não estejam
   aprovados.
5. Encerramentos existentes mantêm seu efeito nas combinações aprovadas que
   estavam abrangidas pelo código antigo.
6. A lista agrupada permanece clara e acionável em desktop e celular.
