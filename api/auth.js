'use strict';
const B=require('./_lib/backend');
function validEmail(value){return typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function validPassword(value){return typeof value==='string'&&value.length>=10&&value.length<=128;}
module.exports=async function handler(req,res){
  if(req.method==='GET'){
    const cfg=B.config();
    if(!cfg.url||!cfg.key)return B.json(res,200,{configured:false,authenticated:false});
    const user=await B.verifiedUser(req);
    return B.json(res,200,{configured:true,authenticated:Boolean(user),user:user?{id:user.id,email:user.email}:null});
  }
  if(!B.guardPost(req,res,2048))return;
  const cfg=B.config();
  if(!cfg.url||!cfg.key)return B.json(res,503,{error:'Cloud authentication unavailable: no dedicated Supabase configured'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const action=body.action;
  if(!['sign_in','sign_up','refresh','sign_out'].includes(action))return B.json(res,400,{error:'Unknown auth action'});
  try{
    if(action==='sign_out'){
      const token=B.accessToken(req);
      if(token)await B.supabase('/auth/v1/logout',{method:'POST',token,body:{}});
      B.clearCookies(res,req);
      return B.json(res,200,{authenticated:false});
    }
    if(action==='refresh'){
      const refresh=B.cookieMap(req).ad_refresh;
      if(!refresh)return B.json(res,401,{error:'Session expired'});
      const answer=await B.supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}});
      if(!answer.ok||!answer.data||!answer.data.access_token){B.clearCookies(res,req);return B.json(res,401,{error:'Session expired'});}
      B.issueCookies(res,answer.data,req);
      return B.json(res,200,{authenticated:true});
    }
    const email=body.email,password=body.password;
    if(!validEmail(email)||!validPassword(password))return B.json(res,400,{error:'Valid email and password (10–128 characters) required'});
    const response=await B.supabase(action==='sign_in'?'/auth/v1/token?grant_type=password':'/auth/v1/signup',{
      method:'POST',body:{email,password}
    });
    if(!response.ok)return B.json(res,action==='sign_in'?401:400,{
      error:action==='sign_in'?'Invalid credentials or unconfirmed account':'Signup not completed; check account settings'
    });
    if(!response.data?.access_token||!response.data?.refresh_token)
      return B.json(res,200,{authenticated:false,pendingConfirmation:true,message:'Verify your email, then sign in'});
    B.issueCookies(res,response.data,req);
    return B.json(res,200,{authenticated:true,pendingConfirmation:false});
  }catch(error){
    console.error('[adaptiveai:auth]',error?.message||'Provider unavailable');
    return B.json(res,503,{error:'Identity provider temporarily unavailable'});
  }
};
