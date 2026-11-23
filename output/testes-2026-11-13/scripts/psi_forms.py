from playwright.sync_api import sync_playwright
from common import login, shot, go

def dialog_text(page):
    d = page.locator('[role=dialog]').last
    try:
        d.wait_for(timeout=8000)
        page.wait_for_timeout(1500)
        return ' '.join(d.inner_text().split())
    except Exception:
        return '(sem dialog) ' + ' '.join(page.inner_text('body').split())[:3000]

def close(page):
    page.keyboard.press('Escape'); page.wait_for_timeout(800)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    go(page, '/pacientes')

    page.get_by_role('button', name='Agendar').first.click()
    print('### AGENDAR (conveniado)\n', dialog_text(page)[:3500]); shot(page, 'psi_agendar_conveniado'); close(page)

    page.get_by_role('button', name='Prontuário').first.click()
    print('\n### PRONTUARIO\n', dialog_text(page)[:2500]); shot(page, 'psi_prontuario'); close(page)

    go(page, '/pacientes')
    page.get_by_role('button', name='Cadastrar Novo Paciente').click()
    print('\n### NOVO PACIENTE\n', dialog_text(page)[:4000]); shot(page, 'psi_novo_paciente')
    for s in page.locator('[role=dialog] select').all():
        print('  select:', [o.inner_text() for o in s.locator('option').all()])
    close(page)
    b.close()
