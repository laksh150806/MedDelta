import fs from 'node:fs';
import crypto from 'node:crypto';
import {VERSION} from '../dist/engine.js';
import {PROTOCOL_VERSION,benchmarkRows,scoreRows,validateDataset} from '../dist/validation/benchmark.js';
const base=new URL('../dist/validation/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,base),'utf8');
const manifest=JSON.parse(read('manifest.json'));
for(const [file,expected] of Object.entries(manifest.files))if(crypto.createHash('sha256').update(read(file)).digest('hex')!==expected)throw new Error('Frozen dataset changed: '+file+'. Version the dataset instead of silently changing labels.');
const dataset=JSON.parse(read('cases.json')),reference=JSON.parse(read('reference-labels.json'));
validateDataset(dataset,reference);
const rows=benchmarkRows(dataset.cases,reference.labels);
const results=Object.fromEntries(['development','evaluation'].map(split=>[split,Object.fromEntries(['full','pair'].map(method=>[method,scoreRows(rows.filter(r=>r.split===split),method)]))]));
const report={applicationVersion:VERSION,engineSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../dist/engine.js',import.meta.url))).digest('hex'),protocol:PROTOCOL_VERSION,datasetId:dataset.id,datasetHashes:manifest.files,referenceStatus:reference.status,scope:'Developer-authored fictional text challenge; no pharmacist validation. Engine outputs with any source issue are counted as abstentions. No OCR or human confirmations are simulated. This is not independent clinical performance.',methods:{full:'All supplied records; current strict parser and comparison rules.',pair:'Same parser/rules, restricted to the two most recent dated records. Invalid dates still force abstention.'},results,rows};
const output=JSON.stringify(report,null,2)+'\n',target=new URL('benchmark-report.json',base);
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==output)throw new Error('Benchmark report is stale. Run npm run benchmark and review changes.');}
else fs.writeFileSync(target,output);
for(const [split,methods] of Object.entries(results))for(const [method,m] of Object.entries(methods))console.log(`${split} / ${method}: ${m.exactMatches}/${m.total} exact; ${m.covered}/${m.total} non-abstaining; ${m.wrongNonAbstaining} wrong non-abstaining; ${m.unsupportedResolution.count} unsupported resolutions.`);
