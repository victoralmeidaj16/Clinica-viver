import {open,login,BASE,clean} from './lib.mjs';
import {mark,unmark,snap} from './helpers.mjs';
const {b,p}=await open({width:1280,height:900});
await login(p);
const goto=async r=>{await p.goto(BASE+r,{waitUntil:'networkidle'});await clean(p);await p.waitForTimeout(900);};
const BA=(t)=>p.locator('button,a').filter({hasText:t}).first();
const sy=()=>p.evaluate(()=>scrollY);
const pageY=async loc=>(await loc.boundingBox()).y+await sy();

// ---- cadastro (modal) topo + base
await goto('/pacientes');
await BA(/Cadastrar Novo Paciente/).click();await p.waitForTimeout(1200);
const form=p.locator('form').filter({has:p.getByPlaceholder('Nome completo')}).first();
const fb=await form.boundingBox();
const sel=form.locator('select');
await mark(p,[{n:1,loc:sel.nth(0),round:20},{n:2,loc:sel.nth(1),round:20},{n:3,loc:p.getByPlaceholder('Nome completo'),round:20},{n:4,loc:p.getByPlaceholder('(00) 00000-0000').first(),round:20},{n:5,loc:p.getByPlaceholder('paciente@email.com'),round:20},{n:6,loc:p.locator('#cadastro-interno-paciente-genero'),round:20},{n:7,loc:p.getByPlaceholder('000.000.000-00'),round:20}]);
await p.screenshot({path:'shots/cad-topo.png',clip:{x:fb.x-20,y:fb.y-5,width:fb.width+40,height:Math.min(fb.height,900-fb.y)+0}});
await unmark(p);
const salvar=BA(/Salvar paciente/);
await salvar.scrollIntoViewIfNeeded();
await mark(p,[{n:8,loc:p.locator('input[name=turno]').first().locator('xpath=ancestor::*[2]'),round:16},{n:9,loc:salvar,round:22}]);
const fb2=await form.boundingBox();
await p.screenshot({path:'shots/cad-base.png',clip:{x:fb2.x-20,y:Math.max(0,fb2.y),width:fb2.width+40,height:Math.min(fb2.height,900)}});
await unmark(p);
console.log('cad ok', JSON.stringify(fb2));

// ---- agenda
await goto('/agenda');
const X=270,W=1010;
await mark(p,[{n:1,loc:p.locator('button').filter({hasText:/^Copiar$/}).first(),round:20},{n:2,loc:BA(/WhatsApp/),round:20},{n:3,loc:BA(/Agendar sessão/).first(),round:26}]);
await snap(p,'agenda-link',{x:X,y:100,width:W,height:560});
await unmark(p);
// calendário
const cal=p.getByText('Calendário do profissional');
await mark(p,[{n:1,loc:p.getByText('Selecionar todos os livres').first(),round:16},{n:2,loc:p.getByText('Bloquear dia inteiro').first(),round:16}]);
await snap(p,'agenda-calendario',{x:X,y:await pageY(cal)-60,width:W,height:760});
await unmark(p);
// grade semanal
const grade=p.getByText('Seus dias de atendimento');
await mark(p,[{n:1,loc:p.locator('input[type=checkbox],[role=switch]').nth(1),pad:4,round:20},{n:2,loc:p.getByText('Duração das sessões'),pad:4,round:8},{n:3,loc:p.getByText('Períodos de atendimento'),pad:4,round:8},{n:4,loc:BA(/Adicionar período/),round:16},{n:5,loc:BA(/Copiar para/),round:16}]);
await snap(p,'agenda-grade',{x:X,y:await pageY(grade)-30,width:W,height:560});
await unmark(p);
// bloqueios
const blq=p.getByText('Períodos bloqueados').first();
await mark(p,[{n:1,loc:p.locator('input[type=date]').nth(0),round:16},{n:2,loc:p.locator('input[type=date]').nth(1),round:16},{n:3,loc:BA(/^\+?\s*Bloquear$/),round:16}]);
await snap(p,'agenda-bloqueios',{x:X,y:await pageY(blq)-50,width:W,height:360});
await unmark(p);
// sessões
const ses=p.getByText('Sessões e confirmações');
await mark(p,[{n:1,loc:BA(/Confirmar que ocorreu/),round:20},{n:2,loc:BA(/Pagamento da sessão/),round:20},{n:3,loc:BA(/Copiar link/),round:20},{n:4,loc:BA(/Reagendar/),round:20},{n:5,loc:BA(/Cancelar$/),round:20}]);
await snap(p,'agenda-sessoes',{x:X,y:await pageY(ses)-40,width:W,height:560});
await unmark(p);

