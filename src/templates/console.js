/**
 * Port of admin-console-concept.html, rewired to call the real Worker API
 * routes instead of mutating an in-memory mock array. Server-rendered
 * shell + initial dossier data injected as JSON (so the bulk grid paints
 * immediately without a client-side fetch round-trip); all edits/uploads/
 * import-export go through fetch() calls to /api/* from here on.
 *
 * No localStorage/sessionStorage anywhere in this file, per the hard
 * constraint in SCAFFOLD_PROMPT.md — GM identity comes from the
 * Cf-Access-Authenticated-User-Email header (server-injected below, read
 * once at render time), nothing persisted client-side across reloads.
 */
export function renderConsolePage({ dossiers, gmEmail }) {
  const initialData = JSON.stringify(dossiers).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>// CAMPAIGNS :: DOSSIER CONSOLE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>${CONSOLE_CSS}</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="brand"><span class="dot"></span>DOSSIER CONSOLE</div>
    <div class="navgroup">
      <div class="label">VIEWS</div>
      <div class="navitem active" data-view="bulk">Bulk Editor <span class="n" id="countTag">0</span></div>
      <div class="navitem" data-view="single" id="navSingle" style="display:none;">Editing Dossier</div>
    </div>
    <div class="navgroup">
      <div class="label">SESSION</div>
      <div class="navitem" style="color:var(--text-dim); cursor:default;">GM: ${escapeHtml(gmEmail)}</div>
    </div>
    <button id="themeToggle">TOGGLE THEME</button>
  </aside>

  <main class="main">
    <div class="topbar">
      <h1 id="viewTitle">Bulk Dossier Editor</h1>
      <div class="toolbar">
        <button class="btn" id="exportXml">Export XML</button>
        <button class="btn" id="importXmlBtn">Import XML</button>
        <input type="file" id="importXml" accept=".xml">
        <button class="btn" id="exportCsv">Export Objectives CSV</button>
        <button class="btn" id="importCsvBtn">Import Objectives CSV</button>
        <input type="file" id="importCsv" accept=".csv">
      </div>
    </div>

    <div class="status" id="statusLine">Ready.</div>

    <div id="bulkView">
      <table>
        <thead>
          <tr><th>Code</th><th>Title</th><th>Location</th><th>Objectives</th><th></th></tr>
        </thead>
        <tbody id="gridBody"></tbody>
      </table>
    </div>

    <div class="editor" id="editorPanel">
      <h2 id="editorTitle">DOSSIER — DETAIL</h2>
      <div class="field">
        <label>Title</label>
        <div contenteditable="true" data-bind="title"></div>
      </div>
      <div class="field">
        <label>Location</label>
        <div contenteditable="true" data-bind="location"></div>
      </div>
      <div class="field">
        <label>Overview</label>
        <div contenteditable="true" data-bind="overview" style="min-height:80px;"></div>
      </div>
      <div class="field">
        <label>Hero Image (max 500KB — auto-downscaled/recompressed to WebP before upload)</label>
        <div class="imgfield">
          <div class="thumb" id="thumbPreview">NONE</div>
          <input type="file" id="imageInput" accept="image/*" style="display:none;">
          <button class="btn" id="uploadImageBtn">Upload Image</button>
          <span class="sizewarn" id="sizeWarn"></span>
        </div>
      </div>
      <div class="savebar">
        <button class="btn primary" id="closeEditor">← Back to Grid</button>
        <span class="savedflag" id="savedFlag">✓ Saved</span>
      </div>
    </div>
  </main>
</div>

<script>
  const INITIAL_DOSSIERS = ${initialData};
  ${CONSOLE_JS}
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CONSOLE_CSS = `
  :root{--bg:#050708; --panel:#0b1211f0; --panel-2:#0e1a17; --line:rgba(23,233,160,.18); --line-strong:rgba(23,233,160,.4);
    --emerald:#17e9a0; --pink:#ff4fae; --text:#dfeee9; --text-dim:#7f948d; --text-faint:#4c5b56; --warn:#ffb84f; --danger:#ff4f6a;
    --font-display:'Space Grotesk',sans-serif; --font-body:'Inter',sans-serif; --font-mono:'JetBrains Mono',monospace;}
  html[data-theme="light"]{--bg:#efe6d2; --panel:#f7f1e2f0; --panel-2:#f0e8d3; --line:rgba(13,122,86,.25); --line-strong:rgba(13,122,86,.55);
    --emerald:#0d8f63; --pink:#c22e83; --text:#231f18; --text-dim:#5c5340; --text-faint:#8c8065; --warn:#a5730c; --danger:#c23a4e;}
  *{box-sizing:border-box; margin:0; padding:0;}
  body{background:var(--bg); color:var(--text); font-family:var(--font-body); min-height:100vh;}
  .app{display:grid; grid-template-columns:220px 1fr; min-height:100vh;}
  @media(max-width:820px){.app{grid-template-columns:1fr;}}
  .side{background:var(--panel-2); border-right:1px solid var(--line); padding:20px 14px; display:flex; flex-direction:column; gap:18px;}
  .brand{font-family:var(--font-display); font-size:.85rem; letter-spacing:2px; color:var(--emerald); display:flex; align-items:center; gap:8px;}
  .brand .dot{width:8px; height:8px; border-radius:50%; background:var(--pink); box-shadow:0 0 8px var(--pink);}
  .navgroup .label{font-family:var(--font-mono); font-size:9.5px; letter-spacing:2px; color:var(--text-faint); margin:14px 0 8px;}
  .navitem{display:flex; align-items:center; justify-content:space-between; font-family:var(--font-mono); font-size:11px; letter-spacing:1px; padding:9px 10px; color:var(--text-dim); cursor:pointer; border-left:2px solid transparent;}
  .navitem.active{color:var(--emerald); border-left-color:var(--emerald); background:var(--panel);}
  .navitem .n{font-size:9px; color:var(--text-faint); border:1px solid var(--line); padding:1px 6px;}
  #themeToggle{margin-top:auto; font-family:var(--font-mono); font-size:10px; letter-spacing:1px; background:var(--panel); border:1px solid var(--line); color:var(--text-dim); padding:9px; cursor:pointer;}
  .main{padding:22px 26px 60px;}
  .topbar{display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:20px;}
  .topbar h1{font-family:var(--font-display); font-size:1.1rem; letter-spacing:2px; text-transform:uppercase;}
  .toolbar{display:flex; gap:8px; flex-wrap:wrap;}
  .btn{font-family:var(--font-mono); font-size:10px; letter-spacing:1.5px; padding:9px 14px; border:1px solid var(--line-strong); background:var(--panel); color:var(--text-dim); cursor:pointer;}
  .btn:hover{border-color:var(--emerald); color:var(--emerald);}
  .btn.primary{border-color:var(--pink); color:var(--pink);}
  input[type=file]{display:none;}
  .status{font-family:var(--font-mono); font-size:10px; color:var(--text-dim); margin-bottom:14px; min-height:16px;}
  .status.ok{color:var(--emerald);}
  .status.err{color:var(--danger);}
  table{width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line);}
  thead th{text-align:left; font-family:var(--font-mono); font-size:9.5px; letter-spacing:1.5px; color:var(--text-faint); padding:10px 12px; border-bottom:1px solid var(--line-strong); background:var(--panel-2); position:sticky; top:0;}
  tbody td{padding:9px 12px; border-bottom:1px solid var(--line); font-size:.85rem; color:var(--text);}
  tbody tr:hover{background:var(--panel-2);}
  td[contenteditable="true"]{cursor:text; outline:none;}
  td[contenteditable="true"]:focus{background:rgba(255,79,174,.08); box-shadow:inset 0 0 0 1px var(--pink);}
  .rowbtn{font-family:var(--font-mono); font-size:9px; color:var(--text-dim); border:1px solid var(--line); background:none; padding:4px 8px; cursor:pointer;}
  .editor{display:none; background:var(--panel); border:1px solid var(--line-strong); margin-top:18px; padding:22px;}
  .editor.open{display:block;}
  .editor h2{font-family:var(--font-display); font-size:1rem; letter-spacing:2px; margin-bottom:16px; color:var(--emerald);}
  .field{margin-bottom:16px;}
  .field label{display:block; font-family:var(--font-mono); font-size:9.5px; letter-spacing:1.5px; color:var(--text-faint); margin-bottom:6px;}
  .field [contenteditable="true"]{background:var(--panel-2); border:1px solid var(--line); padding:10px 12px; font-size:.92rem; line-height:1.6; outline:none;}
  .field [contenteditable="true"]:focus{border-color:var(--pink); box-shadow:0 0 0 1px var(--pink);}
  .savebar{display:flex; align-items:center; gap:10px; margin-top:10px;}
  .savebar .savedflag{font-family:var(--font-mono); font-size:9.5px; color:var(--emerald); opacity:0; transition:.3s;}
  .savebar .savedflag.show{opacity:1;}
  .imgfield{display:flex; align-items:center; gap:12px;}
  .imgfield .thumb{width:60px; height:60px; background:var(--panel-2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:.65rem; color:var(--text-faint); flex-shrink:0; overflow:hidden;}
  .imgfield .thumb img{width:100%; height:100%; object-fit:cover;}
  .imgfield .sizewarn{font-family:var(--font-mono); font-size:9px; color:var(--danger);}
`;

const CONSOLE_JS = `
  let dossiers = INITIAL_DOSSIERS;
  let activeId = null;

  const gridBody = document.getElementById('gridBody');
  const countTag = document.getElementById('countTag');
  const statusLine = document.getElementById('statusLine');

  function flashStatus(msg, cls){
    statusLine.textContent = msg;
    statusLine.className = 'status ' + (cls||'');
  }

  function renderGrid(){
    gridBody.innerHTML = '';
    dossiers.forEach(d=>{
      const done = (d.objectives||[]).filter(o=>o.status==='done').length;
      const total = (d.objectives||[]).length;
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${d.code||''}</td>
        <td contenteditable="true" data-id="\${d._id}" data-field="title">\${d.title||''}</td>
        <td contenteditable="true" data-id="\${d._id}" data-field="location">\${d.location||''}</td>
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${done} / \${total} done</td>
        <td><button class="rowbtn" data-open="\${d._id}">OPEN →</button></td>
      \`;
      gridBody.appendChild(tr);
    });
    countTag.textContent = dossiers.length;
    gridBody.querySelectorAll('td[contenteditable]').forEach(td=>{
      td.addEventListener('blur', ()=> patchField(td.dataset.id, td.dataset.field, td.textContent.trim()));
    });
    gridBody.querySelectorAll('[data-open]').forEach(btn=>{
      btn.addEventListener('click', ()=>openEditor(btn.dataset.open));
    });
  }

  async function patchField(id, field, value){
    try{
      const res = await fetch('/api/dossier/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ field, value }),
      });
      if(!res.ok) throw new Error((await res.json()).error || res.statusText);
      const d = dossiers.find(x=>x._id===id);
      if(d) d[field] = value;
      flashStatus('Saved ' + field + ' → ' + id, 'ok');
    }catch(err){
      flashStatus('Save failed: ' + err.message, 'err');
    }
  }

  // ---------- SINGLE EDITOR ----------
  const editorPanel = document.getElementById('editorPanel');
  const navSingle = document.getElementById('navSingle');
  const viewTitle = document.getElementById('viewTitle');
  const thumbPreview = document.getElementById('thumbPreview');

  function openEditor(id){
    activeId = id;
    const d = dossiers.find(x=>x._id===id);
    document.getElementById('editorTitle').textContent = (d.code||d._id) + ' — DETAIL';
    document.querySelector('[data-bind="title"]').textContent = d.title||'';
    document.querySelector('[data-bind="location"]').textContent = d.location||'';
    document.querySelector('[data-bind="overview"]').textContent = d.overview||'';
    thumbPreview.textContent = d.heroImage ? 'SET' : 'NONE';
    editorPanel.classList.add('open');
    navSingle.style.display = 'flex';
    navSingle.textContent = 'Editing: ' + (d.code||d._id);
    viewTitle.textContent = 'Dossier Detail';
    document.querySelectorAll('.navitem').forEach(n=>n.classList.remove('active'));
    navSingle.classList.add('active');
  }
  document.getElementById('closeEditor').addEventListener('click', ()=>{
    editorPanel.classList.remove('open');
    navSingle.style.display = 'none';
    viewTitle.textContent = 'Bulk Dossier Editor';
    document.querySelector('[data-view="bulk"]').classList.add('active');
  });
  document.querySelectorAll('.editor [contenteditable]').forEach(el=>{
    el.addEventListener('blur', async ()=>{
      if(!activeId) return;
      await patchField(activeId, el.dataset.bind, el.textContent.trim());
      const flag = document.getElementById('savedFlag');
      flag.classList.add('show');
      setTimeout(()=>flag.classList.remove('show'), 1600);
      renderGrid();
    });
  });

  // ---------- IMAGE UPLOAD (client-side downscale + WebP recompress to <500KB) ----------
  const MAX_BYTES = 500 * 1024;
  const MAX_EDGE = 1920;

  async function downscaleToWebp(file){
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.9;
    let blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    while(blob.size > MAX_BYTES && quality > 0.1){
      quality -= 0.1;
      blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    }
    return blob;
  }

  document.getElementById('uploadImageBtn').addEventListener('click', ()=> document.getElementById('imageInput').click());
  document.getElementById('imageInput').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file || !activeId) return;
    const sizeWarn = document.getElementById('sizeWarn');
    sizeWarn.textContent = 'Processing…';
    try{
      const webp = await downscaleToWebp(file);
      if(webp.size > MAX_BYTES){
        sizeWarn.textContent = 'Still over 500KB after max downscale — try a smaller source image.';
        return;
      }
      const form = new FormData();
      form.append('file', webp, 'upload.webp');
      form.append('kind', 'image');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const body = await res.json();
      if(!res.ok) throw new Error(body.error || res.statusText);
      await patchField(activeId, 'heroImage', { _type: 'image', asset: { _type: 'reference', _ref: body.asset._id } });
      thumbPreview.textContent = 'SET';
      sizeWarn.textContent = '✓ Uploaded (' + Math.round(webp.size/1024) + 'KB)';
    }catch(err){
      sizeWarn.textContent = 'Upload failed: ' + err.message;
    }
    e.target.value = '';
  });

  // ---------- THEME ----------
  document.getElementById('themeToggle').addEventListener('click', ()=>{
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme')==='light' ? 'dark' : 'light');
  });

  // ---------- XML EXPORT / IMPORT ----------
  document.getElementById('exportXml').addEventListener('click', async ()=>{
    window.location.href = '/api/export.xml';
  });
  document.getElementById('importXmlBtn').addEventListener('click', ()=> document.getElementById('importXml').click());
  document.getElementById('importXml').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    try{
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import', { method:'POST', body: form });
      const body = await res.json();
      if(!res.ok) throw new Error(body.error || res.statusText);
      flashStatus(\`Imported \${body.imported} dossiers (\${body.created} created, \${body.updated} updated\${body.failed?', ' + body.failed + ' failed':''}).\`, body.failed ? 'err' : 'ok');
      window.location.reload();
    }catch(err){ flashStatus('XML import failed: ' + err.message, 'err'); }
    e.target.value = '';
  });

  // ---------- CSV EXPORT / IMPORT (objectives) ----------
  document.getElementById('exportCsv').addEventListener('click', ()=>{
    window.location.href = '/api/export.csv?collection=objectives';
  });
  document.getElementById('importCsvBtn').addEventListener('click', ()=> document.getElementById('importCsv').click());
  document.getElementById('importCsv').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    try{
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import/csv?collection=objectives', { method:'POST', body: form });
      const body = await res.json();
      if(!res.ok) throw new Error(body.error || res.statusText);
      flashStatus(\`Bulk-updated \${body.updatedDossiers} dossiers' objectives from CSV.\`, 'ok');
      window.location.reload();
    }catch(err){ flashStatus('CSV import failed: ' + err.message, 'err'); }
    e.target.value = '';
  });

  renderGrid();
`;
