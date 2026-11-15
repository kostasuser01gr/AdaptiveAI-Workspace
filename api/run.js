'use strict';
/**
 * Server-side deterministic workflow runner with RLS persistence + approval checkpoints.
 * No external connectors or model requests. The execution boundary is intentionally read-only.
 */
const {randomUUID}=require('node:crypto');
const B=require('../server/backend');
const core=require('../modules/agent-core.js');
function identifier(s){return typeof s==='string'&&/^[a-zA-Z0-9_-]{1,90}$/.test(s);}
function uuid(s){return typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);}
function trimRun(row){
  return {id:row.id,workflowId:row.workflow_id,status:row.status,
    requestKey:row.request_key||null,createdAt:row.created_at||null,
    snapshot:row.detail?.snapshot||null,mode:'server-side-preview'};
}
module.exports=async function handler(req,res){
  if(!B.guardPost(req,res,4000))return;
  const user=await B.requireUser(req,res);
  if(!user)return;
  const input=req.body&&typeof req.body==='object'?req.body:{};
  const action=input.action;
  if(!['start','approve','reject','list'].includes(action))return B.json(res,400,{error:'Unsupported run action'});
  const listPath='/rest/v1/adaptive_agent_runs?select=id,request_key,workflow_id,status,detail,created_at&owner_id=eq.'+encodeURIComponent(user.id);
  try{
    if(action==='list'){
      const r=await B.supabase(listPath+'&order=created_at.desc&limit=20',{token:user.token});
      return r.ok?B.json(res,200,{runs:(Array.isArray(r.data)?r.data:[]).map(trimRun)}):
        B.json(res,503,{error:'Cloud run storage unavailable'});
    }
    if(action==='start'){
      if(!identifier(input.workflowId))return B.json(res,400,{error:'Invalid workflow identifier'});
      const requestKey=uuid(input.requestKey)?input.requestKey:randomUUID();
      const existing=await B.supabase(listPath+'&request_key=eq.'+requestKey+'&limit=1',{token:user.token});
      if(existing.ok&&Array.isArray(existing.data)&&existing.data[0])return B.json(res,200,{run:trimRun(existing.data[0]),reused:true});
      const stored=await B.supabase('/rest/v1/adaptive_workspaces?select=state&owner_id=eq.'+
        encodeURIComponent(user.id)+'&slug=eq.default&limit=1',{token:user.token});
      if(!stored.ok)return B.json(res,503,{error:'Cloud workspace unavailable'});
      const row=Array.isArray(stored.data)?stored.data[0]:null;
      if(!row)return B.json(res,409,{error:'Save the workspace to cloud before running it'});
      const state=core.safeState(row.state);
      const workflow=state.workflows.find(w=>w.id===input.workflowId);
      if(!workflow)return B.json(res,404,{error:'Workflow not present in authenticated workspace'});
      const graph=core.validateWorkflow(workflow);
      if(!graph.ok||!graph.order.length)return B.json(res,422,{error:'Invalid dependency graph'});
      const snapshot=core.startPreview(workflow);
      const detail={mode:'server-side-preview',snapshot,workflow};
      const insert=await B.supabase('/rest/v1/adaptive_agent_runs',{
        token:user.token,method:'POST',prefer:'return=representation',
        body:{owner_id:user.id,request_key:requestKey,workflow_id:workflow.id,status:snapshot.status,detail}
      });
      if(!insert.ok)return B.json(res,503,{error:'Unable to persist run'});
      const result=Array.isArray(insert.data)?insert.data[0]:null;
      if(!result)return B.json(res,503,{error:'Run persistence returned no record'});
      return B.json(res,200,{run:trimRun(result),reused:false});
    }
    if(!uuid(input.runId))return B.json(res,400,{error:'Invalid run identifier'});
    const prior=await B.supabase(listPath+'&id=eq.'+encodeURIComponent(input.runId)+'&limit=1',{token:user.token});
    if(!prior.ok)return B.json(res,503,{error:'Run storage unavailable'});
    const row=Array.isArray(prior.data)?prior.data[0]:null;
    if(!row)return B.json(res,404,{error:'Run not found'});
    if(row.status!=='awaiting_approval')return B.json(res,409,{error:'Run is not awaiting approval',run:trimRun(row)});
    const workflow=row.detail?.workflow,snapshot=row.detail?.snapshot;
    if(!workflow||!snapshot||!core.validateWorkflow(workflow).ok)
      return B.json(res,422,{error:'Persisted run is invalid'});
    const next=core.advancePreview(workflow,snapshot,action);
    const patch=await B.supabase('/rest/v1/adaptive_agent_runs?owner_id=eq.'+
      encodeURIComponent(user.id)+'&id=eq.'+encodeURIComponent(input.runId)+'&status=eq.awaiting_approval',{
      method:'PATCH',token:user.token,prefer:'return=representation',
      body:{status:next.status,detail:{mode:'server-side-preview',snapshot:next,workflow}}
    });
    if(!patch.ok)return B.json(res,503,{error:'Failed to update run'});
    const updated=Array.isArray(patch.data)?patch.data[0]:null;
    if(!updated)return B.json(res,409,{error:'Run changed concurrently; reload status'});
    return B.json(res,200,{run:trimRun(updated)});
  }catch(error){
    console.error('[adaptiveai:run]',error?.message||'Unavailable');
    return B.json(res,503,{error:'Run service unavailable'});
  }
};
