import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRecords,parseRecord,validDate,DEMOS} from '../dist/engine.js';
const doc=(id,date,text)=>({id,date,text,title:id});
const pair=(a,b)=>[doc('a','2026-01-01',a),doc('b','2026-02-01',b)];
test('demo detects conflict, missing medicine, explicit change and stop',()=>{
 const r=compareRecords(DEMOS.handoff.records);assert.equal(r.issues.length,0);
 assert.deepEqual(Object.fromEntries(r.items.map(x=>[x.key,x.status])),{amlodipine:'conflict',atorvastatin:'missing',metformin:'change',cetirizine:'stopped'});
});
test('omission never implies stop',()=>assert.equal(compareRecords(pair('Continue Alpha 10 mg daily.','Continue Beta 5 mg daily.')).items.find(x=>x.key==='alpha').status,'missing'));
test('a newer conflicting dose does not automatically supersede',()=>assert.equal(compareRecords(pair('Continue Alpha 10 mg daily.','Continue Alpha 20 mg daily.')).items[0].status,'conflict'));
test('explicit change is distinct from an unexplained difference',()=>assert.equal(compareRecords(pair('Continue Alpha 10 mg daily.','Change Alpha 20 mg daily.')).items[0].status,'change'));
test('equal-date conflicting records remain ambiguous',()=>{
const r=compareRecords([doc('a','2026-01-01','Alpha 10 mg daily.'),doc('b','2026-01-01','Change Alpha 20 mg daily.')]);assert.equal(r.items[0].status,'conflict');});
test('unsupported duration, future date, PRN limit, and taper remain visible',()=>{
 for(const text of ['Alpha 10 mg daily for 5 days.','Change Alpha 10 mg daily from tomorrow.','Alpha 10 mg as needed, max 3 doses.','Alpha 10 mg then reduce to 5 mg.']) {const r=parseRecord(doc('a','2026-01-01',text));assert.equal(r.events.length,0);assert.equal(r.issues.length,1);}
});
test('invalid dates block chronological conclusions',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(compareRecords([doc('a','','Alpha 10 mg daily.'),doc('b','2026-01-01','Alpha 20 mg daily.')]).blocked,true);});
test('source evidence retains exact line and document',()=>{const r=parseRecord(doc('a','2026-01-01','\nContinue Alpha 10 mg daily.'));assert.equal(r.events[0].line,2);assert.equal(r.events[0].source,'Continue Alpha 10 mg daily.');});
test('unknown content marks every conclusion provisional',()=>{const r=compareRecords(DEMOS.uncertain.records);assert.equal(r.issues.length,1);assert.ok(r.items.every(x=>x.incomplete));});
test('reordering inputs does not change findings',()=>assert.deepEqual(compareRecords(DEMOS.handoff.records).items,compareRecords([...DEMOS.handoff.records].reverse()).items));
test('an unresolved earlier conflict is not hidden by a later change',()=>{const r=compareRecords([...pair('Alpha 10 mg daily.','Alpha 20 mg daily.'),doc('c','2026-03-01','Change Alpha 5 mg daily.')]);assert.equal(r.items[0].status,'conflict');});
test('stop followed by continue is unresolved; explicit start records restart',()=>{assert.equal(compareRecords(pair('Stop Alpha.','Continue Alpha 10 mg daily.')).items[0].status,'conflict');assert.equal(compareRecords(pair('Stop Alpha.','Start Alpha 10 mg daily.')).items[0].status,'change');});
test('same-date identical instructions agree',()=>assert.equal(compareRecords([doc('a','2026-01-01','Alpha 10 mg daily.'),doc('b','2026-01-01','Alpha 10 mg daily.')]).items[0].status,'consistent'));
test('unit and route changes are not silently normalized away',()=>{assert.equal(compareRecords(pair('Alpha 10 mg orally daily.','Alpha 10 mcg orally daily.')).items[0].status,'conflict');assert.equal(compareRecords(pair('Alpha 10 mg orally daily.','Alpha 10 mg topically daily.')).items[0].status,'conflict');});
test('negation and unsupported action words are not medicine names',()=>{for(const text of ['Do not take Alpha 10 mg daily.','Hold Alpha 10 mg daily.','Stop Alpha tomorrow.']){const p=parseRecord(doc('a','2026-01-01',text));assert.equal(p.events.length,0);assert.equal(p.issues.length,1);}});
test('qualified or combined stop instructions stay unread',()=>{for(const text of ['Stop Alpha and Beta.','Stop Alpha if dizzy.','Stop Alpha for now.']){const p=parseRecord(doc('a','2026-01-01',text));assert.equal(p.events.length,0);assert.equal(p.issues.length,1);}});
