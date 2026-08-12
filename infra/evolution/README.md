# Evolution API — canal de WhatsApp da clínica

Implementa a seção 6 de `docs/clinica-plano-implantacao.md`. Aqui está só a
operação; a decisão e os riscos estão no plano.

Versão fixada: `evoapicloud/evolution-api:v2.3.7`. A imagem oficial mudou de
`atendai/` para `evoapicloud/` a partir da v2.3.0 — receitas antigas na internet
ainda apontam para o repositório velho. Não trocar para `latest`: uma
atualização silenciosa aqui derruba a sessão pareada.

---

## 1. Subir

```sh
cd infra/evolution
cp env.example .env

# Segredos
openssl rand -hex 32                 # AUTHENTICATION_API_KEY
openssl rand -base64 24              # POSTGRES_PASSWORD
openssl rand -hex 32                 # token do webhook (seção 3)
```

Preencher no `.env`:

- `AUTHENTICATION_API_KEY` com o primeiro valor gerado;
- `POSTGRES_PASSWORD` com o segundo;
- a mesma senha dentro de `DATABASE_CONNECTION_URI`, no lugar de `SENHA_AQUI`;
- `WEBHOOK_GLOBAL_URL` com o subdomínio real da Viver e o terceiro valor gerado
  no lugar de `TOKEN_DO_WEBHOOK` — o mesmo token vai em `EVOLUTION_WEBHOOK_TOKEN`
  na aplicação (seção 3).

```sh
docker compose up -d
docker compose ps
```

Os três serviços precisam ficar `healthy`. Validar a API:

```sh
curl -s http://127.0.0.1:8080/ | head
```

O `.env` não vai para o Git: o padrão `.env*` já está no `.gitignore` da raiz.
Confirmar com `git status` antes do primeiro commit.

---

## 2. Criar a instância e parear o número

A API não tem porta pública. Da máquina administrativa, abrir túnel:

```sh
ssh -L 8080:127.0.0.1:8080 usuario@VM_DA_OCI
```

Criar a instância (uma só, o número da clínica):

```sh
curl -X POST http://127.0.0.1:8080/instance/create \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "viver-mais-clinica",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

A resposta traz o QR em base64. Ler o QR no celular da clínica em
**Aparelhos conectados → Conectar um aparelho**. O QR expira em segundos; se
perder, pedir de novo:

```sh
curl -s http://127.0.0.1:8080/instance/connect/viver-mais-clinica \
  -H "apikey: $EVOLUTION_API_KEY"
```

Confirmar o estado:

```sh
curl -s http://127.0.0.1:8080/instance/connectionState/viver-mais-clinica \
  -H "apikey: $EVOLUTION_API_KEY"
```

O esperado é `open`. `connecting` e `close` significam sessão não utilizável.

**O pareamento é presencial e manual.** Quem tem o celular precisa estar junto.
Isso é o que transforma queda de sessão em incidente operacional, não em bug.

---

## 3. Ligar a aplicação

A API só é falada servidor-a-servidor. No `.env` da aplicação (na VM, fora do
Git):

```sh
EVOLUTION_API_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=<mesma AUTHENTICATION_API_KEY do container>
EVOLUTION_INSTANCE=viver-mais-clinica
EVOLUTION_WEBHOOK_TOKEN=<openssl rand -hex 32>
```

O `EVOLUTION_WEBHOOK_TOKEN` é o mesmo valor que vai na query de
`WEBHOOK_GLOBAL_URL`. Ele existe porque o webhook global da v2 não garante
cabeçalho customizado: sem token, qualquer um que descubra a URL escreve no
monitor de sessão e registra opt-out em nome de paciente. A rota aceita o token
na query (`?token=`) ou no cabeçalho `x-evolution-token`. Sem
`EVOLUTION_WEBHOOK_TOKEN` configurado a rota recusa todo evento com `401` — o
padrão é falhar fechado.

Sobre `messages.upsert`: é por ele que o psicólogo responde à mensagem de
alocação. `CONTATO` registra o primeiro contato (o mesmo efeito do link
assinado); `ENCAMINHAR` devolve o paciente à fila e aciona o próximo
profissional que atende aos critérios, pulando quem já teve a chance naquele
lead. Qualquer outro texto recebe de volta a instrução com as duas palavras.

Quem consome cada evento:

| Evento | Consumidor | Efeito |
| --- | --- | --- |
| `connection.update` | `lib/whatsapp/sessao.ts` | grava o estado e alerta na primeira queda |
| `qrcode.updated` | `lib/whatsapp/sessao.ts` | marca pareamento pendente; o QR nunca é gravado |
| `send.message`, `messages.update` | `lib/whatsapp/mensagens.ts` | atualiza `clinica_mensagens` sem regredir status |
| `messages.upsert` | `app/api/clinica/whatsapp/webhook` | lê as respostas `CONTATO` e `ENCAMINHAR` do psicólogo e detecta opt-out |

Duas dependências ainda abertas, ambas conhecidas:

- Status de envio precisa de `clinica_mensagens`, que nasce com
  `infra/mysql/004_clinica.sql`. Sem a tabela, o webhook aceita o evento e
  responde `aplicado: false` — nenhum status é gravado em outro lugar.
- Opt-out é gravado no Firestore até `clinica_consentimentos` existir. Perder um
  opt-out não é falha recuperável: é continuar mandando mensagem para quem pediu
  para parar.

Verificação, com a aplicação de pé:

```sh
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/infra/oci/status | jq '.services.whatsapp, .whatsapp, .alertas'
```

Antes do pareamento, o esperado é `"error"` com estado `close` — a sessão não
existe. Depois, `"ok"` com estado `open`. A sessão fica fora do `ready` de
propósito: sessão caída é incidente operacional, não indisponibilidade da
aplicação, e derrubar o healthcheck por causa dela pararia o deploy junto.

O endpoint de status consulta a Evolution e atualiza o registro na mesma
chamada. Quem faz o polling do status mantém o monitor vivo mesmo que nenhum
webhook chegue — que é justamente o cenário de sessão caída.

---

## 4. Depois do pareamento

Antes de qualquer paciente depender disso:

1. Deixar a sessão rodando ociosa durante os Blocos 2 e 3 do plano. São semanas
   de observação de estabilidade de graça, com a clínica ainda no processo
   antigo.
2. Não disparar campanha nenhuma no número recém-pareado. O aquecimento gradual
   da seção 6 do plano começa aqui.
3. Ligar o monitor de sessão (item 6 dos critérios de aceite) antes da primeira
   régua real.

---

## 5. Sessão caiu

O modo de falha mais perigoso, porque é silencioso: a fila continua enfileirando
e nada é entregue.

```sh
# 1. Estado real
curl -s http://127.0.0.1:8080/instance/connectionState/viver-mais-clinica \
  -H "apikey: $EVOLUTION_API_KEY"

