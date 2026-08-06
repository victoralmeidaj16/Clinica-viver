# Infraestrutura OCI

Portado de `Sponteiro/docs/oci-migracao.md` e atualizado para este repositório.
Lá o documento descreve uma migração Firebase → OCI; aqui não há Firebase para
migrar — o que existe é estado em memória sendo substituído por banco, módulo a
módulo.

## Estado do DB System — validado em 29/07/2026

Provisionado pelo Sponteiro e compartilhado por esta aplicação.

- Região: `sa-vinhedo-1` — Brazil Southeast (Vinhedo).
- Compartment: `viver-mais-prod`.
- VCN: `vcn-viver-mais-prod`.
- Sub-rede privada do banco: `subnet-mysql-privada` (`10.20.1.0/24`).
- DB System: `mysql-viver-mais-prod`.
- Shape: `MySQL.Free`, Always Free, standalone, 1 ECPU, 8 GiB, 50 GiB.
- MySQL `9.7.1`, ativo, sem HeatWave e **sem IP público**.
- Endpoint privado: `10.20.1.132:3306`.
- Banco: `viver_mais`.
- Usuário da aplicação: `viver_mais_app@10.20.%`, apenas `SELECT`, `INSERT`,
  `UPDATE` e `DELETE` em `viver_mais.*` — sem DDL.
- TLS validado com `VERIFY_CA`, cipher `TLS_AES_128_GCM_SHA256`.
- Cadeia TLS: servidor `CN=MySQL_Endpoint_Server`, emissor
  `CN=MySQL_Endpoint_CA`, validade até 28/07/2029.

## Arquivos sensíveis, fora do repositório

- `/Users/victoralmeidaj16/Downloads/viver-mais-secrets.env` — `DATABASE_URL` e
  `CRON_SECRET`, permissão `600`.
- `/Users/victoralmeidaj16/Downloads/mysql-viver-mais-prod-ca.pem` — certificado
  do endpoint e CA emissora.

O `.gitignore` cobre `.env*`, `*.pem` e `*.key`. Nenhum destes arquivos deve ser
copiado para dentro do repositório.

## Banco próprio: `viver_mais_clinica`

A instância, a VCN, o TLS, a credencial administrativa e o usuário
`viver_mais_app` são os mesmos que o Sponteiro já usa — infraestrutura se paga
uma vez. **O banco não.**

O `viver_mais` do Sponteiro foi exercitado com dados de teste, e uma clínica em
operação não nasce em cima de dados de teste. Esta aplicação usa
`viver_mais_clinica`, criado por `infra/mysql/000_criar_banco_clinica.sh` no
mesmo DB System, com grant próprio para o mesmo usuário restrito. Nenhuma linha
é importada de lá.

O que é reaproveitado do Sponteiro é **estrutura**: o DDL do domínio clínico,
que é bom e já foi pensado. Não os dados.

## Schema

Sequência de **produção**, aplicada com credencial administrativa no banco
`viver_mais_clinica` (o `viver_mais_app` não tem DDL):

| Arquivo | Papel | Estado |
| --- | --- | --- |
| `000_criar_banco_clinica.sh` | cria o banco e concede acesso ao usuário restrito | pendente |
| `001_financeiro.sql` | **só estrutura**: `instituicoes` e `financeiro_recebimentos`, exigidas por chave estrangeira no 004. As tabelas ficam vazias — o financeiro real vive em `packages/core/src/financial` | pendente |
| `004_clinica.sql` | domínio clínico: pacientes, profissionais, agenda, evoluções, documentos, consentimentos, auditoria | pendente |
| `007_thats_life_core.sql` | organização, usuários, vínculos, atribuição de profissionais, lembretes, `clinica_comandos`, `clinica_outbox` e ALTERs no 004 | pendente |
| `008_seed_organizacao.sql` | organização Viver Mais e vínculo de coordenação. **Sem pacientes e sem profissionais** | pendente |

Dois arquivos **fora** da sequência de produção:

- `005_seed_profissionais.sql` — dez profissionais **fictícios**, com telefones
  fictícios. Só desenvolvimento. Com o Evolution API ligado, telefone de exemplo
  é telefone de alguém.
- `006_clinica_mensagens_conteudo.sql` — migração para bancos que receberam uma
  versão antiga do 004. Em instalação nova falha com
  `ERROR 1060: Duplicate column name 'conteudo'`, porque o 004 atual já traz a
  coluna.

O domínio-base do `004` continua sendo o do Sponteiro. As diferenças de
comportamento desta aplicação entram por `ALTER` no `007` — manter o mesmo
schema divergindo em dois arquivos é como as duas versões deixam de ser a
mesma. Em particular, o `007` substitui a chave de slot simples por uma chave
com coluna gerada: agendamentos ativos ocupam o slot; `cancelado` não ocupa.

**Defeito encontrado e corrigido aqui:** no Sponteiro, o `005` usa ids de
profissional com 41 caracteres numa coluna `CHAR(36)` e falha com
`ERROR 1406: Data too long for column 'id'`. Como nunca foi aplicado, o erro
estava latente. Nesta cópia os ids viraram uuids válidos; **a cópia do Sponteiro
continua quebrada**.

## Próxima etapa — executar a aplicação dentro da VCN

