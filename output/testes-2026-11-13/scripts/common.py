"""Utilitários de teste. Somente leitura: nada aqui salva ou confirma dados."""
import os, re

BASE = 'https://app.clinicavivermais.cloud'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
os.makedirs(OUT, exist_ok=True)
ENV = '/Users/victoralmeidaj16/Downloads/Clinica Viver Mais/.env.local'


def creds():
    vals = {}
    for line in open(ENV, encoding='utf-8'):
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return {
        'admin': (vals['EMAIL LOGIN ADMIN'], vals['SENHA LOGIN ADMIN']),
        'psi': (vals['LOGIN PSICOLOGO VICTOR TESTE'], vals['SENHA PSICOLOGO VICTOR TESTE']),
    }


def shot(page, name):
    path = os.path.join(OUT, f'{name}.png')
    page.screenshot(path=path, full_page=True)
    return path


def visible_text(page, limit=2500):
    txt = page.inner_text('body')
    txt = re.sub(r'\n\s*\n+', '\n', txt)
    return txt[:limit]


def login(browser, role):
    """Faz login (ou reaproveita sessão salva) e devolve (context, page)."""
    state = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'state-{role}.json')
    if os.path.exists(state):
        ctx = browser.new_context(storage_state=state, viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        page.goto(BASE + '/')
        page.wait_for_load_state('networkidle')
        if '/login' not in page.url:
            return ctx, page
        ctx.close()
    email, senha = creds()[role]
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = ctx.new_page()
    page.goto(BASE + '/login')
    page.wait_for_load_state('networkidle')
    page.fill('#login-email', email)
    page.fill('#login-password', senha)
    page.click('button[type=submit]')
    page.wait_for_url(lambda u: '/login' not in u, timeout=30000)
    page.wait_for_load_state('networkidle')
    ctx.storage_state(path=state)
    return ctx, page


def nav_links(page):
    out = []
    for a in page.locator('nav a, aside a').all():
        href = a.get_attribute('href') or ''
        txt = (a.inner_text() or '').strip().replace('\n', ' ')
        if href and (href, txt) not in out:
            out.append((href, txt))
    return out


def settle(page, min_chars=150, timeout=25000):
    """Espera o app cliente renderizar conteúdo útil."""
    page.wait_for_load_state('networkidle')
    try:
        page.wait_for_function(f"document.body.innerText.trim().length > {min_chars}", timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(1200)


def go(page, path):
    page.goto(BASE + path)
    settle(page)
    return page.url


def all_links(page):
    out = []
    for a in page.locator('a[href^="/"]').all():
        href = a.get_attribute('href')
        txt = ' '.join((a.inner_text() or '').split())[:50]
        if (href, txt) not in out:
            out.append((href, txt))
    return out
