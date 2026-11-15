'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('../server/surface-contract');
const backend=require('../server/backend');
const generate=require('../api/generate');
const auth=require('../api/auth');
const workspace=require('../api/workspace');
const capabilities=require('../api/capabilities');

function req(method='POST', body={}, headers={}){
  return {method,body,headers:{
    host:'adaptiveai.example',origin:'https://adaptiveai.example',
    'content-type':'application/json','content-length':'120',...headers
  }};
}
function res(){
  const headers={};
  return {
    headers,code:200,payload:null,
    setHeader(key,value){headers[key.toLowerCase()]=value;},
    status(code){this.code=code;return this;},
    json(payload){this.payload=payload;return this;}
  };
}
test('untrusted markup and extra keys never become executable surface fields',()=>{
  const surface=contract.normalizeSurface({
    title:'<img src=x onerror=alert(1)>',source:'live',html:'<script>unsafe()</script>',
    widgets:[{type:'insight',title:'Test',body:'<script>alert(1)</script>',html:'<img>'},
      {type:'unknown',html:'bad'}]
  });
  assert.equal(surface.source,'ai_draft');
  assert.equal(surface.verified,false);
  assert.equal(Object.hasOwn(surface,'html'),false);
  assert.equal(Object.hasOwn(surface.widgets[0],'html'),false);
  assert.equal(surface.widgets.length,1);
  assert.equal(surface.widgets[0].body,'<script>alert(1)</script>');
});
test('contract caps response size, chart values, columns and dataset length',()=>{
  const metric=Array.from({length:99},(_,i)=>({label:'Label '+i,value:12}));
  const widgets=[{type:'metrics',items:metric},{type:'bars',items:[{label:'bad',value:Infinity},{label:'valid',value:35}]}];
  const s=contract.normalizeSurface({title:'Title',widgets});
  assert.equal(s.widgets[0].items.length,8);
  assert.equal(s.widgets[1].items.length,1);
  assert.equal(s.widgets[1].items[0].value,35);
  assert.throws(()=>contract.parseModelJSON('{"title":"Hello"}'),/supported/);
  assert.equal(contract.validateQuery({query:'a'.repeat(601)}).ok,false);
  assert.equal(contract.validateQuery({query:'hello',role:'impersonated'}).role,'owner');
});
test('origin, JSON, method and body size gates reject unsafe requests',()=>{
  const r1=res(),r2=res(),r3=res(),r4=res();
  assert.equal(backend.guardPost(req('POST',{}, {origin:'https://attacker.example'}),r1),false);
  assert.equal(r1.code,403);
  assert.equal(backend.guardPost(req('POST',{}, {'content-type':'text/plain'}),r2),false);
  assert.equal(r2.code,415);
  assert.equal(backend.guardPost(req('GET'),r3),false);
  assert.equal(r3.code,405);
  assert.equal(backend.guardPost(req('POST',{}, {'content-length':'999999'}),r4,500),false);
  assert.equal(r4.code,413);
  assert.equal(backend.guardPost(req(),res()),true);
});
test('no billable AI when auth backend and quotas are not configured',async()=>{
  const prev={ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY,SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};
  delete process.env.ANTHROPIC_API_KEY; delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try{
    const output=res();
    await generate(req('POST',{query:'Fleet report'}),output);
    assert.equal(output.code,200);
    assert.equal(output.payload.fallback,true);
    assert.equal(output.payload.reason,'ai_not_configured');
    assert.equal(output.headers['access-control-allow-origin'],undefined);
    const cap=res();capabilities(req('GET'),cap);
    assert.equal(cap.payload.aiGenerationAvailable,false);
    assert.equal(cap.payload.mode,'local-demo');
  }finally{
    for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
test('email/password session cookies are HttpOnly and not reflected to JSON',async()=>{
  const prev={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
  const fetchOriginal=global.fetch;
  process.env.SUPABASE_URL='https://unit-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_UNIT_TEST_ONLY_LONG_KEY';
  global.fetch=async(url,init)=>{
    assert.match(url,/\/auth\/v1\/token/);
    assert.match(init.headers.Authorization,/^Bearer sb_publishable_/);
    return {ok:true,status:200,async text(){return JSON.stringify({access_token:'TEST_ACCESS',refresh_token:'TEST_REFRESH',expires_in:1800});}};
  };
  try{
    const output=res();
    await auth(req('POST',{action:'sign_in',email:'test@example.com',password:'long-enough-password'}),output);
    assert.equal(output.code,200);
    assert.equal(output.payload.authenticated,true);
    assert.equal(output.payload.access_token,undefined);
    assert.equal(output.headers['set-cookie'].length,2);
    assert.match(output.headers['set-cookie'][0],/HttpOnly; SameSite=Strict; Secure/);
    assert.match(output.headers['set-cookie'][1],/Path=\/api\/auth/);
  }finally{
    global.fetch=fetchOriginal;
    for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
test('cloud workspace returns 401 without a verified session',async()=>{
  const prev={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
  process.env.SUPABASE_URL='https://unit-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_UNIT_TEST_ONLY_LONG_KEY';
  try{
    const output=res();
    await workspace(req('POST',{action:'load'}),output);
    assert.equal(output.code,401);
    assert.equal(output.payload.error,'Authentication required');
  }finally{for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('RLS cloud sync always derives owner_id from verified identity',async()=>{
  const prev={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
  const originalFetch=global.fetch,owner='11111111-1111-4111-8111-111111111111';let inserted;
  process.env.SUPABASE_URL='https://unit-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_UNIT_TEST_ONLY_LONG_KEY';
  global.fetch=async(url,options)=>{
    if(url.endsWith('/auth/v1/user'))return {ok:true,status:200,text:async()=>JSON.stringify({id:owner,email:'owner@example.com'})};
    assert.match(url,/\/rest\/v1\/adaptive_workspaces\?on_conflict/);
    inserted=JSON.parse(options.body);
    return {ok:true,status:200,text:async()=>JSON.stringify([{updated_at:'2026-11-15T13:00:00Z'}])};
  };
  try{
    const state=require('../modules/agent-core').baseState();
    const output=res();
    await workspace(req('POST',{action:'save',state,owner_id:'22222222-2222-4222-8222-222222222222'},{cookie:'ad_access=FAKE_VALID_TOKEN'}),output);
    assert.equal(output.code,200);
    assert.equal(inserted.owner_id,owner);
    assert.equal(inserted.slug,'default');
    assert.equal(output.payload.saved,true);
  }finally{
    global.fetch=originalFetch;
    for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
