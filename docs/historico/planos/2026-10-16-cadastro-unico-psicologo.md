# Cadastro único de psicólogo — plano de implementação

**Objetivo:** impedir duplicação por e-mail ou WhatsApp e reutilização indevida de uma identidade, oferecendo recuperação por e-mail.

**Desenho:** validação de contatos normalizados dentro da mutação transacional do cadastro; aprovação exige vínculo exclusivo com a conta existente. O formulário oferece recuperação pelo endpoint já existente, com link individual, validade e limite de solicitações. Nenhum envio real é realizado durante os testes.

**Restrições:** preservar mudanças locais; manter rotas de deploy; não mesclar nem excluir registros antigos automaticamente; não revelar contatos de terceiros; novos componentes abaixo de 250 linhas.

## Execução

- [x] Regra de duplicidade: e-mail sem distinção de maiúsculas e telefone com DDI, formatação e nono dígito equivalentes; cobrir coincidência de apenas um contato.
- [x] Aplicar a regra na criação e edição sob lock; devolver conflito 409 e ação de recuperação. Preservar operações não relacionadas em bases com duplicidades antigas.
- [x] Proteger provisionamento antes de qualquer escrita: conta de outro cadastro, vínculo compartilhado e alteração indevida de identidade devem falhar sem sobrescrever nome/CRP.
- [x] Exibir aviso com recuperação no formulário; usar e-mail digitado, sem consultar ou revelar e-mail associado ao telefone. Cadastros ainda em análise devem procurar a gestão.
- [x] Impedir seleção arbitrária do primeiro cadastro quando a sessão tem vínculos ambíguos.
- [x] Executar testes de regressão, lint e checagem de tipos; relatar limitações de publicação e dados antigos.

## Revisão

Conferir duplicação concorrente, identidade já ativa, reenvio legítimo do mesmo cadastro, contato repetido em cadastro pendente, e correção de contato sem introduzir nova colisão.

## Resultado

- 808 testes web passaram, incluindo regressões de duplicidade, exclusividade de identidade e bloqueio de sessões ambíguas.
- Lint dos arquivos alterados aprovado; verificação de tipos do código-fonte aprovada com configuração temporária que exclui validadores obsoletos de rotas em `.next`.
- A edição MySQL sincroniza cadastro, usuário e profissional na mesma transação; a gravação genérica de usuário também deixou de atualizar outra identidade por colisão no índice de e-mail.
- Consulta somente de leitura em produção encontrou uma conta associada a dois cadastros. Nenhum registro foi alterado e a correção ainda não foi publicada. A definição do cadastro legítimo exige revisão da gestão.
- Não foram enviados e-mails ou mensagens reais nos testes.

## Pendências conhecidas

Consolidação dos itens desmarcados e das pendências explícitas deste registro histórico. O estado abaixo reproduz o plano; não constitui uma nova auditoria do código ou da produção. Consulte as etapas originais para detalhes e confirme o estado atual antes de retomar o trabalho.

Pendências registradas em “Resultado”:

- [ ] Submeter à gestão a definição do cadastro legítimo da conta encontrada com dois cadastros associados; o registro informa que nenhum dado foi alterado.
- [ ] Publicar a correção após as verificações necessárias; o registro informa que ela ainda não havia sido publicada. Confirmar o estado atual do deploy antes de agir.
