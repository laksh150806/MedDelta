export const ACTIONS=['listed','start','continue','change','stop'];
export const UNITS=['mg','mcg','g','ml','units'];
export const ROUTES=['unspecified','oral','topical'];
export const SCHEDULES=['once daily','twice daily','three times daily','once weekly','as needed'];
export function validFields(fields){
 if(!fields || typeof fields.name!=='string'||! /^[a-z][a-z -]{1,60}$/i.test(fields.name)||!ACTIONS.includes(fields.action))return false;
 if(fields.action==='stop')return true;
 return Number.isFinite(Number(fields.amount))&&Number(fields.amount)>0&&UNITS.includes(fields.unit)&&ROUTES.includes(fields.route)&&SCHEDULES.includes(fields.frequency);
}
export function reviewMatches(doc,review){return !!review && review.documentText===doc.text && review.documentDate===doc.date && review.documentTitle===doc.title && typeof review.reviewer==='string' && review.reviewer.trim().length>0 && typeof review.at==='string' && !Number.isNaN(Date.parse(review.at)) && Array.isArray(review.lines);}
export function confirmedEvent(doc,line,source){
 if(!reviewMatches(doc,doc.extractionReview))return null;
 const row=doc.extractionReview.lines.find(r=>r.line===line&&r.source===source&&r.confirmed===true);
 if(!row||!validFields(row.fields))return null;
 const f=row.fields,name=f.name.trim().replace(/\s+/g,' ');
 const e={docId:doc.id,docTitle:doc.title,date:doc.date,line,source,key:name.toLowerCase(),name,action:f.action,extraction:'human-confirmed',extractionReviewer:doc.extractionReview.reviewer,extractionReviewedAt:doc.extractionReview.at,suggestedFields:row.suggestedFields||null};
 if(f.action!=='stop')Object.assign(e,{amount:Number(f.amount),unit:f.unit,route:f.route,frequency:f.frequency});
 return e;
}
