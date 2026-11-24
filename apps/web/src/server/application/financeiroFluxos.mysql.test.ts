import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));
const fixture = vi.hoisted(() => ({ inst:'', paciente:'paciente-ficticio', pro:'profissional-ficticio' }));
let pool: Pool;
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => pool, isMysqlConfigured:() => true }));
vi.mock('@/server/persistence/mysql/mappers', async load => ({ ...await load<typeof import('../persistence/mysql/mappers')>(), instituicaoId: () => fixture.inst }));
vi.mock('./store', () => ({ getApplicationStore: () => ({ identities: {
  getPatient: async () => ({ id:fixture.paciente,primaryProfessionalId:fixture.pro,status:'active' }),
} }) }));
import { criarPacote } from './patientPackageService';
import { registrarDecisaoCredito } from './creditAdjustmentService';
import { registrarFaltaDoAgendamento } from '@/server/scheduling/agendaFalta';
import { consumirPacote } from '@/server/scheduling/pacoteAgendamento';
import { reconcileAsaasPayment } from '@/server/payments/paymentLinkRepository';
import { registrarCobrancaContratual } from '@/server/payments/companySessionCharge';
import { registrarEstornoPaciente } from '@/server/payments/patientRefund';
import { lerCreditos } from '@/server/persistence/mysql/educationalCreditRepository';
import { reservarCotaContratual, fixarCotaAntesDeCancelar, travarPacienteParaReserva } from '@/server/persistence/mysql/politicaReserva';
import { previaContratual } from '@/server/persistence/mysql/faturaContratual';
import { fecharFatura, reconcileConvenioInvoicePayment, reconcileConvenioInvoiceRefund } from '@/server/persistence/mysql/convenioRepository';
import { caixaDosContratos } from '@/server/persistence/mysql/clinicContractFinance';
import { politicaPadrao } from '@/lib/politicaConvenio';

