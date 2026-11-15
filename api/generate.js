'use strict';
/**
 * Secure, authenticated generative-UI endpoint.
 * Fails CLOSED to built-in demo templates if credentials, quotas or schema are missing.
 * Never emits untrusted HTML, CSS or executable JavaScript.
 */
const Anthropic=require('@anthropic-ai/sdk');
const B=require('./_lib/backend');
const C=require('./_lib/surface-contract');
const SYSTEM=[
  'You are the AdaptiveAI Workspace declarative surface planner.',
  'You have NO access to private fleet systems or real-time operational metrics.',
  'Never invent numerical operational results, vehicle counts, performance or revenue.',
  'If source data is unavailable, create an INSIGHT explaining which verified data source is needed.',
  'Do not pretend any external tool was called or that data is live.',
  'Return ONLY a JSON object with: title, tag, key, subtitle, widgets.',
  'widgets is an array (1 to 8) of supported types:',
  '1. insight: {type:"insight",title,body,status:"neutral"}',
  '2. metrics: {type:"metrics",title,items:[{label,value,detail,status}]}',
  '3. table: {type:"table",title,columns:[string],rows:[[string]]}',
  '4. bars: {type:"bars",title,items:[{label,value:0..100,display}]}',
  'Use metrics and bars ONLY if the user supplied actual numeric data in the query.',
  'Never include HTML, Markdown fences, URLs, scripts, CSS, or unsupported widget keys.',
  'Limit output to 8 widgets, 24 rows and 1200 characters per insight.'
].join('\n');
module.exports=async function handler(req,res){
  if(!B.guardPost(req,res,8000))return;
  const input=C.validateQuery(req.body);
  if(!input.ok)return B.json(res,400,{error:input.error});
  const cfg=B.config();
  if(!cfg.ai||!cfg.url||!cfg.key||!cfg.service){
    return B.json(res,200,{fallback:true,reason:'ai_not_configured'});
  }
  const user=await B.verifiedUser(req);
  if(!user)return B.json(res,200,{fallback:true,reason:'auth_required'});
  try{
    const claim=await B.supabase('/rest/v1/rpc/adaptive_claim_ai_quota',{
      method:'POST',admin:true,
      body:{p_owner:user.id,p_daily_cap:15,p_cooldown_seconds:12}
    });
    if(!claim.ok)return B.json(res,200,{fallback:true,reason:'quota_unavailable'});
    if(claim.data!==true)return B.json(res,200,{fallback:true,reason:'rate_limited'});
    const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:17000,maxRetries:0});
    const model=process.env.ANTHROPIC_MODEL||'claude-sonnet-4-6';
    const response=await client.messages.create({
      model,max_tokens:1600,temperature:0.2,
      system:SYSTEM+'\nUser role (display preference only): '+input.role,
      messages:[{role:'user',content:input.query}]
    });
    const modelText=(response.content||[]).filter(c=>c&&c.type==='text').map(c=>c.text||'').join('\n');
    return B.json(res,200,C.parseModelJSON(modelText));
  }catch(e){
    console.error('[adaptiveai:generate]',e?.name||'Provider error');
    return B.json(res,200,{fallback:true,reason:'generation_unavailable'});
  }
};
