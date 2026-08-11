# Backend clínico na VPS Hostinger

Este stack mantém o MySQL e o backend Next.js na mesma VPS Hostinger. O MySQL
não publica a porta 3306; somente o backend acessa o banco pela rede Docker.

O `.env` é criado apenas na VM e nunca deve ser versionado.

O frontend fica na Vercel e encaminha somente as APIs para este backend por
`https://app.clinicavivermais.cloud`. O roteiro completo está em
[`../../docs/hostinger-vps.md`](../../docs/hostinger-vps.md).
