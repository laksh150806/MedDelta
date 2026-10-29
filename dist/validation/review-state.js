import {LABELS,PROTOCOL_VERSION} from './benchmark.js';
export const REVIEW_ROLES=['student','pharmacist','other'];
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value));
const bounded=(value,max)=>typeof value==='string'&&value.length<=max;
export function createSession(dataset,hash,at=new Date().toISOString()){
 return {schemaVersion:1,application:'MedDelta validation',protocol:PROTOCOL_VERSION,datasetId:dataset.id,datasetSha256:hash,reviewer:{name:'',role:'student'},createdAt:at,updatedAt:at,exposure:{},judgments:[]};
}
function validateJudgment(row,packet){
 if(!row||!LABELS.includes(row.label)||!bounded(row.note,2000)||!row.note.trim()||!timestamp(row.savedAt)||typeof row.afterExposure!=='boolean'||!Array.isArray(row.evidence)||!row.evidence.length||row.evidence.length>100)throw new Error('Each judgment needs a label, explanation, timestamp, and source evidence.');
 const unique=new Set();for(const e of row.evidence){const record=packet.records.find(r=>r.id===e.recordId);const key=`${e.recordId}:${e.line}`;if(!record||!Number.isInteger(e.line)||e.line<0||e.line>record.text.split('\n').length||unique.has(key))throw new Error('A judgment has invalid or duplicate source evidence.');unique.add(key);}
}
export function validateSession(input,dataset,hash){
 if(!input||input.schemaVersion!==1||input.application!=='MedDelta validation'||input.protocol!==PROTOCOL_VERSION||input.datasetId!==dataset.id||input.datasetSha256!==hash)throw new Error('This review belongs to a different dataset or format. Import a MedDelta validation review for this dataset.');
 if(!bounded(input.reviewer?.name,80)||!input.reviewer.name.trim()||!REVIEW_ROLES.includes(input.reviewer.role)||!timestamp(input.createdAt)||!timestamp(input.updatedAt)||!Array.isArray(input.judgments)||input.judgments.length>dataset.cases.length)throw new Error('Invalid reviewer or review metadata.');
 if(!input.exposure||typeof input.exposure!=='object'||Array.isArray(input.exposure))throw new Error('Missing prediction-exposure history.');
 const ids=new Set(dataset.cases.map(c=>c.id));for(const [id,at] of Object.entries(input.exposure))if(!ids.has(id)||!timestamp(at))throw new Error('Invalid prediction-exposure history.');
 const seen=new Set();for(const row of input.judgments){const packet=dataset.cases.find(c=>c.id===row.caseId);if(!packet||seen.has(row.caseId)||!Array.isArray(row.revisions)||row.revisions.length>50)throw new Error('Unknown/duplicate case or excessive revisions.');seen.add(row.caseId);validateJudgment(row,packet);for(const old of row.revisions)validateJudgment(old,packet);if([row,...row.revisions].some(r=>r.afterExposure)&&!Object.hasOwn(input.exposure,row.caseId))throw new Error('Revision is missing its prediction-exposure record.');}
 // Copy known data only; imported files do not supply markup, methods, or predictions.
 const copyRow=row=>({label:row.label,evidence:row.evidence.map(e=>({recordId:e.recordId,line:e.line})),note:row.note,savedAt:row.savedAt,afterExposure:row.afterExposure});
 return {schemaVersion:1,application:input.application,protocol:input.protocol,datasetId:input.datasetId,datasetSha256:hash,reviewer:{name:input.reviewer.name,role:input.reviewer.role},createdAt:input.createdAt,updatedAt:input.updatedAt,exposure:{...input.exposure},judgments:input.judgments.map(row=>({caseId:row.caseId,...copyRow(row),revisions:row.revisions.map(copyRow)}))};
}
export function saveJudgment(session,dataset,hash,caseId,judgment,at=new Date().toISOString()){
 const next=structuredClone(session),old=next.judgments.find(r=>r.caseId===caseId);
 if(old?.revisions.length>=50)throw new Error('This case has reached the 50-revision limit. Export this review before starting another.');
 const revisions=old?[...old.revisions,(({caseId,revisions,...snapshot})=>snapshot)(old)]:[];
 const row={caseId,label:judgment.label,evidence:judgment.evidence,note:judgment.note.trim(),savedAt:at,afterExposure:Object.hasOwn(next.exposure,caseId),revisions};
 next.judgments=old?next.judgments.map(r=>r.caseId===caseId?row:r):[...next.judgments,row];next.updatedAt=at;
 return validateSession(next,dataset,hash);
}
export function exposePredictions(session,ids,at=new Date().toISOString()){
 const next=structuredClone(session);for(const id of ids)if(!Object.hasOwn(next.exposure,id))next.exposure[id]=at;next.updatedAt=at;return next;
}
