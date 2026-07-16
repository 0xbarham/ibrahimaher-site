// Field definitions mirror functions/_lib/schema.js (TABLE_COLUMNS) plus a
// widget hint per field so the form renders something sensible.
const TABLE_FIELDS = {
  jobs: [
    { name: 'sort_order', type: 'number' },
    { name: 'eyebrow', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'company', type: 'text' },
    { name: 'date_range', type: 'text' },
    { name: 'body_html', type: 'textarea' },
    { name: 'tags_json', type: 'textarea' },
    { name: 'logo_light', type: 'text' },
    { name: 'logo_dark', type: 'text' },
  ],
  projects: [
    { name: 'sort_order', type: 'number' },
    { name: 'title', type: 'text' },
    { name: 'body_html', type: 'textarea' },
    { name: 'tags_json', type: 'textarea' },
    { name: 'icon_light', type: 'text' },
    { name: 'icon_dark', type: 'text' },
    { name: 'featured', type: 'checkbox' },
    { name: 'featured_logo', type: 'text' },
    { name: 'external_url', type: 'text' },
    { name: 'external_label', type: 'text' },
  ],
  skills: [
    { name: 'sort_order', type: 'number' },
    { name: 'category', type: 'text' },
    { name: 'subtitle', type: 'text' },
    { name: 'tags_json', type: 'textarea' },
  ],
  certifications: [
    { name: 'sort_order', type: 'number' },
    { name: 'title', type: 'text' },
    { name: 'issuer', type: 'text' },
  ],
  education: [
    { name: 'sort_order', type: 'number' },
    { name: 'title', type: 'text' },
    { name: 'school', type: 'text' },
    { name: 'date_range', type: 'text' },
    { name: 'body_html', type: 'textarea' },
  ],
  posts: [
    { name: 'sort_order', type: 'number' },
    { name: 'slug', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'excerpt', type: 'textarea' },
    { name: 'post_date', type: 'text' },
    { name: 'read_time', type: 'text' },
  ],
};

let currentTable = 'jobs';
const rowsContainer = document.getElementById('rows-container');
const statusEl = document.getElementById('admin-status');

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#e5484d' : 'var(--muted)';
  if (msg) setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 4000);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function fieldValueFromInput(el, type) {
  if (type === 'checkbox') return el.checked ? 1 : 0;
  if (type === 'number') return el.value === '' ? null : Number(el.value);
  return el.value;
}

function renderRow(row) {
  const fields = TABLE_FIELDS[currentTable];
  const card = document.createElement('div');
  card.className = 'row-card';
  card.dataset.id = row.id ?? '';

  fields.forEach((f) => {
    const wrap = document.createElement('div');
    wrap.className = 'row-field' + (f.type === 'checkbox' ? ' checkbox' : '');

    const label = document.createElement('label');
    label.textContent = f.name;
    label.htmlFor = `${f.name}-${row.id ?? 'new'}`;

    let input;
    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.value = row[f.name] ?? '';
    } else if (f.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!row[f.name];
    } else {
      input = document.createElement('input');
      input.type = f.type === 'number' ? 'number' : 'text';
      input.value = row[f.name] ?? '';
    }
    input.id = `${f.name}-${row.id ?? 'new'}`;
    input.dataset.field = f.name;
    input.dataset.type = f.type;

    if (f.type === 'checkbox') {
      wrap.append(input, label);
    } else {
      wrap.append(label, input);
    }
    card.appendChild(wrap);
  });

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'admin-btn admin-btn-primary';
  saveBtn.textContent = row.id ? 'Save' : 'Create';
  saveBtn.addEventListener('click', () => saveRow(card, row.id));
  actions.appendChild(saveBtn);

  if (row.id) {
    const delBtn = document.createElement('button');
    delBtn.className = 'admin-btn admin-btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteRow(row.id, card));
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);
  return card;
}

function collectBody(card) {
  const body = {};
  card.querySelectorAll('[data-field]').forEach((el) => {
    body[el.dataset.field] = fieldValueFromInput(el, el.dataset.type);
  });
  return body;
}

async function saveRow(card, id) {
  const body = collectBody(card);
  try {
    if (id) {
      body.id = id;
      await api(`/api/content/${currentTable}`, { method: 'PUT', body: JSON.stringify(body) });
      setStatus('Saved.');
    } else {
      await api(`/api/content/${currentTable}`, { method: 'POST', body: JSON.stringify(body) });
      setStatus('Created.');
      await loadTable(currentTable);
    }
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function deleteRow(id, card) {
  if (!confirm('Delete this row?')) return;
  try {
    await api(`/api/content/${currentTable}?id=${id}`, { method: 'DELETE' });
    card.remove();
    setStatus('Deleted.');
  } catch (err) {
    setStatus(err.message, true);
  }
}

function emptyRowTemplate() {
  const row = { id: null };
  TABLE_FIELDS[currentTable].forEach((f) => { row[f.name] = f.type === 'checkbox' ? 0 : ''; });
  return row;
}

async function loadTable(table) {
  currentTable = table;
  rowsContainer.innerHTML = '';
  try {
    const { data } = await api(`/api/content/${table}`);
    data.forEach((row) => rowsContainer.appendChild(renderRow(row)));
  } catch (err) {
    setStatus(err.message, true);
  }
}

document.getElementById('admin-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.admin-tab');
  if (!btn) return;
  document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  loadTable(btn.dataset.table);
});

document.getElementById('add-row-btn').addEventListener('click', () => {
  rowsContainer.prepend(renderRow(emptyRowTemplate()));
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

loadTable(currentTable);
