"""Browser integration checks. Start npm start first; requires Playwright.
Uses a system Chromium if present, otherwise Playwright's installed Chromium.
"""
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    executable=shutil.which('chromium')
    browser=p.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]; uploads=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:uploads.append(request.url) if request.method not in ('GET','HEAD') else None)
    page.goto('http://localhost:3000',wait_until='networkidle')
    page.locator('#add-record').click();page.locator('#sample-pdf').click()
    page.locator('[data-pdf-key="1:4"]').wait_for()
    page.locator('[data-pdf-key="1:4"]').check();page.locator('[data-pdf-key="1:5"]').check()
    page.locator('#pdf-page').select_option('2');page.locator('[data-pdf-key="2:4"]').wait_for();page.locator('[data-pdf-key="2:4"]').check()
    assert page.locator('#pdf-apply').is_disabled()
    page.locator('#pdf-checked').check();page.locator('#pdf-apply').click()
    assert page.locator('#record-text').input_value().count('\n')==2
    assert 'FICTIONAL' not in page.locator('#record-text').input_value()
    page.locator('#record-title').fill('PDF follow-up demo');page.locator('#record-date').fill('2026-09-18')
    page.get_by_role('button',name='Save & compare').click()
    page.get_by_role('tab',name='Source records').click()
    card=page.locator('.record-card').filter(has=page.get_by_role('heading',name='PDF follow-up demo',exact=True))
    assert '3 selected lines' in card.inner_text()
    card.get_by_role('button',name='Review extraction').click();page.locator('#extraction-reviewer').fill('Demo reviewer')
    for box in page.locator('#extraction-lines [data-confirm]').all():box.check()
    page.get_by_role('button',name='Save confirmed fields').click()
    with page.expect_download() as download:page.locator('#export-button').click()
    report=json.loads(Path(download.value.path()).read_text())
    record=next(d for d in report['records'] if d['title']=='PDF follow-up demo')
    assert record['sourceImport']['pageCount']==2
    assert len(record['sourceImport']['sha256'])==64
    assert [r['page'] for r in record['sourceImport']['lines']]==[1,1,2]
    sources=[e['sourceLocation'] for item in report['comparison']['items'] for e in item['events'] if e['docTitle']=='PDF follow-up demo']
    assert sorted(s['page'] for s in sources)==[1,1,2]
    assert not uploads,uploads
    page.locator('#add-record').click();page.locator('#record-text').fill('Preserve this draft.')
    for file,expected in {'locked.pdf':'password-protected','11-pages.pdf':'up to 10 pages','corrupt.pdf':'Invalid PDF'}.items():
        page.locator('#record-file').set_input_files(ROOT/'tests/fixtures/pdf'/file)
        page.wait_for_function("document.querySelector('#pdf-error').textContent.length > 0",timeout=15000)
        assert expected.lower() in page.locator('#pdf-error').inner_text().lower(),file
        page.locator('#pdf-dialog [data-close="pdf-dialog"]').first.click()
        assert page.locator('#record-text').input_value()=='Preserve this draft.'
    page.locator('#record-file').set_input_files(ROOT/'tests/fixtures/pdf/image-only.pdf')
    page.locator('#pdf-ocr').wait_for()
    assert page.locator('[data-pdf-key]').count()==0
    assert page.locator('#pdf-apply').is_disabled()
    page.locator('#pdf-dialog [data-close="pdf-dialog"]').first.click()
    assert page.locator('#record-text').input_value()=='Preserve this draft.'
    page.locator('#record-file').set_input_files(ROOT/'tests/fixtures/pdf/mixed.pdf')
    page.locator('[data-pdf-key="1:4"]').wait_for()
    page.locator('#pdf-warnings summary').click()
    assert 'Page 2 has no extractable text' in page.locator('#pdf-warnings').inner_text()
    page.locator('[data-pdf-key="1:4"]').check();page.locator('#pdf-checked').check();page.locator('#pdf-apply').click()
    page.locator('#record-title').fill('Mixed PDF example');page.locator('#record-date').fill('2026-09-19')
    page.get_by_role('button',name='Save & compare').click()
    assert 'Partial comparison' in page.locator('#issues-region').inner_text()
    page.locator('#issues-region summary').click()
    assert 'Page 2 has no extractable text' in page.locator('#issues-region').inner_text()
    page.set_viewport_size({'width':390,'height':844});page.locator('#add-record').click();page.locator('#sample-pdf').click()
    page.locator('[data-pdf-key="1:4"]').wait_for()
    assert page.locator('#pdf-dialog').evaluate('(element)=>element.scrollWidth<=element.clientWidth')
    (ROOT/'artifacts').mkdir(exist_ok=True);page.screenshot(path=str(ROOT/'artifacts/pdf-mobile.png'))
    page.locator('#pdf-dialog [data-close="pdf-dialog"]').first.click()
    assert page.locator('#record-text').input_value()==''
    assert not errors,errors
    print('PDF browser checks passed: selection, confirmation, provenance, error recovery, mixed pages, cancellation, privacy, and mobile layout.')
    browser.close()
