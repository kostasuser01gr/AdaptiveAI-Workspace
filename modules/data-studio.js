/* AdaptiveAI v4 Data Studio — private, browser-only dataset analytics. */
(function () {
  'use strict';
  var core=window.AdaptiveDataCore;
  if(!core)return;
  var DB='adaptiveai-data-v4', STORE='datasets', list=[], current=null, page='overview', query='', column='', offset=0, locale='eu';
  var fallback=new Map(),persist=true,root=null,canvas=null,nav=null,tab=null,flash=null;
  function E(tag,cls,txt){var x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x;}
  function A(parent){for(var i=1;i<arguments.length;i++)if(arguments[i])parent.appendChild(arguments[i]);return parent;}
  function B(label,action,mode){var b=E('button','adi-btn'+(mode?' '+mode:''),label);b.type='button';b.addEventListener('click',action);return b;}
  function N(text){return E('div','adi-note',text);}
  function P(){return E('section','adi-panel');}
  function H(text,meta){return A(E('div','adi-panel-header'),E('h2','',text),E('span','adi-badge',meta||'LOCAL'));}
  function M(value,name,sub){return A(E('div','adi-kpi'),E('small','',name),E('strong','',value),E('em','',sub||''));}
  function select(items,value){
    var s=E('select','adi-select');
    items.forEach(function(i){var o=E('option','',i.label);o.value=i.id;s.appendChild(o);});
    if(value!==undefined)s.value=value;
    return s;
  }
  function field(title,input){return A(E('label',''),E('span','',title),input);}
  function input(placeholder){var x=E('input','adi-input');x.placeholder=placeholder;return x;}
  function note(text,error){if(!flash)return;flash.textContent=text;flash.className='adi-status'+(error?' error':'');flash.hidden=false;}
  function number(value){return value===null||value===undefined?'—':new Intl.NumberFormat(locale==='eu'?'el-GR':'en-US',{maximumFractionDigits:2}).format(value);}
  function db(){
    return new Promise(function(resolve,reject){
      if(!window.indexedDB)return reject(Error('IndexedDB unsupported'));
      var req=indexedDB.open(DB,1);
      req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){reject(req.error);};
    });
  }
  async function operate(mode,method,arg){
    var connection=await db();
    return new Promise(function(resolve,reject){
      var request=connection.transaction(STORE,mode).objectStore(STORE)[method](arg);
      request.onsuccess=function(){resolve(request.result);};
      request.onerror=function(){reject(request.error);};
      connection.onversionchange=function(){connection.close();};
      setTimeout(function(){connection.close();},100);
    });
  }
  async function load(){
    try{list=await operate('readonly','getAll');persist=true;}
    catch(e){list=Array.from(fallback.values());persist=false;}
    list.sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
    if(current&&!list.some(function(d){return d.id===current.id;}))current=null;
    if(current)current=list.find(function(d){return d.id===current.id;});
    else current=list[0]||null;
  }
  async function save(dataset){
    if(list.length>=core.LIMITS.datasets)throw Error('Maximum '+core.LIMITS.datasets+' datasets.');
    try{await operate('readwrite','put',dataset);}
    catch(e){fallback.set(dataset.id,dataset);persist=false;}
    current=dataset;await load();
  }
  async function remove(id){
    if(!window.confirm('Delete this local dataset?'))return;
    try{await operate('readwrite','delete',id);}catch(e){fallback.delete(id);}
    if(current&&current.id===id)current=null;
    await load();draw();
  }
  function download(filename,contents,mime){
    var url=URL.createObjectURL(new Blob([contents],{type:mime||'text/plain'})),a=E('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }
  function matrix(headers,rows){
    var wrap=E('div','adi-table-wrap'),table=E('table','adi-table'),thead=E('thead'),tr=E('tr'),body=E('tbody');
    headers.forEach(function(s){tr.appendChild(E('th','',s));});thead.appendChild(tr);table.appendChild(thead);
    rows.forEach(function(values){var row=E('tr');headers.forEach(function(_,i){row.appendChild(E('td','',values[i]===undefined?'':values[i]));});body.appendChild(row);});
    A(table,body);wrap.appendChild(table);return wrap;
  }
  function chooser(){
    var choices=select(list.map(function(d){return{id:d.id,label:d.name+' ('+d.rows.length+' rows)'};}),current&&current.id);
    choices.style.maxWidth='300px';choices.setAttribute('aria-label','Active dataset');
    choices.addEventListener('change',function(){current=list.find(function(d){return d.id===choices.value;})||null;query='';column='';offset=0;draw();});
    return choices;
  }
  function importText(text,name){
    return (async function(){
      try{
        var d=core.makeDataset(name,text);await save(d);page='overview';draw();
        note('Imported '+d.rows.length+' real rows locally.'+(persist?'':' This session has no persistent storage.'),!persist);
      }catch(e){note('Import error: '+e.message,true);}
    })();
  }
  function ingest(file){
    if(!file)return;
    if(!/\.(csv|tsv|txt)$/i.test(file.name))return note('Accepted formats: .csv, .tsv and .txt',true);
    if(file.size>core.LIMITS.bytes)return note('File must be no larger than 2 MB.',true);
    file.text().then(function(text){return importText(text,file.name);}).catch(function(e){note(e.message,true);});
  }
  function overview(){
    var grid=E('div','adi-grid'),count=list.reduce(function(n,d){return n+d.rows.length;},0),prof=current&&core.profile(current,locale);
    A(grid,M(list.length,'Datasets','Device-local library'),M(number(count),'Imported rows','From real CSV records'),M(current?current.headers.length:0,'Active columns','Original header schema'),M(prof?prof.completeness+'%':'—','Completeness','Nonempty cells'));
    canvas.appendChild(grid);
    var split=E('div','adi-split'),left=P(),right=P(),drop=E('div','adi-drop');
    left.appendChild(H('Import dataset','CSV / TSV'));
    A(drop,E('div','adi-eyebrow','01 — INGEST'),E('strong','','Drag & drop CSV files'),E('p','','Up to 2 MB, 5,000 rows and 32 columns. Data stays in your browser.'));
    drop.appendChild(B('Choose file',function(){document.getElementById('adi-upload').click();},'primary'));
    drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('drag');});
    drop.addEventListener('dragleave',function(){drop.classList.remove('drag');});
    drop.addEventListener('drop',function(e){e.preventDefault();drop.classList.remove('drag');ingest(e.dataTransfer&&e.dataTransfer.files[0]);});
    left.appendChild(drop);
    left.appendChild(A(E('div','adi-section-title'),E('strong','','Paste CSV or TSV'),E('span','','Manual input')));
    var text=E('textarea','adi-textarea');
    text.id='adi-paste';text.placeholder='Station;Fleet;Revenue\nHeraklion;12;1250,50\nChania;8;850,20';
    var name=input('Dataset title');name.id='adi-name';name.value='Untitled dataset';
    A(left,text,name,B('Import pasted data',function(){importText(text.value,name.value);},'primary'));
    right.appendChild(H('My datasets',list.length+'/'+core.LIMITS.datasets));
    if(!list.length)right.appendChild(E('div','adi-empty','No datasets yet. Upload or paste your first CSV file.'));
    list.forEach(function(d){
      var row=E('div','adi-source-row'),info=E('div'),actions=E('div','adi-actions');
      A(info,E('div','adi-source-name',d.name),E('div','adi-source-meta',d.rows.length+' rows · '+d.headers.length+' columns · '+new Date(d.createdAt).toLocaleDateString()));
      A(actions,B('Analyze',function(){current=d;page='profile';draw();},'primary'),B('Delete',function(){remove(d.id);},'danger'));
      A(row,info,actions);right.appendChild(row);
    });
    A(split,left,right);canvas.appendChild(split);
    if(prof&&prof.sensitive.length)canvas.appendChild(E('div','adi-note warn','Possible personal-data columns: '+prof.sensitive.join(', ')+'. This is heuristic; review before sharing.'));
  }
  function quality(){
    if(!current)return canvas.appendChild(E('div','adi-empty','Import a dataset in Overview to profile it.'));
    var prof=core.profile(current,locale),head=E('div','adi-panel-header');
    A(head,E('h2','','Data quality profile'),chooser());canvas.appendChild(head);
    var stats=E('div','adi-grid');
    A(stats,M(prof.rows,'Valid rows','Parsed records'),M(prof.completeness+'%','Completeness','Nonempty cells'),M(prof.missingCells,'Missing cells','Data quality'),M(prof.skipped,'Skipped rows','Malformed records'));
    canvas.appendChild(stats);
    if(prof.sensitive.length)canvas.appendChild(E('div','adi-note warn','Sensitive headers: '+prof.sensitive.join(', ')+'. Do not upload private datasets to external AI.'));
    if(prof.skipped)canvas.appendChild(E('div','adi-note warn',prof.issues.join(' | ')));
    var main=P();main.appendChild(H('Column profiling','REPRODUCIBLE'));
    var rows=prof.columns.map(function(c){return[c.name,c.filled,c.missing,c.distinct,c.numeric?'NUMERIC':'TEXT',c.numeric?number(c.minimum)+' / '+number(c.maximum):'—'];});
    main.appendChild(matrix(['Column','Filled','Missing','Unique','Type','Min / max'],rows));canvas.appendChild(main);
    var chart=P();chart.style.marginTop='16px';chart.appendChild(H('Data completeness','BY COLUMN'));
    prof.columns.forEach(function(c){
      var pct=prof.rows?Math.round(100*c.filled/prof.rows):0;
      chart.appendChild(bar(c.name,pct,pct+'%'));
    });
    canvas.appendChild(chart);
  }
  function bar(label,pct,display){
    var wrap=E('div','adi-bar'),top=E('div','adi-bar-top'),track=E('div','adi-bar-track'),fill=E('div','adi-bar-fill');
    A(top,E('strong','',label),E('span','',display));
    fill.style.width=Math.max(0,Math.min(100,pct))+'%';track.appendChild(fill);
    A(wrap,top,track);return wrap;
  }
  function analysis(){
    if(!current)return canvas.appendChild(E('div','adi-empty','Import a dataset to build verifiable analytics.'));
    var heading=E('div','adi-panel-header');
    A(heading,E('h2','','Analytics Builder'),chooser());canvas.appendChild(heading);
    canvas.appendChild(N('All visualizations are computed from your local file. No AI-generated metrics, cloud processing or external API calls.'));
    var split=E('div','adi-split'),controls=P(),result=P(),form=E('div','adi-form');
    controls.appendChild(H('Group and aggregate','CALCULATE'));
    var group=select(current.headers.map(function(h){return{id:h,label:h};}));
    var numeric=core.profile(current,locale).columns.filter(function(c){return c.numeric;});
    var measure=select(numeric.length?numeric.map(function(c){return{id:c.name,label:c.name};}):[{id:'',label:'No numeric columns'}]);
    var operation=select([{id:'count',label:'Count records'},{id:'sum',label:'Sum'},{id:'avg',label:'Average'},{id:'median',label:'Median'},{id:'min',label:'Minimum'},{id:'max',label:'Maximum'}],'count');
    var choice=select([{id:'eu',label:'EU decimal 1.234,56'},{id:'us',label:'US decimal 1,234.56'}],locale);
    var text=input('Optional text filter');
    var where=select([{id:'',label:'All columns'}].concat(current.headers.map(function(h){return{id:h,label:h};})));
    measure.disabled=true;
    operation.addEventListener('change',function(){measure.disabled=operation.value==='count';});
    var output=E('div');
    function calculate(){
      try{
        locale=choice.value;
        var report=core.aggregate(current,{groupBy:group.value,measure:measure.value,operation:operation.value,locale:locale,search:text.value,filterColumn:where.value});
        output.replaceChildren();
        output.appendChild(E('p','',report.matchedRows+' matching rows · '+report.totalGroups+' groups · '+report.invalidValues+' invalid values'));
        var graph=E('div','adi-chart');
        var maximum=Math.max(0,...report.groups.map(function(x){return Math.max(0,x.value||0);}));
        report.groups.forEach(function(x){graph.appendChild(bar(x.label,maximum?100*Math.max(0,x.value||0)/maximum:0,number(x.value)));});
        output.appendChild(graph);
        output.appendChild(matrix(['Group','Value','Count'],report.groups.map(function(x){return[x.label,number(x.value),x.count];})));
        var exportRows=report.groups.map(function(x){return[x.label,x.value===null?'':String(x.value),String(x.count)];});
        var exportButton=B('Download aggregate CSV',function(){
          download('adaptiveai-analysis.csv',core.toCSV(['Group','Value','Count'],exportRows),'text/csv;charset=utf-8');
        });
        exportButton.style.marginTop='14px';output.appendChild(exportButton);
      }catch(e){note(e.message,true);}
    }
    A(form,field('Group by',group),field('Operation',operation),field('Numeric field',measure),field('Number format',choice),
      field('Search within',where),field('Contains',text),B('Calculate',calculate,'primary'));
    controls.appendChild(form);result.appendChild(H('Computed output','ACTUAL DATA'));result.appendChild(output);
    output.appendChild(E('div','adi-empty','Choose fields, then click Calculate to display the aggregated result.'));
    A(split,controls,result);canvas.appendChild(split);
  }
  function explore(){
    if(!current)return canvas.appendChild(E('div','adi-empty','Import a dataset to inspect individual records.'));
    var top=E('div','adi-panel-header');
    A(top,E('h2','','Data Explorer'),chooser());canvas.appendChild(top);
    var p=P(),tools=E('div','adi-actions'),searchInput=input('Search all rows'),where=select([{id:'',label:'All columns'}].concat(current.headers.map(function(h){return{id:h,label:h};})),column);
    searchInput.value=query;searchInput.id='adi-query';searchInput.style.maxWidth='320px';where.style.maxWidth='210px';
    tools.appendChild(searchInput);tools.appendChild(where);
    tools.appendChild(B('Export CSV',function(){download('adaptiveai-data.csv',core.toCSV(current.headers,core.rowsFor(current,{search:query,filterColumn:column})),'text/csv;charset=utf-8');}));
    tools.appendChild(B('Export JSON',function(){download('adaptiveai-data.json',JSON.stringify({source:'user_upload',headers:current.headers,rows:core.rowsFor(current,{search:query,filterColumn:column})},null,2),'application/json');}));
    p.appendChild(tools);
    var tableHolder=E('div'),controls=E('div','adi-panel-header');
    controls.style.marginTop='12px';
    function paint(){
      var records=core.rowsFor(current,{search:query,filterColumn:column}),max=Math.max(0,Math.ceil(records.length/40)-1);
      offset=Math.max(0,Math.min(max,offset));tableHolder.replaceChildren();
      tableHolder.appendChild(matrix(current.headers,records.slice(offset*40,(offset+1)*40)));
      controls.replaceChildren();controls.appendChild(E('span','adi-badge',records.length+' records · page '+(offset+1)+' / '+(max+1)));
      var buttons=E('div','adi-actions');
      var back=B('← Back',function(){offset--;paint();}),next=B('Next →',function(){offset++;paint();});
      back.disabled=offset===0;next.disabled=offset===max;A(buttons,back,next);controls.appendChild(buttons);
    }
    searchInput.addEventListener('input',function(){query=searchInput.value;offset=0;paint();});
    where.addEventListener('change',function(){column=where.value;offset=0;paint();});
    p.appendChild(tableHolder);p.appendChild(controls);canvas.appendChild(p);paint();
  }
  function draw(){
    if(!root)return;
    var tabsEl=document.getElementById('adi-views');tabsEl.replaceChildren();canvas.replaceChildren();
    [['overview','Overview'],['profile','Quality Profile'],['analysis','Analytics Builder'],['explore','Data Explorer']].forEach(function(pair){
      var x=E('button','adi-tab',pair[1]);x.type='button';x.setAttribute('role','tab');x.setAttribute('aria-selected',String(page===pair[0]));
      x.addEventListener('click',function(){page=pair[0];draw();});tabsEl.appendChild(x);
    });
    if(!persist)canvas.appendChild(E('div','adi-note warn','Browser database unavailable: imported data may not survive closing this tab.'));
    if(page==='overview')overview();
    else if(page==='profile')quality();
    else if(page==='analysis')analysis();
    else explore();
  }
  function open(){
    var stage=document.getElementById('stage'),tabs=document.getElementById('tabs');if(!stage||!tabs)return;
    if(!root){
      root=E('section','gx-surface adi-root');root.id='adaptive-data-studio';root.tabIndex=-1;
      var container=E('div','adi-container'),hero=E('div','adi-hero'),intro=E('div'),actions=E('div','adi-actions');
      A(intro,E('div','adi-eyebrow','ADAPTIVEAI / REAL DATA LAYER'),E('h1','','Data Intelligence'),E('p','','Explore, validate and analyze your own CSV data — without inventing KPIs or leaving this browser.'));
      A(actions,E('span','adi-indicator','LOCAL ONLY'),B('Import CSV',function(){document.getElementById('adi-upload').click();},'primary'));
      A(hero,intro,actions);
      var upload=E('input');upload.id='adi-upload';upload.type='file';upload.accept='.csv,.tsv,.txt';upload.hidden=true;
      upload.addEventListener('change',function(){ingest(upload.files&&upload.files[0]);upload.value='';});
      flash=E('div','adi-status');flash.hidden=true;flash.setAttribute('role','status');
      var navTabs=E('div','adi-tabs');navTabs.id='adi-views';navTabs.setAttribute('role','tablist');
      canvas=E('div');
      A(container,hero,upload,N('User-owned data remains on this device. The module does not send imports to cloud AI, Vercel APIs or third-party services.'),navTabs,canvas,flash);
      root.appendChild(container);stage.appendChild(root);
      tab=E('button','gx-tab active');tab.type='button';tab.dataset.target=root.id;
      tab.appendChild(E('span','tt','◈ Data Intelligence'));tab.addEventListener('click',open);tabs.appendChild(tab);
    }
    document.querySelectorAll('.bigpanel-bg.open').forEach(function(p){p.classList.remove('open');});
    document.querySelectorAll('.nav-item.active').forEach(function(n){n.classList.remove('active');});
    nav.classList.add('active');
    stage.querySelectorAll('.gx-surface').forEach(function(x){x.style.display=x===root?'':'none';});
    tabs.querySelectorAll('.gx-tab').forEach(function(x){x.classList.toggle('active',x===tab);});
    var emptyState=document.getElementById('empty');if(emptyState)emptyState.style.display='none';
    draw();root.focus({preventScroll:true});
  }
  function mount(){
    if(document.getElementById('navDataStudio'))return;
    var anchor=document.getElementById('navStudio')||document.getElementById('navAssets');if(!anchor)return;
    nav=E('button','nav-item');nav.id='navDataStudio';nav.type='button';
    A(nav,E('span','adi-nav-symbol','◈'),E('span','','Data Intelligence'),E('span','adi-badge','V4'));
    anchor.insertAdjacentElement('afterend',nav);
    nav.addEventListener('click',function(e){e.stopPropagation();open();});
    document.addEventListener('keydown',function(e){
      if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='d'){
        if(e.target&&e.target.matches&&e.target.matches('input,textarea,[contenteditable=true]'))return;
        e.preventDefault();open();
      }
    });
    window.AdaptiveDataStudio={open:open,mode:'local-real-data',version:'4.0',list:function(){return list.map(function(x){return{id:x.id,name:x.name};});}};
    load().then(function(){if(root)draw();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
