import {open,login,BASE,clean} from './lib.mjs';
import {mark,unmark,snap} from './helpers.mjs';
const {b,p}=await open({width:1280,height:900});
await login(p);
const goto=async r=>{await p.goto(BASE+r,{waitUntil:'networkidle'});await clean(p);await p.waitForTimeout(900);};
const BA=(t)=>p.locator('button,a').filter({hasText:t}).first();
const sy=()=>p.evaluate(()=>scrollY);
const pageY=async loc=>(await loc.boundingBox()).y+await sy();
const X=270,W=1010;
await goto('/agenda');
await mark(p,[{n:1,loc:BA(/Copiar$/),round:20},{n:2,loc:BA(/WhatsApp/),round:20},{n:3,loc:BA(/Agendar sessão/),round:26}]);
await snap(p,'agenda-link',{x:X,y:100,width:W,height:335});
await unmark(p);
const grade=p.getByText('Seus dias de atendimento');
await mark(p,[{n:1,loc:p.locator('input[type=checkbox],[role=switch]').nth(1),pad:4,round:20},{n:2,loc:p.getByText('Duração das sessões'),pad:4,round:8,maxW:190},{n:3,loc:p.getByText('Períodos de atendimento'),pad:4,round:8,maxW:260},{n:4,loc:BA(/Adicionar período/),round:16},{n:5,loc:BA(/Copiar para/),round:16}]);
await snap(p,'agenda-grade',{x:X,y:await pageY(grade)-30,width:W,height:620});
await unmark(p);

// modal agendar
await goto('/agenda');
await BA(/Agendar sessão/).click();await p.waitForTimeout(1200);
const M=p.getByText('Novo agendamento').first().locator('xpath=ancestor::div[contains(@class,"fixed")][1]');console.log('M',await M.count());const inModal=M.locator('select').first();
await mark(p,[{n:1,loc:inModal,round:20,noScroll:1},{n:2,loc:M.locator('input[type=date]').first(),round:20,noScroll:1},{n:3,loc:M.locator('input[type=time]').first(),round:20,noScroll:1},{n:4,loc:p.getByRole('button',{name:/Semanal/}),round:16,noScroll:1},{n:5,loc:p.getByText(/sessões? selecionadas?/i).first(),pad:4,round:12,noScroll:1}]);
await p.screenshot({path:'shots/agendar-topo.png',clip:{x:370,y:20,width:540,height:880}});
await unmark(p);
// rola o modal até o fim
await p.evaluate(()=>{ for(const e of document.querySelectorAll('div')){ const s=getComputedStyle(e); if((s.overflowY==='auto'||s.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+50&&e.querySelector('input[type=time]')) e.scrollTop=e.scrollHeight; }});
await p.waitForTimeout(500);
await mark(p,[{n:6,loc:p.getByRole('button',{name:'Presencial'}),round:18,noScroll:1},{n:7,loc:BA(/Agendar \d+ sess/),round:22,noScroll:1},{n:8,loc:p.getByText('Vencimento da cobrança').first(),pad:6,round:10,noScroll:1,maxW:300}]);
await p.screenshot({path:'shots/agendar-base.png',clip:{x:370,y:20,width:540,height:880}});
await unmark(p);

// header
await goto('/cockpit');
await mark(p,[{n:1,loc:p.getByPlaceholder(/Buscar paciente ou sessão/),round:24},{n:2,loc:p.getByLabel(/Notificações/),round:16,pad:6},{n:3,loc:p.getByText('PSICOLOGO DE TESTE').first(),pad:10,round:20}]);
await snap(p,'header',{x:X-14,y:0,width:W+14,height:100});
await unmark(p);
await p.getByLabel(/Notificações/).click();await p.waitForTimeout(800);
await p.screenshot({path:'shots/sino.png',clip:{x:360,y:0,width:920,height:300}});
await b.close();