// ---- agendar sessão (modal)
await goto('/agenda');
await BA(/Agendar sessão/).click();await p.waitForTimeout(1200);
const dlg=p.locator('div').filter({has:p.getByText('Novo agendamento')}).last();
await mark(p,[{n:1,loc:p.locator('select').nth(0),round:20},{n:2,loc:p.locator('input[type=date]').first(),round:20},{n:3,loc:p.locator('input[type=time]').first(),round:20},{n:4,loc:p.getByText('Semanal').first(),pad:2,round:16},{n:5,loc:p.getByText('4 sessões selecionadas').first(),pad:4,round:12},{n:6,loc:p.getByRole('button',{name:'Presencial'}),round:18},{n:7,loc:BA(/Agendar \d+ sess/),round:22}]);
await p.screenshot({path:'shots/agendar.png',clip:{x:370,y:20,width:540,height:830}});
await unmark(p);

// ---- prontuário
await goto('/linha-do-tempo');
await mark(p,[{n:1,loc:p.locator('select').first(),round:20},{n:2,loc:BA(/Registrar Prontuário Manual/),round:24},{n:3,loc:BA(/^\s*Documentos/),round:16}]);
await snap(p,'pront-topo',{x:X,y:100,width:W,height:300});
await unmark(p);
await BA(/Registrar Prontuário Manual/).click();await p.waitForTimeout(1200);
const nf=p.getByText('Novo Registro de Prontuário Manual');
await mark(p,[{n:1,loc:p.getByPlaceholder(/Sessão Semanal TCC/),round:16},{n:2,loc:p.getByPlaceholder(/Queixas, sentimentos/),round:14},{n:3,loc:p.getByPlaceholder(/Comportamentos observados/),round:14},{n:4,loc:p.getByPlaceholder(/Impressões clínicas/),round:14},{n:5,loc:p.getByPlaceholder(/Tarefas combinadas/),round:14},{n:6,loc:BA(/Salvar no Prontuário/),round:22}]);
await snap(p,'pront-form',{x:X,y:await pageY(nf)-40,width:W,height:500});
await unmark(p);

// ---- documentos
await goto('/pacientes');
await p.locator('text=Documentos').first().click();await p.waitForTimeout(2500);await clean(p);
await mark(p,[{n:1,loc:p.locator('select').nth(0),round:16},{n:2,loc:p.getByLabel('Local do atendimento e emissão'),round:16},{n:3,loc:p.locator('select').nth(1),round:16},{n:4,loc:p.locator('select').nth(2),round:16},{n:5,loc:BA(/Revisar documento/),round:16}]);
await snap(p,'docs',{x:X,y:100,width:W,height:560});
await unmark(p);

// ---- financeiro
await goto('/meu-financeiro');
await mark(p,[{n:1,loc:p.locator('input[type=month]'),round:18},{n:2,loc:BA(/^Atualizar/),round:18},{n:3,loc:p.getByText(/Crédito de .* \(70%\)/).locator('xpath=..'),pad:8,round:14},{n:4,loc:BA(/Exportar CSV/),round:18},{n:5,loc:p.getByText('Status dos atendimentos'),pad:6,round:10}]);
await snap(p,'financeiro',{x:X,y:100,width:W,height:600});
await unmark(p);

// ---- cabeçalho: busca / sino / perfil
await goto('/cockpit');
await mark(p,[{n:1,loc:p.getByPlaceholder(/Buscar paciente ou sessão/),round:24},{n:2,loc:p.locator('header button').first(),round:14}]);
await snap(p,'header',{x:X,y:0,width:W,height:100});
await unmark(p);
await b.close();
