import re, json
from playwright.sync_api import sync_playwright
from common import login, shot, go, visible_text

ROUTES = {
  'psi': ['/meu-cadastro', '/pacientes', '/agenda', '/meu-financeiro', '/linha-do-tempo', '/relatorios', '/ajuda'],
  'admin': ['/gestao/cockpit', '/gestao/agenda', '/gestao/psicologos', '/gestao/pacientes', '/gestao/financeiro',
            '/financeiro', '/relatorios', '/convenios', '/configuracoes/integracoes', '/ajuda'],
}
ERR = re.compile(r'(erro|falha|não foi possível|nao foi possivel|something went wrong|application error|500|404)', re.I)
report = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for role, routes in ROUTES.items():
        ctx, page = login(b, role)
        events = []
        page.on('console', lambda m: m.type == 'error' and events.append(('console', m.text[:200])))
        page.on('pageerror', lambda e: events.append(('pageerror', str(e)[:200])))
        page.on('response', lambda r: r.status >= 400 and '/_next/' not in r.url and events.append(('http', f'{r.status} {r.request.method} {r.url[:120]}')))
        for r in routes:
            events.clear()
            url = go(page, r)
            txt = visible_text(page, 6000)
            hits = sorted({m.group(0).lower() for m in ERR.finditer(txt)})
            name = f"{role}{r.replace('/', '_')}"
            shot(page, name)
            report[name] = {'url': url, 'chars': len(txt), 'err_words': hits, 'events': list(events)}
            print(f"[{role}] {r} -> {url.replace('https://app.clinicavivermais.cloud','')} chars={len(txt)} errwords={hits}")
            for e in events: print('     ', e)
        ctx.close()
    b.close()
json.dump(report, open('sweep.json', 'w'), ensure_ascii=False, indent=1)
