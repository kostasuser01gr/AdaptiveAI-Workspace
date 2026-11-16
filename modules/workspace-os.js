/* AdaptiveAI Workspace OS v5 — integrated personal command deck.
 * UI content is DOM-only; no user/model supplied HTML is evaluated.
 */
(function(){
  'use strict';
  var C=window.AdaptiveWorkspaceCore;if(!C)return;
  var KEY='adaptiveai_workspace_os_v5',state,mode='canvas',root=null,stageTab=null,nav=null,rail=null,main=null,metrics=null,content=null,cmdInput=null,toast=null;
  var undo=[],redo=[],filter='',dragging=null,cloudStatus='Checking cloud configuration';
  try{state=C.validate(JSON.parse(localStorage.getItem(KEY)||'null'));}
  catch(e){state=C.initial();}
  function E(tag,cls,txt){
    var n=document.createElement(tag);
    if(cls)n.className=cls;
    if(txt!==undefined)n.textContent=String(txt);
    return n;
  }
  function A(p){
    for(var i=1;i<arguments.length;i++)if(arguments[i])p.appendChild(arguments[i]);
    return p;
  }
  function B(label,fn,style){
    var button=E('button','aw5-btn'+(style?' '+style:''),label);
    button.type='button';if(fn)button.addEventListener('click',fn);
    return button;
  }
  function field(placeholder,value,max){
    var n=E('input','aw5-input');n.type='text';n.placeholder=placeholder||'';n.value=value||'';n.maxLength=max||90;return n;
  }
  function area(value){var n=E('textarea','aw5-textarea');n.value=value||'';n.maxLength=2000;return n;}
  function label(txt,input){return A(E('label',''),E('span','',txt),input);}
  function select(options,value){
    var n=E('select','aw5-select');
    options.forEach(function(o){var item=E('option','',o.label);item.value=o.id;n.appendChild(item);});
    if(value!==undefined)n.value=value;return n;
  }
  function panel(){return E('section','aw5-panel');}
  function tag(text,variant){return E('span','aw5-tag'+(variant?' '+variant:''),text);}
  function notice(text,error){
    if(!toast)return;
    toast.textContent=text;toast.className='aw5-callout'+(error?' aw5-error':'');toast.hidden=false;
  }
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));return true;}
    catch(e){notice('Browser storage unavailable; recent edits may not survive reload.',true);return false;}
  }
  function act(input){
    try{
      var previous=state;
      state=C.transact(state,input);
      if(input.type!=='selectBoard'){
        undo.push(previous);if(undo.length>35)undo.shift();redo=[];
      }
      save();render();
      return true;
    }catch(e){notice(e.message,true);return false;}
  }
  function reset(stateCandidate){
    var previous=state;
    try{state=C.validate(stateCandidate);undo.push(previous);redo=[];save();filter='';mode='canvas';render();return true;}
    catch(e){notice(e.message,true);return false;}
  }
  function undoAction(){
    if(!undo.length)return;
    redo.push(state);state=undo.pop();save();render();notice('Undid previous workspace edit.');
  }
  function redoAction(){
    if(!redo.length)return;
    undo.push(state);state=redo.pop();save();render();notice('Reapplied workspace edit.');
  }
  function current(){return state.boards.find(function(b){return b.id===state.activeBoard;})||state.boards[0];}
  function download(){
    try{
      var data=C.exportJSON(state),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),link=E('a');
      link.href=url;link.download='adaptiveai-workspace-v5.json';document.body.appendChild(link);link.click();link.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},1600);
      notice('Workspace exported. No data was uploaded.');
    }catch(e){notice('Export failed: '+e.message,true);}
  }
  function modal(title,summary,build,submit,labelText){
    var originalFocus=document.activeElement;
    var backdrop=E('div','aw5-modal-backdrop'),dialog=E('section','aw5-modal');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
    A(dialog,E('h3','',title),E('p','',summary||''));var form=E('form','aw5-form'),message=E('div','aw5-error');message.hidden=true;
    build(form);
    var buttons=E('div','aw5-modal-actions');
    var cancel=B('Cancel',closeModal),saveButton=E('button','aw5-btn primary',labelText||'Save');
    saveButton.type='submit';A(buttons,cancel,saveButton);A(dialog,form,message);form.appendChild(buttons);backdrop.appendChild(dialog);
    function closeModal(){document.removeEventListener('keydown',keys);backdrop.remove();if(originalFocus&&originalFocus.isConnected)originalFocus.focus();}
    function keys(e){
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key==='Tab'){
        var controls=Array.from(dialog.querySelectorAll('input,button,select,textarea')).filter(function(x){return !x.disabled;});
        if(!controls.length)return;
        if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus();}
        else if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus();}
      }
    }
    document.addEventListener('keydown',keys);
    backdrop.addEventListener('click',function(e){if(e.target===backdrop)closeModal();});
    form.addEventListener('submit',function(e){
      e.preventDefault();try{
        if(submit(form)!==false)closeModal();
        else {message.hidden=false;message.textContent='Please check your input.';}
      }catch(error){message.hidden=false;message.textContent=error.message;}
    });
    document.body.appendChild(backdrop);
    var first=form.querySelector('input,textarea,select,button');if(first)first.focus();
  }
  function addBoardDialog(){
    var nameInput=field('e.g. Operations Sprint','',90);
    modal('Create workspace board','A private board for tasks, knowledge cards and shortcuts.',function(form){form.appendChild(label('Board name',nameInput));},
      function(){if(!nameInput.value.trim())throw Error('Board name required.');return act({type:'addBoard',title:nameInput.value});},'Create board');
  }
  function renameBoardDialog(){
    var board=current(),nameInput=field('Board name',board.title);
    modal('Rename board','Keep labels short and descriptive.',function(form){form.appendChild(label('Board name',nameInput));},
      function(){return act({type:'renameBoard',id:board.id,title:nameInput.value});},'Rename');
  }
  function addCardDialog(kind){
    var titleInput=field('Card title','',90),bodyInput=area(''),type=kind||'task';
    var target=select([{id:'agents',label:'Agent Studio'},{id:'data',label:'Data Intelligence'},{id:'cloud',label:'Cloud Workspace'},{id:'chat',label:'Generative Canvas'}],'agents');
    modal('Create '+(type==='task'?'task':type==='note'?'note':'shortcut'),'Cards are stored in this browser and never trigger remote actions.',function(form){
      form.appendChild(label('Title',titleInput));
      form.appendChild(label('Description / notes',bodyInput));
      if(type==='shortcut')form.appendChild(label('Destination',target));
    },function(){return act({type:'addCard',card:{kind:type,title:titleInput.value,body:bodyInput.value,target:type==='shortcut'?target.value:undefined}});},'Add card');
  }
  function editCardDialog(card){
    var titleInput=field('Title',card.title),bodyInput=area(card.body);
    modal('Edit '+card.kind,'Changes apply only to this personal workspace.',function(form){
      A(form,label('Title',titleInput),label('Details',bodyInput));
    },function(){return act({type:'updateCard',id:card.id,title:titleInput.value,body:bodyInput.value});},'Save changes');
  }
  function moveCardDialog(card){
    var board=current(),other=state.boards.filter(function(b){return b.id!==board.id;});
    if(!other.length)return notice('Create another board before moving a card.',true);
    var destination=select(other.map(function(b){return{id:b.id,label:b.title};}),other[0].id);
    modal('Move to another board','Card content and completion status are preserved.',function(form){
      form.appendChild(label('Destination board',destination));
    },function(){return act({type:'transferCard',fromBoardId:board.id,toBoardId:destination.value,id:card.id});},'Move card');
  }
  function importDialog(){
    var control=E('input','aw5-input');control.type='file';control.accept='.json,application/json';
    modal('Restore workspace','Import overwrites local boards; you can undo this change during this session. Only AdaptiveAI v5 exports are accepted.',function(form){
      form.appendChild(label('JSON export',control));
    },function(){
      var file=control.files&&control.files[0];
      if(!file)throw Error('Choose a JSON file');
      if(file.size>C.LIMITS.importBytes)throw Error('File is too large');
      file.text().then(function(text){try{
        var next=C.importJSON(text);reset(next);notice('Workspace restored from validated JSON.');
      }catch(e){notice(e.message,true);}}).catch(function(e){notice(e.message,true);});
      return true;
    },'Import workspace');
  }
  function openTarget(target){
    try{
      if(target==='agents'){
        if(!window.AdaptiveAgentStudio)throw Error('Agent Studio module not loaded');
        return window.AdaptiveAgentStudio.open();
      }
      if(target==='data'){
        if(!window.AdaptiveDataStudio)throw Error('Data Intelligence module not loaded');
        return window.AdaptiveDataStudio.open();
      }
      if(target==='cloud'){
        if(!window.AdaptiveAgentStudio)throw Error('Cloud Console is not available');
        window.AdaptiveAgentStudio.open();
        var tabs=document.querySelectorAll('#as-view-tabs .as-subtab');
        var cloud=Array.from(tabs).find(function(t){return t.textContent.includes('Cloud Sync');});
        if(cloud)cloud.click();
        return;
      }
      if(target==='chat'){
        var siblings=Array.from(document.querySelectorAll('#tabs .gx-tab')).filter(function(t){return t!==stageTab&&t.dataset.target!==root.id;});
        if(siblings.length)siblings[siblings.length-1].click();
        else{
          root.style.display='none';stageTab.classList.remove('active');
          var placeholder=document.getElementById('empty');if(placeholder)placeholder.style.display='';
        }
        var prompt=document.getElementById('prompt');if(prompt)prompt.focus();
        return;
      }
      throw Error('Unsupported destination');
    }catch(e){notice(e.message,true);}
  }
  function executeCommand(){
    var value=cmdInput.value;
    try{
      var command=C.parseCommand(value);
      if(command.type==='unknown')return notice('Try /agents, /data, /cloud, /chat, /task NAME, /note NAME, /board NAME or /export. No AI model is called.',true);
      if(command.type==='navigate')openTarget(command.target);
      else if(command.type==='export')download();
      else act(command);
      cmdInput.value='';
    }catch(e){notice(e.message,true);}
  }
  function updateCloud(){
    if(typeof fetch!=='function'){cloudStatus='Capability check unavailable';refreshStatus();return;}
    fetch('/api/capabilities',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(6500)})
      .then(function(r){if(!r.ok)throw Error('Unavailable');return r.json();})
      .then(function(cap){
        cloudStatus=cap.authConfigured?'Cloud configured · sign-in required':'Cloud not configured · local mode';
        refreshStatus();
      }).catch(function(){cloudStatus='Cloud status unavailable · local mode';refreshStatus();});
  }
  function refreshStatus(){
    var status=document.getElementById('aw5-cloud-status');if(status)status.textContent=cloudStatus;
  }
  function kpi(value,title,sub){
    return A(E('div','aw5-kpi'),E('small','',title),E('strong','',value),E('span','',sub));
  }
  function drawRail(){
    rail.replaceChildren();
    var boardPanel=panel(),header=E('div','aw5-panel-title'),list=E('div','aw5-board-list');
    A(header,E('span','','Your workspaces'),B('+',addBoardDialog,'square'));
    boardPanel.appendChild(header);
    state.boards.forEach(function(b,index){
      var item=E('button','aw5-board-item');item.type='button';item.setAttribute('aria-current',String(b.id===state.activeBoard));
      A(item,E('span','',index===0?'◈':index===1?'▦':'◇'),E('span','',b.title),E('small','',b.cards.length));
      item.addEventListener('click',function(){filter='';act({type:'selectBoard',id:b.id});});
      list.appendChild(item);
    });
    boardPanel.appendChild(list);
    var tools=panel(),h=E('div','aw5-panel-title','Linked modules'),actions=E('div','aw5-board-list');
    [['agents','✦','Agent Studio'],['data','◉','Data Intelligence'],['cloud','☁','Cloud Sync'],['chat','⌘','Generative Canvas']].forEach(function(item){
      var b=E('button','aw5-board-item');b.type='button';
      A(b,E('span','',item[1]),E('span','',item[2]));
      b.addEventListener('click',function(){openTarget(item[0]);});actions.appendChild(b);
    });
    A(tools,h,actions);
    var tip=E('div','aw5-rail-tip');
    A(tip,E('strong','','Operator mode · verified boundaries'),E('span','','Boards, notes and tasks live in this browser. External connectors and agent execution require separate, authorized cloud services.'));
    A(rail,boardPanel,tools,tip);
  }
  function drawMetrics(){
    metrics.replaceChildren();
    var s=C.stats(state),open=s.tasks-s.completed;
    var agents=0,datasets=0;
    try{agents=window.AdaptiveAgentStudio?.exportState?.()?.agents?.length||0;}catch(e){}
    try{datasets=window.AdaptiveDataStudio?.list?.()?.length||0;}catch(e){}
    A(metrics,kpi(s.boards,'Boards','Browser-local workspaces'),
      kpi(open,'Open tasks',s.completed+' completed locally'),
      kpi(datasets,'Local datasets','Imported by Data Studio'),
      kpi(agents,'Configured agents','Roles · not executing'));
  }
  function topContent(){return A(E('div','aw5-headline'),E('div',''),E('div','aw5-inline'));}
  function drawCanvas(){
    var board=current(),head=topContent(),info=head.firstChild,actions=head.lastChild;
    A(info,E('h3','',board.title),E('p','',board.description));
    A(actions,B('Rename',renameBoardDialog,'small'),B('Add task',function(){addCardDialog('task');},'small primary'),
      B('Add note',function(){addCardDialog('note');},'small'));
    content.appendChild(head);
    var commands=E('div','aw5-inline');commands.style.marginBottom='15px';
    var search=E('input','aw5-search');search.type='search';search.placeholder='Search cards in this board';search.value=filter;search.setAttribute('aria-label','Search cards');
    commands.appendChild(search);
    commands.appendChild(B('+ Shortcut',function(){addCardDialog('shortcut');},'small'));
    commands.appendChild(tag('Drag to reorder · arrows on touch'));
    content.appendChild(commands);
    var cards=E('div','aw5-card-grid');content.appendChild(cards);
    function paint(){
      cards.replaceChildren();var q=filter.trim().toLocaleLowerCase();
      var indexed=board.cards.map(function(c,index){return{card:c,index:index};}).filter(function(x){return !q||(x.card.title+' '+x.card.body).toLocaleLowerCase().includes(q);});
      if(!indexed.length){
        var empty=E('div','aw5-empty');
        A(empty,E('strong','',q?'No matching cards':'This board is ready to build'),E('span','',q?'Try a different search.':'Add a task, a note, or a shortcut to make this board useful.'));
        cards.appendChild(empty);return;
      }
      indexed.forEach(function(item){
        var card=item.card,index=item.index,box=E('article','aw5-card'+(card.kind==='task'&&card.done?' aw5-completed':''));
        box.draggable=true;box.dataset.cardId=card.id;
        box.addEventListener('dragstart',function(e){dragging=card.id;box.classList.add('aw5-dragging');if(e.dataTransfer)e.dataTransfer.setData('text/plain',card.id);});
        box.addEventListener('dragend',function(){dragging=null;box.classList.remove('aw5-dragging');});
        box.addEventListener('dragover',function(e){if(dragging&&dragging!==card.id){e.preventDefault();box.classList.add('aw5-drop-target');}});
        box.addEventListener('dragleave',function(){box.classList.remove('aw5-drop-target');});
        box.addEventListener('drop',function(e){e.preventDefault();box.classList.remove('aw5-drop-target');if(dragging&&dragging!==card.id)act({type:'moveCard',id:dragging,to:index});dragging=null;});
        var top=E('div','aw5-cardtop');
        var icon=E('div','aw5-card-icon'+(card.kind==='shortcut'?' cool':''),card.kind==='shortcut'?'↗':card.kind==='task'?'✓':'▤');
        var copy=E('div','aw5-card-copy');
        A(copy,E('h4','',card.title),E('p','',card.body||(
          card.kind==='task'?'Track this work item locally.':
          card.kind==='note'?'Personal note · browser-local':
          'Open this workspace module.'
        )));
        A(top,icon,copy);box.appendChild(top);
        var foot=E('div','aw5-cardfoot'),controls=E('div','aw5-card-actions');
        if(card.kind==='shortcut'){
          foot.appendChild(tag('IN-APP LINK'));
          controls.appendChild(B('Open ↗',function(){openTarget(card.target);},'small primary'));
        }else if(card.kind==='task'){
          var check=E('input','aw5-taskcheck');check.type='checkbox';check.checked=card.done;check.setAttribute('aria-label','Mark '+card.title+' complete');
          check.addEventListener('change',function(){act({type:'toggleTask',id:card.id});});
          A(foot,check,tag(card.done?'COMPLETED':'TO DO',card.done?'local':''));
        }else foot.appendChild(tag('PRIVATE NOTE'));
        var up=B('↑',function(){act({type:'moveCard',id:card.id,to:index-1});},'small square');
        var down=B('↓',function(){act({type:'moveCard',id:card.id,to:index+1});},'small square');
        up.disabled=index===0;down.disabled=index>=board.cards.length-1;
        up.setAttribute('aria-label','Move '+card.title+' up');down.setAttribute('aria-label','Move '+card.title+' down');
        A(controls,up,down,B('Edit',function(){editCardDialog(card);},'small'),B('Move',function(){moveCardDialog(card);},'small'),
          B('×',function(){if(window.confirm('Delete '+card.title+'?'))act({type:'deleteCard',id:card.id});},'small danger'));
        foot.appendChild(controls);box.appendChild(foot);cards.appendChild(box);
      });
    }
    search.addEventListener('input',function(){filter=search.value;paint();});
    paint();
  }
  function drawActivity(){
    var head=topContent(),info=head.firstChild;
    A(info,E('h3','','Local activity'),E('p','','Changes made to your Workspace OS boards. This is not a server-verified audit log.'));
    content.appendChild(head);
    var items=state.events.slice().reverse();
    if(!items.length)return content.appendChild(E('div','aw5-empty','No local edits yet. Add a task or note to begin a local history.'));
    var list=E('div','aw5-list');
    items.forEach(function(ev){
      var row=E('div','aw5-event'),time=E('time','aw5-time',new Date(ev.at).toLocaleString());
      A(row,E('span','aw5-dot'),E('span','aw5-event-message',ev.message),time);list.appendChild(row);
    });content.appendChild(list);
  }
  function drawSettings(){
    var head=topContent();A(head.firstChild,E('h3','','Workspace preferences'),E('p','','Private layout, portability, data boundaries and recovery controls.'));
    content.appendChild(head);
    var section=panel();section.classList.add('aw5-narrow');
    var density=E('div','aw5-setting'),labels=E('div');
    A(labels,E('strong','','Card density'),E('small','','Choose generous or compact spacing.'));
    var choices=select([{id:'comfortable',label:'Comfortable'},{id:'compact',label:'Compact'}],state.preferences.density);
    choices.style.maxWidth='160px';
    choices.addEventListener('change',function(){act({type:'setDensity',value:choices.value});});
    A(density,labels,choices);section.appendChild(density);
    var portable=E('div','aw5-setting'),text=E('div'),actions=E('div','aw5-inline');
    A(text,E('strong','','Portable workspace'),E('small','','JSON export / import with schema validation.'));
    A(actions,B('Export',download,'small'),B('Import',importDialog,'small'));
    A(portable,text,actions);section.appendChild(portable);
    var recovery=E('div','aw5-setting'),warning=E('div');
    A(warning,E('strong','','Reset personal boards'),E('small','','Deletes the local v5 board layout, notes and task state.'));
    A(recovery,warning,B('Reset',function(){
      if(window.confirm('Reset all Workspace OS boards, notes and tasks? This does not affect Agent Studio or imported datasets.'))reset(C.initial());
    },'small danger'));section.appendChild(recovery);
    content.appendChild(section);
    content.appendChild(E('div','aw5-callout','Storage: browser localStorage only. No encryption or cross-device sync is included. Never store customer information or credentials in a shared device. Cloud integrations remain separately authenticated and optional.'));
  }
  function drawModules(){
    var head=topContent();
    A(head.firstChild,E('h3','','System capabilities'),E('p','','Actual module availability and feature boundaries, not fabricated connection telemetry.'));
    content.appendChild(head);
    var grid=E('div','aw5-card-grid');
    var modules=[
      {name:'Agent Studio',desc:'Workflow graph, human approvals and local memory. Workflows are previews until a permitted runtime is connected.',target:'agents',status:window.AdaptiveAgentStudio?'LOADED · LOCAL':'MODULE UNAVAILABLE'},
      {name:'Data Intelligence',desc:'User-provided CSV data, profiling, analysis and local dashboards. Not a live fleet API.',target:'data',status:window.AdaptiveDataStudio?'LOADED · LOCAL':'MODULE UNAVAILABLE'},
      {name:'Cloud Workspace',desc:cloudStatus+'. Account and database setup is required for real cloud use.',target:'cloud',status:cloudStatus},
      {name:'Generative Canvas',desc:'The original AdaptiveAI command experience. Billable AI calls require authenticated backend, provider key and server quotas.',target:'chat',status:'ORIGINAL SHELL'}
    ];
    modules.forEach(function(m){
      var box=E('div','aw5-card');box.draggable=false;
      A(box,E('div','aw5-cardtop'),E('h4','',m.name),E('p','',m.desc),E('div','aw5-cardfoot'));
      A(box.firstChild,E('div','aw5-card-icon','◈'));
      A(box.lastChild,tag(m.status),B('Open',function(){openTarget(m.target);},'small'));
      grid.appendChild(box);
    });content.appendChild(grid);
  }
  function render(){
    if(!root)return;
    root.dataset.density=state.preferences.density;
    drawRail();drawMetrics();
    var tabs=document.getElementById('aw5-sections');tabs.replaceChildren();
    [['canvas','Canvas'],['modules','Modules'],['activity','Activity'],['settings','Settings']].forEach(function(pair){
      var b=E('button','aw5-tab',pair[1]);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(mode===pair[0]));
      b.addEventListener('click',function(){mode=pair[0];render();});tabs.appendChild(b);
    });
    content.replaceChildren();
    if(mode==='canvas')drawCanvas();
    else if(mode==='modules')drawModules();
    else if(mode==='activity')drawActivity();
    else drawSettings();
    var back=document.getElementById('aw5-undo');if(back)back.disabled=!undo.length;
    var forward=document.getElementById('aw5-redo');if(forward)forward.disabled=!redo.length;
    refreshStatus();
  }
  function open(){
    var stage=document.getElementById('stage'),tabs=document.getElementById('tabs');
    if(!stage||!tabs)return;
    if(!root)createUI(stage,tabs);
    document.querySelectorAll('.bigpanel-bg.open').forEach(function(b){b.classList.remove('open');});
    document.querySelectorAll('.nav-item.active').forEach(function(b){b.classList.remove('active');});
    if(nav)nav.classList.add('active');
    stage.querySelectorAll('.gx-surface').forEach(function(s){s.style.display=s===root?'':'none';});
    tabs.querySelectorAll('.gx-tab').forEach(function(t){t.classList.toggle('active',t===stageTab);});
    var empty=document.getElementById('empty');if(empty)empty.style.display='none';
    render();root.focus({preventScroll:true});
  }
  function createUI(stage,tabs){
    root=E('section','gx-surface aw5-root');root.id='adaptive-workspace-os';root.tabIndex=-1;
    var wrap=E('div','aw5-wrap'),top=E('div','aw5-top'),brand=E('div','aw5-brand'),brandText=E('div'),toolbar=E('div','aw5-toolbar');
    A(brandText,E('h1','','AdaptiveAI Workspace'),E('small','','PERSONAL COMMAND SYSTEM · V5'));
    A(brand,E('div','aw5-mark','◈'),brandText);
    var undoBtn=B('↶ Undo',undoAction,'small'),redoBtn=B('↷ Redo',redoAction,'small');
    undoBtn.id='aw5-undo';redoBtn.id='aw5-redo';
    A(toolbar,E('span','aw5-status','BROWSER-LOCAL'),undoBtn,redoBtn,B('Export',download,'small'));
    A(top,brand,toolbar);
    var hero=E('div','aw5-hero'),intro=E('div'),actions=E('div','aw5-hero-actions');
    A(intro,E('div','aw5-eyebrow','ADAPTIVEAI / INTELLIGENCE OPERATING SYSTEM'),E('h2','','One space. Every capability.'),E('p','','Compose your workspace, orchestrate your tasks and launch intelligence modules through one coherent command surface. Privately stored, measurable and reversible.'));
    A(actions,B('+ Create board',addBoardDialog,'primary'),B('Explore modules',function(){mode='modules';render();}));
    A(hero,intro,actions);
    var shell=E('div','aw5-shell');rail=E('aside','aw5-rail');main=E('section','aw5-main');metrics=E('div','aw5-overview');
    var command=E('div','aw5-command');cmdInput=E('input','aw5-command-input');
    cmdInput.id='aw5-command';cmdInput.type='text';cmdInput.maxLength=240;
    cmdInput.setAttribute('aria-label','Workspace command');
    cmdInput.placeholder='Try /task Review maintenance, /agents, /data, /board Sprint...';
    cmdInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();executeCommand();}});
    A(command,E('div','aw5-command-logo','⌘'),cmdInput,B('Execute ↗',executeCommand,'primary'));
    command.appendChild(E('div','aw5-command-help','DETERMINISTIC · NO AI PROVIDER CALLS'));
    var subtabs=E('div','aw5-tabs');subtabs.id='aw5-sections';subtabs.setAttribute('role','tablist');
    content=E('div');
    A(main,metrics,command,subtabs,content);
    A(shell,rail,main);
    toast=E('div','aw5-callout');toast.id='aw5-toast';toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
    A(wrap,top,hero,shell,toast);root.appendChild(wrap);stage.appendChild(root);
    stageTab=E('button','gx-tab active');stageTab.type='button';stageTab.dataset.target=root.id;
    stageTab.appendChild(E('span','tt','◈ Workspace OS'));
    stageTab.addEventListener('click',open);tabs.appendChild(stageTab);
    updateCloud();
  }
  function mount(){
    if(document.getElementById('navWorkspaceOS'))return;
    var anchor=document.getElementById('navAssets')||document.getElementById('navAutomations');
    if(!anchor)return;
    nav=E('button','nav-item');nav.id='navWorkspaceOS';nav.type='button';
    A(nav,E('span','aw5-navglyph','◈'),E('span','','Workspace OS'),E('span','badge','V5'));
    anchor.insertAdjacentElement('beforebegin',nav);
    nav.addEventListener('click',function(e){e.stopPropagation();open();});
    document.addEventListener('keydown',function(e){
      var el=e.target,editable=el&&(el.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
      if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='o'){e.preventDefault();open();}
      else if(!editable&&(e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){
        if(!root||root.style.display==='none')return;
        e.preventDefault();cmdInput.focus();
      }
    });
    window.AdaptiveWorkspaceOS={version:'5.0.0',mode:'browser-local',open:open,stats:function(){return C.stats(state);},exportState:function(){return C.validate(state);}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
