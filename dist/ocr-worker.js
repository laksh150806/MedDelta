// One short-lived supervisor per page. Terminating it also stops its nested OCR worker.
importScripts('./vendor/tesseract/tesseract.min.js');
self.onmessage=async ({data})=>{
 let worker;
 const asset=name=>new URL(`./vendor/tesseract/${name}`,self.location.href).href;
 try{
  worker=await Tesseract.createWorker('eng',1,{
   workerPath:asset('worker.min.js'),corePath:asset(''),langPath:asset(''),
   workerBlobURL:false,cacheMethod:'none',gzip:true,
   logger:message=>self.postMessage({type:'progress',status:message.status,progress:message.progress}),
   errorHandler:()=>self.postMessage({type:'error',message:'The local OCR engine could not load or read this page. Try again, or use a clearer image.'})
  });
  await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
  const result=await worker.recognize(new Uint8Array(data.image),{}, {text:true,blocks:true});
  // Only the text and geometry cross back to the application, never debug image output.
  self.postMessage({type:'result',data:{text:result.data.text,blocks:result.data.blocks}});
 }catch{self.postMessage({type:'error',message:'OCR could not finish. Check that the image contains clear, upright printed English text.'});}
 finally{await worker?.terminate();self.close();}
};
