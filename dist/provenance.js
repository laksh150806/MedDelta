export function sourceLocation(doc,line,source){
 const imported=doc.sourceImport;
 if(!imported||!['pdf','image'].includes(imported.type)||imported.importedText!==doc.text)return null;
 const match=imported.lines?.find(row=>row.recordLine===line&&row.text===source);
 if(!match)return null;
 return {fileName:imported.fileName,sha256:imported.sha256,sourceType:imported.type,page:match.page,pdfLine:match.line,method:match.method||'pdf-text',...(match.method==='ocr'?{originalOcrText:match.originalText,corrected:match.text!==match.originalText,bbox:match.bbox,imageWidth:match.imageWidth,imageHeight:match.imageHeight}:{} )};
}
export function needsOcrReview(doc){return doc.sourceImport?.ocrUsed===true||doc.sourceImport?.lines?.some(line=>line.method==='ocr')===true;}
