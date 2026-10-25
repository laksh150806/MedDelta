import model from './action-model.js';
export const MODEL_INFO={version:model.version,trainingExamples:model.training_examples,trainingFamilies:model.training_template_families};
export function classifyAction(text){
  const words=String(text).toLowerCase().match(/[a-z]+/g)||[];
  const tokens=[...words,...words.slice(0,-1).map((w,i)=>w+' '+words[i+1])];
  const counts=new Map();
  for(const token of tokens){if(!Object.hasOwn(model.vocabulary,token))continue;const index=model.vocabulary[token];counts.set(index,(counts.get(index)||0)+1);}
  const logits=model.intercepts.map((base,k)=>base+[...counts].reduce((sum,[j,n])=>sum+model.coefficients[k][j]*n,0));
  const max=Math.max(...logits),exp=logits.map(x=>Math.exp(x-max)),total=exp.reduce((a,b)=>a+b,0),scores=exp.map(x=>x/total);
  const best=scores.indexOf(Math.max(...scores));
  return {action:model.classes[best],score:scores[best],scores,modelVersion:model.version};
}
