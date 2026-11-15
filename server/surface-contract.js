'use strict';

/** Strict declarative surface contract; no executable markup, scripts or URLs. */
const LIMITS = Object.freeze({ query: 600, title: 78, tag: 18, subtitle: 250, widgets: 8, rows: 24, columns: 7, metrics: 8, bars: 14, cell: 150, text: 1200 });
const ROLES = new Set(['owner', 'manager', 'dispatcher', 'inspector']);
const STATUSES = new Set(['neutral', 'positive', 'warning', 'critical']);
const TYPES = new Set(['metrics', 'table', 'bars', 'insight']);
function str(value, max = LIMITS.text) {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}
function array(value, max) { return Array.isArray(value) ? value.slice(0, max) : []; }
function validateQuery(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid request' };
  const query = str(body.query, LIMITS.query + 1);
  if (!query || query.length > LIMITS.query) return { ok: false, error: 'Query must be 1–600 characters' };
  return { ok: true, query, role: ROLES.has(body.role) ? body.role : 'owner' };
}
function metric(input) {
  if (!input || typeof input !== 'object') return null;
  const label = str(input.label, 45), value = str(input.value, 55);
  if (!label || !value) return null;
  return { label, value, detail: str(input.detail, 85), status: STATUSES.has(input.status) ? input.status : 'neutral' };
}
function normalizeWidget(input) {
  if (!input || typeof input !== 'object' || !TYPES.has(input.type)) return null;
  const title = str(input.title, LIMITS.title);
  if (input.type === 'metrics') {
    const items = array(input.items, LIMITS.metrics).map(metric).filter(Boolean);
    return items.length ? { type: 'metrics', title, items } : null;
  }
  if (input.type === 'table') {
    const columns = array(input.columns, LIMITS.columns).map(v => str(v, 50)).filter(Boolean);
    if (!columns.length) return null;
    const rows = array(input.rows, LIMITS.rows).filter(Array.isArray).map(row => columns.map((_, i) => str(row[i], LIMITS.cell)));
    return { type: 'table', title, columns, rows };
  }
  if (input.type === 'bars') {
    const items = array(input.items, LIMITS.bars).map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const label = str(entry.label, 60), display = str(entry.display, 60), value = Number(entry.value);
      if (!label || !Number.isFinite(value) || value < 0 || value > 100) return null;
      return { label, value: Math.round(value * 10) / 10, display };
    }).filter(Boolean);
    return items.length ? { type: 'bars', title, items } : null;
  }
  if (input.type === 'insight') {
    const body = str(input.body, LIMITS.text);
    return body ? { type: 'insight', title, body, status: STATUSES.has(input.status) ? input.status : 'neutral' } : null;
  }
  return null;
}
function normalizeSurface(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid surface');
  const title = str(input.title, LIMITS.title);
  if (!title) throw new Error('Missing surface title');
  const widgets = array(input.widgets, LIMITS.widgets).map(normalizeWidget).filter(Boolean);
  if (!widgets.length) throw new Error('No supported surface widgets');
  return { version: 1, title, tag: str(input.tag, LIMITS.tag) || 'AI DRAFT',
    key: str(input.key, 70).toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'generated_surface',
    subtitle: str(input.subtitle, LIMITS.subtitle), source: 'ai_draft', verified: false, widgets };
}
function parseModelJSON(text) {
  if (typeof text !== 'string' || text.length > 75000) throw new Error('Invalid model response size');
  let value;
  try { value = JSON.parse(text.trim()); }
  catch (e) {
    const match = /^\s*\x60{3}(?:json)?\s*\n([\s\S]*?)\n\x60{3}\s*$/i.exec(text);
    if (!match) throw new Error('Model response is not JSON');
    value = JSON.parse(match[1]);
  }
  return normalizeSurface(value);
}
module.exports = { LIMITS, ROLES, validateQuery, normalizeSurface, normalizeWidget, parseModelJSON };
