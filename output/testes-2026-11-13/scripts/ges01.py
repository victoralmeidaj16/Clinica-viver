from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(x): return ' '.join(x.inner_text().split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'admin')
    go(page, '/gestao/agenda')
    page.evaluate("document.querySelectorAll('div.fixed.inset-0').forEach(e => { if (getComputedStyle(e).zIndex === '90') e.remove() })")
    eds = page.locator('button').filter(has_text='Editar').filter(has_not_text='vencimento')
    print('botões editar:', eds.count())
    eds.first.click(); page.wait_for_timeout(2500)
    d = page.locator('[role=dialog]')
    print('## EDITAR:', T(d.last)[:1500] if d.count() else T(page.locator('body'))[-2500:])
    for el in page.locator('input[type=date], input[type=datetime-local], input[type=time]').all():
        print('   input', el.get_attribute('type'), 'min=', el.get_attribute('min'), 'max=', el.get_attribute('max'), 'value=', el.input_value())
    shot(page, 'admin_editar_sessao')
    b.close()
