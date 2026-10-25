import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {suggestLine} from '../dist/extraction.js';
import {parseRecord,VERSION} from '../dist/engine.js';
import {classifyAction} from '../dist/classifier.js';
import {validFields} from '../dist/review.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const templates=JSON.parse(fs.readFileSync(root+'data/action-templates.json','utf8'));
const unsupported=JSON.parse(fs.readFileSync(root+'data/unsupported-examples.json','utf8'));
const trainCues=Object.values(templates.train).flat().map(t=>t.split('{')[0].trim());
const evaluationCues=Object.values(templates.evaluation).flat().map(t=>t.split('{')[0].trim());
if(evaluationCues.some(cue=>trainCues.includes(cue)))throw new Error('Training/evaluation action cues overlap.');
const rows=[];
for(const [label,families] of Object.entries(templates.evaluation))for(const [family,template] of families.entries()){
 for(const [name,amount] of [['Epsilonmed',5],['Zetamed',10],['Etamed',20]]){
  const frequency='twice daily',regimen=`${amount} mg orally ${frequency}`;
  const text=template.replaceAll('{instruction}',`${name} ${regimen}`).replaceAll('{medicine}',name).replaceAll('{regimen}',regimen)+'.';
  const expected={name,action:label,...(label==='stop'?{}:{amount,unit:'mg',route:'oral',frequency})};
  const baseline=parseRecord({id:'evaluation',title:'Synthetic evaluation',date:'2026-01-01',text}).events[0];
  const suggestion=suggestLine(text);const accepted=!suggestion.blocked&&validFields(suggestion.fields);
  const exact=f=>!!f&&Object.entries(expected).every(([key,value])=>String(f[key]).toLowerCase()===String(value).toLowerCase());
  rows.push({family:`${label}-${family}`,text,expected,baselineCovered:!!baseline,baselineCorrect:exact(baseline),suggestionCovered:accepted,suggestionCorrect:accepted&&exact(suggestion.fields),suggested:suggestion.fields||null});
 }
}
const actionResults=Object.entries(templates.evaluation).flatMap(([label,families])=>families.map(template=>{const cue=template.split('{')[0].trim(),prediction=classifyAction(cue);return {cue,expected:label,predicted:prediction.action,correct:prediction.action===label};}));
const unsupportedResults=unsupported.map(text=>({text,rejected:suggestLine(text).blocked===true}));
function metrics(prefix){const covered=rows.filter(r=>r[prefix+'Covered']).length,correct=rows.filter(r=>r[prefix+'Correct']).length;return {total:rows.length,covered,correct,coverage:covered/rows.length,precisionAmongCovered:covered?correct/covered:null,exactMatchAcrossAll:correct/rows.length};}
const report={version:VERSION,scope:'Synthetic development benchmark, not independent clinical validation. Action evaluation cue families are absent from classifier training; parser rules were developed for these supported constructions. No claim of real-world generalization.',trainingCueCount:trainCues.length,evaluationCueCount:evaluationCues.length,baseline:metrics('baseline'),expandedSuggestions:metrics('suggestion'),actionClassification:{correct:actionResults.filter(r=>r.correct).length,total:actionResults.length},unsupportedRejection:{rejected:unsupportedResults.filter(r=>r.rejected).length,total:unsupportedResults.length},actionResults,rows,unsupportedResults};
const output=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(root+'docs/evaluation.json','utf8')!==output)throw new Error('Evaluation report is stale. Run npm run evaluate and review changes.');}
else fs.writeFileSync(root+'docs/evaluation.json',output);
console.log(JSON.stringify({scope:report.scope,baseline:report.baseline,expandedSuggestions:report.expandedSuggestions,actionClassification:report.actionClassification,unsupportedRejection:report.unsupportedRejection},null,2));
