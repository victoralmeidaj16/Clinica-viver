import time
from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(x): return ' '.join(x.inner_text().split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for tent in range(6):
        try:
            ctx, page = login(b, 'psi'); go(page, '/agenda'); break
        except Exception as e:
            print('aguardando web...', str(e)[:80]); time.sleep(15)
    t = T(page.locator('body')); i = t.find('Paciente Teste 03/11')
    print('PSI agenda:', t[i:i+260])
    shot(page, 'verify19_psi'); ctx.close()
    ctx, page = login(b, 'admin'); go(page, '/gestao/agenda')
    t = T(page.locator('body')); i = t.find('Paciente Teste')
    print('\nGESTAO agenda:', t[i:i+200])
    shot(page, 'verify19_admin')
    b.close()
