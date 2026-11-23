import re
from playwright.sync_api import sync_playwright
from common import settle, shot
DUR = re.compile(r'[^.]{0,60}(dura[cç][aã]o|vari[aá]vel|50 ?min|1h ?30|90 ?min)[^.]{0,60}', re.I)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={'width':1440,'height':900})
    page.goto('https://app.clinicavivermais.cloud/vitrine?cadastro=psicologo'); settle(page)
    pos = page.locator('select:visible').nth(3)
    for label in ['Pós-graduação em Neuropsicologia Clínica', 'Pós-graduação em Avaliação Psicológica']:
        pos.select_option(label=label); page.wait_for_timeout(1200)
        form = ' '.join(page.inner_text('body').split())
        seg = form[form.find('Pós-Graduação na Viver Mais'):form.find('Termo de Adesão e Condições')]
        print(f'## {label}\n  duracao:', [m.group(0).strip() for m in DUR.finditer(seg)])
        print('  trecho:', seg[seg.find('MODALIDADE DE ATENDIMENTO'):][:300])
    shot(page, 'site_cadastro_pos')

    # Agendamento do paciente: SITE-03
    page.goto('https://clinicavivermais.cloud/'); settle(page)
    page.get_by_text('Opção 01', exact=False).first.click(); page.wait_for_timeout(2500)
    for step in range(6):
        t = ' '.join(page.inner_text('body').split())
        has = bool(re.search(r'acessibilidade|deficiência', t, re.I))
        print(f'\n## passo {step} url={page.url} acessibilidade={has}')
        print(t[:900])
        shot(page, f'site_agendar_{step}')
        if has: break
        nxt = page.get_by_role('button', name=re.compile(r'^(Agendar|Continuar|Próximo|Avançar|Escolher|Selecionar|Deixar a clínica)', re.I))
        if nxt.count() == 0: print('  sem botão de avançar'); break
        nxt.first.click(); page.wait_for_timeout(2500)
    b.close()
