import re
from playwright.sync_api import sync_playwright
from common import settle, shot
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={'width':1440,'height':900})
    page.goto('https://app.clinicavivermais.cloud/vitrine?cadastro=psicologo'); settle(page)
    t = ' '.join(page.inner_text('body').split())
    i = t.find('Foto'); 
    print('acessibilidade no form:', bool(re.search(r'acessibilidade|deficiência', t, re.I)))
    print('trecho foto:', t[max(0,i-80):i+200] if i>=0 else 'sem "Foto"')
    shot(page, 'site_cadastro_psi')
    for s in page.locator('select:visible').all():
        opts=[o.inner_text() for o in s.locator('option').all()]
        print('  select:', opts[:14])
    file_inputs = page.locator('input[type=file]').all()
    print('file inputs:', [(f.get_attribute('required'), f.get_attribute('aria-required'), f.get_attribute('name')) for f in file_inputs])
    print('\nTEXTO:', t[:5000])
    b.close()
