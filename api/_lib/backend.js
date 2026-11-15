'use strict';
/** Shared security boundary for AdaptiveAI Vercel API routes. */
function config() {
  const url=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||'');
  return {
    url: /^https:\/\/[a-zA-Z0-9.-]+(?::443)?$/.test(url)?url:'',
    key: key.length>15?key:'',
    service: String(process.env.SUPABASE_SERVICE_ROLE_KEY||''),
    ai: Boolean(process.env.ANTHROPIC_API_KEY)
  };
}
function json(res,status,data) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(data);
}
function cookieMap(req) {
  const out=Object.create(null);
  String(req.headers.cookie||'').split(';').forEach(function(item){
    const split=item.indexOf('=');
    if(split<0)return;
    const name=item.slice(0,split).trim();
    if(!/^[a-z_]{2,40}$/.test(name))return;
    try{out[name]=decodeURIComponent(item.slice(split+1).trim());}catch(e){}
  });
  return out;
}
function isSameOrigin(req) {
  const origin=req.headers.origin;
  if(typeof origin!=='string')return false;
  let expected;
  try{
    const u=new URL(origin),host=String(req.headers.host||'');
    const proxyProto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim();
    const scheme=host.startsWith('localhost:')||host==='localhost'?'http':(proxyProto==='https'?'https':'https');
    expected=new URL(scheme+'://'+host);
    return u.origin===expected.origin;
  }catch(e){return false;}
}
function guardPost(req,res,maxBytes) {
  if(req.method!=='POST') {json(res,405,{error:'Method not allowed'});return false;}
  if(!isSameOrigin(req)) {json(res,403,{error:'Origin verification failed'});return false;}
  const length=Number(req.headers['content-length']||'0');
  if(!Number.isFinite(length)||length>(maxBytes||12000)||length<0) {json(res,413,{error:'Request too large'});return false;}
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) {json(res,415,{error:'Expected JSON'});return false;}
  return true;
}
function accessToken(req){return cookieMap(req).ad_access||'';}
async function supabase(path,{method='GET',body,token,admin=false}={}){
  const cfg=config();
  if(!cfg.url||!cfg.key)throw Error('Cloud authentication is not configured');
  if(admin&&!cfg.service)throw Error('Server quota key is not configured');
  if(!/^\//.test(path)||path.includes('://'))throw Error('Invalid service path');
  const key=admin?cfg.service:cfg.key;
  const headers={apikey:key,Authorization:'Bearer '+(admin?key:(token||key)),Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  const result=await fetch(cfg.url+path,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(9000),redirect:'error'
  });
  let data=null;
  const text=await result.text();
  try{data=text?JSON.parse(text):null;}catch(e){data={error:'Invalid provider response'};}
  return {ok:result.ok,status:result.status,data:data};
}
async function verifiedUser(req){
  const token=accessToken(req);
  if(!token||token.length>8192)return null;
  try{
    const response=await supabase('/auth/v1/user',{token});
    const u=response.data;
    if(response.ok&&u&&typeof u.id==='string'&&/^[0-9a-f-]{36}$/i.test(u.id))
      return {id:u.id,email:typeof u.email==='string'?u.email:'',token};
  }catch(e){}
  return null;
}
function requireUser(req,res){
  return verifiedUser(req).then(user=>{if(!user)json(res,401,{error:'Authentication required'});return user;});
}
function issueCookies(res,result,req){
  const access=result.access_token,refresh=result.refresh_token;
  if(typeof access!=='string'||typeof refresh!=='string'||!access||!refresh)throw Error('Missing identity tokens');
  const host=String(req.headers.host||'');
  const secure=!host.startsWith('localhost');
  const flags='; HttpOnly; SameSite=Strict'+(secure?'; Secure':'');
  const lifetime=Math.max(60,Math.min(Number(result.expires_in)||3600,3600));
  res.setHeader('Set-Cookie',[
    'ad_access='+encodeURIComponent(access)+'; Path=/api; Max-Age='+lifetime+flags,
    'ad_refresh='+encodeURIComponent(refresh)+'; Path=/api/auth; Max-Age=2592000'+flags
  ]);
}
function clearCookies(res,req) {
  const secure=!String(req.headers.host||'').startsWith('localhost');
  const flags='; HttpOnly; SameSite=Strict'+(secure?'; Secure':'');
  res.setHeader('Set-Cookie',[
    'ad_access=; Path=/api; Max-Age=0'+flags,
    'ad_refresh=; Path=/api/auth; Max-Age=0'+flags
  ]);
}
module.exports={config,json,cookieMap,isSameOrigin,guardPost,accessToken,supabase,verifiedUser,requireUser,issueCookies,clearCookies};
