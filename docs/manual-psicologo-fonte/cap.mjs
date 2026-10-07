import {open,login,BASE,clean} from './lib.mjs';
import {mark,unmark,snap} from './helpers.mjs';

const L=(p,t)=>p.getByRole('button',{name:t}).first();

// ---- login (sem sessão)
{
  const {b,p}=await open({width:1280,height:900});
  await p.goto(BASE+'/login',{waitUntil:'networkidle'});await clean(p);
  await mark(p,[{n:1,loc:'input[type=email]',round:16},{n:2,loc:'input[type=password]',round:16},{n:3,loc:p.getByText('Esqueceu a senha?'),pad:3,round:8},{n:4,loc:p.locator('button,a').filter({hasText:/Entrar na plataforma/}).first(),round:18}]);
  await snap(p,'login',{x:640,y:90,width:620,height:730});
  await b.close();
}
const {b,p}=await open({width:1280,height:900});
await login(p);
const goto=async r=>{await p.goto(BASE+r,{waitUntil:'networkidle'});await clean(p);await p.waitForTimeout(900);};

// ---- menu
await goto('/cockpit');
await mark(p,[...['Meu Painel','Meu Cadastro','Meus Pacientes','Prontuários dos Pacientes','Meu Financeiro','Agenda & Horários'].map((t,i)=>({n:i+1,loc:p.locator('aside a',{hasText:t}),pad:1,round:18})),{n:7,loc:p.locator('aside').getByText('Sair da conta'),pad:6,round:12}]);
await snap(p,'menu',{x:0,y:0,width:270,height:900});
await unmark(p);
// ---- painel topo
await mark(p,[{n:1,loc:p.locator('button,a').filter({hasText:/Cadastrar Paciente/}).first(),round:26},{n:2,loc:p.locator('select').first(),round:20},{n:3,loc:p.getByRole('button',{name:/Abrir \/ Lançar Prontuário/}),round:20},{n:4,loc:p.locator('button,a').filter({hasText:/Copiar Link/}).first(),round:20},{n:5,loc:p.locator('button,a').filter({hasText:/Enviar Wpp/}).first(),round:20}]);
await snap(p,'painel-topo',{x:270,y:100,width:1010,height:350});
await unmark(p);
// ---- painel próximas sessões
await mark(p,[{n:1,loc:p.locator('button,a').filter({hasText:/Lembrar Wpp/}).first(),round:20},{n:2,loc:p.locator('button,a').filter({hasText:/Prontuário/}).last(),round:20},{n:3,loc:p.getByText('Ver grade completa'),pad:3,round:8}]);
const sec=await p.getByText('Suas Próximas Sessões Agendadas').boundingBox();
await snap(p,'painel-sessoes',{x:270,y:sec.y+await p.evaluate(()=>scrollY)-40,width:1010,height:290});
await unmark(p);

// ---- pacientes
await goto('/pacientes');
await mark(p,[{n:1,loc:p.locator('button,a').filter({hasText:/Cadastrar Novo Paciente/}).first(),round:26},{n:2,loc:p.getByPlaceholder(/Buscar paciente por nome/),round:24}]);
await snap(p,'pacientes-topo',{x:270,y:100,width:1010,height:760});
await unmark(p);
const card=p.locator('text=Paciente Exemplo 1').first();
await mark(p,[{n:1,loc:p.locator('button,a').filter({hasText:/^Prontuário/}).first(),round:22},{n:2,loc:p.locator('button,a').filter({hasText:/^Agendar/}).first(),round:22},{n:3,loc:p.locator('button,a').filter({hasText:/Enviar Agenda/}).first(),round:22},{n:4,loc:p.getByText('Documentos').first(),pad:4,round:8},{n:5,loc:p.getByText('Registrar desistência').first(),pad:4,round:8}]);
{const y=await p.evaluate(()=>scrollY);const c=await card.boundingBox();await snap(p,'pacientes-card',{x:270,y:c.y+y-50,width:480,height:275});}
await unmark(p);

// ---- cadastro de paciente (modal)
await p.locator('button,a').filter({hasText:/Cadastrar Novo Paciente/}).first().click();await p.waitForTimeout(1200);
const modal=p.locator('form').filter({has:p.getByPlaceholder('Nome completo')}).first();
console.log('modal form?', await modal.count());
await mark(p,[{n:1,loc:p.locator('select').nth(2),round:20},{n:2,loc:p.locator('select').nth(3),round:20},{n:3,loc:p.getByPlaceholder('Nome completo'),round:20},{n:4,loc:p.getByPlaceholder('(00) 00000-0000').first(),round:20},{n:5,loc:p.getByPlaceholder('paciente@email.com'),round:20},{n:6,loc:p.locator('#cadastro-interno-paciente-genero'),round:20},{n:7,loc:p.getByPlaceholder('000.000.000-00'),round:20}]);
await p.screenshot({path:'shots/cad-topo.png',clip:{x:320,y:20,width:640,height:760}});
await unmark(p);
console.log((await p.locator('button').evaluateAll(e=>e.map(x=>x.innerText.trim()).filter(Boolean))).slice(-8));
await b.close();
