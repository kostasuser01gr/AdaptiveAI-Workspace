'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../modules/workspace-core.js');
function active(s){return s.boards.find(b=>b.id===s.activeBoard);}
test('initial deck has real module shortcuts, no invented tasks',()=>{
  const s=core.initial(),st=core.stats(s);
  assert.equal(st.boards,3);assert.equal(st.tasks,0);assert.equal(st.completed,0);
  assert.equal(st.shortcuts,6);assert.equal(core.validate(s).activeBoard,'command');
  assert.ok(s.boards.every(b=>b.cards.every(c=>c.kind==='shortcut')));
});
test('board lifecycle supports add, rename and guard last board',()=>{
  let s=core.transact(core.initial(),{type:'addBoard',title:'Release A'});
  assert.equal(active(s).title,'Release A');
  const id=s.activeBoard;
  s=core.transact(s,{type:'renameBoard',id,title:'Release B'});
  assert.equal(active(s).title,'Release B');
  s=core.transact(s,{type:'removeBoard',id});
  assert.equal(s.boards.length,3);
  let singleton={...core.initial(),boards:[core.initial().boards[0]],activeBoard:'command'};
  assert.throws(()=>core.transact(singleton,{type:'removeBoard',id:'command'}),/last/);
});
test('task lifecycle, immutable transactions and server-free state',()=>{
  const original=core.initial();
  let s=core.transact(original,{type:'addCard',boardId:'delivery',card:{kind:'task',title:'Review deliveries',body:'Nothing external sent'}});
  const id=s.boards.find(b=>b.id==='delivery').cards[0].id;
  assert.equal(original.boards[1].cards.length,0);
  s=core.transact(s,{type:'toggleTask',boardId:'delivery',id});
  assert.equal(core.stats(s).completed,1);
  s=core.transact(s,{type:'updateCard',boardId:'delivery',id,title:'Verified review',body:'Manually confirmed'});
  assert.equal(s.boards[1].cards[0].done,true);
  s=core.transact(s,{type:'deleteCard',boardId:'delivery',id});
  assert.equal(s.boards[1].cards.length,0);
});
test('cross-board transfer preserves identity and task data',()=>{
  let s=core.transact(core.initial(),{type:'addCard',boardId:'delivery',card:{kind:'note',title:'Private draft',body:'Do not share'}});
  const id=s.boards[1].cards[0].id;
  s=core.transact(s,{type:'transferCard',fromBoardId:'delivery',toBoardId:'lab',id});
  assert.equal(s.boards[1].cards.length,0);
  assert.equal(s.boards[2].cards.find(c=>c.id===id).body,'Do not share');
});
test('card ordering, position bounds and no mutation on error',()=>{
  const s=core.initial(),initial=JSON.stringify(s);
  const moved=core.transact(s,{type:'moveCard',boardId:'command',id:'go-agent',to:3});
  assert.deepEqual(moved.boards[0].cards.map(c=>c.id),['go-data','go-cloud','go-chat','go-agent']);
  assert.equal(JSON.stringify(s),initial);
  assert.throws(()=>core.transact(s,{type:'moveCard',boardId:'command',id:'go-agent',to:90}),/position/);
});
test('rejects prototype confusion, duplicate IDs and unsupported shortcuts',()=>{
  let s=core.initial();s.boards[1].id=s.boards[0].id;
  assert.throws(()=>core.validate(s),/Duplicate board/);
  s=core.initial();s.boards[1].cards.push({...s.boards[0].cards[0]});
  assert.throws(()=>core.validate(s),/Duplicate card/);
  assert.throws(()=>core.transact(core.initial(),{type:'addCard',card:{kind:'shortcut',title:'Unknown',target:'external://evil'}}),/shortcut target/);
  assert.throws(()=>core.transact(core.initial(),{type:'randomAction'}),/Unsupported/);
});
test('reliably parses only documented local command grammar',()=>{
  assert.deepEqual(core.parseCommand('/agents'),{type:'navigate',target:'agents'});
  assert.deepEqual(core.parseCommand('/data'),{type:'navigate',target:'data'});
  assert.deepEqual(core.parseCommand('/export'),{type:'export'});
  assert.equal(core.parseCommand('/task Run tests').card.title,'Run tests');
  assert.equal(core.parseCommand('/note Look at the graph').card.kind,'note');
  assert.equal(core.parseCommand('/board Sprint 2').title,'Sprint 2');
  assert.equal(core.parseCommand('wire money now').type,'unknown');
  assert.throws(()=>core.parseCommand('/task '+'a'.repeat(200)),/valid text/);
});
test('workspace export/import roundtrips and rejects malformed payloads',()=>{
  let s=core.transact(core.initial(),{type:'addCard',boardId:'delivery',card:{kind:'task',title:'Complete integration'}});
  const json=core.exportJSON(s),out=core.importJSON(json);
  assert.deepEqual(out,s);
  assert.throws(()=>core.importJSON('not json'),/Invalid JSON/);
  assert.throws(()=>core.importJSON(JSON.stringify({format:'not-v5',state:s})),/not an AdaptiveAI/);
  assert.throws(()=>core.importJSON('x'.repeat(260001)),/260 KB/);
});
test('user-supplied markup remains data; card text cannot introduce HTML',()=>{
  const text='<img src=x onerror=alert(1)>';
  const s=core.transact(core.initial(),{type:'addCard',card:{kind:'note',title:'Draft note',body:text}});
  assert.equal(s.boards[0].cards.at(-1).body,text);
  assert.equal(core.importJSON(core.exportJSON(s)).boards[0].cards.at(-1).body,text);
});
test('limits and invalid schemas fail closed',()=>{
  let s=core.initial();
  assert.throws(()=>core.transact(s,{type:'addCard',card:{kind:'note',title:'x',body:'A'.repeat(2001)}}),/exceeds/);
  assert.throws(()=>core.validate({schema:123,boards:[]}),/schema/);
  assert.throws(()=>core.transact(s,{type:'setDensity',value:'unsafe'}),/density/);
  const compact=core.transact(s,{type:'setDensity',value:'compact'});
  assert.equal(compact.preferences.density,'compact');
});
