// Conservative comparison; expanded extraction enters only after human confirmation.
import {confirmedEvent} from './review.js';
import {sourceLocation,needsOcrReview} from './provenance.js';
export const VERSION = '0.4.0';
const FREQUENCIES = ['once daily','twice daily','three times daily','once weekly','as needed','daily','weekly'];
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function parseRecord(doc) {
  const events=[], issues=[];
  for(const warning of doc.sourceImport?.warnings||[])issues.push({docId:doc.id,line:0,text:doc.sourceImport.fileName,reason:warning});
  if(!validDate(doc.date)) issues.push({docId:doc.id,line:0,text:doc.date || '(missing date)',reason:'A valid document date is required before comparison.'});
  const lines=(doc.text || '').split('\n');
  lines.forEach((raw,index)=>{
    const source=raw.trim(); if(!source) return;
    const reviewed=confirmedEvent(doc,index+1,source);
    if(reviewed){events.push(reviewed);return;}
    if(needsOcrReview(doc)){issues.push({docId:doc.id,line:index+1,text:source,reason:'This record includes OCR. Review extraction and confirm each instruction against the original image before it enters the comparison.'});return;}
    const clean=source.replace(/^[-•]\s*/, '').replace(/[.]$/, '').trim();
    // Entire line must match. Additional qualifiers are never silently dropped.
    if(/\b(no|not|all|any|hold|resume|take|takes|taking|reduce|increase|decrease|switch|replace|restart|avoid|unless|until|tomorrow|yesterday|today|tonight|instead|and|or|if|when|while|before|after|for|except|only|now|please|begin|initiate|commence|keep|maintain|remain|adjust|update|discontinue|cease|treatment|to|patient|should|will)\b/i.test(clean)) {issues.push({docId:doc.id,line:index+1,text:source,reason:'This instruction contains an action or qualifier outside the strict parser. Review extraction or leave it unresolved.'});return;}
    const stop=clean.match(/^stop\s+([a-z][a-z -]{1,60})$/i);
    const re=new RegExp('^(?:(start|continue|change)\\s+)?([a-z][a-z -]{1,60}?)\\s+(\\d+(?:\\.\\d+)?)\\s*(mg|mcg|g|ml|units?)\\s+(?:(orally|oral|topically|topical)\\s+)?('+FREQUENCIES.join('|')+')$','i');
    const match=clean.match(re);
    if(!stop && !match) {issues.push({docId:doc.id,line:index+1,text:source,reason:'Not fully understood. Use one instruction per line, such as “Continue Metformin 500 mg orally twice daily”. Tapers, combinations, durations, and other qualifiers need manual review.'});return;}
    const name=(stop?stop[1]:match[2]).trim().replace(/\s+/g,' ');
    const event={docId:doc.id,docTitle:doc.title,date:doc.date,line:index+1,source,sourceLocation:sourceLocation(doc,index+1,source),key:name.toLowerCase(),name:name[0].toUpperCase()+name.slice(1),action:stop?'stop':(match[1]?.toLowerCase() || 'listed')};
    if(!stop) {event.amount=Number(match[3]);event.unit=match[4].toLowerCase().replace(/^unit$/,'units');event.route=match[5]?.toLowerCase().replace('orally','oral').replace('topically','topical') || 'unspecified';event.frequency=match[6].toLowerCase().replace(/^daily$/,'once daily').replace(/^weekly$/,'once weekly');}
    events.push(event);
  });
  if(!events.length && !issues.length) issues.push({docId:doc.id,line:0,text:'(empty record)',reason:'Add at least one medication instruction.'});
  return {events,issues};
}
export function regimen(e) {return e.action==='stop'?'Explicit stop recorded':`${e.amount} ${e.unit} · ${e.route==='unspecified'?'route not stated':e.route} · ${e.frequency}`;}
function signature(e){return e.action==='stop'?'stop':`${e.amount}|${e.unit}|${e.route}|${e.frequency}`;}
export function compareRecords(documents) {
  const docs=documents.map(d=>({...d}));
  const parsed=docs.map(parseRecord), issues=parsed.flatMap(p=>p.issues);
  if(docs.length<2) return {items:[],issues:[...issues,{docId:'',line:0,text:'',reason:'Add at least two records to compare.'}],blocked:true};
  if(docs.some(d=>!validDate(d.date))) return {items:[],issues,blocked:true};
  const all=parsed.flatMap(p=>p.events);
  const keys=[...new Set(all.map(e=>e.key))];
  const latestDate=docs.map(d=>d.date).sort().at(-1);
  const latestDocs=docs.filter(d=>d.date===latestDate);
  const items=keys.map(key=>{
    const events=all.filter(e=>e.key===key).sort((a,b)=>a.date.localeCompare(b.date)||a.docId.localeCompare(b.docId)||a.line-b.line);
    const first=events[0], last=events.at(-1), transitions=[];
    let unresolved=false,changed=false;
    for(let i=1;i<events.length;i++) {
      const before=events[i-1],after=events[i];
      if(before.date===after.date && signature(before)!==signature(after)) {unresolved=true;transitions.push({kind:'conflict',before,after,text:'Different instructions share a document date; their order is unknown.'});}
      else if(signature(before)===signature(after)) {transitions.push({kind:'same',before,after,text:'The written instruction is unchanged.'});}
      else if(after.action==='stop') {changed=true;transitions.push({kind:'change',before,after,text:'An explicit stop is documented. Confirm its intended effective date.'});}
      else if(after.action==='change' || (before.action==='stop' && after.action==='start')) {changed=true;transitions.push({kind:'change',before,after,text:'An explicit change is documented. This does not resolve earlier unexplained discrepancies.'});}
      else {unresolved=true;transitions.push({kind:'conflict',before,after,text:'The instruction differs without an explicit change explaining the transition.'});}
    }
    // Omission describes the record only; it never changes treatment state.
    const absent=latestDocs.some(d=>!events.some(e=>e.docId===d.id));
    const incomplete=issues.length>0;
    let status,label,summary,question;
    if(unresolved) {status='conflict';label='Needs clarification';summary='The records contain a difference that is not fully explained.';question=`Which documented instruction for ${first.name} was intended, and from what date? Confirm against the original records.`;}
    else if(absent && last.action!=='stop') {status='missing';const selection=latestDocs.some(d=>['pdf','image'].includes(d.sourceImport?.type)&&!events.some(e=>e.docId===d.id));label=selection?'Not in imported selection':'Not in latest record';summary=selection?'This medicine was not found in the reviewed selection. Check the original document; it may appear in unread, unselected, or unconfirmed content.':'This medicine is not listed in at least one of the latest records. That does not establish that it was stopped.';question=`Was ${first.name} intentionally omitted, continued elsewhere, or explicitly stopped?`;}
    else if(last.action==='stop') {status='stopped';label='Stop documented';summary=last.extraction==='human-confirmed'?'A reviewer interpreted the latest available instruction as a stop. Check the original text and confirmed fields.':'An explicit stop appears in the latest available instruction for this medicine.';question='Confirm the intended effective date and whether later instructions exist.';}
    else if(changed) {status='change';label='Change documented';summary='The records explicitly describe a change in the written instruction.';question='Confirm the change and its effective date with the source record.';}
    else if(events.length===1) {status='new';label='First documented';summary='Only one instruction was found. This does not establish when treatment began.';question='Confirm earlier history if needed.';}
    else {status='consistent';label='Matching instructions';summary='The supported fields match across the records where this medicine appears.';question='Confirm the extracted fields and any details not included in this prototype.';}
    return {key,name:first.name,events,transitions,status,label,summary,question,latest:last,incomplete,absent};
  });
  const priority={conflict:0,missing:1,change:2,stopped:3,new:4,consistent:5};
  items.sort((a,b)=>priority[a.status]-priority[b.status]||a.name.localeCompare(b.name));
  return {items,issues,blocked:false,latestDate};
}
export const DEMOS={
  natural:{title:'Review natural wording',description:'Review model suggestions against the original words before comparing.',records:[
    {id:'d1',title:'Earlier medication list',date:'2026-09-02',text:'Continue Metformin 500 mg orally once daily.\nContinue Amlodipine 5 mg orally once daily.\nContinue Cetirizine 10 mg orally once daily.'},
    {id:'d2',title:'Follow-up instructions',date:'2026-09-18',text:'Please increase Metformin to 500 mg by mouth twice a day.\nPlease keep taking Amlodipine 5 mg by mouth every day.\nPlease discontinue taking Cetirizine.'}
  ]},
  handoff:{title:'Discharge & follow-up',description:'An unexplained difference, an explicit change, and a missing instruction.',records:[
    {id:'d1',title:'Clinic prescription',date:'2026-09-02',text:'Continue Metformin 500 mg orally once daily.\nContinue Amlodipine 5 mg orally once daily.\nContinue Atorvastatin 10 mg orally once daily.\nContinue Cetirizine 10 mg orally once daily.'},
    {id:'d2',title:'Discharge medication list',date:'2026-09-10',text:'Change Metformin 500 mg orally twice daily.\nContinue Amlodipine 5 mg orally once daily.\nContinue Atorvastatin 10 mg orally once daily.\nStop Cetirizine.'},
    {id:'d3',title:'Follow-up note',date:'2026-09-18',text:'Continue Metformin 500 mg orally twice daily.\nContinue Amlodipine 10 mg orally once daily.'}
  ]},
  clear:{title:'A documented change',description:'A small example with an explicit change and matching instructions.',records:[
    {id:'d1',title:'Earlier medication list',date:'2026-09-02',text:'Continue Metformin 500 mg orally once daily.\nContinue Amlodipine 5 mg orally once daily.'},
    {id:'d2',title:'Follow-up medication list',date:'2026-09-18',text:'Change Metformin 500 mg orally twice daily.\nContinue Amlodipine 5 mg orally once daily.'}
  ]},
  uncertain:{title:'Missing information',description:'An unread instruction stays visible for manual review.',records:[
    {id:'d1',title:'Earlier medication list',date:'2026-09-02',text:'Continue Metformin 500 mg orally once daily.\nContinue Atorvastatin 10 mg orally once daily.'},
    {id:'d2',title:'Incomplete follow-up note',date:'2026-09-18',text:'Continue Metformin 500 mg orally once daily.\nAtorvastatin — instruction unclear.'}
  ]}
};
