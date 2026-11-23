def dialog_text(page):
    d = page.locator('[role=dialog]').last
    try:
        d.wait_for(timeout=8000); page.wait_for_timeout(1500)
        return ' '.join(d.inner_text().split())
    except Exception:
        return '(sem dialog) ' + ' '.join(page.inner_text('body').split())[:3500]