const url = process.env.VM_FINANCEIRO_MYSQL_TEST;
describe.skipIf(!url)('jornada financeira em MySQL descartável', () => {
  const org = 'org-ficticia';
  const orgId = randomUUID(), profId = randomUUID(), pacienteId = randomUUID();
  const ctx: RequestContext = { actor:{ actorType:'staff',roles:['admin'],organizationId:org,userId:'gestora',membershipId:'m',membershipStatus:'active' },correlationId:'teste',idempotencyKey:randomUUID() };
  let slot = 0;
  async function agenda(paciente = pacienteId) {
    const id = randomUUID();
    await pool.execute(`INSERT INTO clinica_agendamentos (id,ref_core,instituicao_id,organizacao_id,paciente_id,profissional_id,inicio,modalidade)
      VALUES (?,?,?,?,?,?,?,'online')`,[id,id,fixture.inst,orgId,paciente,profId,new Date(Date.UTC(2027,0,1,++slot))]);
    return id;
  }
  async function pacote() {
    const body = { pacienteId:fixture.paciente, quantidade:4, valorCentavos:40000, venceEm:'2030-11-30T15:00:00Z' };
    const command = { ...ctx,idempotencyKey:randomUUID() };
    const { id } = await criarPacote(command,body);
    expect(await criarPacote(command,body)).toEqual({id});
    const paymentId = randomUUID();
    await pool.execute('UPDATE financeiro_cobrancas SET provedor_ref=? WHERE instituicao_id=? AND ref_core=?',[paymentId,fixture.inst,'pacote-'+id]);
    return { id,evento:{ eventId:randomUUID(),eventType:'PAYMENT_CONFIRMED',paymentId,amountCents:40000,receivedAt:'2026-11-30T13:00:00Z',billingType:'CREDIT_CARD' } };
  }
  beforeAll(async () => {
    const local = new URL(url!);
    if (local.hostname !== '127.0.0.1' || local.pathname !== '/validacao_financeira') throw new Error('O teste exige a base validacao em loopback.');
    pool = createPool({ uri:url!,dateStrings:true,timezone:'Z' });
    fixture.inst=randomUUID();
    await pool.execute('INSERT INTO instituicoes (id,slug,nome) VALUES (?,?,?)',[fixture.inst,fixture.inst,'Instituição fictícia']);
    await pool.execute('INSERT INTO clinica_organizacoes (id,instituicao_id,ref_core,nome_exibicao) VALUES (?,?,?,?)',[orgId,fixture.inst,org,'Clínica fictícia']);
    await pool.execute("INSERT INTO clinica_profissionais (id,instituicao_id,organizacao_id,ref_core,usuario_ref,nome,vinculo) VALUES (?,?,?,?,?,?,'psicologo')",[profId,fixture.inst,orgId,fixture.pro,profId,'Profissional fictício']);
    await pool.execute("INSERT INTO clinica_pacientes (id,instituicao_id,organizacao_id,ref_core,nome,status) VALUES (?,?,?,?,?,'ativo')",[pacienteId,fixture.inst,orgId,fixture.paciente,'Paciente fictício']);
  });
  afterAll(async () => { await pool?.end(); });
  it('quatro sessões, crédito único, concorrência na última unidade e decisão em estorno', async () => {
    const {id,evento} = await pacote();
    const eventos = await Promise.all([reconcileAsaasPayment(evento),reconcileAsaasPayment(evento)]);
    expect(eventos.sort()).toEqual(['duplicate','processed']);
    const reservar = async (ag:string) => {
      const conn = await pool.getConnection();
      try { await conn.beginTransaction(); await consumirPacote(conn,org,fixture.paciente,fixture.pro,ag); await conn.commit(); }
      catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    };
    const saldo = async () => Number((await pool.query<RowDataPacket[]>('SELECT quantidade-utilizadas AS saldo FROM financeiro_pacotes WHERE id=?',[id]))[0][0].saldo);
    await reservar(await agenda()); expect(await saldo()).toBe(3);
    await reservar(await agenda()); await reservar(await agenda());
    const a = await agenda(), b = await agenda();
    const resultados = await Promise.allSettled([reservar(a),reservar(b)]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await saldo()).toBe(0);
    const original = (await lerCreditos(org,{},pool)).find(l => l.chargeId === 'pacote-'+id)!;
    expect(original).toMatchObject({source:'package',creditCents:28000});
    expect(await lerCreditos('outra',{},pool)).toEqual([]);
    const estorno = { ...evento,eventId:randomUUID(),eventType:'PAYMENT_PARTIALLY_REFUNDED',refundCents:4000 };
    expect(await registrarEstornoPaciente(estorno)).toBe('processed');
    const linhas = (await lerCreditos(org,{},pool)).filter(l => l.chargeId === original.chargeId);
    expect(linhas).toHaveLength(1);
    const body = { evento:linhas[0].refundRefs![0], ajusteCentavos:-2800, justificativa:'Reembolso parcial confirmado' };
    await expect(registrarDecisaoCredito({...ctx,actor:{...ctx.actor,roles:['billing']}},original.id,body)).rejects.toThrow('Somente a Gestão');
    await expect(registrarDecisaoCredito(ctx,original.id,{...body,justificativa:' '})).rejects.toThrow('justificativa');
    const ajuste = await registrarDecisaoCredito(ctx,original.id,body);
    expect(await registrarDecisaoCredito(ctx,original.id,body)).toEqual(ajuste);
    await expect(registrarDecisaoCredito(ctx,original.id,{...body,ajusteCentavos:0})).rejects.toThrow(/decisão/);
    expect((await lerCreditos(org,{},pool)).find(l => l.id===ajuste.id)).toMatchObject({ originalId:original.id,creditCents:-2800,authorId:'gestora' });
  });
  it('recebimento divergente fica em conciliação inclusive se outro evento trouxer o acumulado integral', async () => {
    const { id, evento } = await pacote();
    await reconcileAsaasPayment({...evento,eventId:randomUUID(),amountCents:10000});
    await reconcileAsaasPayment(evento);
    const [[row]] = await pool.query<RowDataPacket[]>('SELECT pago_em FROM financeiro_pacotes WHERE id=?',[id]);
    expect(row.pago_em).toBeNull();
    expect((await lerCreditos(org,{},pool)).filter(l => l.chargeId==='pacote-'+id)).toEqual([]);
  });
  it('preserva o valor, a competência e o comprovante de cada parte de uma cobrança avulsa', async () => {
    const ref = randomUUID(), paymentId = randomUUID();
    await pool.execute(`INSERT INTO financeiro_cobrancas (id,instituicao_id,organizacao_ref,ref_core,sessao_ref,paciente_ref,
      profissional_ref,emitida_em,vence_em,valor_centavos,status,provedor_ref) VALUES (?,?,?,?,?,?,?,NOW(),NOW(),10000,'pending',?)`,
    [ref,fixture.inst,org,ref,'s-'+ref,fixture.paciente,fixture.pro,paymentId]);
    const primeiro = { paymentId,eventId:randomUUID(),eventType:'PAYMENT_CONFIRMED',billingType:'PIX',
      amountCents:4000,receivedAt:'2026-11-01T02:59:59Z',receiptUrl:'https://www.asaas.com/comprovantes/teste' };
    const segundo = { ...primeiro,eventId:randomUUID(),amountCents:10000,receivedAt:'2026-11-01T03:00:00Z',receiptUrl:'https://example.org/invalido' };
    for (const evento of [primeiro,segundo]) {
      expect(await reconcileAsaasPayment(evento)).toBe('processed');
      expect(await reconcileAsaasPayment(evento)).toBe('duplicate');
    }
    const outubro = (await lerCreditos(org,{endDate:primeiro.receivedAt},pool)).filter(l => l.chargeId===ref);
    const novembro = (await lerCreditos(org,{startDate:segundo.receivedAt},pool)).filter(l => l.chargeId===ref);
    expect(outubro).toMatchObject([{baseCents:4000,creditCents:2800,receiptUrl:primeiro.receiptUrl}]);
    expect(novembro).toMatchObject([{baseCents:6000,creditCents:4200,receiptUrl:undefined}]);
    expect(await lerCreditos('outra-organizacao',{},pool)).toEqual([]);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const conferir = async () => {
        const [rows] = await conn.query<RowDataPacket[]>(`SELECT resultado FROM financeiro_creditos_conferencia
          WHERE instituicao_id=? AND organizacao_ref=? AND origem='payment' AND origem_ref IN
          (SELECT ref_core FROM financeiro_pagamentos WHERE instituicao_id=? AND cobranca_ref=?) ORDER BY base_centavos`,
        [fixture.inst,org,fixture.inst,ref]);
        return rows.map(row=>row.resultado);
      };
      expect(await conferir()).toEqual(['conferido','conferido']);
      await conn.execute('UPDATE financeiro_pagamentos SET valor_centavos=valor_centavos+100 WHERE instituicao_id=? AND cobranca_ref=? AND valor_centavos=4000',[fixture.inst,ref]);
      expect(await conferir()).toEqual(['divergente','conferido']);
      await conn.rollback();
      expect(await conferir()).toEqual(['conferido','conferido']);
    } finally { await conn.rollback(); conn.release(); }
  });
  it('cota consumida na falta sobrevive à edição do contrato e não gera crédito', async () => {
    const convenio = randomUUID();
    const politica = {...politicaPadrao, consumirFalta:true, base:'agendadas' as const, excedente:'autorizar' as const};
    await pool.execute(`INSERT INTO clinica_convenios (id,instituicao_id,organizacao_ref,ref_core,nome,empresa_paga_sessoes,pacote_sessoes,valor_sessao_contrato_centavos,politica)
      VALUES (?,?,?,?,?,1,1,10000,?)`,[convenio,fixture.inst,org,convenio,'Empresa fictícia',JSON.stringify(politica)]);
    const paciente = randomUUID();
    await pool.execute(`INSERT INTO clinica_pacientes (id,instituicao_id,organizacao_id,ref_core,nome,status,convenio_ref)
      VALUES (?,?,?,?,'Paciente fictício','ativo',?)`,[paciente,fixture.inst,orgId,paciente,convenio]);
    const conn = await pool.getConnection();
    try {
      const id = await agenda(paciente);
      await conn.beginTransaction(); expect(await reservarCotaContratual(conn,id)).toBe(false); await conn.commit();
      const registrar = () => registrarFaltaDoAgendamento(org,fixture.pro,id,{cobrar:true},new Date('2027-01-31T15:00:00Z'));
      expect(await registrar()).toBe('covered');
      expect(await registrar()).toBe('covered');
      const [[row]] = await conn.query<RowDataPacket[]>('SELECT cota_ocorrencia_ref FROM clinica_agendamentos WHERE id=?',[id]);
      expect(row.cota_ocorrencia_ref).toBe(convenio);
      await conn.execute('UPDATE clinica_convenios SET politica=? WHERE id=?',[JSON.stringify({...politica,consumirFalta:false}),convenio]);
      const excesso = await agenda(paciente);
      await conn.beginTransaction(); expect(await reservarCotaContratual(conn,excesso)).toBe(true); await conn.commit();
      const previa = await previaContratual(conn,org,convenio,politica,10000,'2027-01-01','2027-01-31');
      expect(previa.sessoes).toContain(id); expect(previa.sessoes).not.toContain(excesso);
      expect((await lerCreditos(org,{},pool)).some(l => l.sessionId===id)).toBe(false);
      const fatura = await fecharFatura(org,convenio,{competencia:'2027-01',periodoInicio:'2027-01-01',periodoFim:'2027-01-31',
        conferencia:{...previa,ajuste:0,motivo:''}});
      expect(fatura).toMatchObject({totalSessoes:1,valorCents:10000});
      await conn.execute("UPDATE clinica_agendamentos SET inicio='2027-02-11 12:00:00' WHERE id=?",[id]);
      const fevereiro = await previaContratual(conn,org,convenio,politica,10000,'2027-02-01','2027-02-28');
      expect(fevereiro.sessoes).not.toContain(id);
    } finally { await conn.rollback(); conn.release(); }
  });
  it('serializa a última vaga e aplica o cancelamento conforme a política do contrato', async () => {
    const convenio = randomUUID(), paciente = randomUUID();
    const politica = {...politicaPadrao,consumirCancelamento:true,excedente:'bloquear'};
    await pool.execute(`INSERT INTO clinica_convenios (id,instituicao_id,organizacao_ref,ref_core,nome,empresa_paga_sessoes,pacote_sessoes,politica)
      VALUES (?,?,?,?,?,1,1,?)`,[convenio,fixture.inst,org,convenio,'Empresa de cota fictícia',JSON.stringify(politica)]);
    await pool.execute(`INSERT INTO clinica_pacientes (id,instituicao_id,organizacao_id,ref_core,nome,status,convenio_ref)
      VALUES (?,?,?,?,'Paciente fictício','ativo',?)`,[paciente,fixture.inst,orgId,paciente,convenio]);
    const reservar = async () => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await travarPacienteParaReserva(conn,paciente);
        const id = randomUUID();
        await conn.execute(`INSERT INTO clinica_agendamentos (id,ref_core,instituicao_id,organizacao_id,paciente_id,profissional_id,inicio,modalidade)
          VALUES (?,?,?,?,?,?,?,'online')`,[id,id,fixture.inst,orgId,paciente,profId,new Date(Date.UTC(2027,0,1,++slot))]);
        await reservarCotaContratual(conn,id);
        await conn.commit();
        return id;
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    };
    const resultados = await Promise.allSettled([reservar(),reservar()]);
    const aprovados = resultados.filter(r => r.status==='fulfilled');
    expect(aprovados).toHaveLength(1);
    expect(resultados.find(r => r.status==='rejected')?.reason.message).toContain('esgotada');
    const id = aprovados[0].value;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Reserva histórica cuja cobertura ainda era projetada.
      await conn.execute('UPDATE clinica_agendamentos SET custeado_pela_empresa=NULL,custeio_convenio_ref=NULL WHERE id=?',[id]);
      await fixarCotaAntesDeCancelar(conn,id);
      await conn.execute("UPDATE clinica_agendamentos SET status='cancelado' WHERE id=?",[id]);
      await conn.commit();
      const [[cancelado]] = await conn.query<RowDataPacket[]>('SELECT cota_ocorrencia_ref FROM clinica_agendamentos WHERE id=?',[id]);
      expect(cancelado.cota_ocorrencia_ref).toBe(convenio);
      await conn.execute('UPDATE clinica_convenios SET politica=? WHERE id=?',[JSON.stringify({...politicaPadrao,consumirCancelamento:false}),convenio]);
      const excedente = await reservar();
      const [[particular]] = await conn.query<RowDataPacket[]>('SELECT custeado_pela_empresa,custeio_aguarda_autorizacao FROM clinica_agendamentos WHERE id=?',[excedente]);
      expect(particular).toMatchObject({custeado_pela_empresa:0,custeio_aguarda_autorizacao:0});
    } finally { await conn.rollback(); conn.release(); }
  });
  it('fecha e recebe uma fatura fixa mesmo sem atendimento e conserva a composição após mudar o contrato', async () => {
    const id = randomUUID();
    const politica = {...politicaPadrao,base:'fixa' as const,quantidadeFixa:4};
    await pool.execute(`INSERT INTO clinica_convenios (id,instituicao_id,organizacao_ref,ref_core,nome,
      empresa_paga_sessoes,politica,valor_sessao_contrato_centavos) VALUES (?,?,?,?,?,1,?,10000)`,
      [id,fixture.inst,org,id,'Empresa fixa fictícia',JSON.stringify(politica)]);
    const dados = { competencia:'2027-02',periodoInicio:'2027-02-01',periodoFim:'2027-02-28' };
    const previa = await previaContratual(pool,org,id,politica,10000,dados.periodoInicio,dados.periodoFim);
    const fatura = await fecharFatura(org,id,{ ...dados,conferencia:{...previa,ajuste:0,motivo:''} });
    expect(fatura).toMatchObject({ totalSessoes:4,valorCents:40000 });
    await pool.execute('UPDATE clinica_convenios SET politica=? WHERE id=?',[JSON.stringify(politicaPadrao),id]);
    const paymentId = randomUUID();
    await pool.execute("UPDATE financeiro_faturas_convenio SET provedor_ref=?,status='boleto_gerado' WHERE ref_core=?",[paymentId,fatura.id]);
    const evento = { eventId:randomUUID(),eventType:'PAYMENT_RECEIVED',paymentId,amountCents:40000,receivedAt:'2027-02-10T12:00:00Z' };
    const ag = await agenda(), sessao = randomUUID();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`UPDATE clinica_agendamentos SET inicio='2027-02-10 12:00:00',status='realizado',
        realizado_em='2027-02-10 13:00:00',sessao_clinica_ref=?,custeado_pela_empresa=1,custeio_convenio_ref=? WHERE id=?`,[sessao,id,ag]);
      await registrarCobrancaContratual(conn,{agendamentoId:ag,organizacao:org,convenio:id,sessao,paciente:fixture.paciente,
        profissional:fixture.pro,inicio:new Date('2027-02-10T12:00:00Z'),confirmadaEm:new Date('2027-02-10T13:00:00Z')},10000);
      await conn.commit();
    } finally { await conn.rollback(); conn.release(); }
    const creditosAntes = (await lerCreditos(org,{},pool)).filter(l=>l.sessionId===sessao);
    expect(creditosAntes).toMatchObject([{source:'company_session',baseCents:10000,creditCents:7000}]);
    expect(await reconcileConvenioInvoicePayment(evento)).toBe('processed');
    expect(await reconcileConvenioInvoicePayment(evento)).toBe('duplicate');
    expect((await lerCreditos(org,{},pool)).filter(l=>l.sessionId===sessao)).toEqual(creditosAntes);
    const [[cobranca]] = await pool.query<RowDataPacket[]>('SELECT fatura_convenio_ref,status FROM financeiro_cobrancas WHERE instituicao_id=? AND sessao_ref=?',[fixture.inst,sessao]);
    expect(cobranca).toMatchObject({fatura_convenio_ref:fatura.id,status:'paid'});
    expect((await caixaDosContratos(org,{startDate:'2027-02-01T03:00:00Z',endDate:'2027-03-01T02:59:59Z'},evento.receivedAt)).recebido).toBe(40000);
    expect(await reconcileConvenioInvoiceRefund({...evento,eventId:randomUUID(),refundCents:4000,receivedAt:'2027-03-12T12:00:00Z'})).toBe('processed');
    expect((await caixaDosContratos(org,{startDate:'2027-03-01T03:00:00Z'},evento.receivedAt)).recebido).toBe(-4000);
    expect((await lerCreditos(org,{},pool)).some(l => l.chargeId===fatura.id)).toBe(false);
    const creditoComEstorno = (await lerCreditos(org,{},pool)).find(l=>l.sessionId===sessao)!;
    expect(creditoComEstorno.creditCents).toBe(7000);
    const manter = await registrarDecisaoCredito({...ctx,idempotencyKey:randomUUID()},creditoComEstorno.id,
      {evento:creditoComEstorno.refundRefs?.[0],ajusteCentavos:0,justificativa:'Gestão manteve o crédito da sessão realizada.'});
    expect((await lerCreditos(org,{},pool)).find(l=>l.id===manter.id)).toMatchObject({source:'adjustment',creditCents:0,originalId:creditoComEstorno.id});

  });

});
