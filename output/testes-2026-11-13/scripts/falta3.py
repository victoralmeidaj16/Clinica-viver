from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(x): return ' '.join(x.inner_text().split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    reqs=[]
    page.on('request', lambda r: r.method not in ('GET','HEAD') and reqs.append(f'{r.method} {r.url[:100]}'))
    go(page, '/agenda')
    page.evaluate("document.querySelectorAll('div.fixed.inset-0').forEach(e => { if (getComputedStyle(e).zIndex === '90') e.remove() })")
    page.wait_for_timeout(500)
    btn = page.locator('button', has_text='Registrar falta')
    print('botões falta:', btn.count())
    btn.first.click(); page.wait_for_timeout(2500)
    d = page.locator('[role=dialog], [role=alertdialog]')
    print('## REGISTRAR FALTA:', T(d.last) if d.count() else T(page.locator('main'))[:2000])
    shot(page, 'psi_registrar_falta')
    print('   escritas disparadas:', reqs)
    b.close()
