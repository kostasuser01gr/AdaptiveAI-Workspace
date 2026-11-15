/* AdaptiveAI Agent Studio — GenOS-inspired local control plane.
   All data is local to this browser. No AI agents, APIs or external tools run here. */
(function(){
  'use strict';
  var core=window.AdaptiveAgentCore;
  if(!core)return;
  var KEY='adaptiveai_agent_studio_v1',NS='http://www.w3.org/2000/svg';
  var state;
  try{state=core.safeState(JSON.parse(localStorage.getItem(KEY)||'null'));}
  catch(e){state=core.baseState();}
  var view='overview',selected=state.workflows[0].id,lastRun=null,studio=null,studioTab=null,content=null,navBtn=null;
  function node(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;}
  function svg(tag,attrs,txt){var e=document.createElementNS(NS,tag);Object.keys(attrs||{}).forEach(function(k){e.setAttribute(k,attrs[k]);});if(txt!==undefined)e.textContent=String(txt);return e;}
  function add(p){for(var i=1;i<arguments.length;i++){var c=arguments[i];if(c)p.appendChild(c);}return p;}
  function btn(label,style,handler){var b=node('button','as-btn'+(style?' '+style:''),label);b.type='button';if(handler)b.addEventListener('click',handler);return b;}
  function label(text,control){return add(node('label',''),node('span','',text),control);}
  function field(placeholder,max){var input=node('input','as-input');input.placeholder=placeholder||'';input.maxLength=max||90;return input;}
  function select(items,value){var s=node('select','as-select');items.forEach(function(it){var o=node('option','',it.label);o.value=it.id;s.appendChild(o);});if(value!==undefined)s.value=value;return s;}
  function chip(text,style){return node('span','as-chip'+(style?' '+style:''),text);}
  function card(cls){return node('article','as-card'+(cls?' '+cls:''));}
  function p(text){return node('p','',text);}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){notice('Browser storage unavailable. Changes remain in this session.');return false;}}
  function event(message){state.events.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,6),message:String(message),at:new Date().toISOString()});state.events=state.events.slice(0,120);save();}
  function notice(message){var f=document.getElementById('as-flash');if(f){f.textContent=message;f.hidden=false;}if(typeof window._toast==='function')window._toast(message);}
  function current(){return state.workflows.find(function(w){return w.id===selected;})||state.workflows[0];}
  function updateWorkflow(updated){state.workflows=state.workflows.map(function(w){return w.id===updated.id?updated:w;});lastRun=null;save();render();}
  function heading(title,subtitle){var b=node('div','as-toolbar');add(b,node('h2','',title),chip(subtitle||'Local configuration'));return b;}
  function makeKpi(value,name,detail){var c=node('div','as-kpi');add(c,node('small','',name),node('strong','',value),node('span','',detail));return c;}
  function open(){
    var stage=document.getElementById('stage'),tabs=document.getElementById('tabs');
    if(!stage||!tabs)return;
    if(!studio){
      studio=node('section','gx-surface as-studio');studio.id='adaptive-agent-studio';studio.setAttribute('aria-label','Agent Studio');studio.setAttribute('tabindex','-1');
      var wrap=node('div','as-wrap'),head=node('div','as-head'),intro=node('div','');
      add(intro,node('div','as-eyebrow','ADAPTIVEAI / INTELLIGENCE LAYER'),node('h1','','Agent Studio'),p('Agent configuration, dependency-aware workflow design and approval-first previews. Built into your existing command center.'));
      var actions=node('div','as-actions');
      add(actions,chip('BROWSER-LOCAL','amber'),btn('Export configuration','',exportConfig),btn('New workflow','primary',function(){view='workflows';render();var n=document.getElementById('as-new-workflow');if(n)n.focus();}));
      add(head,intro,actions);
      var flash=node('div','as-banner');flash.id='as-flash';flash.hidden=true;flash.setAttribute('role','status');
      var tabsNav=node('div','as-subtabs');tabsNav.id='as-view-tabs';tabsNav.setAttribute('role','tablist');tabsNav.setAttribute('aria-label','Agent Studio sections');
      content=node('div','');content.id='as-view-content';
      add(wrap,head,flash,tabsNav,content);studio.appendChild(wrap);stage.appendChild(studio);
      studioTab=node('button','gx-tab active');studioTab.type='button';studioTab.dataset.target=studio.id;
      add(studioTab,node('span','tt','✦ Agent Studio'));studioTab.addEventListener('click',open);tabs.appendChild(studioTab);
    }
    document.querySelectorAll('.bigpanel-bg.open').forEach(function(bg){bg.classList.remove('open');});
    document.querySelectorAll('.nav-item.active').forEach(function(b){b.classList.remove('active');});
    if(navBtn)navBtn.classList.add('active');
    stage.querySelectorAll('.gx-surface').forEach(function(s){s.style.display=s===studio?'':'none';});
    tabs.querySelectorAll('.gx-tab').forEach(function(t){t.classList.toggle('active',t===studioTab);});
    var empty=document.getElementById('empty');if(empty)empty.style.display='none';
    render();studio.focus({preventScroll:true});
  }
  function render(){
    if(!studio)return;
    var navbar=document.getElementById('as-view-tabs');navbar.replaceChildren();
    [['overview','Overview'],['workflows','Workflow Graph'],['memory','Memory Vault'],['tools','Tool Registry'],['cloud','Cloud Sync'],['audit','Audit Trail']].forEach(function(item){
      var b=node('button','as-subtab',item[1]);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(view===item[0]));
      b.addEventListener('click',function(){view=item[0];render();});navbar.appendChild(b);
    });
    content.replaceChildren();
    if(view==='overview')renderOverview();
    else if(view==='workflows')renderWorkflows();
    else if(view==='memory')renderMemory();
    else if(view==='tools')renderTools();
    else if(view==='cloud') { if(window.AdaptiveCloudConsole) window.AdaptiveCloudConsole.render(content); else content.textContent='Cloud module unavailable'; }
    else renderAudit();
  }
  function renderOverview(){
    var kpis=node('div','as-kpis');
    var gates=state.workflows.reduce(function(n,w){return n+w.nodes.filter(function(x){return x.approval;}).length;},0);
    add(kpis,makeKpi(state.agents.length,'Configured agents','No live runtime connected'),
      makeKpi(state.workflows.length,'Workflow graphs','Validated locally'),
      makeKpi(gates,'Approval checkpoints','Explicit human decisions'),
      makeKpi(state.tools.filter(function(t){return t.connected;}).length,'Live tool connections','None connected yet'));
    content.appendChild(kpis);
    var info=node('div','as-banner','ⓘ  This is a functional local planning studio, not a remote agent runner. Workflow steps are simulated and no customer data, notifications or external tools are accessed.');
    content.appendChild(info);
    content.appendChild(node('div','as-section-title','Configured agent roles'));
    var grid=node('div','as-grid');
    state.agents.forEach(function(a){
      var c=card(),row=node('div','as-cardtop'),icon=node('div','as-avatar',a.icon),text=node('div','');
      add(text,node('h3','',a.name),p(a.role));add(row,icon,text);c.appendChild(row);
      c.appendChild(p('Use this agent role to plan tasks and route workflow steps. Execution requires a connected, permissioned runtime.'));
      var foot=node('div','as-cardfoot');
      add(foot,chip('CONFIGURED · OFFLINE'),btn('Create workflow','',function(){
        var w=core.newWorkflow(a.name+' plan',a.id);state.workflows.push(w);selected=w.id;
        event('Created workflow for '+a.name);view='workflows';render();
      }));
      add(c,foot);grid.appendChild(c);
    });
    content.appendChild(grid);
    content.appendChild(node('div','as-section-title','Operations design principles'));
    var banner=card('featured');
    add(banner,node('h3','','Built to respect your existing workspace'),p('The existing generative surfaces, dashboards, role selector and command palette remain unchanged. This module is isolated, reversible and explicitly distinguishes simulated steps from authenticated service integrations.'));
    content.appendChild(banner);
  }
  function graph(workflow){
    var board=node('div','as-flow-board');
    var checked=core.validateWorkflow(workflow);
    if(!checked.ok){board.appendChild(node('div','as-error',checked.errors.join('; ')));return board;}
    if(!workflow.nodes.length){board.appendChild(node('div','as-empty','Add a step to start your workflow graph.'));return board;}
    var byId=new Map(workflow.nodes.map(function(n){return [n.id,n];})),memo={};
    function depth(id){if(memo[id]!==undefined)return memo[id];var n=byId.get(id);memo[id]=n.dependsOn.length?1+Math.max.apply(null,n.dependsOn.map(depth)):0;return memo[id];}
    var levels={};checked.order.forEach(function(id){var d=depth(id);(levels[d]||(levels[d]=[])).push(id);});
    var count=Object.keys(levels).length,width=Math.max(720,count*210+55);
    var height=Math.max(220,Math.max.apply(null,Object.keys(levels).map(function(k){return levels[k].length;}))*98+80),positions={};
    Object.keys(levels).forEach(function(key){var arr=levels[key],start=(height-arr.length*98)/2;arr.forEach(function(id,i){positions[id]={x:25+Number(key)*210,y:start+i*98};});});
    var surface=svg('svg',{viewBox:'0 0 '+width+' '+height,width:width,height:height,role:'img','aria-label':'Workflow dependency graph'});
    workflow.nodes.forEach(function(n){n.dependsOn.forEach(function(parent){
      var from=positions[parent],to=positions[n.id];
      if(!from||!to)return;
      surface.appendChild(svg('path',{d:'M'+(from.x+164)+' '+(from.y+32)+' C'+(from.x+188)+' '+(from.y+32)+' '+(to.x-24)+' '+(to.y+32)+' '+to.x+' '+(to.y+32),stroke:'#c77c45','stroke-width':'1.8',fill:'none','stroke-dasharray':'5 4',opacity:'.8'}));
    });});
    checked.order.forEach(function(id){
      var n=byId.get(id),pos=positions[id],g=svg('g',{}),rect=svg('rect',{x:pos.x,y:pos.y,width:164,height:64,rx:11,fill:'#1e2026',stroke:n.approval?'#ad7e31':'#4f515a','stroke-width':'1'});
      var name=n.name.length>22?n.name.slice(0,20)+'…':n.name;
      add(g,rect,svg('text',{x:pos.x+12,y:pos.y+25,fill:'#f4f1ed','font-size':'11','font-weight':'650'},name),
        svg('text',{x:pos.x+12,y:pos.y+45,fill:n.approval?'#eab86e':'#a6a8ad','font-size':'10'},n.approval?'APPROVAL GATE':(n.agentId||'agent').toUpperCase()),
        svg('title',{},n.name));
      surface.appendChild(g);
    });
    board.appendChild(surface);return board;
  }
  function renderWorkflows(){
    var w=current(),toolbar=node('div','as-toolbar');
    var left=node('div','');add(left,node('h2','','Workflow orchestration'),p('Directed acyclic graphs, validation and manual approvals.'));
    var choices=select(state.workflows.map(function(x){return {id:x.id,label:x.name};}),selected);
    choices.style.maxWidth='290px';
    choices.setAttribute('aria-label','Choose workflow');
    choices.addEventListener('change',function(){selected=choices.value;lastRun=null;render();});
    add(toolbar,left,choices);content.appendChild(toolbar);
    var grid=node('div','as-two'),main=card(),side=card();
    add(main,heading(w.name,'DAG · '+w.nodes.length+' steps'),graph(w));
    var stepTitle=node('div','as-section-title','Workflow steps');main.appendChild(stepTitle);
    var validation=core.validateWorkflow(w);
    main.appendChild(chip(validation.ok?'VALID DAG':'INVALID DEPENDENCIES',validation.ok?'green':'warning'));
    if(!w.nodes.length)main.appendChild(node('div','as-empty','No steps. Add one using the editor.'));
    validation.order.forEach(function(stepId,i){
      var step=w.nodes.find(function(n){return n.id===stepId;}),box=node('div','as-flow-node');
      var row=node('div','as-flow-header'),meta=node('div','');
      add(meta,node('span','as-flow-step','STEP '+String(i+1).padStart(2,'0')+' · '+step.agentId),
        node('h4','',step.name),chip(step.approval?'Needs approval':'Auto-preview',step.approval?'warning':''));
      var actions=node('div','as-flow-actions');
      add(actions,btn('Remove','quiet',function(){updateWorkflow(core.removeStep(w,step.id));event('Removed step '+step.name);}));
      add(row,meta,actions);box.appendChild(row);
      var deps=node('div','as-flow-deps');
      if(!step.dependsOn.length)deps.appendChild(node('span','','Entry step'));
      step.dependsOn.forEach(function(d){var parent=w.nodes.find(function(n){return n.id===d;});deps.appendChild(node('span','','After: '+(parent?parent.name:d)));});
      box.appendChild(deps);main.appendChild(box);
    });
    var runBlock=card('featured');runBlock.style.marginTop='15px';
    add(runBlock,heading('Execution preview','NO REMOTE ACTIONS'));
    runBlock.appendChild(p('A deterministic dry run checks dependencies and pauses at each approval gate. Tools and real agents are never invoked.'));
    var controls=node('div','as-run-actions');
    controls.appendChild(btn('▶ Run local preview','primary',function(){try{lastRun=core.startPreview(w);event('Started dry run: '+w.name);render();}catch(e){notice(e.message);}}));
    if(lastRun&&lastRun.workflowId===w.id&&lastRun.waitingOn){
      controls.appendChild(btn('Approve gate','',function(){lastRun=core.advancePreview(w,lastRun,'approve');event('Approved dry-run gate: '+w.name);render();}));
      controls.appendChild(btn('Reject gate','danger',function(){lastRun=core.advancePreview(w,lastRun,'reject');event('Rejected dry-run gate: '+w.name);render();}));
    }
    runBlock.appendChild(controls);
    if(lastRun&&lastRun.workflowId===w.id){
      var summary=node('div','as-section-title','Preview status');
      add(summary,chip(lastRun.status.toUpperCase(),lastRun.status==='completed'?'green':'warning'));
      runBlock.appendChild(summary);
      var lines=node('div','as-run-list');
      validation.order.forEach(function(id){var s=w.nodes.find(function(n){return n.id===id;}),r=node('div','as-run-row');
        add(r,node('span','',s.name),chip((lastRun.steps[id]||'queued').replaceAll('_',' '),lastRun.steps[id]==='previewed'?'green':''));lines.appendChild(r);
      });
      runBlock.appendChild(lines);
      if(lastRun.messages.length)runBlock.appendChild(p(lastRun.messages[lastRun.messages.length-1]));
    }
    main.appendChild(runBlock);
    add(side,heading('Add a workflow','Local only'));
    var newName=field('Workflow name',90);newName.id='as-new-workflow';
    var createForm=node('div','as-form');
    add(createForm,label('New workflow',newName),btn('Create workflow','primary',function(){
      try{var newW=core.newWorkflow(newName.value);if(state.workflows.length>=30)throw Error('Maximum 30 workflows');state.workflows.push(newW);selected=newW.id;event('Created workflow '+newW.name);render();}
      catch(e){notice(e.message);}
    }));
    side.appendChild(createForm);
    side.appendChild(node('div','as-section-title','Add dependency-aware step'));
    var form=node('div','as-form'),stepName=field('e.g. Review maintenance exceptions',90);
    var agent=select(state.agents.map(function(a){return {id:a.id,label:a.name};}));
    var dependency=select([{id:'',label:'No dependency'}].concat(w.nodes.map(function(n){return {id:n.id,label:n.name};})));
    var approval=node('input');approval.type='checkbox';
    add(form,label('Step name',stepName),label('Assigned agent',agent),label('Wait for step',dependency),add(node('label','as-checkbox'),approval,node('span','','Require human approval')),
      btn('Add step','primary',function(){try{var next=core.addStep(w,{name:stepName.value,agentId:agent.value,dependsOn:dependency.value,approval:approval.checked});updateWorkflow(next);event('Added workflow step '+stepName.value.trim());}catch(e){notice(e.message);}}));
    side.appendChild(form);
    side.appendChild(node('div','as-section-title','Connect existing steps'));
    var connectForm=node('div','as-form'),target=select(w.nodes.map(function(n){return {id:n.id,label:n.name};})),source=select(w.nodes.map(function(n){return {id:n.id,label:n.name};}));
    add(connectForm,label('Target step',target),label('Depends on',source),btn('Create connection','',function(){
      try{if(target.value===source.value)throw Error('A step cannot depend on itself');updateWorkflow(core.linkSteps(w,target.value,source.value));event('Linked workflow dependencies');}
      catch(e){notice(e.message);}
    }),p('Circular links are automatically rejected and do not change the graph.'));
    side.appendChild(connectForm);
    add(grid,main,side);content.appendChild(grid);
  }
  function renderMemory(){
    content.appendChild(heading('Memory Vault','Browser-local notes'));
    content.appendChild(node('div','as-banner','ⓘ  Notes remain in localStorage on this device. They are not AI model memory, encrypted storage or synced to a backend. Do not enter passwords or sensitive customer data.'));
    var layout=node('div','as-two'),list=card(),editor=card();
    var search=field('Search saved notes…',100);search.setAttribute('aria-label','Search notes');list.appendChild(search);
    var entries=node('div','as-memory-grid');entries.style.marginTop='14px';
    function paintEntries(term){
      entries.replaceChildren();
      var filtered=state.memory.filter(function(m){return (m.key+' '+m.value+' '+m.scope).toLowerCase().includes(term.toLowerCase());});
      if(!filtered.length){entries.appendChild(node('div','as-empty','No notes match your search.'));return;}
      filtered.forEach(function(m){
        var box=card(),top=node('div','as-cardtop');add(top,node('span','as-memory-key',m.key),chip(m.scope));
        box.appendChild(top);box.appendChild(node('div','as-memory-value',m.value));
        add(box,btn('Delete','danger',function(){state.memory=state.memory.filter(function(x){return x.id!==m.id;});event('Deleted note '+m.key);paintEntries(search.value);}));
        entries.appendChild(box);
      });
    }
    search.addEventListener('input',function(){paintEntries(search.value);});paintEntries('');
    list.appendChild(entries);
    editor.appendChild(heading('Add or update a note','Max 100'));
    var form=node('div','as-form'),key=field('e.g. station_preferences',80);
    var scope=select([{id:'workspace',label:'Workspace'}].concat(state.agents.map(function(a){return {id:a.id,label:a.name};})));
    var value=node('textarea','as-textarea');value.maxLength=2000;value.placeholder='Plain-text note, no credentials or personal data';
    add(form,label('Memory key',key),label('Scope',scope),label('Note',value),btn('Save note','primary',function(){
      var k=key.value.trim(),v=value.value.trim();if(!k||!v)return notice('Enter a key and value.');
      var existing=state.memory.find(function(m){return m.key===k&&m.scope===scope.value;});
      if(!existing&&state.memory.length>=100)return notice('Memory limit reached (100).');
      if(existing)existing.value=v;
      else state.memory.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,6),key:k,value:v,scope:scope.value});
      event('Saved local note '+k);render();
    }));
    editor.appendChild(form);add(layout,list,editor);content.appendChild(layout);
  }
  function renderTools(){
    content.appendChild(heading('Tool Registry','Permission intent'));
    content.appendChild(node('div','as-banner','ⓘ  Enabling a tool stores a preference for a future connector. No API credentials are configured and no requests are sent to external services.'));
    var c=card();
    state.tools.forEach(function(tool){
      var row=node('div','as-tool-row'),details=node('div',''),r=node('div','as-actions'),toggle=node('input');
      toggle.type='checkbox';toggle.checked=!!tool.enabled;toggle.setAttribute('aria-label','Enable '+tool.name+' in configuration');
      toggle.addEventListener('change',function(){tool.enabled=toggle.checked;event((toggle.checked?'Enabled':'Disabled')+' tool preference '+tool.name);render();});
      add(details,node('h3','',tool.name),p(tool.description));
      add(r,chip('NOT CONNECTED','warning'),toggle);
      add(row,details,r);c.appendChild(row);
    });
    content.appendChild(c);
    var info=card('featured');info.style.marginTop='15px';
    add(info,node('h3','','Connection contract'),p('Production connectors must use server-side OAuth or scoped credentials, minimum-privilege permissions, explicit approvals for mutations, audit records and actual health checks. A switch here is not a live connection.'));
    content.appendChild(info);
  }
  function renderAudit(){
    var header=node('div','as-toolbar');
    add(header,node('h2','','Local audit trail'),btn('Clear local log','danger',function(){
      if(!window.confirm('Clear only Agent Studio local audit entries?'))return;
      state.events=[];save();render();notice('Agent Studio log cleared.');
    }));
    content.appendChild(header);
    content.appendChild(node('div','as-banner','ⓘ  This is a local configuration history, not an immutable or server-verified enterprise audit log.'));
    var log=node('div','as-log');
    if(!state.events.length)log.appendChild(node('div','as-empty','No configuration changes yet. Workflow and memory edits will appear here.'));
    state.events.forEach(function(item){
      var entry=node('div','as-event'),text=node('div','');
      add(text,node('strong','',item.message),node('time','',new Date(item.at).toLocaleString()));
      add(entry,node('div','as-event-dot'),text);log.appendChild(entry);
    });
    content.appendChild(log);
  }
  function exportConfig(){
    try{
      var data=JSON.stringify({type:'adaptiveai-agent-studio',exportedAt:new Date().toISOString(),state:state},null,2);
      var blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='adaptiveai-agent-studio.json';document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},1500);
      event('Exported local Agent Studio configuration');
    }catch(e){notice('Export failed: '+e.message);}
  }
  function mount(){
    var nav=document.querySelector('#navAutomations');if(!nav||document.getElementById('navStudio'))return;
    navBtn=node('button','nav-item');navBtn.id='navStudio';navBtn.type='button';
    add(navBtn,node('span','as-nav-icon','✦'),node('span','','Agent Studio'),chip('NEW','amber'));
    nav.insertAdjacentElement('afterend',navBtn);
    navBtn.addEventListener('click',function(e){e.stopPropagation();open();});
    document.addEventListener('keydown',function(e){
      if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='g'){e.preventDefault();open();}
    });
    window.AdaptiveAgentStudio={
      open:open,version:'2.0.0',mode:'local-preview',
      exportState:function(){return JSON.parse(JSON.stringify(state));},
      replaceState:function(candidate){
        var next=core.safeState(candidate);
        if(!next.workflows.length)throw Error('No valid cloud workflows');
        state=next;selected=state.workflows[0].id;lastRun=null;save();render();
      }
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
