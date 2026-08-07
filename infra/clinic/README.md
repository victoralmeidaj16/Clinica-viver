# Backend clínico na OCI

Este stack mantém o MySQL e o backend Next.js na mesma VM privada. O MySQL
não publica a porta 3306; somente o backend acessa o banco pela rede Docker.

O `.env` é criado apenas na VM e nunca deve ser versionado.
