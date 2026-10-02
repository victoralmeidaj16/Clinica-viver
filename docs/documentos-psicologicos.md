# Documentos psicológicos

O paciente possui uma área de documentos, acessível pelo cartão, prontuário e
atendimento realizado na agenda. A primeira versão oferece declaração de
comparecimento, declaração de acompanhamento referente a um período realizado e
relatório psicológico de encaminhamento. Os textos são próprios; a apostila foi
utilizada somente como referência de organização.

## Fluxo

1. Selecionar o modelo e informar local e finalidade ou as seções do encaminhamento.
2. Revisar a prévia calculada pelo servidor e confirmar o conteúdo.
3. Emitir, consultar no histórico e baixar PDF para assinatura.

O PDF contém campo de assinatura; a confirmação na interface não constitui
assinatura digital. O encaminhamento é organizado em identificação, demanda,
procedimentos, análise e conclusão. Nenhum conteúdo clínico é gerado por IA
nesta versão. Declarações usam finalidades predefinidas e não oferecem campos de
diagnóstico, CID ou sintomas.

## Configuração

- Aplicar `infra/mysql/051_documentos_psicologicos.sql` com o executor existente
  (`npm run db:migrate`, usando `MYSQL_ADMIN_URL` no ambiente de destino).
- Configurar `CLINICAL_DOCUMENTS_KEY` no backend: 32 bytes aleatórios representados
  em 64 caracteres hexadecimais. Gerar com um gerenciador de segredos ou
  `openssl rand -hex 32`. Não versionar a chave.
- Preservar a chave junto à política de backup de segredos. Não substituí-la sem
  migrar os documentos existentes: trocar a chave impede ler o histórico.
- A Vercel continua encaminhando somente APIs específicas ao backend. Nenhum
  rewrite de páginas foi adicionado.

Na operação normal, sem MySQL, a emissão e o histórico falham explicitamente.
A prévia depende dos cadastros e atendimentos, mas não grava um documento.

## Testar localmente

Execute `npm run demo:documentos` e entre em `http://localhost:3010/login` com
`psicologo@vivermais.local` e senha `Psi@123`. Se a porta estiver ocupada, defina
`DOCUMENTS_DEMO_PORT` com outra porta livre.

Em Meus Pacientes, abra Documentos de **Ana Exemplo (paciente fictícia)**. Há duas
sessões concluídas para testar as declarações. Também é possível preencher um
encaminhamento, revisar, emitir e baixar o PDF. O histórico persiste entre
reinícios em `apps/web/.demo-state/documents`, com conteúdo criptografado e chave
local não versionada. Não use dados reais nesse ambiente.

Esse modo só funciona com `NODE_ENV=development`, `CLINICAL_DOCUMENTS_DEMO=true`,
organização `org-demo` e sem MySQL configurado. O comando prepara essas condições
automaticamente e não altera credenciais de produção. Os documentos ficam marcados
como demonstração sem validade clínica, inclusive no PDF. Não há fallback em texto aberto.

## Persistência e acesso

O servidor exige vínculo ativo, perfil de psicólogo ativo, correspondência com o
usuário autenticado e paciente atribuído ao profissional. A consulta também
filtra instituição, organização, paciente e autor. Documentos de outro autor não
são liberados automaticamente numa reatribuição de paciente.

O conteúdo integral, dados dos signatários, usuário emissor, versão do modelo e
referências dos atendimentos são preservados em um snapshot criptografado com
AES-256-GCM. O contexto de instituição, organização, paciente, profissional e
documento é autenticado junto ao conteúdo. A tabela mantém apenas identificadores
e data de emissão fora da criptografia. Respostas usam `Cache-Control: no-store`.

Emissões são imutáveis e idempotentes. A repetição de uma requisição devolve o
mesmo documento; reutilização da chave com conteúdo diferente retorna conflito.
Uma alteração nos dados entre prévia e emissão exige nova revisão. As declarações
usam apenas agendamentos concluídos do próprio profissional, já encerrados.

Esta versão não oferece revogação, assinatura digital, envio por WhatsApp ou
compartilhamento público. A adequação dos textos ao uso clínico deve ser revisada
pela coordenação antes da disponibilização em produção.
