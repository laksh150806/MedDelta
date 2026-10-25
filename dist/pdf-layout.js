// Layout reconstruction is deliberately conservative and must be checked visually.
export function extractPageLines(items,pageNumber){
 const warnings=[],usable=[];
 for(const item of items){
  if(typeof item.str!=='string'||!item.str.trim())continue;
  const t=item.transform;
  if(!Array.isArray(t)||t.length!==6||!t.every(Number.isFinite))throw new Error(`Page ${pageNumber} contains unreadable text positions.`);
  if(Math.abs(t[1])>0.1||Math.abs(t[2])>0.1||item.dir==='ttb')throw new Error(`Page ${pageNumber} contains rotated or vertical text. This layout needs manual transcription.`);
  usable.push({text:item.str,x:t[4],y:t[5],width:Number(item.width)||0,height:Math.max(Math.abs(t[3]),Number(item.height)||0,1)});
 }
 if(!usable.length)return {lines:[],warnings:[`Page ${pageNumber} has no extractable text. It may be scanned or blank; its content has not been read.`]};
 usable.sort((a,b)=>b.y-a.y||a.x-b.x);
 const rows=[];
 for(const item of usable){const row=rows.find(r=>Math.abs(r.y-item.y)<=Math.max(1.5,Math.min(r.height,item.height)*0.25));if(row)row.items.push(item);else rows.push({y:item.y,height:item.height,items:[item]});}
 const lines=[];
 for(const row of rows){
  row.items.sort((a,b)=>a.x-b.x);let text='',endX=null,lastHeight=row.height;
  const flush=()=>{const clean=text.trim();if(clean)lines.push({page:pageNumber,line:lines.length+1,text:clean});text='';endX=null;};
  for(const item of row.items){
   const gap=endX===null?0:item.x-endX;
   if(endX!==null&&gap>Math.max(36,lastHeight*4)){flush();warnings.push(`Page ${pageNumber} has widely separated text columns. Check line grouping against the preview.`);}
   const space=text&&!/\s$/.test(text)&&!/^\s/.test(item.text)&&gap>Math.max(0.8,item.height*0.12)?' ':'';
   text+=space+item.text;endX=item.x+item.width;lastHeight=item.height;
  }
  flush();
 }
 return {lines,warnings:[...new Set(warnings)]};
}
export function selectedPdfText(pages,keys){
 const selected=pages.flatMap(p=>p.lines).filter(line=>keys.has(`${line.page}:${line.line}`));
 const text=selected.map(line=>line.text).join('\n');
 if(!selected.length)throw new Error('Select at least one medication instruction.');
 if(text.length>15000)throw new Error('Selected text exceeds 15,000 characters. Import a smaller selection.');
 return {text,lines:selected.map((line,i)=>({...line,recordLine:i+1}))};
}
