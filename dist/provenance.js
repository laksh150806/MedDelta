export function sourceLocation(doc,line,source){
 const imported=doc.sourceImport;
 if(!imported||imported.type!=='pdf'||imported.importedText!==doc.text)return null;
 const match=imported.lines?.find(row=>row.recordLine===line&&row.text===source);
 if(!match)return null;
 return {fileName:imported.fileName,sha256:imported.sha256,page:match.page,pdfLine:match.line};
}
