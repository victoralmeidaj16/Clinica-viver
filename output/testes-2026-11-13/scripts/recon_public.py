from playwright.sync_api import sync_playwright
from common import settle
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={'width':1440,'height':900})
    for url in ['https://clinicavivermais.cloud/', 'https://app.clinicavivermais.cloud/vitrine']:
        page.goto(url); settle(page)
        print('==', url, '->', page.url)
        seen=set()
        for el in page.locator('a, button').all():
            t=' '.join((el.inner_text() or '').split())[:50]; h=el.get_attribute('href') or ''
            if t and (t,h) not in seen: seen.add((t,h)); print('  ', t, '|', h)
    b.close()
