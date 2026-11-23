from playwright.sync_api import sync_playwright
from common import login, shot, go
from psi_forms_util import dialog_text

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    go(page, '/pacientes')
    page.get_by_role('button', name='Prontuário').first.click()
    page.wait_for_timeout(3000)
    print('### PRONTUARIO url', page.url)
    print(dialog_text(page)[:3000]); shot(page, 'psi_prontuario')
    for btn in page.locator('button:visible').all():
        t = ' '.join((btn.inner_text() or '').split())
        if t: print('   btn:', t[:50], '| disabled' if btn.is_disabled() else '')

    go(page, '/pacientes')
    page.get_by_role('button', name='Cadastrar Novo Paciente').click()
    print('\n### NOVO PACIENTE\n', dialog_text(page)[:4500]); shot(page, 'psi_novo_paciente')
    for s in page.locator('select:visible').all():
        print('  select:', [o.inner_text() for o in s.locator('option').all()])
    b.close()
