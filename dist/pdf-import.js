import {extractPageLines} from './pdf-layout.js';
export const PDF_LIMITS={bytes:10*1024*1024,pages:10,textCharacters:100000};
let libraryPromise;
export function validatePdfFile(file){
 if(!file||!file.name?.toLowerCase().endsWith('.pdf'))throw new Error('Choose a PDF file.');
 if(!file.size)throw new Error('This PDF is empty.');
 if(file.size>PDF_LIMITS.bytes)throw new Error('Choose a PDF smaller than 10 MB.');
}
function abortError(){return new DOMException('PDF import cancelled.','AbortError');}
export async function openPdf(file,{signal,onProgress=()=>{}}={}){
 validatePdfFile(file);if(signal?.aborted)throw abortError();
 const buffer=await file.arrayBuffer();if(signal?.aborted)throw abortError();
 const bytes=new Uint8Array(buffer);
 if(!new TextDecoder('latin1').decode(bytes.slice(0,1024)).includes('%PDF-'))throw new Error('This file does not contain a valid PDF header.');
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 onProgress('Opening PDF locally…');
 if(!libraryPromise)libraryPromise=import('./vendor/pdfjs/pdf.min.mjs').catch(error=>{libraryPromise=null;throw error;});
 const pdfjs=await libraryPromise;if(signal?.aborted)throw abortError();
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
 const asset=name=>new URL(`./vendor/pdfjs/${name}/`,import.meta.url).href;
 const task=pdfjs.getDocument({data:bytes,standardFontDataUrl:asset('standard_fonts'),cMapUrl:asset('cmaps'),cMapPacked:true,wasmUrl:asset('wasm'),iccUrl:asset('iccs'),stopAtErrors:true,enableXfa:false,maxImageSize:16000000,canvasMaxAreaInBytes:64000000});
 const cancel=()=>{task.destroy().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  const document=await task.promise;if(signal?.aborted)throw abortError();
  if(document.numPages>PDF_LIMITS.pages)throw new Error('This prototype supports PDFs with up to 10 pages.');
  const pages=[];let total=0;
  for(let number=1;number<=document.numPages;number++){
   if(signal?.aborted)throw abortError();onProgress(`Reading page ${number} of ${document.numPages}…`);
   const page=await document.getPage(number);let extracted;
   try{const content=await page.getTextContent();extracted=extractPageLines(content.items,number);}catch{extracted={lines:[],warnings:[`Page ${number} could not be read as selectable text. Preview it and try OCR or transcribe it manually.`]};}
   total+=extracted.lines.reduce((sum,line)=>sum+line.text.length,0);if(total>PDF_LIMITS.textCharacters)throw new Error('This PDF contains too much text for the prototype. Import a shorter document.');
   pages.push({number,method:extracted.lines.length?'pdf-text':'unread',...extracted});
  }
  let renderTask=null,destroyed=false;
  return {file,pages,sha256,type:'pdf',pageCount:document.numPages,
   async render(pageNumber,canvas,{ocr=false}={}){
    if(destroyed)throw abortError();if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}}
    const page=await document.getPage(pageNumber);const raw=page.getViewport({scale:1});const scale=Math.min(ocr?3:1.6,(ocr?2400:900)/raw.width,(ocr?3200:1200)/raw.height);const viewport=page.getViewport({scale});
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    renderTask=page.render({canvasContext:canvas.getContext('2d'),canvas,viewport});
    try{await renderTask.promise;}catch(error){if(error.name!=='RenderingCancelledException')throw error;}
   },
   async destroy(){if(destroyed)return;destroyed=true;signal?.removeEventListener('abort',cancel);if(renderTask)renderTask.cancel();await task.destroy();}
  };
 }catch(error){signal?.removeEventListener('abort',cancel);await task.destroy().catch(()=>{});if(signal?.aborted)throw abortError();if(error.name==='PasswordException')throw new Error('This PDF is password-protected. Import an unlocked copy; the prototype does not collect passwords.');throw new Error(error.message||'The PDF could not be read. Try a typed PDF or plain text.');}
}
