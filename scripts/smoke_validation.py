"""Browser checks for the fictional validation workflow. Start npm start first."""
import json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,**({'executable_path':shutil.which('chromium')} if shutil.which('chromium') else {}))
 context=browser.new_context(viewport={'width':1440,'height':1050});page=context.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append((r.method,r.url)))
 page.on('dialog',lambda d:d.accept())
 page.goto('http://localhost:3000/validation.html',wait_until='networkidle');page.locator('#lab-workspace').wait_for()
 assert page.locator('#lab-label').input_value()==''
 assert page.locator('#lab-results').is_hidden()
 assert not any('reference-labels' in u or 'benchmark-report' in u for m,u in requests)
 page.locator('#lab-reviewer').fill('Fictional reviewer');page.locator('#lab-role').select_option('pharmacist')
 page.locator('#lab-label').select_option('consistent');page.locator('#lab-note').fill('The amounts, routes, and frequencies agree.')
 page.get_by_role('button',name='Save judgment',exact=True).click()
 assert 'source evidence' in page.locator('#lab-form-error').inner_text()
 page.locator('[data-evidence="r1:1"]').check();page.locator('[data-evidence="r2:1"]').check();page.get_by_role('button',name='Save judgment',exact=True).click()
 assert 'Practice 1/8' in page.locator('#lab-progress').inner_text()
 assert page.locator('#lab-reviewer').is_disabled()
 assert page.locator('#lab-results').is_hidden()
 page.locator('#lab-next').click();assert page.locator('#lab-label').input_value()==''
 page.locator('[data-case="D01"]').click();assert page.locator('#lab-label').input_value()=='consistent'
 page.locator('#lab-compare').click();assert page.locator('#lab-results').is_visible()
 assert 'Latest two records' in page.locator('#lab-results').inner_text()
 page.locator('#lab-label').select_option('unresolved');page.locator('#lab-note').fill('Changed after seeing the prediction for workflow testing.')
 page.get_by_role('button',name='Save judgment',exact=True).click()
 assert '1 current judgments' in page.locator('#lab-results').inner_text()
 with page.expect_download() as d:page.locator('#lab-export').click()
 report=json.loads(Path(d.value.path()).read_text());assert report['judgments'][0]['afterExposure']
 assert report['judgments'][0]['revisions'][0]['label']=='consistent'
 assert not report['judgments'][0]['revisions'][0]['afterExposure']
 assert report['exposure']['D01']
 page.locator('#lab-reset').click();assert 'Practice 0/8' in page.locator('#lab-progress').inner_text()
 page.locator('#lab-import').set_input_files({'name':'review.json','mimeType':'application/json','buffer':json.dumps(report).encode()})
 page.wait_for_function("document.querySelector('#lab-progress').textContent.includes('Practice 1/8')")
 assert page.locator('#lab-label').input_value()=='unresolved'
 assert 'already been revealed' in page.locator('#lab-exposure').inner_text()
 assert page.locator('#lab-results').is_hidden()
 bad={**report,'datasetSha256':'wrong-dataset'}
 page.locator('#lab-import').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
 page.wait_for_function("document.querySelector('#lab-error').textContent.length>0")
 assert 'different dataset' in page.locator('#lab-error').inner_text()
 assert 'Practice 1/8' in page.locator('#lab-progress').inner_text()
 page.locator('#lab-split').select_option('evaluation');assert page.locator('[data-case]').count()==24
 page.locator('[data-case="E02"]').click();page.locator('#lab-label').select_option('conflict');page.locator('#lab-note').fill('The earlier increase was never explained.')
 page.locator('[data-evidence="r1:1"]').check();page.locator('[data-evidence="r2:1"]').check();page.get_by_role('button',name='Save judgment',exact=True).click()
 assert 'Evaluation 1/24' in page.locator('#lab-progress').inner_text()
 page.locator('#lab-compare').click()
 with page.expect_download() as d:page.locator('#lab-export-comparison').click()
 comparison=json.loads(Path(d.value.path()).read_text())
 assert comparison['results']['evaluation']['full']['exactMatches']==1
 assert comparison['results']['evaluation']['pair']['exactMatches']==0
 assert comparison['results']['development']['full']['exactMatches']==0
 assert comparison['revisedAfterExposure']==['D01']
 page.locator('#lab-hide-results').click()
 (ROOT/'artifacts').mkdir(exist_ok=True);page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(ROOT/'artifacts/validation-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 page.screenshot(path=str(ROOT/'artifacts/validation-mobile.png'),full_page=True)
 assert not any(m not in ('GET','HEAD') for m,u in requests)
 # The new lab opens in another tab so in-memory medication work stays open.
 main=context.new_page();main.goto('http://localhost:3000')
 main.locator('#add-record').click();main.locator('#record-title').fill('Preserved draft')
 main.locator('#editor-dialog [data-close="editor-dialog"]').first.click()
 with main.expect_popup() as opened:main.get_by_role('link',name='Validation lab').click()
 lab=opened.value;lab.wait_for_load_state();assert main.locator('#case-title').inner_text()=='Discharge & follow-up'
 assert 'validation.html' in lab.url
 guide=context.new_page();guide.goto('http://localhost:3000/validation/reviewer-guide.html');assert guide.locator('.review-packet').count()==32
 assert not errors,errors
 print('Validation browser checks passed: evidence gates, hidden predictions, exposure/revision history, export/reopen, invalid-import recovery, per-split metrics, mobile layout, guide, and separate workspace tab.')
 context.close();browser.close()