`DATABASE_URL` aponta para `10.20.1.132`, endereço privado. Backend hospedado
fora da OCI não alcança esse endereço, e **não** se deve expor o MySQL por load
balancer público para contornar a restrição.

### VM Always Free

1. Verificar se já existe sub-rede pública na `vcn-viver-mais-prod`; criar se
   necessário, exclusiva para a aplicação.
2. Criar a VM Compute Always Free nessa sub-rede. Dimensionar para **dois**
   processos: o Next.js e o container do Evolution API (`infra/evolution/`).
3. Chave SSH exclusiva de produção — privada só no Mac, permissão `600`;
   somente a pública instalada na VM.
4. Regras mínimas de rede:
   - SSH `22` apenas do IP administrativo autorizado;
   - HTTP `80` e HTTPS `443` públicos;
   - MySQL `3306` apenas da sub-rede/NSG da aplicação para a sub-rede do banco.
5. Remover a regra temporária de `3306` originada do Cloud Shell depois da
   validação.
6. Runtime em container supervisionado, com reinício automático.
7. Guardar na VM, fora do Git: `DATABASE_URL`, `CRON_SECRET`, o PEM da CA e as
   demais variáveis privadas. Migrar para OCI Vault na sequência.
8. Proxy HTTPS e subdomínio no domínio da própria Viver
   (ex.: `clinica.vivermaispsicologia.com.br`).

### Desenvolvimento local

Enquanto a aplicação não roda na VCN, o acesso é por túnel:

```bash
ssh -L 3306:10.20.1.132:3306 opc@<ip-da-vm>
```

e `DATABASE_URL` apontando para `127.0.0.1:3306`. O túnel é ferramenta de
desenvolvimento; ele não substitui rodar dentro da VCN.

### Carregamento do certificado

Duas formas, ambas suportadas por `apps/web/src/server/oci/runtime.ts`:

- `MYSQL_SSL_CA` com o PEM e quebras de linha escapadas; ou
- `MYSQL_SSL_CA_FILE` apontando para um arquivo com leitura restrita ao serviço
  — preferível na VM, porque mantém o certificado fora do ambiente do processo.

## Validação

1. `infra/mysql/003_validar_app_tls.sh` — usuário restrito e TLS `VERIFY_CA`.
2. `GET /api/infra/oci/status` com `Authorization: Bearer <CRON_SECRET>`:
   `200` e `{"ready":true,"services":{"mysql":"ok"}}`. Sem banco alcançável,
   `503`.
3. `GET /api/infra/mode` deve responder `{"persistence":"mysql"}`. É o que faz
   o aviso de demonstração sumir das telas.
4. `POST /api/application/appointments` com a mesma `Idempotency-Key` duas
   vezes: a segunda devolve `idempotentReplay: true` e não cria linha nova.
5. Dois agendamentos no mesmo horário do mesmo profissional: o segundo é
   rejeitado pela `clinica_agendamentos_slot_uq`; cancelado não bloqueia um
   novo agendamento no mesmo horário.
6. Sobreposição parcial do intervalo do mesmo profissional: rejeitada pela
   checagem de intervalo executada dentro da transação de escrita, incluindo
   concorrência entre requisições.
7. Logs sem `DATABASE_URL`, senha, `CRON_SECRET` ou PEM.

## WhatsApp — piloto restrito

Enquanto a operação está em piloto, mensagem só sai para os contatos declarados
em `WHATSAPP_ALLOWED_NUMBERS`: um do profissional e um do paciente. Todo o resto
é recusado por `apps/web/src/server/adapters/whatsappAllowlist.ts`.

Três propriedades da trava:

1. **Falha fechada.** Lista vazia bloqueia tudo. Esquecer de configurar produz
   nenhuma mensagem, não todas.
2. **Tolerante a formato, não a número.** `+55 48 99614-7527`, `5548996147527` e
   `554896147527` são a mesma pessoa e passam; um dígito diferente é bloqueado.
   O nono dígito é tratado como equivalência, porque o WhatsApp não é
   consistente com ele.
3. **É do servidor.** Não confia em quem chama nem em preferência de paciente.

Os números reais ficam no `.env`, fora do Git. O `.env.example` traz apenas a
variável vazia — telefone de pessoa não entra em arquivo versionado.

Hoje o adaptador de entrega ainda é o de demonstração: ele registra em memória
e **nada sai para a rede**. A trava foi escrita antes do envio real existir, de
propósito, para não depender de alguém lembrar dela no dia em que ele existir.

## Capacidade

Gatilhos de revisão, medidos por nós: CPU ≥ 70% sustentado, RAM ≥ 80%
sustentado, disco ≥ 75%, p95 acima de 1,5 s. Envelope de referência: 150–200
cadastrados, até 50 simultâneos. Estourar o envelope aqui significa subir de
shape, não renegociar contrato.

## Pendências

1. Ambiente `viver-mais-dev` separado. Até existir, todo teste de escrita ocorre
   contra o banco de produção — que hoje só tem financeiro, mas passará a ter
   paciente.
2. Credenciais em OCI Vault, depois que a VM estiver ativa.
3. Autenticação real. O contexto por cabeçalho identifica, não autentica.
4. Adaptador de Object Storage para anexos e PDFs.
5. Redis/Valkey privado — somente com necessidade comprovada de cache
   distribuído, rate limiting ou workers concorrentes.
