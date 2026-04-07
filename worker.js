const ALLOWED_ORIGIN = 'https://salescomm1.github.io';

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin === 'http://localhost:8080';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── LEADS ─────────────────────────────────────────────────────────────
    if (path === '/leads' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM leads ORDER BY createdAt DESC'
      ).all();
      return json(results, 200, origin);
    }

    if (path === '/leads' && request.method === 'POST') {
      const d = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO leads (id, company, contact, email, phone, stage, deal, buildCost, contractLength, source, lastContact, currentCrm, notes, declineReason, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, d.company, d.contact, d.email||'', d.phone||'',
        d.stage||'Lead', d.deal||0, d.buildCost||0,
        d.contractLength||'', d.source||'', d.lastContact||'',
        d.currentCrm||'', d.notes||'', d.declineReason||'',
        new Date().toISOString()
      ).run();
      const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
      return json(lead, 201, origin);
    }

    const leadMatch = path.match(/^\/leads\/([^/]+)$/);
    if (leadMatch) {
      const id = leadMatch[1];
      if (request.method === 'GET') {
        const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
        if (!lead) return json({ error: 'Not found' }, 404, origin);
        return json(lead, 200, origin);
      }
      if (request.method === 'PUT') {
        const d = await request.json();
        await env.DB.prepare(
          `UPDATE leads SET company=?, contact=?, email=?, phone=?, stage=?, deal=?, buildCost=?, contractLength=?, source=?, lastContact=?, currentCrm=?, notes=?, declineReason=? WHERE id=?`
        ).bind(
          d.company, d.contact, d.email||'', d.phone||'',
          d.stage||'Lead', d.deal||0, d.buildCost||0,
          d.contractLength||'', d.source||'', d.lastContact||'',
          d.currentCrm||'', d.notes||'', d.declineReason||'', id
        ).run();
        const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
        return json(lead, 200, origin);
      }
      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM tasks WHERE leadId=?').bind(id).run();
        await env.DB.prepare('DELETE FROM leads WHERE id=?').bind(id).run();
        return json({ ok: true }, 200, origin);
      }
    }

    // ── TASKS ─────────────────────────────────────────────────────────────
    if (path === '/tasks' && request.method === 'GET') {
      const leadId = url.searchParams.get('leadId');
      const { results } = leadId
        ? await env.DB.prepare('SELECT * FROM tasks WHERE leadId=? ORDER BY due ASC').bind(leadId).all()
        : await env.DB.prepare('SELECT * FROM tasks ORDER BY due ASC').all();
      return json(results, 200, origin);
    }

    if (path === '/tasks' && request.method === 'POST') {
      const d = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO tasks (id, title, leadId, due, priority, done, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, d.title, d.leadId||null, d.due||'',
        d.priority||'Medium', d.done||0, d.notes||'',
        new Date().toISOString()
      ).run();
      const task = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
      return json(task, 201, origin);
    }

    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const id = taskMatch[1];
      if (request.method === 'PUT') {
        const d = await request.json();
        await env.DB.prepare(
          `UPDATE tasks SET title=?, leadId=?, due=?, priority=?, done=?, notes=? WHERE id=?`
        ).bind(
          d.title, d.leadId||null, d.due||'',
          d.priority||'Medium', d.done ? 1 : 0, d.notes||'', id
        ).run();
        const task = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
        return json(task, 200, origin);
      }
      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(id).run();
        return json({ ok: true }, 200, origin);
      }
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};
