'use strict';
const B=require('../server/backend');
module.exports=function handler(req,res){
  if(req.method!=='GET')return B.json(res,405,{error:'Method not allowed'});
  const cfg=B.config();
  const auth=Boolean(cfg.url&&cfg.key);
  return B.json(res,200,{
    product:'AdaptiveAI Workspace',
    version:'3.0',
    authConfigured:auth,
    cloudSyncAvailable:auth,
    aiGenerationAvailable:Boolean(auth&&cfg.ai&&cfg.service),
    mode:auth?'cloud-configured':'local-demo',
    safeguards:{untrustedHtml:false,serverQuotas:true,localPreview:true}
  });
};
