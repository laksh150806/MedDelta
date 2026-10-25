import {parseRecord} from './engine.js';
import {classifyAction} from './classifier.js';
import {reviewMatches} from './review.js';
const conditional=/\b(not|no|all|any|hold|resume|restart|avoid|unless|until|tomorrow|yesterday|today|tonight|instead|and|or|if|when|while|before|after|for|except|only|now|prn|bid|tid|qd|qod|od|tablet|tablets|capsule|capsules)\b/i;
const units='(mg|mcg|g|ml|units?)';
const frequencies='(three times daily|three times a day|twice daily|twice a day|once daily|once a day|every day|once weekly|once a week|weekly|daily|as needed)';
function normalizedFrequency(s){return s.toLowerCase().replace('three times a day','three times daily').replace('twice a day','twice daily').replace('once a day','once daily').replace('every day','once daily').replace('once a week','once weekly').replace(/^daily$/,'once daily').replace(/^weekly$/,'once weekly');}
export function suggestLine(source){
 const strict=parseRecord({id:'draft',title:'Draft',date:'2026-01-01',text:source});
 if(strict.events.length){const e=strict.events[0];return {fields:{name:e.name,action:e.action,amount:e.amount??'',unit:e.unit||'mg',route:e.route||'unspecified',frequency:e.frequency||'once daily'},method:'Existing strict parser',blocked:false};}
 if(conditional.test(source))return {fields:null,blocked:true,reason:'A condition, timing qualifier, abbreviation, or unsupported dosage form needs manual review. This line stays unresolved.'};
 const clean=source.trim().replace(/^[-•]\s*/,'').replace(/[.]$/,'').replace(/,\s*/g,' ').replace(/\s+/g,' ');
 const stop=clean.match(/^(?:please )?(?:stop(?: taking)?|discontinue(?: taking)?|cease(?: taking| treatment with)?) ([a-z][a-z -]{1,60})$/i);
 const actionPrefix='(?:(?:please )?(?:continue(?: taking)?|keep(?: taking)?|maintain(?: treatment with)?|remain on|start(?: taking)?|begin(?: taking)?|initiate(?: treatment with)?|commence|change(?: the dose of)?|increase|decrease|adjust(?: the dose of)?|reduce|update)|(?:new prescription|medication|listed medication|medication list|recorded|listed|record entry|medication recorded|recorded medication):)';
 const pattern=new RegExp('^(?:'+actionPrefix+'\\s+)?([a-z][a-z -]{1,60}?)\\s+(?:to\\s+)?(\\d+(?:\\.\\d+)?)\\s*'+units+'\\s+(?:(oral|orally|by mouth|topical|topically)\\s+)?'+frequencies+'$','i');
 const match=clean.match(pattern);
 if(!stop&&!match)return {fields:null,blocked:true,reason:'This sentence cannot be fully represented by the current fields. Keep the original text for manual review.'};
 const extractedName=(stop?stop[1]:match[1]).trim();
 // Train and infer on the action cue only, never the medication or regimen.
 const cue=clean.slice(0,clean.toLowerCase().indexOf(extractedName.toLowerCase())).trim();
 const prediction=classifyAction(cue);
 let fields;
 if(stop){fields={name:stop[1].trim(),action:prediction.action,amount:'',unit:'mg',route:'unspecified',frequency:'once daily'};}
 else fields={name:match[1].trim(),action:prediction.action,amount:Number(match[2]),unit:match[3].toLowerCase().replace(/^unit$/,'units'),route:match[4]?.toLowerCase().replace('orally','oral').replace('by mouth','oral').replace('topically','topical')||'unspecified',frequency:normalizedFrequency(match[5])};
 // A model action must not discard a written amount or invent missing fields.
 if((stop && prediction.action!=='stop')||(!stop&&prediction.action==='stop')||prediction.score<0.6)fields.action='';
 return {fields,method:'Local action model + field rules',prediction:{...prediction,scoreMeaning:'Uncalibrated model score, not medical certainty'},blocked:false};
}
export function extractionDraft(doc){
 const prior=reviewMatches(doc,doc.extractionReview)?doc.extractionReview:null;
 return doc.text.split('\n').flatMap((raw,index)=>{const source=raw.trim();if(!source)return [];const suggestion=suggestLine(source);const saved=prior?.lines.find(r=>r.line===index+1&&r.source===source);return [{line:index+1,source,...suggestion,fields:saved?.fields||suggestion.fields,suggestedFields:saved?.suggestedFields||suggestion.fields,confirmed:saved?.confirmed===true}];});
}
