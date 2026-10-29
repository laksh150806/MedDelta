import {LABELS,LABEL_NAMES,benchmarkRows,scoreRows,PROTOCOL_VERSION} from './benchmark.js';
import {createSession,saveJudgment,validateSession,exposePredictions} from './review-state.js';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dataset,hash,session,currentId,split='development',caseDirty=false,sessionDirty=false,resultsVisible=false;
const packet=()=>dataset.cases.find(c=>c.id===currentId);
function status(message){$('#lab-save-status').textContent=message;}
function error(message){$('#lab-error').textContent=message;}
function mayLeaveCase(){return !caseDirty||window.confirm('Discard unsaved changes to this judgment? Saved judgments will remain in this tab.');}
function saveFile(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function renderNavigation(){
 const completed=new Set(session.judgments.map(r=>r.caseId));
 $('#lab-case-list').innerHTML=dataset.cases.filter(c=>c.split===split).map(c=>`<button class="case-choice ${c.id===currentId?'active':''}" data-case="${c.id}" aria-current="${c.id===currentId?'true':'false'}"><span>${c.id}</span>${completed.has(c.id)?'<span class="done">Saved</span>':''}</button>`).join('');
 const count=s=>dataset.cases.filter(c=>c.split===s&&completed.has(c.id)).length;
 $('#lab-progress').textContent=`Practice ${count('development')}/8 · Evaluation ${count('evaluation')}/24 saved`;
 $('#lab-compare').disabled=!session.judgments.length;$('#lab-export').disabled=!session.judgments.length;
 $('#lab-reviewer').disabled=!!session.judgments.length;$('#lab-role').disabled=!!session.judgments.length;
}
function renderCase(){
 const c=packet(),saved=session.judgments.find(r=>r.caseId===c.id),evidence=new Set((saved?.evidence||[]).map(e=>`${e.recordId}:${e.line}`));
 const source=(record,line,text,isDate=false)=>`<label class="evidence-pick ${isDate?'date-evidence':''}"><input type="checkbox" data-evidence="${esc(record.id)}:${line}" ${evidence.has(`${record.id}:${line}`)?'checked':''} aria-label="Cite ${esc(record.title)} ${isDate?'date':'line '+line}"><span class="line-number">${isDate?'Date':line}</span><span>${esc(text)}</span></label>`;
 $('#lab-case').innerHTML=`<div class="packet-title"><div><div class="eyebrow">${split==='development'?'PRACTICE':'EVALUATION'} PACKET ${c.id}</div><h2>Review ${esc(c.target)}</h2><p>${c.records.length} supplied records · Cite the evidence using the boxes below.</p></div><span class="badge badge-demo">Fictional</span></div>${c.records.map(record=>`<article class="packet-record"><h3>${esc(record.title)}</h3>${source(record,0,record.date||'(document date missing)',true)}${record.text.split('\n').map((text,i)=>source(record,i+1,text)).join('')}</article>`).join('')}`;
 $('#lab-label').value=saved?.label||'';$('#lab-note').value=saved?.note||'';
 $('#lab-form-error').textContent='';$('#lab-exposure').textContent=Object.hasOwn(session.exposure,c.id)?'Predictions have already been revealed for this case. Any further saved judgment will be marked as a revision after exposure.':'Predictions have not been revealed in this review session.';
 caseDirty=false;renderNavigation();
}
function comparison(){
 const rows=benchmarkRows(dataset.cases,session.judgments);
 return {protocol:PROTOCOL_VERSION,datasetId:dataset.id,datasetSha256:hash,scope:'Agreement with this reviewer’s self-entered labels. No adjudication or clinical validation. Predicted findings with any source issue count as abstentions.',reviewer:session.reviewer,exposure:session.exposure,revisedAfterExposure:session.judgments.filter(r=>r.afterExposure).map(r=>r.caseId),results:Object.fromEntries(['development','evaluation'].map(s=>[s,Object.fromEntries(['full','pair'].map(m=>[m,scoreRows(rows.filter(r=>r.split===s),m)]))])),rows};
}
function renderResults(){
 if(!resultsVisible)return;
 session=exposePredictions(session,session.judgments.map(r=>r.caseId));sessionDirty=true;
 const report=comparison();
 const fraction=(value,total)=>`${value}/${total}`;
 $('#lab-results').innerHTML=`<div class="eyebrow">COMPARISON WITH YOUR SAVED JUDGMENTS</div><h2>Agreement is a starting point.</h2><p>These results use your labels. They do not establish that either the reviewer or the system is correct. Discuss disagreements before making performance claims. ${report.revisedAfterExposure.length} current judgments were saved after seeing predictions; all revisions and exposure times are retained.</p>${['development','evaluation'].map(s=>{const rows=report.rows.filter(r=>r.split===s);return `<h3>${s==='development'?'Practice':'Evaluation'} · ${rows.length} reviewed cases</h3><div class="results-table-wrap"><table><thead><tr><th>Method</th><th>Exact agreement</th><th>Non-abstaining</th><th>Wrong non-abstaining</th><th>Unsupported resolutions*</th></tr></thead><tbody>${['full','pair'].map(m=>{const v=report.results[s][m];return `<tr><td>${m==='full'?'MedDelta · full history':'Latest two records'}</td><td>${fraction(v.exactMatches,v.total)}</td><td>${fraction(v.covered,v.total)}</td><td>${v.wrongNonAbstaining}</td><td>${fraction(v.unsupportedResolution.count,v.unsupportedResolution.uncertainReferences)}</td></tr>`;}).join('')}</tbody></table></div><div class="results-table-wrap"><table><thead><tr><th>Case</th><th>Your judgment</th><th>MedDelta</th><th>Latest two</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.caseId}</td><td>${esc(LABEL_NAMES[r.expected])}</td><td class="${r.expected!==r.full.label?'different':''}">${esc(LABEL_NAMES[r.full.label])}${r.full.abstained?' (abstained)':''}</td><td class="${r.expected!==r.pair.label?'different':''}">${esc(LABEL_NAMES[r.pair.label])}${r.pair.abstained?' (abstained)':''}</td></tr>`).join('')||'<tr><td colspan="4">No saved judgments in this set.</td></tr>'}</tbody></table></div>`;}).join('')}<p>*A resolved label where your label is discrepancy, missing, or insufficient evidence. This protocol measure is not a measure of patient harm. Abstentions count toward exact agreement only when your label is insufficient evidence, and are always shown separately as reduced coverage.</p><p>Both methods use the same parser and comparison rules. The baseline sees only the two most recent dated records. Source-text alignment, confusion matrices, and conflict precision/recall are included in the JSON.</p><button class="button button-outline" id="lab-export-comparison">Download comparison JSON</button>`;
 $('#lab-results').hidden=false;$('#lab-hide-results').hidden=false;
 $('#lab-export-comparison').onclick=()=>saveFile('meddelta-review-comparison.json',comparison());
 $('#lab-exposure').textContent=Object.hasOwn(session.exposure,currentId)?'Predictions have now been revealed. Any further saved judgment for this case will be marked as a revision after exposure.':'Predictions have not been revealed for this case.';
 status('Comparison revealed. Export the review to preserve exposure history.');
}
$('#lab-form').addEventListener('input',()=>{caseDirty=true;});$('#lab-case').addEventListener('change',()=>{caseDirty=true;});
$('#lab-reviewer').addEventListener('input',()=>{sessionDirty=true;});$('#lab-role').addEventListener('change',()=>{sessionDirty=true;});
$('#lab-form').addEventListener('submit',event=>{
 event.preventDefault();if(!dataset)return;
 try{
  const candidate=structuredClone(session);
  if(!candidate.judgments.length)candidate.reviewer={name:$('#lab-reviewer').value.trim(),role:$('#lab-role').value};
  if(!candidate.reviewer.name)throw new Error('Enter a reviewer name or initials before saving.');
  const evidence=[...$('#lab-case').querySelectorAll('[data-evidence]:checked')].map(el=>{const [recordId,line]=el.dataset.evidence.split(':');return {recordId,line:Number(line)};});
  session=saveJudgment(candidate,dataset,hash,currentId,{label:$('#lab-label').value,note:$('#lab-note').value,evidence});
  sessionDirty=true;caseDirty=false;error('');renderNavigation();status(`${currentId} saved in this tab. Export to keep the review.`);$('#lab-form-error').textContent='';renderResults();
 }catch(e){$('#lab-form-error').textContent=e.message;}
});
$('#lab-case-list').addEventListener('click',event=>{const id=event.target.closest('[data-case]')?.dataset.case;if(id&&mayLeaveCase()){currentId=id;renderCase();}});
$('#lab-split').addEventListener('change',()=>{if(!mayLeaveCase()){$('#lab-split').value=split;return;}split=$('#lab-split').value;currentId=dataset.cases.find(c=>c.split===split&&!session.judgments.some(r=>r.caseId===c.id))?.id||dataset.cases.find(c=>c.split===split).id;renderCase();});
$('#lab-next').addEventListener('click',()=>{if(!mayLeaveCase())return;const next=dataset.cases.find(c=>c.split===split&&!session.judgments.some(r=>r.caseId===c.id));if(!next){status('Every case in this set has a saved judgment. Export before leaving.');return;}currentId=next.id;renderCase();});
$('#lab-export').addEventListener('click',()=>{if(caseDirty&&!window.confirm('Export saved judgments only? Your unsaved form changes will not be included.'))return;saveFile('meddelta-validation-review.json',session);sessionDirty=false;status('Saved judgments exported. Keep this file to resume the review.');});
$('#lab-compare').addEventListener('click',()=>{if(!session.judgments.length||!mayLeaveCase())return;const evaluationCount=session.judgments.filter(r=>dataset.cases.find(c=>c.id===r.caseId).split==='evaluation').length;if(evaluationCount<24&&!window.confirm(`Reveal predictions for saved judgments now? You have reviewed ${evaluationCount}/24 evaluation cases. For an independent review, finish the evaluation set first. Exposure will be recorded.`))return;resultsVisible=true;renderCase();renderResults();$('#lab-results').scrollIntoView({behavior:'smooth',block:'start'});});
$('#lab-hide-results').addEventListener('click',()=>{resultsVisible=false;$('#lab-results').hidden=true;$('#lab-hide-results').hidden=true;status('Comparison hidden. Recorded exposure history is retained.');});
$('#lab-import').addEventListener('change',async event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;
 try{
  if(file.size>1024*1024)throw new Error('Use a review JSON file smaller than 1 MB.');
  const imported=validateSession(JSON.parse(await file.text()),dataset,hash);
  if((sessionDirty||caseDirty||session.judgments.length)&&!window.confirm('Replace the current review with this file? Export current work first if needed.'))return;
  session=imported;caseDirty=false;sessionDirty=false;resultsVisible=false;$('#lab-results').hidden=true;$('#lab-hide-results').hidden=true;$('#lab-reviewer').value=session.reviewer.name;$('#lab-role').value=session.reviewer.role;renderCase();error('');status('Review reopened. Prior revisions and prediction exposure are preserved.');
 }catch(e){error('Review was not imported. '+e.message);}
});
$('#lab-reset').addEventListener('click',()=>{if((caseDirty||sessionDirty||session.judgments.length)&&!window.confirm('Start an empty review? Export the current review first if you want to keep it.'))return;session=createSession(dataset,hash);caseDirty=false;sessionDirty=false;resultsVisible=false;$('#lab-results').hidden=true;$('#lab-hide-results').hidden=true;$('#lab-reviewer').value='';$('#lab-role').value='student';error('');renderCase();status('New review. Nothing is saved outside this tab.');});
window.addEventListener('beforeunload',event=>{if(sessionDirty||caseDirty){event.preventDefault();event.returnValue='';}});
async function load(){
 const responses=await Promise.all([fetch('./validation/cases.json'),fetch('./validation/manifest.json')]);if(responses.some(r=>!r.ok))throw new Error('The case set could not be loaded. Reload to try again.');
 const [source,manifest]=await Promise.all([responses[0].text(),responses[1].json()]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==manifest.files['cases.json'])throw new Error('The case set does not match its frozen manifest. Review is paused.');
 dataset=JSON.parse(source);session=createSession(dataset,hash);currentId=dataset.cases[0].id;
 $('#lab-label').insertAdjacentHTML('beforeend',LABELS.map(label=>`<option value="${label}">${esc(LABEL_NAMES[label])}</option>`).join(''));
 $('#lab-loading').hidden=true;$('#lab-workspace').hidden=false;renderCase();
}
load().catch(e=>{$('#lab-loading').hidden=true;error(e.message);});
