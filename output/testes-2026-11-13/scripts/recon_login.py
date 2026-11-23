from playwright.sync_api import sync_playwright
from common import BASE, shot, visible_text

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto(BASE + '/login')
    page.wait_for_load_state('networkidle')
    print('URL', page.url)
    print(visible_text(page, 1200))
    for el in page.locator('input, button').all():
        print(el.evaluate("e => e.tagName + ' type=' + e.type + ' name=' + e.name + ' id=' + e.id + ' ph=' + (e.placeholder||'') + ' txt=' + (e.innerText||'').slice(0,40)"))
    print(shot(page, '00-login'))
    b.close()
