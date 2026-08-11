# Pendências operacionais da VPS

## Worker de transbordo por SLA

O código já contém o serviço Docker `sla-sweeper`, mas ele só deve ser ativado
quando a VPS receber estas variáveis em `/opt/viver-mais/infra/clinic/.env`:

```env
SLA_SWEEP_TOKEN=<gerar com: openssl rand -hex 32>
SLA_SWEEP_INTERVAL_SECONDS=300
WHATSAPP_COORDINATION_NUMBERS=55DDDNUMERO
```

O número de `WHATSAPP_COORDINATION_NUMBERS` também precisa ser acrescentado a
`WHATSAPP_ALLOWED_NUMBERS`. Ele recebe somente protocolo e nomes dos
profissionais envolvidos no transbordo; nunca dados do paciente.

Depois de commitar o código, publicar da raiz do repositório:

```sh
VPS_HOST=root@IP_DA_VPS ./infra/clinic/deploy-vps.sh
```

Validar na VPS:

```sh
docker compose -f /opt/viver-mais/infra/clinic/docker-compose.yml logs -f sla-sweeper
```

O esperado é `Varredura de SLA concluída; transbordos=0.` em cada ciclo sem
pendências. Não compartilhar aqui o IP, senha, tokens ou conteúdo do `.env`.
