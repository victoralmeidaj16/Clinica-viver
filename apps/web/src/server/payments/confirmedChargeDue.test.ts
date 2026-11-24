import { beforeEach, expect, it, vi } from 'vitest';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
vi.mock('server-only', () => ({}));
const { confirmar, consultar, conciliar } = vi.hoisted(() => ({ confirmar:vi.fn(), consultar:vi.fn(), conciliar:vi.fn() }));
vi.mock('@/server/adapters/interPixAdapter', () => ({ confirmarPrazoInterPix:confirmar,getInterPixCharge:consultar }));
vi.mock('./paymentLinkRepository', () => ({ reconcileSettledInterPixCharge:conciliar }));
import { aplicarVencimentoSolicitado } from './confirmedChargeDue';
const db = { query:vi.fn(),execute:vi.fn(),beginTransaction:vi.fn(),commit:vi.fn(),rollback:vi.fn() };
const job = { id:'job', agendamento_id:'agenda',vence_em:'2099-02-01 13:15:00.000' } as RowDataPacket;
const plan = { charges:[{ organizacao_ref:'org',ref_core:'c' } as RowDataPacket],checkouts:[],remotes:[{ provider:'inter',id:'pix-1' }] };
const run = () => aplicarVencimentoSolicitado(db as unknown as PoolConnection,job,plan);
const saldo = (v:number) => [[{status:v ? 'partially_paid':'paid',saldo_centavos:v}]];
beforeEach(() => { vi.resetAllMocks(); db.query.mockResolvedValue(saldo(6000)); confirmar.mockResolvedValue('updated'); });
it('confirma o saldo de R$ 60 e conserva as baixas', async () => {
  expect(await run()).toBe('updated');
  expect(confirmar).toHaveBeenCalledWith('pix-1','2099-02-01T13:15:00.000Z',6000);
  expect(db.execute.mock.calls.filter(([sql]) => /UPDATE financeiro_pagamentos/.test(sql))).toHaveLength(0);
});
it('preserva o prazo anterior se o banco confirma apenas cancelamento ou prazo divergente', async () => {
  confirmar.mockResolvedValue('rejected');
  expect(await run()).toBe('rejected');
  expect(db.execute).toHaveBeenCalledTimes(1);
});
it('quitação concorrente impede promover o prazo', async () => {
  db.query.mockResolvedValueOnce(saldo(6000)).mockResolvedValueOnce(saldo(0));
  expect(await run()).toBe('paid');
  expect(db.execute).toHaveBeenCalledTimes(1);
});
it('mantém pendente para conferir novamente se outra parcela entrou', async () => {
  db.query.mockResolvedValueOnce(saldo(6000)).mockResolvedValueOnce(saldo(4000));
  expect(await run()).toBe('queued'); expect(db.execute).not.toHaveBeenCalled();
});
