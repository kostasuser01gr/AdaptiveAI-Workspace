'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/run');
const core=require('../modules/agent-core.js');

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const runId='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
function request(body,extra={}){
  return {method:'POST',body,headers:{host:'adaptiveai.example',origin:'https://adaptiveai.example',
    'content-type':'application/json','content-length':'600',cookie:'ad_access=MOCK_IDENTITY',...extra}};
}
function response(){
  return {code:200,payload:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},
    json(data){this.payload=data;return this;}};
}
function reply(data,status=200){return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)};}
function setCloud(){
  const env={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
  process.env.SUPABASE_URL='https://unit-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_TEST_KEY_LONG_2026';
  return ()=>Object.entries(env).forEach(([k,v])=>v===undefined?delete process.env[k]:process.env[k]=v);
}
test('only authenticated identity can start server preview',async()=>{
  const clear=setCloud(),original=global.fetch;global.fetch=async()=>{throw Error('should not call without a cookie');};
  try{const r=response();await handler(request({action:'start',workflowId:'fleet-readiness'},{cookie:''}),r);
    assert.equal(r.code,401);
  }finally{global.fetch=original;clear();}
});
test('server derives owner and graph from stored workspace, not caller-supplied fields',async()=>{
  const clear=setCloud(),original=global.fetch;const state=core.baseState();let inserted;
  global.fetch=async(url,options)=>{
    if(url.endsWith('/auth/v1/user'))return reply({id:owner,email:'owner@example.com'});
    if(url.includes('adaptive_agent_runs?'))return reply([]);
    if(url.includes('/adaptive_workspaces?'))return reply([{state}]);
    if(url.endsWith('/adaptive_agent_runs')&&options.method==='POST'){
      inserted=JSON.parse(options.body);
      return reply([{id:runId,owner_id:inserted.owner_id,request_key:inserted.request_key,
        workflow_id:inserted.workflow_id,status:inserted.status,detail:inserted.detail,created_at:new Date().toISOString()}]);
    }
    throw Error('Unexpected endpoint: '+url);
  };
  try{
    const r=response();
    await handler(request({action:'start',workflowId:'fleet-readiness',owner_id:other,workflow:{nodes:[]},requestKey:key}),r);
    assert.equal(r.code,200);
    assert.equal(inserted.owner_id,owner);
    assert.equal(inserted.status,'awaiting_approval');
    assert.equal(inserted.detail.workflow.nodes.length,3);
    assert.equal(inserted.request_key,key);
    assert.equal(r.payload.run.status,'awaiting_approval');
    assert.equal(r.payload.run.mode,'server-side-preview');
  }finally{global.fetch=original;clear();}
});
test('approval requires compare-and-swap expected status to prevent duplicated transitions',async()=>{
  const clear=setCloud(),original=global.fetch,workflow=core.baseState().workflows[0],run=core.startPreview(workflow);
  let patchUrl='';
  global.fetch=async(url,options)=>{
    if(url.endsWith('/auth/v1/user'))return reply({id:owner});
    if(url.includes('/adaptive_agent_runs?')&&options.method==='GET')
      return reply([{id:runId,workflow_id:workflow.id,status:'awaiting_approval',request_key:key,detail:{workflow,snapshot:run}}]);
    if(url.includes('/adaptive_agent_runs?')&&options.method==='PATCH'){
      patchUrl=url;
      const payload=JSON.parse(options.body);
      return reply([{id:runId,workflow_id:workflow.id,status:payload.status,request_key:key,detail:payload.detail}]);
    }
    throw Error('Unexpected endpoint: '+url);
  };
  try{
    const r=response();await handler(request({action:'approve',runId}),r);
    assert.equal(r.code,200);
    assert.equal(r.payload.run.status,'completed');
    assert.match(patchUrl,/status=eq\.awaiting_approval/);
    assert.match(patchUrl,/owner_id=eq\.11111111/);
  }finally{global.fetch=original;clear();}
});
test('concurrent approval conflict is surfaced instead of silently overwriting',async()=>{
  const clear=setCloud(),original=global.fetch,workflow=core.baseState().workflows[0],run=core.startPreview(workflow);
  global.fetch=async(url,options)=>{
    if(url.endsWith('/auth/v1/user'))return reply({id:owner});
    if(options.method==='GET')return reply([{id:runId,workflow_id:workflow.id,status:'awaiting_approval',detail:{workflow,snapshot:run}}]);
    if(options.method==='PATCH')return reply([]);
    throw Error('Unexpected request');
  };
  try{
    const r=response();await handler(request({action:'approve',runId}),r);
    assert.equal(r.code,409);assert.match(r.payload.error,/concurrently/);
  }finally{global.fetch=original;clear();}
});
