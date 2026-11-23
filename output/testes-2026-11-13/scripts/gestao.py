import re
from playwright.sync_api import sync_playwright
from common import login, shot, go
def T(page): return ' '.join(page.inner_text('body').split())
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, page = login(b, 'admin')
    errs=[]
    page.on('response', lambda r: r.status >= 400 and '/_next/' not in r.url and errs.append(f'{r.status} {r.request.method} {r.url[:110]}'))

    go(page, '/gestao/psicologos'); t=T(page)
    print('## PSICOLOGOS rodízio:', [m.group(0) for m in re.finditer(r'[^.]{0,40}(rod[ií]zio|posi[cç][aã]o|\d+º)[^.]{0,40}', t, re.I)][:8])

    go(page, '/gestao/agenda'); t=T(page)
    tabs=[' '.join(x.inner_text().split()) for x in page.locator('[role=tab], main button').all()][:25]
    print('\n## AGENDA botões/abas:', tabs)
    for tab in page.locator('[role=tab]').all():
        tab.click(); page.wait_for_timeout(1500)
        print('   aba', ' '.join(tab.inner_text().split()), '-> ok, chars', len(T(page)))
    shot(page,'admin_agenda')
    print('   resumo disponibilidade:', bool(re.search('disponibilidade', T(page), re.I)))

    go(page, '/gestao/cockpit')
    page.locator('header button').filter(has_text=re.compile(r'^\d+$')).first.click(); page.wait_for_timeout(2000)
    print('\n## SINO admin:', T(page)[:1] and ' '.join(page.locator('[role=dialog], [role=menu], [data-radix-popper-content-wrapper]').last.inner_text().split())[:1200])
    shot(page,'admin_sino')
    print('\nhttp errs:', errs)
    b.close()
