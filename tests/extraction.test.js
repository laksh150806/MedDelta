import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseRecord,compareRecords,DEMOS} from '../dist/engine.js';
import {suggestLine,extractionDraft} from '../dist/extraction.js';
import {classifyAction} from '../dist/classifier.js';
import {validFields} from '../dist/review.js';
const reviewed=(doc,fields)=>({...doc,extractionReview:{documentText:doc.text,documentDate:doc.date,documentTitle:doc.title,reviewer:'Synthetic test reviewer',at:'2026-01-01T00:00:00Z',lines:[{line:1,source:doc.text.trim(),confirmed:true,fields}]}});
const doc={id:'d',title:'Fictional record',date:'2026-02-01',text:'Please increase Alphamed to 10 mg by mouth twice a day.'};
test('natural wording yields structured suggestions but no automatic event',()=>{
 const s=suggestLine(doc.text);assert.deepEqual(s.fields,{name:'Alphamed',action:'change',amount:10,unit:'mg',route:'oral',frequency:'twice daily'});
 assert.equal(parseRecord(doc).events.length,0);assert.equal(extractionDraft(doc)[0].confirmed,false);
});
test('reviewed fields retain original source and reviewer identity',()=>{const r=parseRecord(reviewed(doc,suggestLine(doc.text).fields));assert.equal(r.events[0].source,doc.text);assert.equal(r.events[0].extraction,'human-confirmed');assert.equal(r.events[0].extractionReviewer,'Synthetic test reviewer');});
test('editing source text, date, or title invalidates an existing confirmation',()=>{const d=reviewed(doc,suggestLine(doc.text).fields);for(const changes of [{text:doc.text+' '},{date:'2026-03-01'},{title:'Different record'}])assert.equal(parseRecord({...d,...changes}).events.length,0);});
test('unconfirmed and malformed fields cannot enter comparison',()=>{const d=reviewed(doc,suggestLine(doc.text).fields);d.extractionReview.lines[0].confirmed=false;assert.equal(parseRecord(d).events.length,0);d.extractionReview.lines[0].confirmed=true;d.extractionReview.lines[0].fields.action='guess';assert.equal(parseRecord(d).events.length,0);});
test('a reviewer can correct a model suggestion without rewriting source',()=>{const fields={...suggestLine(doc.text).fields,amount:15};const e=parseRecord(reviewed(doc,fields)).events[0];assert.equal(e.amount,15);assert.equal(e.source,doc.text);});
test('unsupported qualifiers are kept unresolved',()=>{const examples=JSON.parse(fs.readFileSync(new URL('../data/unsupported-examples.json',import.meta.url)));for(const text of examples)assert.equal(suggestLine(text).blocked,true,text);});
test('the model action is independent of medicine name and regimen',()=>{const a=suggestLine('Please increase Alphamed to 5 mg orally once daily.');const b=suggestLine('Please increase Othermed to 20 mcg topically once weekly.');assert.deepEqual(a.prediction,b.prediction);});
test('reviewing the natural-language sample yields expected temporal findings',()=>{
 const docs=structuredClone(DEMOS.natural.records),d=docs[1];d.extractionReview={documentText:d.text,documentDate:d.date,documentTitle:d.title,reviewer:'Test',at:'2026-01-01T00:00:00Z',lines:extractionDraft(d).map(row=>({...row,confirmed:true}))};
 const result=compareRecords(docs);assert.equal(result.issues.length,0);assert.deepEqual(Object.fromEntries(result.items.map(i=>[i.key,i.status])),{metformin:'change',cetirizine:'stopped',amlodipine:'consistent'});
});
test('JavaScript inference reproduces the Python model export',()=>{const examples=JSON.parse(fs.readFileSync(new URL('./model-parity.json',import.meta.url)));for(const e of examples){const actual=classifyAction(e.text);assert.equal(actual.action,e.expected);actual.scores.forEach((score,i)=>assert.ok(Math.abs(score-e.scores[i])<1e-8));}});
test('no blank reviewer or invalid amount is treated as confirmation',()=>{const d=reviewed(doc,suggestLine(doc.text).fields);d.extractionReview.reviewer=' ';assert.equal(parseRecord(d).events.length,0);assert.equal(validFields({...suggestLine(doc.text).fields,amount:0}),false);});
