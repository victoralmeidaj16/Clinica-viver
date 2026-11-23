import re
from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(x): return ' '.join(x.inner_text().split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    # PSI-15
    ctx, page = login(b, 'psi')
    go(page, '/agenda')
    t = T(page.locator('body'))
    i = t.find('Paciente Teste')
    print('## PSI agenda trecho:', t[max(0,i-200):i+600] if i>=0 else t[:1500])
    btns = [' '.join(x.inner_text().split()) for x in page.locator('main button:visible').all()]
    print('   botões:', [x for x in btns if x][:40])
    shot(page, 'psi_agenda')
    ctx.close()
    # GES-01
    ctx, page = login(b, 'admin')
    go(page, '/gestao/agenda')
    page.get_by_role('button', name='Editar', exact=True).first.click(); page.wait_for_timeout(2500)
    d = page.locator('[role=dialog]').last
    print('\n## GESTAO editar sessão:', T(d)[:1500] if d.count() else T(page.locator('body'))[-1500:])
    for el in page.locator('input[type=date], input[type=datetime-local], input[type=time]').all():
        print('   input', el.get_attribute('type'), 'min=', el.get_attribute('min'), 'max=', el.get_attribute('max'), 'value=', el.input_value())
    shot(page, 'admin_editar_sessao')
    b.close()