# 2. Logs recentes
docker compose logs --tail=100 evolution

# 3. Se o container caiu, mas o volume está intacto: religar costuma bastar,
#    a sessão volta sem QR novo.
docker compose up -d

# 4. Se o estado for "close" e não voltar, pedir novo QR (presencial)
curl -s http://127.0.0.1:8080/instance/connect/viver-mais-clinica \
  -H "apikey: $EVOLUTION_API_KEY"
```

Antes de repareamento, **segurar a fila**. Mensagem retida é recuperável;
mensagem marcada como falhada e descartada, não.

Se o estado voltar a cair logo após o pareamento, ou se a conta parar de enviar
para destinatários que antes funcionavam, tratar como possível bloqueio do
número — não insistir com reconexão em série, o que piora o quadro.

---

## 6. Backup

Dois volumes com naturezas diferentes:

| Volume | Conteúdo | Perder significa |
| --- | --- | --- |
| `evolution_instances` | estado de autenticação da sessão | novo pareamento presencial por QR |
| `evolution_postgres` | metadados da instância | recriar instância e parear de novo |
| `evolution_redis` | cache | nada, reconstrói sozinho |

```sh
docker compose stop evolution
docker run --rm \
  -v viver-mais-evolution_evolution_instances:/dados:ro \
  -v "$PWD":/backup alpine \
  tar czf /backup/evolution-instances-$(date +%F).tar.gz -C /dados .
docker compose start evolution
```

Guardar junto do backup do DB System, fora da VM. O tarball contém credencial de
sessão do WhatsApp da clínica: tratar com o mesmo cuidado de uma chave privada.

---

## 7. Atualizar versão

A sessão pareada é o ativo em risco. Nunca atualizar direto em produção:

1. Subir a nova tag em ambiente separado, com instância de teste e número de
   teste.
2. Conferir se o schema do Postgres migra sem intervenção.
3. Só então trocar a tag no `docker-compose.yml` da VM, com backup do volume
   feito no mesmo dia.

---

## 8. O que não fazer

- Publicar a porta 8080 em `0.0.0.0`. A API controla o WhatsApp da clínica
  inteira e a autenticação é uma chave só.
- Usar a `AUTHENTICATION_API_KEY` de exemplo da documentação oficial. Ela é
  pública.
- Ligar `DATABASE_SAVE_DATA_NEW_MESSAGE` e afins "para depurar". Isso cria uma
  segunda base com conteúdo de paciente fora das regras de sigilo — ver o
  cabeçalho do `env.example`.
- Subir `LOG_LEVEL` para `DEBUG` ou `LOG_BAILEYS` acima de `error` em produção:
  passa a registrar conteúdo de mensagem em log.
- Apontar o Evolution para o PostgreSQL próprio dele. O schema não tem relação com o
  domínio clínico, e `viver_mais_app` não tem DDL.
- Usar o número pessoal de alguém da equipe para parear.
