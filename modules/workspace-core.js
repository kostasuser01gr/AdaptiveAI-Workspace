/* AdaptiveAI Workspace OS v5 — deterministic state engine, zero dependencies.
 * No network calls, provider API usage or autonomous execution.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AdaptiveWorkspaceCore=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const LIMITS=Object.freeze({boards:12,cardsPerBoard:60,title:90,body:2000,events:150,importBytes:260000});
  const TYPES=new Set(['shortcut','task','note']);
  const TARGETS=new Set(['agents','data','chat','cloud']);
  const DENSITIES=new Set(['comfortable','compact']);
  function copy(s){return JSON.parse(JSON.stringify(s));}
  function identifier(prefix){
    return String(prefix||'w')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }
  function name(value,max){
    const v=typeof value==='string'?value.trim():'';
    if(!v||v.length>(max||LIMITS.title)||/[\u0000-\u001f\u007f]/.test(v))throw Error('Enter valid text (max '+(max||LIMITS.title)+' characters)');
    return v;
  }
  function initial(){
    return {schema:1,activeBoard:'command',preferences:{density:'comfortable'},
      boards:[
        {id:'command',title:'Command Center',description:'Launch tools and organize your work',cards:[
          {id:'go-agent',kind:'shortcut',title:'Agent Studio',body:'Design, validate and preview approval-gated workflows',target:'agents'},
          {id:'go-data',kind:'shortcut',title:'Data Intelligence',body:'Analyze user-provided datasets without external uploads',target:'data'},
          {id:'go-cloud',kind:'shortcut',title:'Cloud Workspace',body:'Check optional authentication and cloud sync',target:'cloud'},
          {id:'go-chat',kind:'shortcut',title:'Generative Canvas',body:'Return to the original AdaptiveAI prompt and surfaces',target:'chat'}
        ]},
        {id:'delivery',title:'Delivery Board',description:'Track your real work with private notes and tasks',cards:[]},
        {id:'lab',title:'Intelligence Lab',description:'Explore connected modules and local capabilities',cards:[
          {id:'lab-data',kind:'shortcut',title:'Data Intelligence',body:'Data quality, grouped analysis and local dashboards',target:'data'},
          {id:'lab-agent',kind:'shortcut',title:'Agent Studio',body:'Graph validation, local memory and approval previews',target:'agents'}
        ]}
      ],events:[]};
  }
  function validateCard(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid card');
    const kind=raw.kind;
    if(!TYPES.has(kind))throw Error('Unsupported card type');
    const id=name(raw.id,110),title=name(raw.title);
    const body=typeof raw.body==='string'?raw.body:'';
    if(body.length>LIMITS.body||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body))throw Error('Card body exceeds limits');
    const out={id,kind,title,body};
    if(kind==='shortcut'){
      if(!TARGETS.has(raw.target))throw Error('Unsupported shortcut target');
      out.target=raw.target;
    }else if(kind==='task')out.done=raw.done===true;
    return out;
  }
  function validate(raw){
    if(!raw||typeof raw!=='object'||raw.schema!==1||!Array.isArray(raw.boards)||!raw.boards.length||raw.boards.length>LIMITS.boards)
      throw Error('Invalid workspace schema');
    const boardIds=new Set(),cardIds=new Set();
    const boards=raw.boards.map(function(b){
      if(!b||typeof b!=='object'||!Array.isArray(b.cards)||b.cards.length>LIMITS.cardsPerBoard)throw Error('Invalid board');
      const id=name(b.id,110),title=name(b.title),description=typeof b.description==='string'?b.description:'';
      if(description.length>220)throw Error('Board description too long');
      if(boardIds.has(id))throw Error('Duplicate board ID');
      boardIds.add(id);
      const cards=b.cards.map(function(c){
        const normalized=validateCard(c);
        if(cardIds.has(normalized.id))throw Error('Duplicate card ID');
        cardIds.add(normalized.id);
        return normalized;
      });
      return {id,title,description,cards};
    });
    if(!boardIds.has(raw.activeBoard))throw Error('Unknown active board');
    const events=(Array.isArray(raw.events)?raw.events:[]).slice(-LIMITS.events).filter(function(e){
      return e&&typeof e.at==='string'&&typeof e.message==='string'&&e.message.length<=170;
    }).map(function(e){return {at:e.at,message:e.message};});
    return {schema:1,activeBoard:raw.activeBoard,
      preferences:{density:DENSITIES.has(raw.preferences&&raw.preferences.density)?raw.preferences.density:'comfortable'},boards,events};
  }
  function event(state,message){
    state.events.push({at:new Date().toISOString(),message:String(message).slice(0,170)});
    if(state.events.length>LIMITS.events)state.events=state.events.slice(-LIMITS.events);
  }
  function transact(state,action){
    const next=validate(state),type=action&&action.type;
    const active=next.boards.find(function(b){return b.id===next.activeBoard;});
    function board(id){const b=next.boards.find(function(x){return x.id===id;});if(!b)throw Error('Board not found');return b;}
    function card(b,id){const c=b.cards.find(function(x){return x.id===id;});if(!c)throw Error('Card not found');return c;}
    if(type==='selectBoard'){next.activeBoard=board(action.id).id;return next;}
    if(type==='addBoard'){
      if(next.boards.length>=LIMITS.boards)throw Error('Board limit reached');
      const title=name(action.title),id=identifier('board');
      next.boards.push({id,title,description:'Personal workspace',cards:[]});
      next.activeBoard=id;event(next,'Created board '+title);
    }else if(type==='renameBoard'){
      const b=board(action.id);b.title=name(action.title);event(next,'Renamed board to '+b.title);
    }else if(type==='removeBoard'){
      if(next.boards.length<=1)throw Error('Cannot delete the last board');
      const b=board(action.id);next.boards=next.boards.filter(function(x){return x.id!==b.id;});
      if(next.activeBoard===b.id)next.activeBoard=next.boards[0].id;
      event(next,'Removed board '+b.title);
    }else if(type==='addCard'){
      const b=board(action.boardId||next.activeBoard);
      if(b.cards.length>=LIMITS.cardsPerBoard)throw Error('Card limit reached');
      const values=action.card||{};
      const c=validateCard({id:identifier('card'),kind:values.kind,title:values.title,body:values.body||'',target:values.target,done:false});
      b.cards.push(c);event(next,'Created '+c.kind+': '+c.title);
    }else if(type==='updateCard'){
      const b=board(action.boardId||next.activeBoard),old=card(b,action.id);
      const changed=validateCard(Object.assign({},old,{title:action.title===undefined?old.title:action.title,body:action.body===undefined?old.body:action.body}));
      Object.assign(old,changed);event(next,'Updated '+old.kind+': '+old.title);
    }else if(type==='toggleTask'){
      const old=card(board(action.boardId||next.activeBoard),action.id);
      if(old.kind!=='task')throw Error('Card is not a task');
      old.done=!old.done;event(next,(old.done?'Completed task: ':'Reopened task: ')+old.title);
    }else if(type==='deleteCard'){
      const b=board(action.boardId||next.activeBoard),old=card(b,action.id);
      b.cards=b.cards.filter(function(c){return c.id!==old.id;});
      event(next,'Deleted '+old.kind+': '+old.title);
    }else if(type==='moveCard'){
      const b=board(action.boardId||next.activeBoard),from=b.cards.findIndex(function(c){return c.id===action.id;});
      if(from===-1)throw Error('Card not found');
      const target=Number(action.to);
      if(!Number.isInteger(target)||target<0||target>=b.cards.length)throw Error('Invalid card position');
      b.cards.splice(target,0,b.cards.splice(from,1)[0]);
      event(next,'Reordered '+b.cards[target].title);
    }else if(type==='transferCard'){
      const from=board(action.fromBoardId),to=board(action.toBoardId);
      if(from.id===to.id)throw Error('Choose another board');
      if(to.cards.length>=LIMITS.cardsPerBoard)throw Error('Destination board is full');
      const c=card(from,action.id);
      from.cards=from.cards.filter(function(x){return x.id!==c.id;});to.cards.push(c);
      event(next,'Moved '+c.title+' to '+to.title);
    }else if(type==='setDensity'){
      if(!DENSITIES.has(action.value))throw Error('Unsupported density');
      next.preferences.density=action.value;event(next,'Set density to '+action.value);
    }else throw Error('Unsupported workspace action');
    return validate(next);
  }
  function parseCommand(query){
    const raw=typeof query==='string'?query.trim():'';
    if(raw.length>240)throw Error('Command too long');
    const value=raw.toLowerCase().replace(/\s+/g,' ');
    if(['agents','agent','open agents','open agent studio','/agents'].includes(value))return {type:'navigate',target:'agents'};
    if(['data','datasets','open data','open data intelligence','/data'].includes(value))return {type:'navigate',target:'data'};
    if(['chat','canvas','open chat','open canvas','/chat'].includes(value))return {type:'navigate',target:'chat'};
    if(['cloud','open cloud','/cloud'].includes(value))return {type:'navigate',target:'cloud'};
    if(['export','export workspace','/export'].includes(value))return {type:'export'};
    const task=raw.match(/^(?:task:|add task:|\/task\s+)(.+)$/i);
    if(task)return {type:'addCard',card:{kind:'task',title:name(task[1])}};
    const memo=raw.match(/^(?:note:|add note:|\/note\s+)(.+)$/i);
    if(memo)return {type:'addCard',card:{kind:'note',title:name(memo[1])}};
    const board=raw.match(/^(?:board:|new board:|\/board\s+)(.+)$/i);
    if(board)return {type:'addBoard',title:name(board[1])};
    return {type:'unknown',query:raw};
  }
  function exportJSON(state){return JSON.stringify({format:'adaptiveai-workspace-v5',exportedAt:new Date().toISOString(),state:validate(state)},null,2);}
  function importJSON(text){
    if(typeof text!=='string'||text.length>LIMITS.importBytes)throw Error('Import must be JSON smaller than 260 KB');
    let obj;try{obj=JSON.parse(text);}catch(e){throw Error('Invalid JSON file');}
    if(!obj||obj.format!=='adaptiveai-workspace-v5')throw Error('File is not an AdaptiveAI Workspace v5 export');
    return validate(obj.state);
  }
  function stats(state){
    const s=validate(state),cards=s.boards.flatMap(function(b){return b.cards;});
    const tasks=cards.filter(function(c){return c.kind==='task';});
    return {boards:s.boards.length,cards:cards.length,tasks:tasks.length,completed:tasks.filter(function(t){return t.done;}).length,notes:cards.filter(function(c){return c.kind==='note';}).length,shortcuts:cards.filter(function(c){return c.kind==='shortcut';}).length};
  }
  return {LIMITS:LIMITS,initial:initial,validate:validate,transact:transact,parseCommand:parseCommand,stats:stats,importJSON:importJSON,exportJSON:exportJSON};
});
