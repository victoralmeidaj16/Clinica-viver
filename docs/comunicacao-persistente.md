# Comunicação persistente e confirmação pós-sessão

## Ativação

1. Aplicar `065_comunicacao_persistente.sql` com o runner habitual (`npm run db:migrate` e a credencial administrativa do ambiente), antes de publicar o backend atualizado.
2. Configurar `CLINICAL_DOCUMENTS_KEY` com uma chave hexadecimal de 32 bytes. A fila e os resumos/tarefas usam a mesma infraestrutura AES-256-GCM dos documentos clínicos. Manter essa chave estável e protegida junto aos procedimentos de backup; trocá-la sem migração impede ler os registros existentes.
3. Conferir `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` e a política `WHATSAPP_ALLOWED_NUMBERS` / `WHATSAPP_ALLOW_ALL_RECIPIENTS`.

As correções não executam migrations, publicações nem disparos durante os testes.
Notificações antigas do snapshot demonstrativo não são importadas automaticamente: podem representar envios já realizados e precisam de revisão antes de qualquer reenvio.

## Garantias e estados

`clinica_envios_whatsapp` reserva a chave antes de chamar a Evolution. Guarda hashes da chave e do conteúdo, tentativa, estado e referência do provedor; não guarda telefone ou texto. Repetir uma chave com conteúdo diferente gera conflito. A API operacional separa as chaves por organização e usuário.

- `sending`: requisição reservada, ainda sem resultado persistido. Outra instância não envia novamente.
- `sent`: aceite HTTP confirmado; repetições retornam o resultado salvo.
- `rejected`: recusa HTTP explícita que permite nova tentativa com a mesma chave.
- `unknown`: timeout, erro de transporte ou resposta ambígua. Não há reenvio automático.

As reservas não expiram automaticamente. Se o processo cair entre o envio e a gravação do resultado, consultar a Evolution antes de qualquer decisão operacional. Não apagar a reserva nem gerar outra chave para contornar um estado incerto. O aceite do provedor não comprova leitura da mensagem pelo paciente.

`clinica_comunicacoes` guarda a fila e os resumos/tarefas cifrados, com isolamento por instituição e organização. O resumo aprovado é persistido antes do envio; a etapa pós-sessão só conclui após o aceite do provedor e a persistência da entrega. Falhas preservam a aprovação para retomada. O destinatário vem do cadastro do paciente, e o despacho verifica autorização, preferência e consentimento.

Se a fila permanecer `sending` após uma interrupção, repetir o despacho consulta a reserva durável: um aceite já registrado permite concluir a atualização local; uma entrega incerta continua pendente.

O adaptador demonstrativo só é selecionado fora de produção e sem MySQL. Em produção, canais sem adaptador real falham explicitamente; atualmente a entrega integrada é WhatsApp.

## Preços e agenda

O catálogo `apps/web/src/lib/attendancePricing.ts` alimenta vitrine e mensagens. Os valores familiares foram extraídos da vitrine existente: R$ 150,00 social e R$ 230,00 particular. Valores individuais personalizados de cobrança continuam seguindo o cadastro financeiro.

Cancelamento comum recusa atendimentos realizados ou com sessão clínica vinculada, retornando HTTP 409 antes de cobrança/aviso. Não foi criada uma operação de reversão clínica/financeira: ela requer regras próprias de retificação e estorno, fora do cancelamento comum.
