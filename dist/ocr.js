export const OCR_VERSION='tesseract.js 6.0.1 / core 6.1.2 / English best_int';
export const OCR_LIMITS={bytes:10*1024*1024,pixels:24000000,characters:100000,lines:500,timeoutMs:120000};
export function validateImageFile(file){
 if(!file||! /\.(png|jpe?g|webp)$/i.test(file.name||''))throw new Error('Choose a PNG, JPEG, or WebP image. HEIC and handwriting are not supported.');
 if(!file.size)throw new Error('This image is empty.');
 if(file.size>OCR_LIMITS.bytes)throw new Error('Choose an image smaller than 10 MB.');
}
export function validateImageDimensions(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>OCR_LIMITS.pixels||Math.max(width,height)>12000)throw new Error('Use an image with at most 24 megapixels and no side longer than 12,000 pixels.');
}
export function imageSignature(bytes){
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'png';
 const text=new TextDecoder('latin1').decode(bytes.slice(0,12));
 return text.startsWith('RIFF')&&text.slice(8)==='WEBP'?'webp':null;
}
export function ocrLines(data,pageNumber,width,height){
 const lines=[];
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const row of paragraph.lines||[]){
  const text=String(row.text||'').replace(/\s+/g,' ').trim();if(!text)continue;
  const score=Number.isFinite(row.confidence)?Math.max(0,Math.min(100,row.confidence)):null;
  const box=row.bbox,validBox=box&&['x0','y0','x1','y1'].every(k=>Number.isFinite(box[k]))&&box.x0>=0&&box.y0>=0&&box.x1>box.x0&&box.y1>box.y0&&box.x1<=width&&box.y1<=height;
  lines.push({page:pageNumber,line:lines.length+1,text,originalText:text,method:'ocr',confidence:score,needsCloserLook:score===null||score<85,bbox:validBox?{...box}:null,imageWidth:width,imageHeight:height});
 }
 // Never silently discard recognized text if an engine update changes the block shape.
 if(!lines.length&&data.text?.trim())throw new Error('OCR returned text without line positions. Please transcribe and check this page manually.');
 if(lines.length>OCR_LIMITS.lines||lines.reduce((n,l)=>n+l.text.length,0)>OCR_LIMITS.characters)throw new Error('This page has too much text. Use a shorter document.');
 if(!lines.length)throw new Error('No printed text was recognized. Use a clearer, upright image. Handwriting is not supported.');
 return lines;
}
export function recognizeCanvas(canvas,{signal,onProgress=()=>{},timeoutMs=OCR_LIMITS.timeoutMs}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('OCR cancelled.','AbortError'));return;}
  let worker,finished=false,timer;
  const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker?.terminate();error?reject(error):resolve(result);};
  const cancel=()=>finish(new DOMException('OCR cancelled.','AbortError'));
  signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>finish(new Error('OCR took too long. Try a smaller, clearer image.')),timeoutMs);
  onProgress('Preparing the page for local OCR…');
  canvas.toBlob(async blob=>{
   try{
    if(finished)return;if(!blob)throw new Error('The page could not be prepared for OCR.');
    const buffer=await blob.arrayBuffer();if(finished)return;
    worker=new Worker(new URL('./ocr-worker.js',import.meta.url));
    worker.onerror=()=>finish(new Error('The local OCR engine could not start. Reload and try again.'));
    worker.onmessage=({data})=>{
     if(data.type==='progress')onProgress(data.status==='recognizing text'?`Reading printed text locally… ${Math.round((data.progress||0)*100)}%`:'Loading local OCR tools… The first page may take a moment.');
     if(data.type==='error')finish(new Error(data.message));
     if(data.type==='result'){try{finish(null,ocrLines(data.data,1,canvas.width,canvas.height));}catch(error){finish(error);}}
    };
    worker.postMessage({image:buffer},[buffer]);
   }catch(error){finish(error);}
  },'image/png');
 });
}
export async function openImage(file,{signal}={}){
 validateImageFile(file);
 const buffer=await file.arrayBuffer();if(signal?.aborted)throw new DOMException('Import cancelled.','AbortError');
 if(!imageSignature(new Uint8Array(buffer)))throw new Error('This file is not a readable PNG, JPEG, or WebP image.');
 const digest=await crypto.subtle.digest('SHA-256',buffer),sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const url=URL.createObjectURL(file),img=new Image();let destroyed=false;
 const destroy=async()=>{if(destroyed)return;destroyed=true;signal?.removeEventListener('abort',cancel);img.src='';URL.revokeObjectURL(url);};
 const cancel=()=>{destroy();};signal?.addEventListener('abort',cancel,{once:true});
 try{
  img.src=url;await img.decode();if(signal?.aborted)throw new DOMException('Import cancelled.','AbortError');
  validateImageDimensions(img.naturalWidth,img.naturalHeight);
  return {file,sha256,type:'image',pageCount:1,pages:[{number:1,method:'unread',lines:[],warnings:['Image text has not been read. Run OCR, then check the original.']}],
   async render(number,canvas,{ocr=false}={}){
    if(destroyed)throw new DOMException('Import cancelled.','AbortError');
    const scale=Math.min(1,(ocr?2400:900)/img.naturalWidth,(ocr?3200:1200)/img.naturalHeight);
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
   },destroy};
 }catch(error){await destroy();if(signal?.aborted)throw new DOMException('Import cancelled.','AbortError');throw new Error(error.message?.startsWith('Use an image')?error.message:'The image could not be decoded. Try a PNG, JPEG, or WebP export.');}
}
