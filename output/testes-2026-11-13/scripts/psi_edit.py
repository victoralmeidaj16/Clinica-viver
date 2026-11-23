import re
from playwright.sync_api import sync_playwright
from common import login, shot, go
from psi_forms_util import dialog_text

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'psi')
    go(page, '/meu-cadastro')
    page.get_by_role('button', name='Editar meu perfil').click()
    page.wait_for_timeout(2500)
    t = dialog_text(page)
    print(t[:5000]); shot(page, 'psi_editar_perfil')
    print('\nmencoes de duracao:', sorted(set(re.findall(r'(50 ?min|90 ?min|1h ?30(?: ?min)?|60 ?min|vari[aá]vel|duração[^.]{0,60})', t, re.I))))
    b.close()
