/* AdaptiveAI safe declarative renderer: all model content is text, never HTML. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AdaptiveSafeUI=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function el(tag,className,text){
    var n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined&&text!==null)n.textContent=String(text);
    return n;
  }
  function append(parent){
    for(var i=1;i<arguments.length;i++)if(arguments[i])parent.appendChild(arguments[i]);
    return parent;
  }
  function text(value,max){
    if(typeof value!=='string'&&typeof value!=='number')return '';
    return String(value).replace(/[\u0000-\u001f]/g,'').slice(0,max||1000);
  }
  function section(title){
    var s=el('section','asu-panel');
    if(title)s.appendChild(el('h3','asu-panel-title',text(title,78)));
    return s;
  }
  function renderMetrics(widget){
    var out=section(widget.title),grid=el('div','asu-metrics');
    (Array.isArray(widget.items)?widget.items:[]).slice(0,8).forEach(function(item){
      var box=el('div','asu-metric');
      append(box,el('small','',text(item.label,45)),el('strong','',text(item.value,55)),el('span','',text(item.detail,85)));
      grid.appendChild(box);
    });
    out.appendChild(grid);return out;
  }
  function renderTable(widget){
    var out=section(widget.title),scroll=el('div','asu-table-scroll'),table=el('table','asu-table'),head=el('thead'),headRow=el('tr');
    var columns=(Array.isArray(widget.columns)?widget.columns:[]).slice(0,7);
    columns.forEach(function(c){headRow.appendChild(el('th','',text(c,50)));});
    head.appendChild(headRow);table.appendChild(head);
    var body=el('tbody');
    (Array.isArray(widget.rows)?widget.rows:[]).slice(0,24).forEach(function(row){
      var tr=el('tr');columns.forEach(function(_,index){tr.appendChild(el('td','',text(Array.isArray(row)?row[index]:'',150)));});body.appendChild(tr);
    });
    table.appendChild(body);scroll.appendChild(table);out.appendChild(scroll);return out;
  }
  function renderBars(widget){
    var out=section(widget.title),list=el('div','asu-bars');
    (Array.isArray(widget.items)?widget.items:[]).slice(0,14).forEach(function(item){
      var value=Number(item.value);
      if(!Number.isFinite(value))return;
      value=Math.max(0,Math.min(100,value));
      var row=el('div','asu-bar-row'),caption=el('div','asu-bar-caption'),track=el('div','asu-bar-track'),fill=el('div','asu-bar-fill');
      fill.style.width=value+'%';
      append(caption,el('span','',text(item.label,60)),el('b','',text(item.display||value+'%',60)));
      track.appendChild(fill);append(row,caption,track);list.appendChild(row);
    });
    out.appendChild(list);return out;
  }
  function renderInsight(widget){
    var out=section(widget.title);
    out.classList.add('asu-insight');
    out.appendChild(el('p','',text(widget.body,1200)));
    return out;
  }
  function render(container,surface,originalQuery){
    if(!container||!surface||typeof surface!=='object')return false;
    container.replaceChildren();
    var hero=el('header','asu-head'),titleWrap=el('div');
    append(titleWrap,el('div','asu-eyebrow',surface.source==='user_dataset'?'LOCAL DATA · USER-PROVIDED · UNVERIFIED':'GENERATIVE UI · AI-DRAFT · UNVERIFIED'),
      el('h2','',text(surface.title||originalQuery||'Generated view',78)),
      el('p','',text(surface.subtitle||'AI-generated analysis. Connect verified data sources for live operational values.',250)));
    append(hero,titleWrap,el('span','asu-tag',text(surface.tag||'AI DRAFT',18)));
    container.appendChild(hero);
    var widgets=Array.isArray(surface.widgets)?surface.widgets.slice(0,8):[];
    widgets.forEach(function(w){
      if(!w||typeof w!=='object')return;
      var component=w.type==='metrics'?renderMetrics(w):w.type==='table'?renderTable(w):w.type==='bars'?renderBars(w):w.type==='insight'?renderInsight(w):null;
      if(component)container.appendChild(component);
    });
    if(container.children.length===1)container.appendChild(renderInsight({title:'No supported widgets',body:'The response did not include any safe, displayable data.'}));
    return true;
  }
  return {render:render};
});
