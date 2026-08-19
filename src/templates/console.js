/**
 * Port of admin-console-concept.html, rewired to call the real Worker API
 * routes instead of mutating an in-memory mock array. Server-rendered
 * shell + initial campaign/dossier/genreTheme data injected as JSON (so
 * every view paints immediately without a client-side fetch round-trip);
 * all edits/creates/uploads/import-export go through fetch() calls to
 * /api/* from here on.
 *
 * No localStorage/sessionStorage anywhere in this file, per the hard
 * constraint in SCAFFOLD_PROMPT.md — GM identity comes from the
 * Cf-Access-Authenticated-User-Email header (server-injected below, read
 * once at render time), nothing persisted client-side across reloads.
 *
 * campaigns/dossiers are already scoped server-side to this GM's own
 * campaigns (ownerEmail == gmEmail) — see src/routes/console.js. Every
 * write the client makes is re-checked against that ownership server-side
 * too (api-campaign.js / api-dossier.js) — client-side scoping here is a
 * UX convenience, not the security boundary.
 */
export function renderConsolePage({ campaigns, dossiers, genreThemes, gmEmail, sanityProjectId, sanityDataset }) {
  const initialCampaigns = JSON.stringify(campaigns).replace(/</g, "\\u003c");
  const initialDossiers = JSON.stringify(dossiers).replace(/</g, "\\u003c");
  const initialThemes = JSON.stringify(genreThemes).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Criticals and Fumbles Campaign Log</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>${CONSOLE_CSS}</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="brand"><span class="dot"></span>Criticals and Fumbles Campaign Log</div>
    <div class="navgroup">
      <div class="label">CAMPAIGNS</div>
      <div class="navitem" data-view="createCampaign">+ Create New Campaign</div>
      <div class="navitem sub" data-view="createDossier">+ Create Session / Dossier</div>
      <div class="navitem" data-view="campaigns">My Campaigns <span class="n" id="campaignCountTag">0</span></div>
    </div>
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
      <div class="toolbar" id="bulkToolbar">
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
          <tr><th>Code</th><th>Title</th><th>Campaign</th><th>Location</th><th>Objectives</th><th></th></tr>
        </thead>
        <tbody id="gridBody"></tbody>
      </table>
    </div>

    <div id="campaignsView" style="display:none;">
      <table>
        <thead>
          <tr><th>Title</th><th>Genre</th><th>Status</th><th>Visible</th><th>Sessions</th><th></th></tr>
        </thead>
        <tbody id="campaignGridBody"></tbody>
      </table>
    </div>

    <div id="campaignSessionsView" style="display:none;">
      <a class="back-link" href="#" id="csvBack">&larr; My Campaigns</a>
      <h2 id="csvHeading" style="font-family:var(--font-display); letter-spacing:2px; margin:10px 0 16px; color:var(--emerald);"></h2>
      <table>
        <thead>
          <tr><th>Code</th><th>Title</th><th>Location</th><th>Objectives</th><th></th></tr>
        </thead>
        <tbody id="campaignSessionsBody"></tbody>
      </table>
    </div>

    <div class="editor" id="editCampaignView">
      <h2>EDIT CAMPAIGN</h2>
      <div class="field"><label>Title *</label><input type="text" id="ecTitle"></div>
      <div class="field"><label>Genre * (matches a Genre Theme below)</label><input type="text" id="ecGenre"></div>
      <div class="field"><label>System</label><input type="text" id="ecSystem"></div>
      <div class="field">
        <label>Status</label>
        <select id="ecStatus">
          <option value="active">Active</option>
          <option value="recruiting">Recruiting</option>
          <option value="hiatus">Hiatus</option>
          <option value="concluded">Concluded</option>
        </select>
      </div>
      <div class="field">
        <label>Genre Theme *</label>
        <select id="ecTheme"></select>
      </div>
      <div class="field"><label>GM Name(s) (comma-separated)</label><input type="text" id="ecGmNames"></div>
      <div class="field"><label>Hook (directory card blurb)</label><textarea id="ecHook" rows="2"></textarea></div>
      <div class="field"><label>Motto</label><input type="text" id="ecMotto"></div>
      <div class="field"><label>Sign-Off</label><input type="text" id="ecSignOff"></div>
      ${heroImageFieldBlock("ec")}
      <div class="field">
        <label class="checkline"><input type="checkbox" id="ecVisible"> Visible on the public campaign directory</label>
      </div>
      <div class="savebar">
        <button class="btn primary" id="ecSave">Save Campaign</button>
        <button class="btn" id="ecCancel">← Back</button>
        <span class="savedflag" id="ecFlag"></span>
      </div>
    </div>

    <div class="editor" id="createCampaignView">
      <h2>NEW CAMPAIGN</h2>
      <div class="field"><label>Title *</label><input type="text" id="ccTitle" placeholder="e.g. Bureau Noir: Dawn Protocol"></div>
      <div class="field"><label>Genre * (matches a Genre Theme below)</label><input type="text" id="ccGenre" placeholder="e.g. Sci-Fi, Fantasy, Horror, Modern"></div>
      <div class="field"><label>System</label><input type="text" id="ccSystem" placeholder="e.g. D&D 5e, Call of Cthulhu 7e"></div>
      <div class="field">
        <label>Status</label>
        <select id="ccStatus">
          <option value="active">Active</option>
          <option value="recruiting">Recruiting</option>
          <option value="hiatus">Hiatus</option>
          <option value="concluded">Concluded</option>
        </select>
      </div>
      <div class="field">
        <label>Genre Theme *</label>
        <select id="ccTheme"></select>
      </div>
      <div class="field"><label>GM Name(s) (comma-separated)</label><input type="text" id="ccGmNames" placeholder="e.g. Alex, Sam"></div>
      <div class="field"><label>Hook (directory card blurb)</label><textarea id="ccHook" rows="2"></textarea></div>
      <div class="field"><label>Motto</label><input type="text" id="ccMotto"></div>
      <div class="field"><label>Sign-Off</label><input type="text" id="ccSignOff"></div>
      ${heroImageFieldBlock("cc")}
      <div class="field">
        <label class="checkline"><input type="checkbox" id="ccVisible"> Publish immediately (visible on the public campaign directory)</label>
      </div>
      <div class="savebar">
        <button class="btn primary" id="ccSubmit">Create Campaign</button>
        <span class="savedflag" id="ccFlag"></span>
      </div>
      <p class="hint">Leave "Publish immediately" unchecked to build the campaign out first — you can publish it anytime from "My Campaigns".</p>
    </div>

    <div class="editor" id="createDossierView">
      <h2>NEW SESSION / DOSSIER</h2>
      <div class="field">
        <label>Campaign *</label>
        <select id="cdCampaign"></select>
      </div>
      <div class="field"><label>Code *</label><input type="text" id="cdCode" placeholder="e.g. BN-DAWN-119-08"></div>
      <div class="field"><label>Title *</label><input type="text" id="cdTitle"></div>
      ${dossierFieldsBlock("cd")}
      <div class="savebar">
        <button class="btn primary" id="cdSubmit">Create Dossier</button>
        <span class="savedflag" id="cdFlag"></span>
      </div>
    </div>

    <div class="editor" id="editorPanel">
      <h2 id="editorTitle">DOSSIER — DETAIL</h2>
      <div class="field"><label>Code</label><input type="text" id="edCode" readonly></div>
      <div class="field"><label>Campaign</label><input type="text" id="edCampaignTitle" readonly></div>
      <div class="field"><label>Title *</label><input type="text" id="edTitle"></div>
      ${dossierFieldsBlock("ed")}
      <div class="savebar">
        <button class="btn primary" id="edSave">Save Session</button>
        <button class="btn" id="closeEditor">← Back</button>
        <span class="savedflag" id="savedFlag">✓ Saved</span>
      </div>
    </div>
  </main>
</div>

<datalist id="quickFactSuggestions">
  <option value="STATUS"><option value="THREAT LEVEL"><option value="FACTION">
  <option value="OBJECTIVE COUNT"><option value="RESOURCES"><option value="MORALE">
</datalist>
<datalist id="locationFactSuggestions">
  <option value="REGION"><option value="POPULATION"><option value="GOVERNANCE">
  <option value="CLIMATE"><option value="NOTABLE NPCS"><option value="DEFENSES">
</datalist>

<script>
  const INITIAL_CAMPAIGNS = ${initialCampaigns};
  const INITIAL_DOSSIERS = ${initialDossiers};
  const INITIAL_THEMES = ${initialThemes};
  const SANITY_PROJECT_ID = ${JSON.stringify(sanityProjectId || "")};
  const SANITY_DATASET = ${JSON.stringify(sanityDataset || "")};
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

/**
 * Shared HTML for every dossier field beyond campaign/code (identical in
 * shape between the Create Dossier form and the single-dossier editor —
 * see schema/dossier.js for the authoritative field list). Rendered
 * server-side at page-render time (this is a real function call producing
 * a string, not part of the browser-side CONSOLE_JS blob below), keeping
 * the two forms from drifting apart the way they briefly did before this
 * was factored out. `prefix` becomes each element's id prefix (`cd` for
 * create, `ed` for edit) so client-side JS can address either form
 * generically.
 */
// Shared by every form with a hero image (campaign create/edit, dossier
// create/edit) — one upload/preview/replace widget, `prefix`-addressed so
// wireImageUpload() (client-side) can hook up any of them generically.
function heroImageFieldBlock(prefix) {
  return `
      <div class="field">
        <label>Hero Image (max 500KB — auto-downscaled/recompressed to WebP before upload)</label>
        <div class="imgfield">
          <div class="thumb" id="${prefix}ThumbPreview">NONE</div>
          <input type="file" id="${prefix}ImageInput" accept="image/*" style="display:none;">
          <button type="button" class="btn" id="${prefix}UploadImageBtn">Upload Image</button>
          <span class="sizewarn" id="${prefix}SizeWarn"></span>
        </div>
      </div>
  `;
}

// Tip copy sits above each label, not below — a DM reads "what goes
// here" before they start typing, not as an afterthought once the field
// is already open. Quick Facts/Location Facts/Stat Tiles/Threat
// Assessment text is verbatim from a direct request; the rest (session
// metadata + Objectives/Log) follows the same "prompt with examples"
// shape for consistency across every repeater/field a DM has to fill in.
function dossierFieldsBlock(prefix) {
  return `
      <div class="field">
        <p class="field-tip">What's this session's overall classification/sensitivity? e.g. TOP SECRET, RESTRICTED, Party Eyes Only.</p>
        <label>Classification</label>
        <input type="text" id="${prefix}Classification" placeholder="e.g. TOP SECRET">
      </div>
      <div class="field">
        <p class="field-tip">Who's this dossier actually for? e.g. PLAYER-FACING, GM Only, Survivor Cell Only.</p>
        <label>Distribution</label>
        <input type="text" id="${prefix}Distribution" placeholder="e.g. PLAYER-FACING">
      </div>
      <div class="field">
        <p class="field-tip">However your table tracks sessions — a number, an in-world date, whatever the players would recognize.</p>
        <label>Session Label</label>
        <input type="text" id="${prefix}SessionLabel" placeholder="e.g. 8, Day 41">
      </div>
      <div class="field"><label>Location</label><input type="text" id="${prefix}Location"></div>
      <div class="field">
        <p class="field-tip">The main recap — what actually happened this session, in a paragraph or two. This is what most players will read first.</p>
        <label>Overview</label>
        <textarea id="${prefix}Overview" rows="3"></textarea>
      </div>
      ${heroImageFieldBlock(prefix)}
      <div class="field">
        <p class="field-tip">Any highlights of this session? Loot, Key Moments, Implications, Aftermath facts, etc.</p>
        <label>Quick Facts</label>
        <div class="repeater" id="${prefix}QuickFacts"></div>
        <button type="button" class="btn small" data-add-row="${prefix}QuickFacts:factRow">+ Add Fact</button>
      </div>
      <div class="field">
        <p class="field-tip">In-world items, places, people, things — whatever's tied to this session's location specifically.</p>
        <label>Location Facts</label>
        <div class="repeater" id="${prefix}LocationFacts"></div>
        <button type="button" class="btn small" data-add-row="${prefix}LocationFacts:factRow">+ Add Fact</button>
      </div>
      <div class="field">
        <p class="field-tip">World conditions or news affecting this location. Complications, city feel, news, political or trade tensions or conflicts.</p>
        <label>Stat Tiles</label>
        <div class="repeater" id="${prefix}StatTiles"></div>
        <button type="button" class="btn small" data-add-row="${prefix}StatTiles:statTile">+ Add Tile</button>
      </div>
      <div class="field">
        <p class="field-tip">Risks that are pertinent to this session, scored from Low to Very High.</p>
        <label>Threat Assessment</label>
        <div class="repeater" id="${prefix}ThreatAssessment"></div>
        <button type="button" class="btn small" data-add-row="${prefix}ThreatAssessment:meterRow">+ Add Row</button>
      </div>
      <div class="field">
        <p class="field-tip">What is the party actively trying to achieve? Mark each Open or Done, and rank by priority so players see what matters most right now.</p>
        <label>Objectives</label>
        <div class="repeater" id="${prefix}Objectives"></div>
        <button type="button" class="btn small" data-add-row="${prefix}Objectives:objective">+ Add Objective</button>
      </div>
      <div class="field">
        <p class="field-tip">A running record of what happened, in order — session log entries build up the campaign's timeline session over session.</p>
        <label>Log</label>
        <div class="repeater" id="${prefix}Log"></div>
        <button type="button" class="btn small" data-add-row="${prefix}Log:logEntry">+ Add Entry</button>
      </div>
      <p class="hint">Media gallery items (image/audio/video) aren't in this form yet — add those directly in Sanity Studio.</p>
  `;
}

const CONSOLE_CSS = `
  /* Same palette/fonts as the main criticalsandfumbles.com site (see its
     docs/design-system.md) — the console is an admin tool on the main
     site's visual language, NOT genre-themed. Genre theming
     (theme.js/themeToCssVars) is scoped to dossier pages and each
     campaign's session-index page only — never here, never the public
     directory. Variable names kept as-is (--pink etc.) to minimize diff
     against the rest of this file; only the color VALUES and fonts
     changed to match the main site's tokens. */
  :root{--bg:#111111; --panel:#1a1a1a; --panel-2:#151515; --line:rgba(46,197,107,.18); --line-strong:rgba(46,197,107,.4);
    --emerald:#2ec56b; --pink:#d946a8; --text:#f0eae0; --text-dim:#a39a8e; --text-faint:#666666; --warn:#c8893a; --danger:#c23a4e;
    --font-display:'Bebas Neue',sans-serif; --font-body:'Crimson Pro',serif; --font-mono:'Space Mono',monospace;}
  html[data-theme="light"]{--bg:#fbf0e0; --panel:#f0e8d8; --panel-2:#e8dcc4; --line:rgba(26,122,69,.25); --line-strong:rgba(26,122,69,.55);
    --emerald:#1a7a45; --pink:#c4306a; --text:#1a1208; --text-dim:#6b6045; --text-faint:#8a7055; --warn:#b36a1a; --danger:#c23a4e;}
  *{box-sizing:border-box; margin:0; padding:0;}
  body{background:var(--bg); color:var(--text); font-family:var(--font-body); min-height:100vh;}
  .app{display:grid; grid-template-columns:220px 1fr; min-height:100vh;}
  @media(max-width:820px){.app{grid-template-columns:1fr;}}
  .side{background:var(--panel-2); border-right:1px solid var(--line); padding:20px 14px; display:flex; flex-direction:column; gap:18px;}
  .brand{font-family:var(--font-display); font-size:1rem; line-height:1.3; letter-spacing:.5px; color:var(--emerald); display:flex; align-items:flex-start; gap:8px;}
  .brand .dot{margin-top:6px; flex-shrink:0;}
  .brand .dot{width:8px; height:8px; border-radius:50%; background:var(--pink); box-shadow:0 0 8px var(--pink);}
  .navgroup .label{font-family:var(--font-mono); font-size:9.5px; letter-spacing:2px; color:var(--text-faint); margin:14px 0 8px;}
  .navitem{display:flex; align-items:center; justify-content:space-between; font-family:var(--font-mono); font-size:11px; letter-spacing:1px; padding:9px 10px; color:var(--text-dim); cursor:pointer; border-left:2px solid transparent;}
  .navitem.sub{padding-left:22px; font-size:10px;}
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
  .field-tip{font-family:var(--font-body); font-size:.82rem; font-style:italic; color:var(--text-dim); margin:0 0 6px; line-height:1.4;}
  .field [contenteditable="true"]{background:var(--panel-2); border:1px solid var(--line); padding:10px 12px; font-size:.92rem; line-height:1.6; outline:none;}
  .field [contenteditable="true"]:focus{border-color:var(--pink); box-shadow:0 0 0 1px var(--pink);}
  .field input[type=text], .field select, .field textarea{width:100%; max-width:420px; background:var(--panel-2); border:1px solid var(--line); color:var(--text); padding:9px 12px; font-family:var(--font-body); font-size:.92rem; outline:none;}
  .field input[type=text]:focus, .field select:focus, .field textarea:focus{border-color:var(--pink); box-shadow:0 0 0 1px var(--pink);}
  .hint{font-family:var(--font-mono); font-size:9.5px; color:var(--text-faint); margin-top:14px;}
  .back-link{display:inline-block; font-family:var(--font-mono); font-size:10.5px; color:var(--text-dim); text-decoration:none; margin-bottom:6px;}
  .back-link:hover{color:var(--emerald);}
  .field input[readonly]{opacity:.55; cursor:not-allowed;}
  .checkline{display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:10.5px; letter-spacing:.5px; color:var(--text-dim); cursor:pointer;}
  .checkline input{width:14px; height:14px; accent-color:var(--emerald); cursor:pointer;}
  .repeater{display:flex; flex-direction:column; gap:8px; margin-bottom:8px;}
  .repeater-row{display:flex; gap:8px; align-items:flex-start; background:var(--panel-2); border:1px solid var(--line); padding:8px; flex-wrap:wrap;}
  .repeater-row input, .repeater-row select, .repeater-row textarea{flex:1; min-width:120px; background:var(--panel); border:1px solid var(--line); color:var(--text); padding:7px 9px; font-family:var(--font-body); font-size:.85rem; outline:none;}
  .repeater-row textarea{min-width:200px; flex-basis:100%;}
  .repeater-row .rm{flex:0 0 auto; font-family:var(--font-mono); font-size:9px; color:var(--danger); border:1px solid var(--line); background:none; padding:6px 9px; cursor:pointer; align-self:flex-start;}
  .btn.small{padding:6px 10px; font-size:9px;}
  .savebar{display:flex; align-items:center; gap:10px; margin-top:10px;}
  .savebar .savedflag{font-family:var(--font-mono); font-size:9.5px; color:var(--emerald); opacity:0; transition:.3s;}
  .savebar .savedflag.show{opacity:1;}
  .savebar .savedflag.err{color:var(--danger);}
  .imgfield{display:flex; align-items:center; gap:12px;}
  .imgfield .thumb{width:60px; height:60px; background:var(--panel-2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:.65rem; color:var(--text-faint); flex-shrink:0; overflow:hidden;}
  .imgfield .thumb img{width:100%; height:100%; object-fit:cover;}
  .imgfield .sizewarn{font-family:var(--font-mono); font-size:9px; color:var(--danger);}
  .toggle{position:relative; display:inline-block; width:36px; height:20px;}
  .toggle input{opacity:0; width:0; height:0;}
  .toggle .slider{position:absolute; inset:0; background:var(--panel-2); border:1px solid var(--line-strong); border-radius:20px; cursor:pointer; transition:.2s;}
  .toggle .slider:before{content:""; position:absolute; width:14px; height:14px; left:2px; top:2px; background:var(--text-dim); border-radius:50%; transition:.2s;}
  .toggle input:checked + .slider{border-color:var(--emerald);}
  .toggle input:checked + .slider:before{transform:translateX(16px); background:var(--emerald);}
`;

const CONSOLE_JS = `
  let campaigns = INITIAL_CAMPAIGNS;
  let dossiers = INITIAL_DOSSIERS;
  const themes = INITIAL_THEMES;
  let activeId = null;

  const gridBody = document.getElementById('gridBody');
  const campaignGridBody = document.getElementById('campaignGridBody');
  const countTag = document.getElementById('countTag');
  const campaignCountTag = document.getElementById('campaignCountTag');
  const statusLine = document.getElementById('statusLine');
  const viewTitle = document.getElementById('viewTitle');
  const bulkToolbar = document.getElementById('bulkToolbar');

  function flashStatus(msg, cls){
    statusLine.textContent = msg;
    statusLine.className = 'status ' + (cls||'');
  }

  function campaignTitleFor(id){
    const c = campaigns.find(x=>x._id===id);
    return c ? c.title : '(unknown)';
  }

  // ---------- VIEW SWITCHING ----------
  const VIEWS = {
    bulk: { panel: 'bulkView', title: 'Bulk Dossier Editor', toolbar: true },
    campaigns: { panel: 'campaignsView', title: 'My Campaigns', toolbar: false },
    campaignSessions: { panel: 'campaignSessionsView', title: 'Campaign Sessions', toolbar: false },
    createCampaign: { panel: 'createCampaignView', title: 'Create New Campaign', toolbar: false },
    createDossier: { panel: 'createDossierView', title: 'Create Session / Dossier', toolbar: false },
    editCampaign: { panel: 'editCampaignView', title: 'Edit Campaign', toolbar: false },
    single: { panel: 'editorPanel', title: 'Dossier Detail', toolbar: false },
  };

  // createCampaignView/createDossierView/editCampaignView/editorPanel all
  // share the .editor CSS class, which defaults to display:none and only
  // shows via the .open class (not inline style) — bulkView/campaignsView/
  // campaignSessionsView are plain divs toggled with inline style instead.
  // Mixing the two up here was the bug: setting style.display='' on an
  // .editor panel just falls back to its CSS default of none, since it
  // never gets .open added.
  const EDITOR_PANELS = new Set(['createCampaignView', 'createDossierView', 'editCampaignView', 'editorPanel']);

  function switchView(view){
    Object.values(VIEWS).forEach(v=>{
      const el = document.getElementById(v.panel);
      if(!el) return;
      if(EDITOR_PANELS.has(v.panel)) el.classList.remove('open');
      else el.style.display = 'none';
    });
    const target = VIEWS[view];
    const el = document.getElementById(target.panel);
    if(EDITOR_PANELS.has(target.panel)) el.classList.add('open');
    else el.style.display = '';
    viewTitle.textContent = target.title;
    bulkToolbar.style.display = target.toolbar ? '' : 'none';
    document.querySelectorAll('.navitem[data-view]').forEach(n=>n.classList.toggle('active', n.dataset.view===view));
    if(view === 'campaigns') renderCampaignGrid();
    if(view === 'createCampaign') populateThemeSelect();
    if(view === 'createDossier') populateCampaignSelect();
  }

  document.querySelectorAll('.navitem[data-view]').forEach(item=>{
    item.addEventListener('click', ()=> switchView(item.dataset.view));
  });

  // ---------- BULK DOSSIER GRID ----------
  function renderGrid(){
    gridBody.innerHTML = '';
    dossiers.forEach(d=>{
      const done = (d.objectives||[]).filter(o=>o.status==='done').length;
      const total = (d.objectives||[]).length;
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${d.code||''}</td>
        <td contenteditable="true" data-id="\${d._id}" data-field="title">\${d.title||''}</td>
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${campaignTitleFor(d.campaignId)}</td>
        <td contenteditable="true" data-id="\${d._id}" data-field="location">\${d.location||''}</td>
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${done} / \${total} done</td>
        <td><button class="rowbtn" data-open="\${d._id}">OPEN →</button></td>
      \`;
      gridBody.appendChild(tr);
    });
    countTag.textContent = dossiers.length;
    gridBody.querySelectorAll('td[contenteditable]').forEach(td=>{
      td.addEventListener('blur', ()=> patchDossierField(td.dataset.id, td.dataset.field, td.textContent.trim()));
    });
    gridBody.querySelectorAll('[data-open]').forEach(btn=>{
      btn.addEventListener('click', ()=>openEditor(btn.dataset.open));
    });
  }

  async function patchDossierField(id, field, value){
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

  // ---------- MY CAMPAIGNS (list + visible toggle) ----------
  function dossiersForCampaign(campaignId){
    return dossiers.filter(d=>d.campaignId===campaignId);
  }

  function renderCampaignGrid(){
    campaignGridBody.innerHTML = '';
    campaigns.forEach(cmp=>{
      const sessionCount = dossiersForCampaign(cmp._id).length;
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${cmp.title||''}</td>
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${cmp.genre||''}</td>
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${cmp.status||''}</td>
        <td>
          <label class="toggle">
            <input type="checkbox" data-id="\${cmp._id}" \${cmp.visible ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td><button class="rowbtn" data-sessions="\${cmp._id}">\${sessionCount} session\${sessionCount===1?'':'s'} →</button></td>
        <td><button class="rowbtn" data-edit-campaign="\${cmp._id}">Edit</button></td>
      \`;
      campaignGridBody.appendChild(tr);
    });
    campaignCountTag.textContent = campaigns.length;
    campaignGridBody.querySelectorAll('input[type=checkbox]').forEach(input=>{
      input.addEventListener('change', async ()=>{
        const id = input.dataset.id;
        const value = input.checked;
        try{
          const res = await fetch('/api/campaign/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: {'content-type':'application/json'},
            body: JSON.stringify({ field: 'visible', value }),
          });
          if(!res.ok) throw new Error((await res.json()).error || res.statusText);
          const cmp = campaigns.find(x=>x._id===id);
          if(cmp) cmp.visible = value;
          flashStatus((value ? 'Published' : 'Unpublished') + ' "' + campaignTitleFor(id) + '"', 'ok');
        }catch(err){
          input.checked = !value;
          flashStatus('Toggle failed: ' + err.message, 'err');
        }
      });
    });
    campaignGridBody.querySelectorAll('[data-sessions]').forEach(btn=>{
      btn.addEventListener('click', ()=> openCampaignSessions(btn.dataset.sessions));
    });
    campaignGridBody.querySelectorAll('[data-edit-campaign]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditCampaign(btn.dataset.editCampaign));
    });
  }

  // ---------- CAMPAIGN SESSIONS (list a single campaign's dossiers) ----------
  let activeCampaignId = null;
  const campaignSessionsBody = document.getElementById('campaignSessionsBody');

  function openCampaignSessions(campaignId){
    activeCampaignId = campaignId;
    document.getElementById('csvHeading').textContent = campaignTitleFor(campaignId);
    renderCampaignSessions();
    switchView('campaignSessions');
  }

  function renderCampaignSessions(){
    campaignSessionsBody.innerHTML = '';
    dossiersForCampaign(activeCampaignId).forEach(d=>{
      const done = (d.objectives||[]).filter(o=>o.status==='done').length;
      const total = (d.objectives||[]).length;
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${d.code||''}</td>
        <td>\${d.title||''}</td>
        <td>\${d.location||''}</td>
        <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-dim);">\${done} / \${total} done</td>
        <td><button class="rowbtn" data-open="\${d._id}">EDIT →</button></td>
      \`;
      campaignSessionsBody.appendChild(tr);
    });
    if(dossiersForCampaign(activeCampaignId).length === 0){
      campaignSessionsBody.innerHTML = '<tr><td colspan="5" style="opacity:.5;">No sessions in this campaign yet.</td></tr>';
    }
    campaignSessionsBody.querySelectorAll('[data-open]').forEach(btn=>{
      btn.addEventListener('click', ()=>openEditor(btn.dataset.open));
    });
  }

  document.getElementById('csvBack').addEventListener('click', (e)=>{ e.preventDefault(); switchView('campaigns'); });

  // ---------- EDIT CAMPAIGN ----------
  function openEditCampaign(id){
    const cmp = campaigns.find(x=>x._id===id);
    if(!cmp) return;
    activeCampaignEditId = id;
    populateThemeSelect('ecTheme');
    document.getElementById('ecTitle').value = cmp.title || '';
    document.getElementById('ecGenre').value = cmp.genre || '';
    document.getElementById('ecSystem').value = cmp.system || '';
    document.getElementById('ecStatus').value = cmp.status || 'active';
    document.getElementById('ecTheme').value = cmp.theme || '';
    document.getElementById('ecGmNames').value = (cmp.gmNames||[]).join(', ');
    document.getElementById('ecHook').value = cmp.hook || '';
    document.getElementById('ecMotto').value = cmp.motto || '';
    document.getElementById('ecSignOff').value = cmp.signOff || '';
    document.getElementById('ecVisible').checked = !!cmp.visible;
    renderExistingThumb('ec', cmp.heroImage);
    document.getElementById('ecSizeWarn').textContent = '';
    document.getElementById('ecFlag').className = 'savedflag';
    switchView('editCampaign');
  }

  let activeCampaignEditId = null;

  document.getElementById('ecCancel').addEventListener('click', ()=> switchView('campaigns'));

  document.getElementById('ecSave').addEventListener('click', async ()=>{
    const flag = document.getElementById('ecFlag');
    const id = activeCampaignEditId;
    const fields = {
      title: document.getElementById('ecTitle').value.trim(),
      genre: document.getElementById('ecGenre').value.trim(),
      system: document.getElementById('ecSystem').value.trim(),
      status: document.getElementById('ecStatus').value,
      theme: document.getElementById('ecTheme').value,
      gmNames: document.getElementById('ecGmNames').value.split(',').map(s=>s.trim()).filter(Boolean),
      hook: document.getElementById('ecHook').value.trim(),
      motto: document.getElementById('ecMotto').value.trim(),
      signOff: document.getElementById('ecSignOff').value.trim(),
      visible: document.getElementById('ecVisible').checked,
    };
    if(!fields.title || !fields.genre || !fields.theme){
      flag.textContent = 'Title, Genre, and Genre Theme are required.';
      flag.className = 'savedflag show err';
      return;
    }
    try{
      await Promise.all(Object.entries(fields).map(([field, value])=>
        fetch('/api/campaign/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: {'content-type':'application/json'},
          body: JSON.stringify({ field, value }),
        }).then(async res=>{
          if(!res.ok) throw new Error((await res.json()).error || res.statusText);
        })
      ));
      const cmp = campaigns.find(x=>x._id===id);
      if(cmp) Object.assign(cmp, fields);
      flag.textContent = '✓ Saved.';
      flag.className = 'savedflag show';
      setTimeout(()=>switchView('campaigns'), 700);
    }catch(err){
      flag.textContent = 'Failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  });

  // ---------- CREATE CAMPAIGN ----------
  function populateThemeSelect(selectId){
    const sel = document.getElementById(selectId || 'ccTheme');
    sel.innerHTML = themes.map(t=>
      \`<option value="\${t._id}">\${t.genre}\${t.campaignOverride ? ' (override)' : ''}</option>\`
    ).join('');
  }

  document.getElementById('ccSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('ccFlag');
    const body = {
      title: document.getElementById('ccTitle').value.trim(),
      genre: document.getElementById('ccGenre').value.trim(),
      system: document.getElementById('ccSystem').value.trim(),
      status: document.getElementById('ccStatus').value,
      theme: document.getElementById('ccTheme').value,
      gmNames: document.getElementById('ccGmNames').value.split(',').map(s=>s.trim()).filter(Boolean),
      hook: document.getElementById('ccHook').value.trim(),
      motto: document.getElementById('ccMotto').value.trim(),
      signOff: document.getElementById('ccSignOff').value.trim(),
      visible: document.getElementById('ccVisible').checked,
    };
    if(ccHeroImageAsset){
      body.heroImage = { _type: 'image', asset: { _type: 'reference', _ref: ccHeroImageAsset } };
    }
    if(!body.title || !body.genre || !body.theme){
      flag.textContent = 'Title, Genre, and Genre Theme are required.';
      flag.className = 'savedflag show err';
      return;
    }
    try{
      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      campaigns.push({ _id: result.id, title: body.title, genre: body.genre, status: body.status, visible: body.visible, heroImage: body.heroImage });
      flag.textContent = body.visible ? '✓ Created and published.' : '✓ Created — publish it from "My Campaigns" when ready.';
      flag.className = 'savedflag show';
      ['ccTitle','ccGenre','ccSystem','ccGmNames','ccHook','ccMotto','ccSignOff'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('ccVisible').checked = false;
      ccHeroImageAsset = null;
      renderExistingThumb('cc', null);
      document.getElementById('ccSizeWarn').textContent = '';
      setTimeout(()=>switchView('campaigns'), 900);
    }catch(err){
      flag.textContent = 'Failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  });

  // ---------- REPEATERS (dossier array fields: quickFacts, locationFacts,
  // statTiles, threatAssessment, objectives, log — see schema/dossier.js
  // for the authoritative object shapes each of these mirrors) ----------
  const REPEATER_SHAPES = {
    factRow: [
      { key: 'label', ph: 'Label' },
      { key: 'value', ph: 'Value' },
    ],
    statTile: [
      { key: 'value', ph: 'Value' },
      { key: 'label', ph: 'Label' },
    ],
    meterRow: [
      { key: 'label', ph: 'Label' },
      { key: 'level', ph: 'Level', type: 'select', options: ['low','medium','high','very-high'] },
    ],
    objective: [
      { key: 'title', ph: 'Title' },
      { key: 'description', ph: 'Description', type: 'textarea' },
      { key: 'priority', ph: 'Priority', type: 'select', options: ['primary','secondary','tertiary'] },
      { key: 'status', ph: 'Status', type: 'select', options: ['open','done'] },
    ],
    logEntry: [
      { key: 'ts', ph: 'Timestamp (e.g. Day 41, 22:04 IC)' },
      { key: 'entry', ph: 'Entry', type: 'textarea' },
    ],
  };

  // Suggested labels for the free-form kv boxes (quickFacts/locationFacts
  // both use the 'factRow' shape but mean different things — offered via
  // <datalist> so the field stays free text, just with a native-browser
  // autocomplete nudge instead of forcing a fixed list like the real
  // enum fields (status/priority/level) get.
  const KV_SUGGESTIONS = {
    QuickFacts: 'quickFactSuggestions',
    LocationFacts: 'locationFactSuggestions',
  };

  function addRepeaterRow(containerId, shapeName){
    const container = document.getElementById(containerId);
    const shape = REPEATER_SHAPES[shapeName];
    const suggestKey = Object.keys(KV_SUGGESTIONS).find(k=>containerId.endsWith(k));
    const listId = suggestKey ? KV_SUGGESTIONS[suggestKey] : null;
    const row = document.createElement('div');
    row.className = 'repeater-row';
    row.dataset.shape = shapeName;
    row.innerHTML = shape.map(f=>{
      if(f.type === 'textarea') return \`<textarea data-key="\${f.key}" placeholder="\${f.ph}" rows="2"></textarea>\`;
      if(f.type === 'select') return \`<select data-key="\${f.key}">\${f.options.map(o=>\`<option value="\${o}">\${o}</option>\`).join('')}</select>\`;
      const listAttr = (listId && f.key === 'label') ? \` list="\${listId}"\` : '';
      return \`<input type="text" data-key="\${f.key}" placeholder="\${f.ph}"\${listAttr}>\`;
    }).join('') + '<button type="button" class="rm">Remove</button>';
    row.querySelector('.rm').addEventListener('click', ()=> row.remove());
    container.appendChild(row);
  }

  function collectRepeaterRows(containerId){
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('.repeater-row')).map(row=>{
      const obj = { _key: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).slice(0, 12), _type: row.dataset.shape };
      row.querySelectorAll('[data-key]').forEach(input=>{ obj[input.dataset.key] = input.value.trim(); });
      return obj;
    }).filter(obj => Object.keys(obj).some(k => k !== '_key' && k !== '_type' && obj[k]));
  }

  function clearRepeater(containerId){
    document.getElementById(containerId).innerHTML = '';
  }

  document.querySelectorAll('[data-add-row]').forEach(btn=>{
    const [containerId, shapeName] = btn.dataset.addRow.split(':');
    btn.addEventListener('click', ()=> addRepeaterRow(containerId, shapeName));
  });

  // ---------- CREATE DOSSIER ----------
  function populateCampaignSelect(){
    const sel = document.getElementById('cdCampaign');
    if(campaigns.length === 0){
      sel.innerHTML = '<option value="">— Create a campaign first —</option>';
      return;
    }
    sel.innerHTML = campaigns.map(c=> \`<option value="\${c._id}">\${c.title}</option>\`).join('');
  }

  document.getElementById('cdSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('cdFlag');
    const body = {
      campaign: document.getElementById('cdCampaign').value,
      code: document.getElementById('cdCode').value.trim(),
      title: document.getElementById('cdTitle').value.trim(),
      classification: document.getElementById('cdClassification').value.trim(),
      distribution: document.getElementById('cdDistribution').value.trim(),
      sessionLabel: document.getElementById('cdSessionLabel').value.trim(),
      location: document.getElementById('cdLocation').value.trim(),
      overview: document.getElementById('cdOverview').value.trim(),
      quickFacts: collectRepeaterRows('cdQuickFacts'),
      locationFacts: collectRepeaterRows('cdLocationFacts'),
      statTiles: collectRepeaterRows('cdStatTiles'),
      threatAssessment: collectRepeaterRows('cdThreatAssessment'),
      objectives: collectRepeaterRows('cdObjectives'),
      log: collectRepeaterRows('cdLog'),
    };
    if(cdHeroImageAsset){
      body.heroImage = { _type: 'image', asset: { _type: 'reference', _ref: cdHeroImageAsset } };
    }
    if(!body.campaign || !body.code || !body.title){
      flag.textContent = 'Campaign, Code, and Title are required.';
      flag.className = 'savedflag show err';
      return;
    }
    try{
      const res = await fetch('/api/dossier', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      dossiers.unshift({ _id: result.id, code: body.code, title: body.title, location: body.location, overview: body.overview, heroImage: body.heroImage, objectives: body.objectives, campaignId: body.campaign });
      flag.textContent = '✓ Created.';
      flag.className = 'savedflag show';
      ['cdCode','cdTitle','cdClassification','cdDistribution','cdSessionLabel','cdLocation','cdOverview'].forEach(id=>document.getElementById(id).value='');
      ['cdQuickFacts','cdLocationFacts','cdStatTiles','cdThreatAssessment','cdObjectives','cdLog'].forEach(clearRepeater);
      cdHeroImageAsset = null;
      renderExistingThumb('cd', null);
      document.getElementById('cdSizeWarn').textContent = '';
      setTimeout(()=>switchView('bulk'), 900);
    }catch(err){
      flag.textContent = 'Failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  });

  // ---------- REPEATER PREFILL (edit mode — reverse of collectRepeaterRows) ----------
  function populateRepeater(containerId, shapeName, rows){
    clearRepeater(containerId);
    (rows||[]).forEach(row=>{
      addRepeaterRow(containerId, shapeName);
      const el = document.getElementById(containerId);
      const added = el.lastElementChild;
      added.querySelectorAll('[data-key]').forEach(input=>{
        if(row[input.dataset.key] !== undefined) input.value = row[input.dataset.key];
      });
    });
  }

  // Every dossier field this editor knows how to save, and which DOM
  // element/kind of value it maps to — used by both prefill (openEditor)
  // and save (edSave) so the two can never drift out of sync with each
  // other. Repeater fields use their REPEATER_SHAPES name as the "kind".
  const DOSSIER_FIELD_MAP = [
    { field: 'title', id: 'edTitle', kind: 'text' },
    { field: 'classification', id: 'edClassification', kind: 'text' },
    { field: 'distribution', id: 'edDistribution', kind: 'text' },
    { field: 'sessionLabel', id: 'edSessionLabel', kind: 'text' },
    { field: 'location', id: 'edLocation', kind: 'text' },
    { field: 'overview', id: 'edOverview', kind: 'text' },
    { field: 'quickFacts', id: 'edQuickFacts', kind: 'factRow' },
    { field: 'locationFacts', id: 'edLocationFacts', kind: 'factRow' },
    { field: 'statTiles', id: 'edStatTiles', kind: 'statTile' },
    { field: 'threatAssessment', id: 'edThreatAssessment', kind: 'meterRow' },
    { field: 'objectives', id: 'edObjectives', kind: 'objective' },
    { field: 'log', id: 'edLog', kind: 'logEntry' },
  ];

  // ---------- SINGLE EDITOR ----------
  const editorPanel = document.getElementById('editorPanel');
  const navSingle = document.getElementById('navSingle');

  function openEditor(id){
    activeId = id;
    const d = dossiers.find(x=>x._id===id);
    document.getElementById('editorTitle').textContent = (d.code||d._id) + ' — DETAIL';
    document.getElementById('edCode').value = d.code || '';
    document.getElementById('edCampaignTitle').value = campaignTitleFor(d.campaignId);
    DOSSIER_FIELD_MAP.forEach(({ field, id, kind })=>{
      if(kind === 'text'){
        document.getElementById(id).value = d[field] || '';
      } else {
        populateRepeater(id, kind, d[field]);
      }
    });
    renderExistingThumb('ed', d.heroImage);
    document.getElementById('edSizeWarn').textContent = '';
    navSingle.style.display = 'flex';
    navSingle.textContent = 'Editing: ' + (d.code||d._id);
    switchView('single');
  }
  document.getElementById('closeEditor').addEventListener('click', ()=>{
    navSingle.style.display = 'none';
    switchView('bulk');
  });

  document.getElementById('edSave').addEventListener('click', async ()=>{
    if(!activeId) return;
    const flag = document.getElementById('savedFlag');
    const updates = {};
    DOSSIER_FIELD_MAP.forEach(({ field, id, kind })=>{
      updates[field] = kind === 'text' ? document.getElementById(id).value.trim() : collectRepeaterRows(id);
    });
    try{
      await Promise.all(Object.entries(updates).map(([field, value])=>
        patchDossierField(activeId, field, value)
      ));
      flag.textContent = '✓ Saved';
      flag.classList.add('show');
      setTimeout(()=>flag.classList.remove('show'), 1600);
      renderGrid();
    }catch(err){
      flag.textContent = 'Save failed: ' + err.message;
      flag.classList.add('show', 'err');
      setTimeout(()=>flag.classList.remove('show','err'), 2400);
    }
  });

  // ---------- IMAGE UPLOAD (client-side downscale + WebP recompress to <500KB) ----------
  // Generic across every form with a heroImage field (campaign create/
  // edit, dossier create/edit) — 'ed'/'ec' PATCH the live document
  // immediately on upload since there's no reason to wait for the
  // explicit Save button; 'cd'/'cc' store the asset ref locally and
  // include it in the POST body when the document is actually created.
  const MAX_BYTES = 500 * 1024;
  const MAX_EDGE = 1920;

  // Mirrors src/lib/sanity-image.js's regex-based URL builder (kept in
  // sync by hand — this is browser JS embedded in a template string, it
  // can't import that module) — used only to preview an EXISTING
  // heroImage when opening an edit form; a freshly uploaded image is
  // previewed straight from the local blob instead (see wireImageUpload).
  function sanityImageUrl(image, w, h){
    const ref = image && image.asset && image.asset._ref;
    if(!ref || !SANITY_PROJECT_ID) return null;
    const m = /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref);
    if(!m) return null;
    const [, id, dims, format] = m;
    return \`https://cdn.sanity.io/images/\${SANITY_PROJECT_ID}/\${SANITY_DATASET}/\${id}-\${dims}.\${format}?auto=format&w=\${w}&h=\${h}\`;
  }

  function setUploadBtnLabel(prefix, hasImage){
    const btn = document.getElementById(prefix + 'UploadImageBtn');
    if(btn) btn.textContent = hasImage ? 'Replace Image' : 'Upload Image';
  }

  // Prefill helper — call when opening an edit form with existing data.
  function renderExistingThumb(prefix, image){
    const thumb = document.getElementById(prefix + 'ThumbPreview');
    const url = sanityImageUrl(image, 120, 120);
    thumb.innerHTML = url ? \`<img src="\${url}" alt="">\` : '';
    if(!url) thumb.textContent = 'NONE';
    setUploadBtnLabel(prefix, !!url);
  }

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

  // Downscales, uploads, and returns { asset, webp } — or throws. Caller
  // handles size-warning text and whatever happens with the asset ref.
  async function uploadImageAsset(file){
    const webp = await downscaleToWebp(file);
    if(webp.size > MAX_BYTES){
      throw new Error('Still over 500KB after max downscale — try a smaller source image.');
    }
    const form = new FormData();
    form.append('file', webp, 'upload.webp');
    form.append('kind', 'image');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const body = await res.json();
    if(!res.ok) throw new Error(body.error || res.statusText);
    return { asset: body.asset, webp };
  }

  // Wires <prefix>UploadImageBtn/<prefix>ImageInput/<prefix>ThumbPreview/
  // <prefix>SizeWarn (the ids dossierFieldsBlock() generates) to a single
  // upload flow; onUploaded(assetId) decides what happens with the result.
  function wireImageUpload(prefix, onUploaded){
    const btn = document.getElementById(prefix + 'UploadImageBtn');
    const input = document.getElementById(prefix + 'ImageInput');
    const thumb = document.getElementById(prefix + 'ThumbPreview');
    const sizeWarn = document.getElementById(prefix + 'SizeWarn');
    btn.addEventListener('click', ()=> input.click());
    input.addEventListener('change', async (e)=>{
      const file = e.target.files[0]; if(!file) return;
      sizeWarn.textContent = 'Processing…';
      try{
        const { asset, webp } = await uploadImageAsset(file);
        await onUploaded(asset._id);
        thumb.innerHTML = \`<img src="\${URL.createObjectURL(webp)}" alt="">\`;
        setUploadBtnLabel(prefix, true);
        sizeWarn.textContent = '✓ Uploaded (' + Math.round(webp.size/1024) + 'KB)';
      }catch(err){
        sizeWarn.textContent = 'Upload failed: ' + err.message;
      }
      e.target.value = '';
    });
  }

  // Dossier editor — PATCHes heroImage onto the live document immediately.
  wireImageUpload('ed', async (assetId)=>{
    if(!activeId) return;
    await patchDossierField(activeId, 'heroImage', { _type: 'image', asset: { _type: 'reference', _ref: assetId } });
  });

  // Create-dossier form — stores the reference locally (cdHeroImageAsset)
  // since the dossier doesn't exist yet to PATCH; included in the POST
  // body when it's actually created.
  let cdHeroImageAsset = null;
  wireImageUpload('cd', async (assetId)=>{ cdHeroImageAsset = assetId; });

  // Edit-campaign form — same immediate-PATCH pattern as 'ed'.
  wireImageUpload('ec', async (assetId)=>{
    if(!activeCampaignEditId) return;
    const res = await fetch('/api/campaign/' + encodeURIComponent(activeCampaignEditId), {
      method: 'PATCH',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({ field: 'heroImage', value: { _type: 'image', asset: { _type: 'reference', _ref: assetId } } }),
    });
    if(!res.ok) throw new Error((await res.json()).error || res.statusText);
    const cmp = campaigns.find(x=>x._id===activeCampaignEditId);
    if(cmp) cmp.heroImage = { asset: { _ref: assetId } };
  });

  // Create-campaign form — same locally-stored-ref pattern as 'cd'.
  let ccHeroImageAsset = null;
  wireImageUpload('cc', async (assetId)=>{ ccHeroImageAsset = assetId; });

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
