from playwright.sync_api import sync_playwright
from common import login, shot, go
from psi_forms_util import dialog_text

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    errs = []
    page.on('response', lambda r: r.status >= 400 and '/_next/' not in r.url and errs.append(f'{r.status} {r.request.method} {r.url[:110]}'))
    go(page, '/linha-do-tempo?patientId=paciente-triagem-1793285270615')
    page.get_by_role('button', name='Registrar Prontuário Manual').click()
    print('### FORM PRONTUARIO\n', dialog_text(page)[:2500]); shot(page, 'psi_prontuario_form')
    for el in page.locator('[role=dialog] textarea, [role=dialog] input, [role=dialog] select').all():
        print('  campo:', el.evaluate("e=>e.tagName+' '+(e.type||'')+' '+(e.placeholder||e.name||'')"), '| disabled' if el.is_disabled() else '')
    for btn in page.locator('[role=dialog] button').all():
        t = ' '.join((btn.inner_text() or '').split())
        if t: print('  btn:', t[:50], '| disabled' if btn.is_disabled() else '')
    print('http errs:', errs)

    errs.clear()
    go(page, '/meu-cadastro')
    print('\n### MEU CADASTRO\n', ' '.join(page.inner_text('body').split())[:2500]); shot(page, 'psi_meu_cadastro')
    for btn in page.locator('main button:visible').all():
        t = ' '.join((btn.inner_text() or '').split())
        if t: print('  btn:', t[:60])
    print('http errs:', errs)
    b.close()
