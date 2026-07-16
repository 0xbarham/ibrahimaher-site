import { TABLE_COLUMNS } from '../../_lib/schema.js';
import { json } from '../../_lib/auth.js';

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequestGet({ params, env }) {
  const columns = TABLE_COLUMNS[params.table];
  if (!columns) return json({ ok: false, error: 'Unknown table' }, 404);

  const { results } = await env.DB.prepare(
    `SELECT * FROM ${params.table} ORDER BY sort_order ASC`
  ).all();
  return json({ ok: true, data: results });
}

export async function onRequestPost({ params, env, request }) {
  const columns = TABLE_COLUMNS[params.table];
  if (!columns) return json({ ok: false, error: 'Unknown table' }, 404);

  const body = await safeJson(request);
  if (!body) return json({ ok: false, error: 'Invalid JSON body' }, 400);

  const cols = columns.filter((c) => c in body);
  if (cols.length === 0) return json({ ok: false, error: 'No valid fields provided' }, 400);

  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => body[c]);
  const result = await env.DB.prepare(
    `INSERT INTO ${params.table} (${cols.join(', ')}) VALUES (${placeholders})`
  ).bind(...values).run();

  return json({ ok: true, id: result.meta.last_row_id });
}

export async function onRequestPut({ params, env, request }) {
  const columns = TABLE_COLUMNS[params.table];
  if (!columns) return json({ ok: false, error: 'Unknown table' }, 404);

  const body = await safeJson(request);
  if (!body || !Number.isInteger(body.id)) {
    return json({ ok: false, error: 'Request body must include an integer id' }, 400);
  }

  const cols = columns.filter((c) => c in body);
  if (cols.length === 0) return json({ ok: false, error: 'No valid fields provided' }, 400);

  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => body[c]);
  values.push(body.id);

  await env.DB.prepare(`UPDATE ${params.table} SET ${setClause} WHERE id = ?`).bind(...values).run();
  return json({ ok: true });
}

export async function onRequestDelete({ params, env, request }) {
  const columns = TABLE_COLUMNS[params.table];
  if (!columns) return json({ ok: false, error: 'Unknown table' }, 404);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id)) return json({ ok: false, error: 'Missing or invalid id query param' }, 400);

  await env.DB.prepare(`DELETE FROM ${params.table} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}
