'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../modules/agent-core.js');

test('seeded workflow is a valid directed acyclic graph', () => {
  const state = core.baseState();
  const graph = core.validateWorkflow(state.workflows[0]);
  assert.equal(graph.ok, true);
  assert.deepEqual(graph.order, ['collect', 'check', 'brief']);
  assert.equal(state.memory.length, 0);
  assert.equal(state.tools.filter(t => t.connected).length, 0);
});
test('rejects cycles without modifying input graph', () => {
  const original = core.baseState().workflows[0];
  const snapshot = JSON.stringify(original);
  assert.throws(() => core.linkSteps(original, 'collect', 'brief'), /cycle/i);
  assert.equal(JSON.stringify(original), snapshot);
});
test('rejects unknown dependencies and duplicate IDs', () => {
  const graph = core.baseState().workflows[0];
  graph.nodes[0].dependsOn.push('nonexistent');
  assert.equal(core.validateWorkflow(graph).ok, false);
  graph.nodes[0].dependsOn = [];
  graph.nodes.push({ ...graph.nodes[0] });
  assert.match(core.validateWorkflow(graph).errors.join(' '), /Duplicate/i);
});
test('approval gate blocks completion until explicit approval', () => {
  const workflow = core.baseState().workflows[0];
  const run = core.startPreview(workflow);
  assert.equal(run.status, 'awaiting_approval');
  assert.equal(run.steps.collect, 'previewed');
  assert.equal(run.steps.check, 'awaiting_approval');
  assert.equal(run.steps.brief, 'queued');
  const unchanged = core.advancePreview(workflow, run, 'advance');
  assert.equal(unchanged.status, 'awaiting_approval');
  assert.equal(unchanged.steps.brief, 'queued');
  const approved = core.advancePreview(workflow, run, 'approve');
  assert.equal(approved.status, 'completed');
  assert.equal(approved.steps.brief, 'previewed');
  assert.match(approved.messages.at(-1), /no external actions/i);
});
test('rejection is terminal', () => {
  const w = core.baseState().workflows[0], run = core.startPreview(w);
  const denied = core.advancePreview(w, run, 'reject');
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.steps.brief, 'queued');
  assert.equal(core.advancePreview(w, denied, 'approve').status, 'rejected');
});
test('new workflow and step creation enforce usable names', () => {
  assert.throws(() => core.newWorkflow('  '), /name/);
  const w = core.newWorkflow('Maintenance readiness', 'quality');
  assert.equal(w.nodes[0].agentId, 'quality');
  assert.throws(() => core.addStep(w, {name:'  '}), /name/);
  const updated = core.addStep(w,{name:'Manual review',agentId:'quality',dependsOn:w.nodes[0].id,approval:true});
  assert.equal(core.validateWorkflow(updated).ok, true);
  assert.equal(updated.nodes.length, 2);
  assert.equal(w.nodes.length, 1);
});
test('removing a step clears dependencies pointing to it', () => {
  const w = core.baseState().workflows[0];
  const updated = core.removeStep(w, 'check');
  assert.deepEqual(updated.nodes[1].dependsOn, []);
  assert.equal(core.validateWorkflow(updated).ok, true);
});
test('state restore never restores connected flags from localStorage', () => {
  const s = core.baseState();
  s.tools[0].connected = true;
  s.memory.push({ id:'test', key:'key', value:'value', scope:'workspace' });
  s.events.push({id:'a',message:'changed',at:'2026-11-15T00:00:00.000Z'});
  const reloaded = core.safeState(s);
  assert.equal(reloaded.tools[0].connected, false);
  assert.equal(reloaded.memory.length, 1);
  assert.equal(reloaded.events.length, 1);
  assert.equal(core.safeState({version:10}).workflows.length, 1);
});
