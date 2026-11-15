/* AdaptiveAI Agent Core: deterministic local planning and preview, never remote execution. */
(function(root,factory) {
  'use strict';
  var core=factory();
  if (typeof module==='object' && module.exports) module.exports=core;
  if (root) root.AdaptiveAgentCore=core;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var MAX_STEPS=24;
  function id(prefix){return (prefix||'id')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function baseState(){
    return {version:1,
      agents:[
        {id:'dashboard',name:'Dashboard Architect',role:'Generative interfaces',icon:'◈'},
        {id:'fleet',name:'Fleet Analyst',role:'Vehicle operations',icon:'◉'},
        {id:'quality',name:'Quality Guardian',role:'Review and assurance',icon:'◇'},
        {id:'reporting',name:'Report Composer',role:'Planning and exports',icon:'▤'}
      ],
      tools:[
        {id:'surface',name:'Surface Composer',description:'Draft UI surfaces and visual briefs',enabled:true,connected:false},
        {id:'fleet-api',name:'Fleet Connector',description:'Real reservation and vehicle records',enabled:false,connected:false},
        {id:'mail',name:'Messaging Gateway',description:'Send emails and notifications with approval',enabled:false,connected:false},
        {id:'reports',name:'Report Export',description:'Generate structured reporting outputs',enabled:true,connected:false}
      ],
      workflows:[{id:'fleet-readiness',name:'Fleet readiness review',
        nodes:[
          {id:'collect',name:'Review availability',agentId:'fleet',dependsOn:[],approval:false,toolId:'fleet-api'},
          {id:'check',name:'Review exceptions',agentId:'quality',dependsOn:['collect'],approval:true,toolId:null},
          {id:'brief',name:'Prepare briefing',agentId:'reporting',dependsOn:['check'],approval:false,toolId:'reports'}
        ]
      }],
      memory:[],events:[],lastRun:null};
  }
  function validateWorkflow(workflow){
    var errors=[],ordered=[];
    if(!workflow||!Array.isArray(workflow.nodes))return {ok:false,errors:['Missing workflow nodes'],order:[]};
    if(workflow.nodes.length>MAX_STEPS)errors.push('Maximum '+MAX_STEPS+' steps per workflow');
    var map=new Map();
    workflow.nodes.forEach(function(n){
      if(!n||typeof n.id!=='string'||!n.id){errors.push('Step has no identifier');return;}
      if(map.has(n.id))errors.push('Duplicate step: '+n.id);
      map.set(n.id,n);
    });
    var visiting=new Set(),visited=new Set();
    function visit(stepId){
      if(visiting.has(stepId)){errors.push('Dependency cycle detected');return;}
      if(visited.has(stepId))return;
      var node=map.get(stepId);
      if(!node){errors.push('Unknown dependency: '+stepId);return;}
      visiting.add(stepId);
      var deps=Array.isArray(node.dependsOn)?node.dependsOn:[];
      if(!Array.isArray(node.dependsOn))errors.push('Invalid dependencies: '+stepId);
      deps.forEach(visit);
      visiting.delete(stepId);visited.add(stepId);ordered.push(stepId);
    }
    map.forEach(function(_,key){visit(key);});
    return {ok:errors.length===0,errors:Array.from(new Set(errors)),order:errors.length?[]:ordered};
  }
  function addStep(workflow,values){
    if(!workflow||!Array.isArray(workflow.nodes))throw Error('Workflow unavailable');
    if(workflow.nodes.length>=MAX_STEPS)throw Error('Workflow step limit reached');
    var name=String(values.name||'').trim().slice(0,90);
    if(!name)throw Error('Step name required');
    var out=copy(workflow);
    out.nodes.push({id:id('step'),name:name,agentId:String(values.agentId||'dashboard'),dependsOn:values.dependsOn?[String(values.dependsOn)]:[],approval:!!values.approval,toolId:values.toolId||null});
    var checked=validateWorkflow(out);if(!checked.ok)throw Error(checked.errors.join('; '));
    return out;
  }
  function linkSteps(workflow,nodeId,dependencyId){
    var out=copy(workflow),node=out.nodes.find(function(n){return n.id===nodeId;});
    if(!node||!out.nodes.some(function(n){return n.id===dependencyId;}))throw Error('Unknown workflow step');
    if(!node.dependsOn.includes(dependencyId))node.dependsOn.push(dependencyId);
    var checked=validateWorkflow(out);if(!checked.ok)throw Error(checked.errors.join('; '));
    return out;
  }
  function removeStep(workflow,nodeId){
    var out=copy(workflow);
    out.nodes=out.nodes.filter(function(n){return n.id!==nodeId;});
    out.nodes.forEach(function(n){n.dependsOn=n.dependsOn.filter(function(d){return d!==nodeId;});});
    return out;
  }
  function newWorkflow(name,agentId){
    var value=String(name||'').trim().slice(0,90);if(!value)throw Error('Workflow name required');
    return {id:id('wf'),name:value,nodes:[{id:id('step'),name:'Define outcome',agentId:agentId||'dashboard',dependsOn:[],approval:false,toolId:null}]};
  }
  function startPreview(workflow){
    var checked=validateWorkflow(workflow);
    if(!checked.ok||!checked.order.length)throw Error(checked.errors.join('; ')||'Add at least one step');
    var run={workflowId:workflow.id,id:id('run'),startedAt:new Date().toISOString(),status:'preview',waitingOn:null,steps:{},messages:[]};
    checked.order.forEach(function(k){run.steps[k]='queued';});
    return advancePreview(workflow,run,'advance');
  }
  function advancePreview(workflow,inputRun,decision){
    var checked=validateWorkflow(workflow);if(!checked.ok)throw Error(checked.errors.join('; '));
    var run=copy(inputRun);if(run.workflowId!==workflow.id)throw Error('Run belongs to another workflow');
    if(run.status==='completed'||run.status==='rejected')return run;
    if(run.waitingOn){
      var pending=run.waitingOn;
      if(decision==='approve'){run.steps[pending]='previewed';run.messages.push('Approved local gate: '+pending);run.waitingOn=null;}
      else if(decision==='reject'){run.steps[pending]='rejected';run.status='rejected';run.waitingOn=null;run.messages.push('Rejected local gate: '+pending);return run;}
      else return run;
    }
    var byId=new Map(workflow.nodes.map(function(n){return [n.id,n];}));
    for(var i=0;i<checked.order.length;i++){
      var key=checked.order[i],node=byId.get(key);
      if(run.steps[key]!=='queued')continue;
      if(!node.dependsOn.every(function(dep){return run.steps[dep]==='previewed';}))continue;
      if(node.approval){run.steps[key]='awaiting_approval';run.waitingOn=key;run.status='awaiting_approval';run.messages.push('Local approval needed: '+node.name);return run;}
      run.steps[key]='previewed';run.messages.push('Simulated only: '+node.name);
    }
    run.status=checked.order.every(function(k){return run.steps[k]==='previewed';})?'completed':'blocked';
    if(run.status==='completed')run.messages.push('Preview complete; no external actions executed');
    return run;
  }
  function safeState(candidate){
    var defaults=baseState(),state=copy(defaults);
    if(!candidate||candidate.version!==1||!Array.isArray(candidate.workflows))return state;
    state.workflows=candidate.workflows.filter(function(w){return w&&typeof w.name==='string'&&validateWorkflow(w).ok;}).slice(0,30);
    if(!state.workflows.length)state.workflows=defaults.workflows;
    state.memory=Array.isArray(candidate.memory)?candidate.memory.filter(function(m){return m&&typeof m.key==='string'&&typeof m.value==='string'&&m.value.length<=2000;}).slice(-100):[];
    state.events=Array.isArray(candidate.events)?candidate.events.filter(function(e){return e&&typeof e.message==='string';}).slice(-120):[];
    if(Array.isArray(candidate.tools))state.tools.forEach(function(t){var s=candidate.tools.find(function(x){return x&&x.id===t.id;});if(s)t.enabled=!!s.enabled;});
    return state;
  }
  return {baseState:baseState,safeState:safeState,validateWorkflow:validateWorkflow,addStep:addStep,
    linkSteps:linkSteps,removeStep:removeStep,newWorkflow:newWorkflow,startPreview:startPreview,advancePreview:advancePreview};
});
