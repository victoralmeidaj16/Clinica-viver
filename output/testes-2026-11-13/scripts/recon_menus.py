from playwright.sync_api import sync_playwright
from common import login, shot, settle, all_links, visible_text

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for role in ('admin', 'psi'):
        ctx, page = login(b, role)
        settle(page)
        print(f'== {role}: {page.url}')
        for href, txt in all_links(page):
            print('  ', href, '|', txt)
        print(visible_text(page, 600))
        print('  ', shot(page, f'01-home-{role}'))
        ctx.close()
    b.close()
