from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(x): return ' '.join(x.inner_text().split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    net=[]
    page.on('response', lambda r: r.request.method not in ('GET','HEAD') and net.append(f'{r.status} {r.request.method} {r.url[:110]}'))
    go(page, '/linha-do-tempo?patientId=paciente-triagem-1793285270615')
    page.locator('button', has_text='Registrar Prontuário Manual').first.click(); page.wait_for_timeout(2000)
    fields = page.locator('textarea:visible, input[type=text]:visible').all()
    print('campos visíveis:', len(fields))
    texts = ['TESTE PLATAFORMA 13/11 (PSI-11) - pode apagar', 'Teste de registro - subjetivo', 'Teste de registro - objetivo', 'Teste de registro - avaliação', 'Teste de registro - plano']
    form_fields = [f for f in fields if (f.get_attribute('placeholder') or '').lower().find('buscar') < 0]
    for f, t in zip(form_fields, texts): f.fill(t)
    shot(page, 'psi_prontuario_preenchido')
    page.locator('button', has_text='Salvar no Prontuário').first.click(); page.wait_for_timeout(4000)
    body = T(page.locator('body'))
    print('rede:', net)
    i = body.find('HISTÓRICO DE PRONTUÁRIOS')
    print('depois de salvar:', body[i:i+500] if i>=0 else body[-800:])
    for kw in ['erro', 'Erro', 'não foi possível', 'Não foi possível', 'sucesso', 'salvo']:
        if kw in body: print('  contém:', kw)
    shot(page, 'psi_prontuario_salvo')
    b.close()
