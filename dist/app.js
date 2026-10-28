import {compareRecords,parseRecord,regimen,DEMOS,VERSION,validDate} from './engine.js';
import {extractionDraft} from './extraction.js';
import {ACTIONS,UNITS,ROUTES,SCHEDULES,validFields} from './review.js';
import {openPdf} from './pdf-import.js';
import {selectedPdfText} from './pdf-layout.js';
import {openImage,recognizeCanvas,OCR_VERSION} from './ocr.js';
import {needsOcrReview,sourceLocation} from './provenance.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',check:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 16h.01"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',folder:'<path d="M3 7V5h7l2 3h9v12H3Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',pill:'<path d="m8 4-5 5a5 5 0 0 0 7 7l5-5a5 5 0 0 0-7-7Z" transform="translate(3 1)"/><path d="m8 9 7 7"/>',alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>',change:'<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',link:'<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 -1) scale(.95)"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
let demoKey='handoff',docs=structuredClone(DEMOS.handoff.records),notes={},result,view='overview',filter='all',edited=false,editingId=null,activeKey=null,pendingAction=null,toastTimer;
let extractionDocId=null,extractionRows=[];
let pendingSourceImport=null,pdfSession=null,pdfController=null,pdfToken=0,pdfKeys=new Set(),pdfViewed=new Set(),pdfBusy=false;
const pdfFiles=new Map();
const date=v=>validDate(v)?new Date(v+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date needed';
const badge=item=>`<span class="badge badge-${item.status}">${item.status==='conflict'?'◦ ':''}${esc(item.label)}</span>`;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function confirmAction(title,text,action){pendingAction=action;$('#confirm-title').textContent=title;$('#confirm-text').textContent=text;$('#confirm-dialog').showModal();}
function recalculate(){result=compareRecords(docs);render();}
function setView(v){view=v;document.querySelectorAll('[data-view]').forEach(el=>{if(el.getAttribute('role')==='tab') el.setAttribute('aria-selected',String(el.dataset.view===v));else el.classList.toggle('active',el.dataset.view===v);});renderContent();}
function render(){
 const attention=result.items.filter(x=>['conflict','missing'].includes(x.status)).length;
 const changes=result.items.filter(x=>['change','stopped'].includes(x.status)).length;
 const stats=[['pill','Medicines found',result.items.length,'Across the supplied records'],['alert','Need clarification',attention,'Differences or missing instructions'],['change','Documented changes',changes,'Explicit changes and stops'],['check','Review notes',Object.keys(notes).length,'Captured in this session']];
 $('#stats').innerHTML=stats.map(([i,label,value,sub],n)=>`<div class="stat ${n===1?'stat-attention':''}"><span class="stat-icon">${icon(i)}</span><div class="stat-label">${label}</div><div class="stat-value">${value.toString().padStart(2,'0')}</div><div class="stat-sub">${sub}</div></div>`).join('');
 $('#case-title').textContent=edited?'Your review workspace':DEMOS[demoKey].title;
 $('#case-description').textContent=edited?`${docs.length} records · Compare, inspect, and capture your review.`:DEMOS[demoKey].description;
 $('#case-badge').textContent=edited?'Edited workspace':'Fictional demo';
 $('#demo-disclaimer').innerHTML=icon('info')+`<span>${edited?'Prototype findings describe supplied records, not what someone should take. Work is cleared on reload.':'Fictional records for exploring the prototype. Findings describe the documents, not what someone should take.'}</span>`;
 $('#overview-count').textContent=result.items.length;$('#nav-count').textContent=result.items.length;$('#records-count').textContent=docs.length;$('#notes-count').textContent=Object.keys(notes).length;
 $('#issues-region').innerHTML=result.issues.length?`<div class="notice"><strong>${result.blocked?'Comparison paused':'Partial comparison'} · ${result.issues.length} ${result.issues.length===1?'item needs':'items need'} manual review</strong><p>${result.blocked?'Fix missing dates or add records before comparing.':'Some text was not fully understood. All findings are provisional until those lines are checked.'}</p><details><summary>Show unread text and missing information</summary>${result.issues.map(i=>`<div class="issue-line"><strong>${esc(docs.find(d=>d.id===i.docId)?.title || 'Workspace')}${i.line?' · line '+i.line:''}</strong><code>${esc(i.text)}</code>${esc(i.reason)}${i.docId?`<br><button class="text-button" data-extract="${esc(i.docId)}">Review extraction →</button><button class="text-button" data-edit="${esc(i.docId)}">Edit source</button>`:''}</div>`).join('')}</details></div>`:'';
 renderContent();
}
function renderContent(){
 if(view==='records'){renderRecords();return;}if(view==='notes'){renderNotes();return;}
 const visible=result.items.filter(x=>filter==='all'||['conflict','missing'].includes(x.status));
 const sorted=[...docs].sort((a,b)=>a.date.localeCompare(b.date));
 $('#content').innerHTML=`<div class="overview-grid"><div><div class="section-heading"><div><h2>Medication comparison</h2><p>Open a medicine to follow the evidence.</p></div><div class="filter-buttons" aria-label="Filter medications"><button class="filter-button ${filter==='all'?'active':''}" data-filter="all" aria-pressed="${filter==='all'}">All medicines</button><button class="filter-button ${filter==='attention'?'active':''}" data-filter="attention" aria-pressed="${filter==='attention'}">Needs a look</button></div></div><div class="med-list">${visible.length?visible.map(card).join(''):`<div class="empty-state"><h3>${result.blocked?'A little more information first':filter==='attention'?'No discrepancies flagged':'No supported instructions found'}</h3><p>${result.blocked?'Check the highlighted records to continue.':filter==='attention'?'The comparison found no unexplained differences in the supported fields. This is not a clinical safety check.':'Open Source records to add or correct your typed instructions.'}</p></div>`}</div></div><aside class="insight-aside"><div class="insight-panel"><div class="panel-eyebrow">${icon('link')} Follow the evidence</div><h3>A timeline,<br>not an assumption.</h3><p>Each finding connects back to the words in the original record.</p><div class="mini-timeline">${sorted.map(d=>`<div class="mini-event"><span class="timeline-dot"></span><div><strong>${esc(d.title)}</strong><time>${date(d.date)}</time></div></div>`).join('')}</div><button class="panel-link" data-view="records">Explore source records <span>↗</span></button></div><div class="legend"><strong>A missing mention isn’t a stop.</strong>If a medicine disappears from a later list, MedDelta keeps that uncertainty visible.</div></aside></div>`;
}
function card(item){
 const meaningful=item.transitions.findLast(t=>t.kind===(item.status==='conflict'?'conflict':'change'));
 const previous=item.status==='missing'?item.latest:(meaningful?.before || (item.events.length>1?item.events.at(-2):item.events[0]));
 return `<button class="med-card" data-detail="${esc(item.key)}" aria-label="Review ${esc(item.name)}: ${esc(item.label)}"><div class="med-card-head"><span class="pill-icon">${icon('pill')}</span><span class="med-name">${esc(item.name)}</span>${badge(item)}</div><div class="med-comparison"><div><div class="comparison-label">${item.events.length>1?'Earlier instruction':'First instruction'} · ${date(previous.date)}</div><div class="comparison-value">${esc(regimen(previous))}</div></div><span class="comparison-arrow">→</span><div><div class="comparison-label">${item.status==='missing'?'Latest record':'Latest instruction'}${item.status==='missing'?'':' · '+date(item.latest.date)}</div><div class="comparison-value">${item.status==='missing'?'Not listed · status unclear':esc(regimen(item.latest))}</div></div></div><div class="med-card-bottom"><span>${icon('file')}${item.events.length} source ${item.events.length===1?'passage':'passages'}${item.incomplete?' · Partial extraction':''}${notes[item.key]?' · Note saved':''}</span><strong>Review evidence ↗</strong></div></button>`;
}
function renderRecords(){
 $('#content').innerHTML=`<div class="section-heading"><div><h2>Your source records</h2><p>Document dates order the timeline. Treatment effective dates are not inferred.</p></div><button class="text-button" data-add>Add record +</button></div><div class="records-grid">${docs.map(d=>{const parsed=parseRecord(d);return `<article class="record-card"><div class="record-head"><span class="pill-icon">${icon('file')}</span><div><h3>${esc(d.title)}</h3><p>${date(d.date)} · ${parsed.events.length} supported instructions</p></div></div><div class="record-body">${esc(d.text)}</div>${d.sourceImport?`<div class="pdf-source-tag">${d.sourceImport.type==='image'?'Image':'PDF'}${d.sourceImport.ocrUsed?' · OCR':''}: ${esc(d.sourceImport.fileName)} · ${d.sourceImport.lines.length} selected lines${d.sourceImport.importedText!==d.text?' · Text edited; page links unavailable':''}${pdfFiles.has(d.sourceImport.assetId)?`<button class="text-button" data-pdf="${esc(d.id)}">Open original file ↗</button>`:''}</div>`:''}<div class="record-footer"><button class="text-button" data-extract="${esc(d.id)}">Review extraction ↗</button><button class="text-button" data-edit="${esc(d.id)}">Edit</button><button class="text-button danger" data-delete="${esc(d.id)}">Remove</button></div></article>`;}).join('')||'<div class="empty-state"><h3>Add your first record</h3><p>You need at least two dated records for a comparison.</p></div>'}</div>`;
}
function renderNotes(){const entries=Object.entries(notes);$('#content').innerHTML=`<div class="section-heading"><div><h2>Review notes</h2><p>Notes record a reviewer's observations. They do not certify clinical correctness.</p></div></div>${entries.length?entries.map(([key,n])=>`<article class="note-card"><h3>${esc(result.items.find(i=>i.key===key)?.name||key)}</h3><p>${esc(n.text)}</p><small>${esc(n.reviewer||'Reviewer not specified')} · ${esc(new Date(n.at).toLocaleString())}</small><button class="text-button" data-detail="${esc(key)}">View evidence & edit note →</button></article>`).join(''):'<div class="empty-state"><h3>A place for the human perspective.</h3><p>Open a medication, inspect its evidence, and add your first review note.</p><button class="text-button" data-view="overview">Back to medication overview →</button></div>'}`;}
function detail(key){
 const item=result.items.find(x=>x.key===key);if(!item)return;activeKey=key;
 const note=notes[key];
 $('#detail-content').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">MEDICATION EVIDENCE</div><h2>${esc(item.name)}</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Close evidence">×</button></div><div class="dialog-body">${badge(item)}<p class="detail-summary">${esc(item.summary)}</p>${item.incomplete?'<div class="notice" style="margin-top:16px">Some source text was unread. Check every flagged line before relying on this comparison.</div>':''}<div class="detail-section-title">Document timeline · ${item.events.length} source passages</div><div>${item.events.map(e=>`<div class="evidence-event"><div class="evidence-meta"><strong>${esc(e.docTitle)}</strong><span>${date(e.date)}</span></div><blockquote>“${esc(e.source)}”</blockquote><div class="evidence-caption">${e.sourceLocation?`${e.sourceLocation.sourceType==='image'?'Image':'PDF page '+e.sourceLocation.page}, ${e.sourceLocation.method==='ocr'?'OCR':'extracted'} line ${e.sourceLocation.pdfLine}${e.sourceLocation.corrected?' · transcription corrected':''} · `:``}Record line ${e.line} · ${e.extraction==='human-confirmed'?'Fields confirmed by '+esc(e.extractionReviewer)+' · '+esc(e.action):e.action==='listed'?'No explicit action word':esc(e.action)+' explicitly written'}</div></div>`).join('')}</div>${item.transitions.filter(t=>t.kind!=='same').map(t=>`<p class="small muted" style="margin-top:10px">${date(t.before.date)} → ${date(t.after.date)}: ${esc(t.text)}</p>`).join('')}<div class="question-box"><strong>Suggested clarification</strong>${esc(item.question)}</div><form id="note-form"><label for="reviewer">Reviewer name <span class="muted">(optional)</span></label><input id="reviewer" maxlength="80" value="${esc(note?.reviewer||'')}" placeholder="Your name or initials"><label class="review-note-label" for="review-note">Review note <span>Saved in this tab only</span></label><textarea id="review-note" rows="3" maxlength="3000" required placeholder="Record what you verified, what remains unclear, and the source of any clarification.">${esc(note?.text||'')}</textarea>${note?'<p class="saved-note">A note has been saved for this finding.</p>':''}<div style="display:flex;gap:10px;justify-content:flex-end">${note?'<button class="button button-outline" type="button" id="delete-note">Remove note</button>':''}<button class="button button-primary" type="submit">Save review note ${icon('check')}</button></div></form></div><div class="dialog-footer"><span class="small muted">Document evidence only. A review note does not change the source findings.</span></div>`;
 if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
}
function editor(id=null){editingId=id;const d=docs.find(d=>d.id===id);$('#editor-title').textContent=d?'Edit source record':'Add a source record';$('#record-title').value=d?.title||'';$('#record-date').value=d?.date||'';$('#record-text').value=d?.text||'';$('#record-file').value='';$('#form-error').textContent='';pendingSourceImport=d?.sourceImport||null;renderSourceImportInfo();$('#editor-dialog').showModal();}
function resetReview(){notes={};edited=true;}
function renderSourceImportInfo(){
 const source=pendingSourceImport;
 $('#source-import-info').textContent=source?`${source.type==='image'?'Image':'PDF'} source: ${source.fileName}. ${source.lines.length} selected lines. ${source.ocrUsed?'OCR text needs field confirmation after saving. ':''}${source.importedText!==$('#record-text').value?'Text has been edited; exact source links will be unavailable.':''}`:'';
}
function releaseUnusedPdfs(){const used=new Set(docs.map(d=>d.sourceImport?.assetId));for(const [id,asset] of pdfFiles){if(!used.has(id)){URL.revokeObjectURL(asset.url);pdfFiles.delete(id);}}}
function showOriginalPdf(id){const doc=docs.find(d=>d.id===id),asset=pdfFiles.get(doc?.sourceImport?.assetId);if(!asset){toast('The original file is no longer available in this tab.');return;}const a=document.createElement('a');a.href=asset.url;a.target='_blank';a.rel='noopener noreferrer';a.click();}
function importPage(){return pdfSession?.pages.find(p=>p.number===Number($('#pdf-page').value));}
function renderImportWarnings(){
 const warnings=pdfSession?.pages.flatMap(p=>p.warnings)||[];
 $('#pdf-warnings').innerHTML=warnings.length?`<details class="notice"><summary>Source limitations · ${warnings.length}</summary>${warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</details>`:'';
}
async function startPdfImport(file){
 const token=++pdfToken;pdfController?.abort();await pdfSession?.destroy().catch(()=>{});if(token!==pdfToken)return;pdfSession=null;pdfController=new AbortController();pdfKeys=new Set();pdfViewed=new Set();pdfBusy=true;
 $('#pdf-workspace').hidden=true;$('.pdf-preview').classList.remove('zoomed');$('#pdf-zoom').setAttribute('aria-pressed','false');$('#pdf-zoom').textContent='Enlarge preview';$('#pdf-error').textContent='';$('#pdf-warnings').innerHTML='';$('#pdf-checked').checked=false;$('#pdf-status').textContent='Opening document locally…';$('#pdf-apply').disabled=true;
 if(!$('#pdf-dialog').open)$('#pdf-dialog').showModal();
 try{
  const open=file.name.toLowerCase().endsWith('.pdf')?openPdf:openImage;
  const session=await open(file,{signal:pdfController.signal,onProgress:message=>{if(token===pdfToken)$('#pdf-status').textContent=message;}});
  if(token!==pdfToken){await session.destroy();return;}pdfSession=session;
  $('#pdf-file-name').textContent=file.name;$('#pdf-page').innerHTML=session.pages.map(p=>`<option value="${p.number}">${p.number} of ${session.pageCount}</option>`).join('');
  renderImportWarnings();$('#pdf-workspace').hidden=false;
  $('#pdf-status').textContent=session.pages.some(p=>p.lines.length)?'Select the medication lines and check them against the original.':'Preview ready. Choose “Read this page with OCR” to recognize printed English text.';
  await renderPdfPage();
 }catch(error){if(token!==pdfToken||error.name==='AbortError')return;$('#pdf-error').textContent=error.message;$('#pdf-status').textContent='Document import could not finish.';pdfBusy=false;}
}
function renderPdfLines(){
 const page=importPage();if(!page)return;
 $('#pdf-lines').innerHTML=page.lines.length?page.lines.map(line=>{
  const key=`${line.page}:${line.line}`;
  return `<div class="pdf-line ${line.needsCloserLook?'ocr-uncertain':''}"><input type="checkbox" aria-label="Select line ${line.line}" data-pdf-key="${key}" ${pdfKeys.has(key)?'checked':''}><span class="pdf-line-number">${line.line}</span><div class="pdf-line-content">${line.method==='ocr'?`<label class="sr-only" for="ocr-line-${line.line}">Correct OCR line ${line.line}</label><textarea id="ocr-line-${line.line}" data-ocr-key="${key}" rows="2" maxlength="1500" spellcheck="false">${esc(line.text)}</textarea><small>${line.needsCloserLook?'Recognition uncertain · inspect closely':'OCR draft · check every name and number'}</small><details><summary>Original OCR text</summary><p>${esc(line.originalText)}</p></details>`:`<label for="pdf-pick-${line.line}" class="pdf-line-text">${esc(line.text)}</label>`}</div></div>`;
 }).join(''):'<p class="notice">No text lines yet. Run OCR on this page. Unread pages stay flagged if you import other pages.</p>';
 // Associate the text with its selection control without nesting editable inputs in a label.
 $('#pdf-lines').querySelectorAll('[data-pdf-key]').forEach(el=>el.id=`pdf-pick-${el.dataset.pdfKey.split(':')[1]}`);
}
async function renderPdfPage(){
 if(!pdfSession)return;const session=pdfSession,token=pdfToken,number=Number($('#pdf-page').value);pdfBusy=true;$('#pdf-lines').innerHTML='';updatePdfSelection();
 try{await session.render(number,$('#pdf-canvas'));if(token!==pdfToken)return;pdfViewed.add(number);renderPdfLines();}
 catch(error){if(token===pdfToken)$('#pdf-error').textContent='This page could not be previewed. Its lines cannot be selected: '+error.message;}
 finally{if(token===pdfToken){pdfBusy=false;updatePdfSelection();}}
}
function updatePdfSelection(){
 const page=importPage();
 $('#pdf-selected-count').textContent=`${pdfKeys.size} ${pdfKeys.size===1?'line':'lines'} selected`;
 $('#pdf-apply').disabled=pdfBusy||!pdfSession||!pdfKeys.size||!$('#pdf-checked').checked;
 for(const id of ['pdf-select-page','pdf-clear-page','pdf-page','pdf-checked'])$('#'+id).disabled=pdfBusy;
 $('#pdf-ocr').disabled=pdfBusy||!page||!pdfViewed.has(page.number)||page.method==='ocr';
 $('#pdf-ocr').textContent=page?.method==='ocr'?'OCR complete · correct lines below':'Read this page with OCR';
}
$('#pdf-ocr').addEventListener('click',async()=>{
 const session=pdfSession,page=importPage(),token=pdfToken;if(!session||!page||pdfBusy)return;
 pdfBusy=true;$('#pdf-error').textContent='';$('#pdf-checked').checked=false;$('#pdf-lines').inert=true;updatePdfSelection();
 const canvas=document.createElement('canvas');
 try{
  await session.render(page.number,canvas,{ocr:true});if(token!==pdfToken)return;
  const lines=await recognizeCanvas(canvas,{signal:pdfController.signal,onProgress:message=>{if(token===pdfToken)$('#pdf-status').textContent=message;}});
  if(token!==pdfToken)return;
  for(const line of page.lines)pdfKeys.delete(`${page.number}:${line.line}`);
  page.lines=lines.map(line=>({...line,page:page.number}));page.method='ocr';page.ocrAt=new Date().toISOString();
  page.warnings=[`Page ${page.number} was read with OCR. Text can be missed or misread; document completeness remains unverified. Check the entire original page.`];
  renderImportWarnings();renderPdfLines();
  $('#pdf-status').textContent=`${lines.length} OCR lines ready. Correct any errors, then select the medication instructions. Nothing is selected automatically.`;
 }catch(error){if(token===pdfToken&&error.name!=='AbortError'){$('#pdf-error').textContent=error.message;$('#pdf-status').textContent='OCR did not finish. Any earlier extracted lines have been kept.';}}
 finally{canvas.width=0;canvas.height=0;if(token===pdfToken){pdfBusy=false;$('#pdf-lines').inert=false;updatePdfSelection();}}
});
$('#pdf-zoom').addEventListener('click',()=>{const zoomed=$('.pdf-preview').classList.toggle('zoomed');$('#pdf-zoom').setAttribute('aria-pressed',String(zoomed));$('#pdf-zoom').textContent=zoomed?'Fit preview':'Enlarge preview';});
$('#pdf-page').addEventListener('change',()=>{renderPdfPage();});
$('#pdf-lines').addEventListener('change',e=>{const key=e.target.dataset.pdfKey;if(!key||pdfBusy)return;e.target.checked?pdfKeys.add(key):pdfKeys.delete(key);$('#pdf-checked').checked=false;updatePdfSelection();});
$('#pdf-lines').addEventListener('input',e=>{
 const key=e.target.dataset.ocrKey;if(!key||pdfBusy)return;
 const line=importPage()?.lines.find(l=>`${l.page}:${l.line}`===key);if(!line)return;
 line.text=e.target.value.trim();$('#pdf-checked').checked=false;updatePdfSelection();
});
$('#pdf-checked').addEventListener('change',updatePdfSelection);
for(const [id,checked] of [['pdf-select-page',true],['pdf-clear-page',false]])$('#'+id).addEventListener('click',()=>{for(const input of $('#pdf-lines').querySelectorAll('[data-pdf-key]')){input.checked=checked;checked?pdfKeys.add(input.dataset.pdfKey):pdfKeys.delete(input.dataset.pdfKey);}$('#pdf-checked').checked=false;updatePdfSelection();});
$('#pdf-apply').addEventListener('click',()=>{
 if(!pdfSession||pdfBusy||!$('#pdf-checked').checked)return;
 try{const selected=selectedPdfText(pdfSession.pages,pdfKeys);if(selected.lines.some(l=>!pdfViewed.has(l.page)))throw new Error('View every selected page before importing.');
  const assetId=crypto.randomUUID(),file=pdfSession.file,ocrUsed=pdfSession.pages.some(p=>p.method==='ocr');
  pdfFiles.set(assetId,{file,url:URL.createObjectURL(file)});
  pendingSourceImport={type:pdfSession.type,assetId,fileName:file.name,fileBytes:file.size,sha256:pdfSession.sha256,pdfjsVersion:pdfSession.type==='pdf'?'6.4.299':null,ocrUsed,ocrEngine:ocrUsed?OCR_VERSION:null,pageCount:pdfSession.pageCount,importedAt:new Date().toISOString(),importedText:selected.text,lines:selected.lines,warnings:pdfSession.pages.flatMap(p=>p.warnings),pages:pdfSession.pages.map(p=>({number:p.number,method:p.method,ocrAt:p.ocrAt||null,extractedLineCount:p.lines.length})),visualCheckAcknowledged:true};
  $('#record-text').value=selected.text;if(!$('#record-title').value.trim())$('#record-title').value=file.name.replace(/\.(pdf|png|jpe?g|webp)$/i,'').slice(0,100);
  renderSourceImportInfo();$('#form-error').textContent='';closePdfImport();toast(ocrUsed?'OCR draft imported. Save the date, then review and confirm the fields.':'Selected lines imported. Enter the document date before saving.');
 }catch(error){$('#pdf-error').textContent=error.message;}
});
function closePdfImport(){pdfToken++;const controller=pdfController,session=pdfSession;pdfController=null;pdfSession=null;pdfBusy=false;controller?.abort();session?.destroy().catch(()=>{});$('#pdf-lines').inert=false;if($('#pdf-dialog').open)$('#pdf-dialog').close();}
$('#pdf-dialog').addEventListener('cancel',e=>{e.preventDefault();closePdfImport();});
$('#editor-dialog').addEventListener('close',()=>{pendingSourceImport=null;releaseUnusedPdfs();});
$('#record-text').addEventListener('input',renderSourceImportInfo);
for(const [id,name,type] of [['sample-pdf','fictional-followup.pdf','application/pdf'],['sample-scan','fictional-printed-scan.png','image/png']])$('#'+id).addEventListener('click',async()=>{const button=$('#'+id);button.disabled=true;try{const response=await fetch('./samples/'+name);if(!response.ok)throw new Error('The sample could not be loaded.');const file=new File([await response.blob()],name,{type});if($('#editor-dialog').open)await startPdfImport(file);}catch(error){$('#form-error').textContent=error.message;}finally{button.disabled=false;}});
function openExtraction(id){
 const doc=docs.find(d=>d.id===id);if(!doc)return;
 extractionDocId=id;extractionRows=extractionDraft(doc);$('#extraction-error').textContent='';$('#extraction-reviewer').value=doc.extractionReview?.reviewer||'';
 const select=(name,values,current)=>`<select data-field="${name}">${name==='action'?'<option value="">Select after checking the source</option>':''}${values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${v==='listed'?'Listed (no explicit action)':v==='unspecified'?'Not stated':esc(v)}</option>`).join('')}</select>`;
 $('#extraction-lines').innerHTML=extractionRows.map((row,index)=>{
  const f=row.fields,location=sourceLocation(doc,row.line,row.source);
  return `<section class="extraction-row" data-row="${index}"><div class="evidence-meta"><strong>Line ${row.line} · ${esc(doc.title)}</strong><span>${row.blocked?'Manual review needed':esc(row.method)}</span></div><blockquote>${esc(row.source)}</blockquote>${location?.method==='ocr'?`<p class="small muted">OCR source: ${esc(location.fileName)} · page ${location.page}, line ${location.pdfLine}. ${location.corrected?'Transcription was corrected.':'Check names, decimals, units, and action words.'}</p><details class="ocr-original"><summary>Original OCR text</summary><p>${esc(location.originalOcrText)}</p></details>`:''}${row.blocked?`<p class="extraction-blocked">${esc(row.reason)}</p>`:`<div class="extraction-fields"><label>Medicine<input data-field="name" maxlength="61" value="${esc(f.name)}"></label><label>Action${select('action',ACTIONS,f.action)}</label><label>Written amount<input data-field="amount" type="number" min="0.000001" step="any" value="${esc(f.amount)}"></label><label>Unit${select('unit',UNITS,f.unit)}</label><label>Route${select('route',ROUTES,f.route)}</label><label>Frequency${select('frequency',SCHEDULES,f.frequency)}</label></div><label class="confirm-fields"><input type="checkbox" data-confirm ${row.confirmed?'checked':''}>I checked these fields against the original text.</label><p class="small muted">For a stop, amount, unit, route, and frequency are not used. Any edits are stored alongside the original suggestion.</p>`}</section>`;
 }).join('')||'<p class="notice">This record is empty. Add instructions before reviewing extraction.</p>';
 $('#extraction-source').innerHTML=needsOcrReview(doc)?`<div class="notice"><strong>OCR draft · field review required</strong><p>Check every instruction against the original image, including names, decimals, units, and stop/change words.</p>${pdfFiles.has(doc.sourceImport?.assetId)?`<button type="button" class="text-button" data-pdf="${esc(doc.id)}">Open original file ↗</button>`:''}</div>`:'';
 $('#extraction-lines').querySelectorAll('.extraction-row').forEach(updateStopFields);
 $('#extraction-dialog').showModal();
}
function updateStopFields(row){const action=row.querySelector('[data-field="action"]');if(!action)return;for(const name of ['amount','unit','route','frequency'])row.querySelector(`[data-field="${name}"]`).disabled=action.value==='stop';}
$('#extraction-lines').addEventListener('input',e=>{if(e.target.dataset.field)e.target.closest('.extraction-row').querySelector('[data-confirm]').checked=false;});
$('#extraction-lines').addEventListener('change',e=>{if(e.target.dataset.field==='action')updateStopFields(e.target.closest('.extraction-row'));});
$('#extraction-form').addEventListener('submit',e=>{
 e.preventDefault();const doc=docs.find(d=>d.id===extractionDocId);if(!doc)return;
 const reviewer=$('#extraction-reviewer').value.trim();if(!reviewer){$('#extraction-error').textContent='Enter a reviewer name or initials.';return;}
 let error='';
 const lines=extractionRows.map((row,index)=>{
  if(row.blocked)return {line:row.line,source:row.source,confirmed:false,reason:row.reason};
  const el=$(`#extraction-lines [data-row="${index}"]`),fields=Object.fromEntries([...el.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value.trim()]));
  const confirmed=el.querySelector('[data-confirm]').checked;
  if(confirmed&&!validFields(fields))error=`Check all fields on line ${row.line}. A medicine and action are required; non-stop instructions also need a positive amount, unit, route, and frequency.`;
  return {line:row.line,source:row.source,fields,suggestedFields:row.suggestedFields,confirmed,method:row.method,modelVersion:row.prediction?.modelVersion||null};
 });
 if(error){$('#extraction-error').textContent=error;return;}
 const save=()=>{
  const review={documentText:doc.text,documentDate:doc.date,documentTitle:doc.title,reviewer,at:new Date().toISOString(),lines};
  docs=docs.map(d=>d.id===doc.id?{...d,extractionReview:review,extractionHistory:[...(d.extractionHistory||[]),...(d.extractionReview?[d.extractionReview]:[])]}:d);
  resetReview();recalculate();$('#extraction-dialog').close();toast(`${lines.filter(r=>r.confirmed).length} instructions confirmed. Comparison updated.`);
 };
 if(Object.keys(notes).length)confirmAction('Recalculate with reviewed fields?','Existing medication review notes will be cleared because the extracted evidence may change. Export first if you want to keep them.',save);else save();
});
function exportReport(){
 const report={application:'MedDelta',version:VERSION,exportedAt:new Date().toISOString(),caseType:edited?'user-edited':'fictional-demo',limitations:'Experimental local action classifier plus field rules; expanded suggestions and OCR-derived records require human confirmation. OCR is for upright printed English; recognition can omit or misread text, and completeness is unverified. Rule-based comparison. No clinical validation, brand mapping, effective-date inference, or treatment recommendations. All unsupported text requires manual review. Reviewer notes do not certify safety.',records:docs,comparison:result,reviewNotes:notes};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`meddelta-review-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Review exported with source records and notes.');
}
document.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.dataset.view){setView(target.dataset.view);return;}
 if(target.dataset.close){if(target.dataset.close==='pdf-dialog')closePdfImport();else $('#'+target.dataset.close).close();return;}
 if(target.dataset.filter){filter=target.dataset.filter;renderContent();return;}
 if(target.dataset.detail){detail(target.dataset.detail);return;}
 if(target.dataset.edit){editor(target.dataset.edit);return;}
 if(target.dataset.extract){openExtraction(target.dataset.extract);return;}
 if(target.dataset.pdf){showOriginalPdf(target.dataset.pdf);return;}
 if(target.hasAttribute('data-add')){editor();return;}
 if(target.dataset.delete){const id=target.dataset.delete;confirmAction('Remove this record?','The comparison will be recalculated and existing review notes cleared because their evidence may change.',()=>{docs=docs.filter(d=>d.id!==id);releaseUnusedPdfs();resetReview();recalculate();toast('Record removed. Comparison updated.');});return;}
 if(target.id==='delete-note'){delete notes[activeKey];render();detail(activeKey);toast('Review note removed.');}
});
$('#add-record').addEventListener('click',()=>editor());
$('#export-button').addEventListener('click',exportReport);
$('#how-button').addEventListener('click',()=>$('#help-dialog').showModal());$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
$('#confirm-yes').addEventListener('click',()=>{const action=pendingAction;pendingAction=null;$('#confirm-dialog').close();action?.();});
$('#demo-select').addEventListener('change',e=>{const selected=e.target.value;e.target.value=demoKey;confirmAction('Load a different sample?','This replaces the current records and notes. Export your review first if you want to keep it.',()=>{demoKey=selected;docs=structuredClone(DEMOS[selected].records);releaseUnusedPdfs();notes={};edited=false;filter='all';$('#demo-select').value=selected;recalculate();setView('overview');toast('Sample case loaded.');});});
$('#record-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#record-title').value.trim(),text=$('#record-text').value.trim(),when=$('#record-date').value;if(!title||!text||!validDate(when)){$('#form-error').textContent='Please add a title, valid date, and medication instructions.';return;}if(docs.length>=12&&!editingId){$('#form-error').textContent='This prototype supports up to 12 records per review.';return;}const save=()=>{const old=docs.find(d=>d.id===editingId);const d={id:editingId||crypto.randomUUID(),title,date:when,text,sourceImport:pendingSourceImport,extractionHistory:[...(old?.extractionHistory||[]),...(old?.extractionReview?[old.extractionReview]:[])]};docs=editingId?docs.map(old=>old.id===editingId?d:old):[...docs,d];resetReview();recalculate();$('#editor-dialog').close();if(needsOcrReview(d)){setView('records');openExtraction(d.id);toast('Review and confirm the OCR-derived fields to include them.');}else toast('Record saved. Comparison updated.');};if(Object.keys(notes).length){confirmAction('Update the source evidence?','Saving a record clears existing review notes so old reviews cannot be mistaken for reviews of new evidence. Export first if needed.',save);}else save();});
$('#record-file').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 e.target.value='';
 if(/\.(pdf|png|jpe?g|webp)$/i.test(file.name)){await startPdfImport(file);return;}
 if(file.size>60000||!file.name.toLowerCase().endsWith('.txt')){$('#form-error').textContent='Choose TXT (under 60 KB), PDF, PNG, JPEG, or WebP (under 10 MB).';return;}
 try{const text=await file.text();if(text.length>15000)throw new Error('This record is too long. Use up to 15,000 characters.');if(!$('#editor-dialog').open)return;$('#record-text').value=text;pendingSourceImport=null;renderSourceImportInfo();$('#form-error').textContent='';toast('Text imported. Check the title and date before saving.');}catch(err){$('#form-error').textContent=err.message;}
});
document.addEventListener('submit',e=>{if(e.target.id!=='note-form')return;e.preventDefault();const text=$('#review-note').value.trim();if(!text){$('#review-note').setCustomValidity('Enter a review note.');$('#review-note').reportValidity();return;}notes[activeKey]={text,reviewer:$('#reviewer').value.trim(),at:new Date().toISOString()};render();$('#detail-dialog').close();toast('Review note saved. Export to keep it.');});
document.addEventListener('input',e=>{if(e.target.id==='review-note')e.target.setCustomValidity('');});
document.querySelectorAll('[role="tab"]').forEach(tab=>tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...document.querySelectorAll('[role="tab"]')];let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;e.preventDefault();tabs[i].focus();setView(tabs[i].dataset.view);}));
window.addEventListener('beforeunload',e=>{if(edited||Object.keys(notes).length){e.preventDefault();e.returnValue='';}});
recalculate();
