# Registro de testes — 14/11/2026

Referência: [checklist da plataforma](checklist-testes-plataforma.md). Esta rodada foi executada no código local, com Node.js 24.10.0; não comprova o estado publicado em produção.

## Verificação automatizada

Comando executado na raiz: `npm run check`.

| Etapa | Resultado observado |
| --- | --- |
| Lint | Concluído sem erros, com 43 avisos. |
| Tipos do core e da aplicação | Concluídos sem erros. |
| Testes do core | 195 aprovados em 25 arquivos. |
| Testes da aplicação | 1.603 aprovados em 244 arquivos. |
| Build | Compilação concluída com aviso do Turbopack sobre rastreamento de arquivos; a etapa posterior de TypeScript não terminou durante a espera e a execução foi interrompida. O build completo não foi confirmado. |

O aviso do Turbopack aponta uma cadeia de importação que inclui `next.config.mjs`, `asaasAdapter.ts` e a rota de integração Asaas. Nenhuma análise de causa ou correção foi feita nesta rodada.

## Testes manuais e capturas

A ferramenta de controle do navegador não conseguiu abrir nem controlar uma aba do Chrome nesta sessão. Portanto, **não houve testes manuais nem novas capturas de tela**; os estados anteriores do checklist não foram alterados ou revalidados. As capturas da rodada anterior permanecem em [testes-2026-11-13/capturas](testes-2026-11-13/capturas/).

Continuam pendentes os testes visuais e os fluxos descritos no checklist, incluindo PSI-03, PSI-16, GES-01, GES-07, GES-09, FLX-05 e FLX-06. Os fluxos que podem enviar WhatsApp ou gerar cobranças exigem combinar previamente destinatários e ambiente, conforme o próprio checklist. Não foram enviados WhatsApps, emitidas cobranças ou notas fiscais nesta rodada.
