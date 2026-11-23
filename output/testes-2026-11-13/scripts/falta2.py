from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(x): return ' '.join(x.inner_text().split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    reqs=[]
    page.on('request', lambda r: r.method not in ('GET','HEAD') and reqs.append(f'{r.method} {r.url[:100]}'))
    go(page, '/agenda')
    sk = page.get_by_role('button', name='Pular')
    if sk.count(): sk.first.click(); page.wait_for_timeout(800)
    page.get_by_role('button', name='Registrar falta').first.click(); page.wait_for_timeout(2500)
    d = page.locator('[role=dialog], [role=alertdialog]')
    print('## REGISTRAR FALTA:', T(d.last) if d.count() else T(page.locator('body'))[:2500])
    shot(page, 'psi_registrar_falta')
    print('   requisições de escrita disparadas:', reqs)
    ctx.close()

    ctx, page = login(b, 'admin')
    go(page, '/gestao/agenda')
    page.locator('main button').filter(has_text='Editar').filter(has_not_text='vencimento').first.click(); page.wait_for_timeout(2500)
    d = page.locator('[role=dialog]')
    print('\n## GESTAO editar sessão:', T(d.last)[:1500] if d.count() else '(sem dialog)')
    for el in page.locator('input[type=date], input[type=datetime-local], input[type=time]').all():
        print('   input', el.get_attribute('type'), 'min=', el.get_attribute('min'), 'max=', el.get_attribute('max'), 'value=', el.input_value())
    shot(page, 'admin_editar_sessao')
    b.close()
