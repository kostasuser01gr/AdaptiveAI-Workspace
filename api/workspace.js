'use strict';
const B=require('./_lib/backend');
const core=require('../modules/agent-core.js');
/**
 * Authenticated, RLS-scoped cloud persistence. No service-role privileges on data requests.
 * One workspace per user; the client never supplies the owner_id.
 */
module.exports=async function handler(req,res){
  if(!B.guardPost(req,res,95000))return;
  const user=await B.requireUser(req,res);
  if(!user)return;
  const body=req.body&&typeof req.body==='object'?req.body:{};
  if(!['load','save'].includes(body.action))return B.json(res,400,{error:'Unknown workspace operation'});
  const path='/rest/v1/adaptive_workspaces';
  try{
    if(body.action==='load'){
      const query=path+'?select=state,updated_at&owner_id=eq.'+encodeURIComponent(user.id)+'&slug=eq.default&limit=1';
      const response=await B.supabase(query,{token:user.token});
      if(!response.ok)return B.json(res,503,{error:'Workspace database unavailable'});
      const row=Array.isArray(response.data)?response.data[0]:null;
      return B.json(res,200,{found:Boolean(row),state:row?core.safeState(row.state):null,updatedAt:row?.updated_at||null});
    }
    if(!body.state||typeof body.state!=='object'||Array.isArray(body.state))
      return B.json(res,400,{error:'Invalid workspace data'});
    const clean=core.safeState(body.state);
    if(clean.workflows.length>30||clean.memory.length>100)return B.json(res,400,{error:'Workspace limits exceeded'});
    const response=await B.supabase(path+'?on_conflict=owner_id,slug',{
      token:user.token,method:'POST',
      body:{owner_id:user.id,slug:'default',state:clean},
      prefer:'resolution=merge-duplicates,return=representation'
    });
    if(!response.ok)return B.json(res,503,{error:'Unable to save workspace; verify database schema and permissions'});
    const row=Array.isArray(response.data)?response.data[0]:null;
    return B.json(res,200,{saved:true,updatedAt:row?.updated_at||new Date().toISOString()});
  }catch(e){
    console.error('[adaptiveai:workspace]',e?.message||'Unavailable');
    return B.json(res,503,{error:'Workspace service unavailable'});
  }
};
