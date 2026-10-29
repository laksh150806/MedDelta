import {compareRecords,validDate} from '../engine.js';
export const PROTOCOL_VERSION='temporal-review-1';
export const LABELS=['consistent','change','conflict','missing','stopped','new','unresolved'];
export const LABEL_NAMES={consistent:'Matching instructions',change:'Documented change',conflict:'Unexplained discrepancy',missing:'Missing from latest record',stopped:'Explicit stop documented',new:'First documented',unresolved:'Insufficient evidence'};
export function predictCase(packet,method='full'){
 if(!['full','pair'].includes(method))throw new Error('Unknown benchmark method.');
 // Both methods share parsing and abstention rules; only their history window differs.
 const records=method==='pair'&&packet.records.every(d=>validDate(d.date))?[...packet.records].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(-2):packet.records;
 const result=compareRecords(records),item=result.items.find(i=>i.key===packet.target.toLowerCase());
 const label=result.blocked||result.issues.length||!item?'unresolved':item.status;
 const evidence=(item?.events||[]).map(e=>({recordId:e.docId,line:e.line,text:e.source}));
 const aligned=evidence.filter(e=>records.find(d=>d.id===e.recordId)?.text.split('\n')[e.line-1]?.trim()===e.text).length;
 return {label,rawStatus:item?.status||null,abstained:label==='unresolved',recordsUsed:records.map(d=>d.id),issues:result.issues.map(i=>({recordId:i.docId,line:i.line,reason:i.reason})),evidence,sourceTextAligned:aligned,sourceTextCount:evidence.length};
}
export function benchmarkRows(cases,references){
 const labels=new Map(references.map(r=>[r.caseId,r]));
 return cases.filter(c=>labels.has(c.id)).map(packet=>({caseId:packet.id,split:packet.split,family:packet.family,expected:labels.get(packet.id).label,full:predictCase(packet,'full'),pair:predictCase(packet,'pair')}));
}
const ratio=(n,d)=>d?n/d:null;
export function scoreRows(rows,method='full'){
 const confusion=Object.fromEntries(LABELS.map(a=>[a,Object.fromEntries(LABELS.map(b=>[b,0]))]));
 let exact=0,covered=0,correctCovered=0,tp=0,fp=0,fn=0,resolvedWithoutSupport=0,uncertainReferences=0,aligned=0,evidenceCount=0;
 for(const row of rows){
  const expected=row.expected,prediction=row[method];if(!LABELS.includes(expected)||!LABELS.includes(prediction?.label))throw new Error('Invalid benchmark label.');
  const actual=prediction.label;confusion[expected][actual]++;
  if(actual===expected)exact++;
  if(actual!=='unresolved'){covered++;if(actual===expected)correctCovered++;}
  if(actual==='conflict'&&expected==='conflict')tp++;
  if(actual==='conflict'&&expected!=='conflict')fp++;
  if(actual!=='conflict'&&expected==='conflict')fn++;
  if(['conflict','missing','unresolved'].includes(expected)){uncertainReferences++;if(['consistent','change','stopped','new'].includes(actual))resolvedWithoutSupport++;}
  aligned+=prediction.sourceTextAligned||0;evidenceCount+=prediction.sourceTextCount||0;
 }
 return {total:rows.length,exactMatches:exact,exactAgreement:ratio(exact,rows.length),covered,coverage:ratio(covered,rows.length),abstentions:rows.length-covered,correctAmongCovered:correctCovered,agreementAmongCovered:ratio(correctCovered,covered),wrongNonAbstaining:covered-correctCovered,conflict:{truePositive:tp,falsePositive:fp,falseNegative:fn,precision:ratio(tp,tp+fp),recall:ratio(tp,tp+fn)},unsupportedResolution:{count:resolvedWithoutSupport,uncertainReferences,rate:ratio(resolvedWithoutSupport,uncertainReferences)},sourceTextAlignment:{matched:aligned,total:evidenceCount,rate:ratio(aligned,evidenceCount)},confusion};
}
export function validateDataset(dataset,references){
 if(dataset.schemaVersion!==1||references.datasetId!==dataset.id||!Array.isArray(dataset.cases)||!dataset.cases.length)throw new Error('Invalid dataset identity.');
 const ids=new Set(),families=new Map(),signatures=new Set();
 for(const c of dataset.cases){
  if(ids.has(c.id)||!['development','evaluation'].includes(c.split)||!c.target||!c.family||c.records.length<2)throw new Error('Invalid or duplicate case.');ids.add(c.id);
  if(families.has(c.family)&&families.get(c.family)!==c.split)throw new Error('A case family crosses the split.');families.set(c.family,c.split);
  const signature=JSON.stringify([c.target,c.records.map(r=>[r.date,r.text]).sort()]);if(signatures.has(signature))throw new Error('Duplicate source packet.');signatures.add(signature);
  const recordIds=new Set();for(const r of c.records){if(recordIds.has(r.id)||typeof r.text!=='string'||typeof r.date!=='string')throw new Error('Invalid record.');recordIds.add(r.id);}
 }
 if(references.labels.length!==ids.size||new Set(references.labels.map(r=>r.caseId)).size!==ids.size)throw new Error('Reference labels must cover every case exactly once.');
 for(const r of references.labels){const c=dataset.cases.find(c=>c.id===r.caseId);if(!c||!LABELS.includes(r.label)||!r.rationale?.trim()||!r.evidence.length)throw new Error('Invalid reference judgment.');for(const e of r.evidence){const d=c.records.find(d=>d.id===e.recordId);if(!d||!Number.isInteger(e.line)||e.line<0||e.line>d.text.split('\n').length)throw new Error('Invalid reference evidence.');}}
 return true;
}
