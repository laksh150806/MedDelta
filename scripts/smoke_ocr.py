"""Real browser OCR checks with fictional fixtures. Start npm start first.
Requires Python Playwright and Chromium. Uses vendored OCR, never a mock result.
"""
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests/fixtures/ocr'

def recognize(page):
    page.locator('#pdf-ocr').click()
    page.wait_for_function("document.querySelectorAll('[data-ocr-key]').length>0 || document.querySelector('#pdf-error').textContent.length>0",timeout=120000)
    assert not page.locator('#pdf-error').inner_text(),page.locator('#pdf-error').inner_text()

def key_for(page,medicine):
    return next(el.get_attribute('data-ocr-key') for el in page.locator('[data-ocr-key]').all() if medicine in el.input_value())

def cancel(page):
    page.locator('#pdf-dialog [data-close="pdf-dialog"]').first.click()

def exported(page):
    with page.expect_download() as d:page.locator('#export-button').click()
    return json.loads(Path(d.value.path()).read_text())

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,**({'executable_path':shutil.which('chromium')} if shutil.which('chromium') else {}))
    context=browser.new_context(viewport={'width':1440,'height':1000})
    # Local-only OCR must still work when the optional web fonts/CDNs are unavailable.
    context.route('**/*',lambda route:route.continue_() if urlparse(route.request.url).hostname in ('localhost','127.0.0.1') else route.abort())
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    context.on('request',lambda r:requests.append((r.method,r.url)))
    page.goto('http://localhost:3000',wait_until='networkidle');requests.clear()
    page.locator('#add-record').click();page.locator('#sample-scan').click();recognize(page)
    assert not page.locator('[data-pdf-key]:checked').count()
    assert page.locator('#pdf-apply').is_disabled()
    for medicine in ['Metformin','Amlodipine','Cetirizine']:
        page.locator(f'[data-pdf-key="{key_for(page,medicine)}"]').check()
    page.locator('#pdf-checked').check()
    metformin=page.locator(f'[data-ocr-key="{key_for(page,"Metformin")}"]')
    original=metformin.input_value();metformin.fill(original.rstrip('.'))
    assert not page.locator('#pdf-checked').is_checked()
    assert page.locator('#pdf-apply').is_disabled()
    page.locator('#pdf-checked').check()
    (ROOT/'artifacts').mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT/'artifacts/ocr-desktop.png'))
    page.locator('#pdf-apply').click();page.locator('#record-title').fill('OCR integration example');page.locator('#record-date').fill('2026-09-20')
    page.get_by_role('button',name='Save & compare').click()
    page.locator('#extraction-source').wait_for();assert 'OCR draft' in page.locator('#extraction-source').inner_text()
    assert not page.locator('#extraction-lines [data-confirm]:checked').count()
    page.locator('#extraction-dialog [data-close="extraction-dialog"]').first.click()
    report=exported(page)
    assert not [e for i in report['comparison']['items'] for e in i['events'] if e['docTitle']=='OCR integration example']
    card=page.locator('.record-card').filter(has=page.get_by_role('heading',name='OCR integration example',exact=True))
    card.get_by_role('button',name='Review extraction').click();page.locator('#extraction-reviewer').fill('Fictional test reviewer')
    first=page.locator('#extraction-lines .extraction-row').first
    first.locator('[data-confirm]').check();first.locator('[data-field="amount"]').fill('500')
    assert not first.locator('[data-confirm]').is_checked()
    for box in page.locator('#extraction-lines [data-confirm]').all():box.check()
    page.get_by_role('button',name='Save confirmed fields').click()
    report=exported(page);record=next(d for d in report['records'] if d['title']=='OCR integration example')
    source=record['sourceImport'];assert source['type']=='image' and source['ocrUsed']
    assert len(source['sha256'])==64 and source['lines'][0]['originalText']==original
    assert source['lines'][0]['text']==original.rstrip('.') and source['lines'][0]['bbox']
    events=[e for i in report['comparison']['items'] for e in i['events'] if e['docTitle']=='OCR integration example']
    assert len(events)==3 and all(e['extraction']=='human-confirmed' for e in events)
    assert events[0]['sourceLocation']['sourceType']=='image'
    assert all(e['sourceLocation']['method']=='ocr' for e in events)
    assert not any(method not in ('GET','HEAD') for method,url in requests),requests
    assert not any(urlparse(url).hostname not in ('localhost','127.0.0.1') for method,url in requests),requests
    print('PNG: recognition, correction history, mandatory field review, export, and same-origin-only processing passed.',flush=True)
    # Image-only PDF follows the same recognition and correction path.
    page.locator('#add-record').click();page.locator('#record-file').set_input_files(FIXTURES/'printed-scan.pdf')
    page.locator('#pdf-ocr').wait_for();assert not page.locator('[data-pdf-key]').count();recognize(page)
    page.locator(f'[data-pdf-key="{key_for(page,"Metformin")}"]').check();page.locator('#pdf-checked').check();page.locator('#pdf-apply').click()
    page.locator('#record-title').fill('Scanned PDF');page.locator('#record-date').fill('2026-09-21');page.get_by_role('button',name='Save & compare').click()
    page.locator('#extraction-reviewer').fill('Fictional reviewer');page.locator('#extraction-lines [data-confirm]').check();page.get_by_role('button',name='Save confirmed fields').click()
    record=next(d for d in exported(page)['records'] if d['title']=='Scanned PDF')
    assert record['sourceImport']['type']=='pdf' and record['sourceImport']['lines'][0]['page']==1
    print('Scanned PDF: real OCR and page references passed.',flush=True)
    page.locator('#add-record').click();page.locator('#record-text').fill('Preserve this draft.')
    for name in ['printed.jpg','printed.webp']:
        page.locator('#record-file').set_input_files(FIXTURES/name);recognize(page)
        assert key_for(page,'Metformin');cancel(page)
        assert page.locator('#record-text').input_value()=='Preserve this draft.'
    for name in ['blank.png','corrupt.png']:
        page.locator('#record-file').set_input_files(FIXTURES/name)
        if name=='blank.png':page.locator('#pdf-ocr').click()
        page.wait_for_function("document.querySelector('#pdf-error').textContent.length>0",timeout=120000)
        assert ('No printed text' if name=='blank.png' else 'could not be decoded') in page.locator('#pdf-error').inner_text()
        cancel(page);assert page.locator('#record-text').input_value()=='Preserve this draft.'
    # Cancel while the worker is loading/recognizing, then successfully retry the same file.
    page.locator('#sample-scan').click()
    with page.expect_event('worker',timeout=15000):page.locator('#pdf-ocr').click()
    cancel(page)
    assert page.locator('#record-text').input_value()=='Preserve this draft.'
    context.route('**/vendor/tesseract/eng.traineddata.gz',lambda route:route.abort())
    page.locator('#sample-scan').click();page.locator('#pdf-ocr').click()
    page.wait_for_function("document.querySelector('#pdf-error').textContent.length>0",timeout=15000)
    assert 'could not load' in page.locator('#pdf-error').inner_text()
    cancel(page);context.unroute('**/vendor/tesseract/eng.traineddata.gz')
    timeout_result=page.evaluate("""async()=>{const {recognizeCanvas}=await import('./ocr.js');const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;try{await recognizeCanvas(canvas,{timeoutMs:1});return 'unexpected success';}catch(e){return e.message;}}""")
    assert 'too long' in timeout_result
    page.set_viewport_size({'width':390,'height':844});page.locator('#sample-scan').click();recognize(page)
    assert page.locator('#pdf-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    assert page.locator('#pdf-apply').is_visible()
    page.locator('#pdf-zoom').click()
    assert page.locator('.pdf-preview').evaluate('(e)=>e.scrollWidth>e.clientWidth')
    page.locator('#pdf-zoom').click()
    page.screenshot(path=str(ROOT/'artifacts/ocr-mobile.png'));cancel(page)
    assert not errors,errors
    assert not page.workers, 'An OCR supervisor survived completion/cancellation.'
    print('JPEG/WebP, blank/corrupt files, draft preservation, cancellation/retry, engine loading failure, timeout, worker teardown, and mobile layout passed.',flush=True)
    context.close();browser.close()
