/**
 * Port of concepts/admin-console-concept.html, rewired to call the real Worker API
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
 * campaigns (ownerEmailHash matches a hash of gmEmail) — see
 * src/routes/console.js. Every
 * write the client makes is re-checked against that ownership server-side
 * too (api-campaign.js / api-dossier.js) — client-side scoping here is a
 * UX convenience, not the security boundary.
 */
export function renderConsolePage({
  campaigns, dossiers, genreThemes, gmEmail, sanityProjectId, sanityDataset,
  worlds, teamMembers, worldUnits, factions, keyFigures, magicItems, notablePlaces, loreEntries,
  myTeamMember, myArticles,
}) {
  const initialCampaigns = JSON.stringify(campaigns).replace(/</g, "\\u003c");
  const initialDossiers = JSON.stringify(dossiers).replace(/</g, "\\u003c");
  const initialThemes = JSON.stringify(genreThemes).replace(/</g, "\\u003c");
  const initialWorlds = JSON.stringify(worlds).replace(/</g, "\\u003c");
  const initialTeamMembers = JSON.stringify(teamMembers).replace(/</g, "\\u003c");
  const initialWorldUnits = JSON.stringify(worldUnits).replace(/</g, "\\u003c");
  const initialFactions = JSON.stringify(factions).replace(/</g, "\\u003c");
  const initialKeyFigures = JSON.stringify(keyFigures).replace(/</g, "\\u003c");
  const initialMagicItems = JSON.stringify(magicItems).replace(/</g, "\\u003c");
  const initialNotablePlaces = JSON.stringify(notablePlaces).replace(/</g, "\\u003c");
  const initialLoreEntries = JSON.stringify(loreEntries).replace(/</g, "\\u003c");
  const initialMyTeamMember = JSON.stringify(myTeamMember || null).replace(/</g, "\\u003c");
  const initialMyArticles = JSON.stringify(myArticles || []).replace(/</g, "\\u003c");

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
      <div class="label">MY PROFILE</div>
      <div class="navitem" data-view="myProfile">Edit My Bio</div>
      <div class="navitem" data-view="createArticle">+ Write Article</div>
      <div class="navitem" data-view="myArticles">My Articles <span class="n" id="myArticleCountTag">0</span></div>
    </div>
    ${myTeamMember?.tier === "Horsemen" ? `
    <div class="navgroup">
      <div class="label">ADMIN</div>
      <div class="navitem" data-view="adminLink">Link Team Members</div>
    </div>
    ` : ""}
    <div class="navgroup collapsible collapsed" id="worldBuildingGroup">
      <div class="label collapse-toggle"><span>WORLD BUILDING</span><span class="chev">▸</span></div>
      <div class="sublabel">Create</div>
      <div class="navitem" data-view="createWorldUnit">+ Create World Unit</div>
      <div class="navitem" data-view="createFaction">+ Create Faction</div>
      <div class="navitem" data-view="createKeyFigure">+ Create Key Figure</div>
      <div class="navitem" data-view="createMagicItem">+ Create Magic Item</div>
      <div class="navitem" data-view="createLoreEntry">+ Create Lore Entry</div>
      <div class="navitem" data-view="createNotablePlace">+ Create Notable Place</div>
      <div class="sublabel">Edit</div>
      <div class="navitem" data-view="worldUnits">My World Units <span class="n" id="worldUnitCountTag">0</span></div>
      <div class="navitem" data-view="factions">My Factions <span class="n" id="factionCountTag">0</span></div>
      <div class="navitem" data-view="keyFigures">My Key Figures <span class="n" id="keyFigureCountTag">0</span></div>
      <div class="navitem" data-view="magicItems">My Magic Items <span class="n" id="magicItemCountTag">0</span></div>
      <div class="navitem" data-view="loreEntries">My Lore Entries <span class="n" id="loreEntryCountTag">0</span></div>
      <div class="navitem" data-view="notablePlaces">My Notable Places <span class="n" id="notablePlaceCountTag">0</span></div>
    </div>
    <div class="navgroup">
      <div class="label">IMPORT / EXPORT</div>
      <div class="navitem active" data-view="bulk">Dossier <span class="n" id="countTag">0</span></div>
      <div class="navitem" data-view="bulkWiki">Wiki</div>
    </div>
    <div class="navgroup">
      <div class="label">VIEWS</div>
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
      <h1 id="viewTitle">Dossier</h1>
      <div class="toolbar" id="bulkToolbar">
        <a class="btn secondary" href="/console/templates/dossiers.xml">Download XML Template</a>
        <button class="btn" id="importXmlBtn">Import XML</button>
        <input type="file" id="importXml" accept=".xml">
        <button class="btn primary" id="exportXml">Export XML</button>
      </div>
    </div>
    <p class="hint" id="bulkHint">
      Download the template, fill in one &lt;dossier&gt; block per session (campaignSlug must
      match one of your own campaigns), then Import XML to create-or-update by dossier code —
      existing dossiers with the same code get overwritten, not duplicated. Export XML gives you
      everything currently in this table, in the same format, as a starting point for edits.
    </p>

    <div class="status" id="statusLine">Ready.</div>
    <div id="xmlResults"></div>

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
      <div class="field">
        <label>Slug</label>
        <input type="text" id="ecSlug" readonly>
        <p class="field-tip">Fixed at creation — this is the Sanity slug.current value, the last path segment of the campaign's public URL.</p>
      </div>
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
      <div class="field">
        <label>Code</label>
        <input type="text" id="edCode">
        <p class="field-tip">Changing this changes the dossier's public URL — anyone with the old link gets a 404. Must be unique within this campaign.</p>
      </div>
      <div class="field"><label>Campaign</label><input type="text" id="edCampaignTitle" readonly></div>
      <div class="field"><label>Title *</label><input type="text" id="edTitle"></div>
      ${dossierFieldsBlock("ed")}
      <div class="savebar">
        <button class="btn primary" id="edSave">Save Session</button>
        <button class="btn" id="closeEditor">← Back</button>
        <button class="btn danger" id="edDelete">Delete Dossier</button>
        <span class="savedflag" id="savedFlag">✓ Saved</span>
      </div>
    </div>

    <!-- ============ MY PROFILE / ARTICLES ============ -->

    <div class="editor" id="myProfileView">
      <h2>MY BIO</h2>
      <p class="hint" id="mpUnlinkedHint" style="display:none;">
        No profile is linked to your login yet — ask an admin to link your
        Cloudflare Access email to a Team Member document before you can
        edit your bio here.
      </p>
      <div id="mpForm">
        <div class="field"><label>Handle</label><input type="text" id="mpHandle" readonly></div>
        <div class="field"><label>Real Name</label><input type="text" id="mpRealName"></div>
        <div class="field"><label>D&amp;D Class</label><input type="text" id="mpDndClass"></div>
        <div class="field"><label>Race</label><input type="text" id="mpRace"></div>
        <div class="field">
          <label>Alignment</label>
          <select id="mpAlignment">
            ${["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil","Unaligned"].map(a=>`<option value="${a}">${a}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Stats (1–20)</label>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:90px;">
              <label>Charisma</label>
              <input type="number" id="mpCharisma" min="1" max="20">
            </div>
            <div style="flex:1; min-width:90px;">
              <label>Wisdom</label>
              <input type="number" id="mpWisdom" min="1" max="20">
            </div>
            <div style="flex:1; min-width:90px;">
              <label>Intelligence</label>
              <input type="number" id="mpIntelligence" min="1" max="20">
            </div>
            <div style="flex:1; min-width:90px;">
              <label>Luck</label>
              <input type="number" id="mpLuck" min="1" max="20">
            </div>
          </div>
        </div>
        <div class="field"><label>Backstory</label><textarea id="mpBackstory" rows="4"></textarea></div>
        <div class="field"><label>Signature Move</label><input type="text" id="mpSignatureMove"></div>
        <div class="field">
          <label>Social Links</label>
          <div class="repeater" id="mpSocialLinks"></div>
          <button type="button" class="btn small" data-add-row="mpSocialLinks:socialLink">+ Add Link</button>
        </div>
        ${heroImageFieldBlock("mp", "Avatar")}
        <div class="savebar">
          <button class="btn primary" id="mpSave">Save My Bio</button>
          <span class="savedflag" id="mpFlag"></span>
        </div>
      </div>
    </div>

    <div id="myArticlesView" style="display:none;">
      <p class="hint" id="maUnlinkedHint" style="display:none;">
        No profile is linked to your login yet — ask an admin to link
        your account before you can author articles.
      </p>
      <table>
        <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Read Time</th><th></th></tr></thead>
        <tbody id="myArticleGridBody"></tbody>
      </table>
    </div>

    <div class="editor" id="createArticleView">
      <h2>NEW ARTICLE</h2>
      ${articleFieldsBlock("ca")}
      <div class="savebar">
        <button class="btn primary" id="caSubmit">Save as Draft</button>
        <span class="savedflag" id="caFlag"></span>
      </div>
    </div>

    <div class="editor" id="editArticleView">
      <h2 id="eaTitleHeading">ARTICLE — DETAIL</h2>
      <p class="field-tip" id="eaStatusNote"></p>
      ${articleFieldsBlock("ea")}
      <div class="savebar">
        <button class="btn primary" id="eaSave">Save Changes</button>
        <button class="btn" id="eaCancel">← Back</button>
        <span class="savedflag" id="eaFlag"></span>
      </div>
    </div>

    <!-- ============ ADMIN ============ -->

    <div id="adminLinkView" style="display:none;">
      <p class="hint">
        Links a DM's Cloudflare Access login email to a team member document
        — only the HMAC of the email is ever stored, never the email itself
        (see lib/identity.js). Re-linking a member that's already linked
        overwrites the old link. New team members and tier changes still
        happen in Sanity Studio — not here.
      </p>
      <div class="field">
        <label>Team Member</label>
        <select id="alMember"></select>
      </div>
      <div class="field">
        <label>Their Login Email</label>
        <input type="email" id="alEmail" placeholder="dm@example.com">
      </div>
      <div class="savebar">
        <button class="btn primary" id="alLink">Link</button>
        <span class="savedflag" id="alFlag"></span>
      </div>
      <table style="margin-top:24px;">
        <thead><tr><th>Handle</th><th>Real Name</th><th>Tier</th><th>Linked</th><th></th></tr></thead>
        <tbody id="adminMemberGridBody"></tbody>
      </table>
    </div>

    <!-- ============ WIKI MANUAL BUILDER ============ -->

    <div id="worldUnitsView" style="display:none;">
      <table><thead><tr><th>Name</th><th>World</th><th>Status</th><th>Last Edited By</th><th></th></tr></thead><tbody id="worldUnitGridBody"></tbody></table>
    </div>
    <div class="editor" id="createWorldUnitView">
      <h2>NEW WORLD UNIT</h2>
      ${worldOnlyFieldBlock("cwu")}
      <div class="field"><label>Name *</label><input type="text" id="cwuName"></div>
      ${worldUnitFieldsBlock("cwu")}
      <div class="savebar"><button class="btn primary" id="cwuSubmit">Create World Unit</button><span class="savedflag" id="cwuFlag"></span></div>
    </div>
    <div class="editor" id="editWorldUnitView">
      <h2>EDIT WORLD UNIT</h2>
      <div class="field"><label>World</label><input type="text" id="ewuWorldTitle" readonly></div>
      <div class="field"><label>Name *</label><input type="text" id="ewuName"></div>
      ${worldUnitFieldsBlock("ewu")}
      <p class="hint" id="ewuAudit"></p>
      <div class="savebar"><button class="btn primary" id="ewuSave">Save World Unit</button><button class="btn" id="ewuCancel">← Back</button><span class="savedflag" id="ewuFlag"></span></div>
    </div>

    <div id="factionsView" style="display:none;">
      <table><thead><tr><th>Name</th><th>Type</th><th>Last Edited By</th><th></th></tr></thead><tbody id="factionGridBody"></tbody></table>
    </div>
    <div class="editor" id="createFactionView">
      <h2>NEW FACTION</h2>
      ${worldUnitRefFieldsBlock("cfa")}
      <div class="field"><label>Name *</label><input type="text" id="cfaName"></div>
      ${factionFieldsBlock("cfa")}
      <div class="savebar"><button class="btn primary" id="cfaSubmit">Create Faction</button><span class="savedflag" id="cfaFlag"></span></div>
    </div>
    <div class="editor" id="editFactionView">
      <h2>EDIT FACTION</h2>
      <div class="field"><label>Name *</label><input type="text" id="efaName"></div>
      ${factionFieldsBlock("efa")}
      <p class="hint" id="efaAudit"></p>
      <div class="savebar"><button class="btn primary" id="efaSave">Save Faction</button><button class="btn" id="efaCancel">← Back</button><span class="savedflag" id="efaFlag"></span></div>
    </div>

    <div id="keyFiguresView" style="display:none;">
      <table><thead><tr><th>Name</th><th>Status</th><th>Threat</th><th>Last Edited By</th><th></th></tr></thead><tbody id="keyFigureGridBody"></tbody></table>
    </div>
    <div class="editor" id="createKeyFigureView">
      <h2>NEW KEY FIGURE</h2>
      ${worldUnitRefFieldsBlock("ckf")}
      <div class="field"><label>Name *</label><input type="text" id="ckfName"></div>
      ${keyFigureFieldsBlock("ckf")}
      <div class="savebar"><button class="btn primary" id="ckfSubmit">Create Key Figure</button><span class="savedflag" id="ckfFlag"></span></div>
    </div>
    <div class="editor" id="editKeyFigureView">
      <h2>EDIT KEY FIGURE</h2>
      <div class="field"><label>Name *</label><input type="text" id="ekfName"></div>
      ${keyFigureFieldsBlock("ekf")}
      <p class="hint" id="ekfAudit"></p>
      <div class="savebar"><button class="btn primary" id="ekfSave">Save Key Figure</button><button class="btn" id="ekfCancel">← Back</button><span class="savedflag" id="ekfFlag"></span></div>
    </div>

    <div id="magicItemsView" style="display:none;">
      <table><thead><tr><th>Name</th><th>Rarity</th><th>Last Edited By</th><th></th></tr></thead><tbody id="magicItemGridBody"></tbody></table>
    </div>
    <div class="editor" id="createMagicItemView">
      <h2>NEW MAGIC ITEM</h2>
      ${worldUnitRefFieldsBlock("cmi")}
      <div class="field"><label>Name *</label><input type="text" id="cmiName"></div>
      ${magicItemFieldsBlock("cmi")}
      <div class="savebar"><button class="btn primary" id="cmiSubmit">Create Magic Item</button><span class="savedflag" id="cmiFlag"></span></div>
    </div>
    <div class="editor" id="editMagicItemView">
      <h2>EDIT MAGIC ITEM</h2>
      <div class="field"><label>Name *</label><input type="text" id="emiName"></div>
      ${magicItemFieldsBlock("emi")}
      <p class="hint" id="emiAudit"></p>
      <div class="savebar"><button class="btn primary" id="emiSave">Save Magic Item</button><button class="btn" id="emiCancel">← Back</button><span class="savedflag" id="emiFlag"></span></div>
    </div>

    <div id="loreEntriesView" style="display:none;">
      <table><thead><tr><th>Title</th><th>Category</th><th>Canon Status</th><th>Last Edited By</th><th></th></tr></thead><tbody id="loreEntryGridBody"></tbody></table>
    </div>
    <div class="editor" id="createLoreEntryView">
      <h2>NEW LORE ENTRY</h2>
      <div class="field"><label>World *</label><select id="cleWorld"></select></div>
      <div class="field"><label>Title *</label><input type="text" id="cleTitle"></div>
      <div class="field"><label>Unit</label><select id="cleUnit"><option value="">—</option></select></div>
      ${loreEntryFieldsBlock("cle")}
      <div class="savebar"><button class="btn primary" id="cleSubmit">Create Lore Entry</button><span class="savedflag" id="cleFlag"></span></div>
    </div>
    <div class="editor" id="editLoreEntryView">
      <h2>EDIT LORE ENTRY</h2>
      <div class="field"><label>World</label><input type="text" id="eleWorldTitle" readonly></div>
      <div class="field"><label>Title *</label><input type="text" id="eleTitle"></div>
      <div class="field"><label>Unit</label><select id="eleUnit"><option value="">—</option></select></div>
      ${loreEntryFieldsBlock("ele")}
      <p class="hint" id="eleAudit"></p>
      <div class="savebar"><button class="btn primary" id="eleSave">Save Lore Entry</button><button class="btn" id="eleCancel">← Back</button><span class="savedflag" id="eleFlag"></span></div>
    </div>

    <div id="notablePlacesView" style="display:none;">
      <table><thead><tr><th>Name</th><th>Type</th><th>Danger</th><th>Last Edited By</th><th></th></tr></thead><tbody id="notablePlaceGridBody"></tbody></table>
    </div>
    <div class="editor" id="createNotablePlaceView">
      <h2>NEW NOTABLE PLACE</h2>
      ${worldUnitRefFieldsBlock("cnp")}
      <div class="field"><label>Name *</label><input type="text" id="cnpName"></div>
      ${notablePlaceFieldsBlock("cnp")}
      <div class="savebar"><button class="btn primary" id="cnpSubmit">Create Notable Place</button><span class="savedflag" id="cnpFlag"></span></div>
    </div>
    <div class="editor" id="editNotablePlaceView">
      <h2>EDIT NOTABLE PLACE</h2>
      <div class="field"><label>Name *</label><input type="text" id="enpName"></div>
      ${notablePlaceFieldsBlock("enp")}
      <p class="hint" id="enpAudit"></p>
      <div class="savebar"><button class="btn primary" id="enpSave">Save Notable Place</button><button class="btn" id="enpCancel">← Back</button><span class="savedflag" id="enpFlag"></span></div>
    </div>

    <div id="bulkWikiView" style="display:none;">
      <p class="hint">
        Hand the downloaded template and prompt to your AI agent (Claude, ChatGPT, Gemini)
        along with your raw notes — it sorts your notes into the template's shape.
        Then pick which World this import targets and upload the result.
        Nothing in the file chooses the World — that's always set here.
        Which World Unit within it gets created/updated is instead named
        in the file itself (worldUnit.name) — worlds can only be created
        in Sanity Studio, but a unit can be created right here.
      </p>
      <div class="field">
        <a class="btn" href="/console/templates/wiki-import.json">Download JSON Template</a>
        <button class="btn" id="bwCopyPrompt">Copy AI Prompt</button>
        <span class="savedflag" id="bwCopyFlag"></span>
      </div>
      <div class="field">
        <label>Target World *</label>
        <select id="bwWorld"></select>
      </div>
      <div class="field">
        <label>Wiki Import JSON</label>
        <input type="file" id="bwFile" accept=".json">
      </div>
      <div class="savebar">
        <button class="btn primary" id="bwImport">Import</button>
        <span class="savedflag" id="bwFlag"></span>
      </div>
      <div id="bwResults"></div>
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
  const INITIAL_WORLDS = ${initialWorlds};
  const INITIAL_TEAM_MEMBERS = ${initialTeamMembers};
  const INITIAL_WORLD_UNITS = ${initialWorldUnits};
  const INITIAL_FACTIONS = ${initialFactions};
  const INITIAL_KEY_FIGURES = ${initialKeyFigures};
  const INITIAL_MAGIC_ITEMS = ${initialMagicItems};
  const INITIAL_NOTABLE_PLACES = ${initialNotablePlaces};
  const INITIAL_LORE_ENTRIES = ${initialLoreEntries};
  const INITIAL_MY_TEAM_MEMBER = ${initialMyTeamMember};
  const INITIAL_MY_ARTICLES = ${initialMyArticles};
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
// Mirrors cnf-website's sanity/schemas/constants.ts ARTICLE_CATEGORIES —
// no shared package between the two repos (same situation as the design
// tokens, see CLAUDE.md § Visual design), kept in sync by hand.
const ARTICLE_CATEGORIES = [
  "Campaign Craft", "Classes", "Combat", "Reviews",
  "World Building", "Player Tips", "DM Advice", "Lore & Theory",
];

function articleFieldsBlock(prefix) {
  return `
      <div class="field"><label>Title *</label><input type="text" id="${prefix}Title"></div>
      <div class="field"><label>Excerpt</label><textarea id="${prefix}Excerpt" rows="2" maxlength="200"></textarea></div>
      <div class="field">
        <label>Category</label>
        <select id="${prefix}Category">
          <option value="">—</option>
          ${ARTICLE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Tags (comma-separated)</label><input type="text" id="${prefix}Tags"></div>
      <div class="field"><label>Worlds</label><select id="${prefix}Worlds" multiple size="4"></select></div>
      ${heroImageFieldBlock(prefix, "Cover Image")}
      <div class="field">
        <p class="field-tip">Blank line between paragraphs. **bold** and *italic* are supported; headings and lists aren't (they'll save as plain text) — same conversion the Wiki import uses.</p>
        <label>Body</label>
        <textarea id="${prefix}Body" rows="12"></textarea>
      </div>
  `;
}

function heroImageFieldBlock(prefix, label) {
  return `
      <div class="field">
        <label>${label || "Hero Image"} (max 500KB — auto-downscaled/recompressed to WebP before upload)</label>
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
      <p class="field-tip">Banner shown right below the page's nav tabs, before Overview — separate from the Hero Image below (which appears in the Evidence section further down the page).</p>
      ${heroImageFieldBlock(prefix + "Header", "Header Image")}
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

// ---- Wiki manual builder field blocks ----
// World/Unit are rendered as plain <select> shells here (options filled
// client-side from INITIAL_WORLDS/INITIAL_WORLD_UNITS via populateSelect())
// — same "empty <select id=...> filled client-side" pattern
// createCampaignView's Genre Theme select already uses.
function worldUnitFieldsBlock(prefix) {
  return `
      <div class="field"><label>dmOwner</label><select id="${prefix}DmOwner"></select></div>
      <div class="field"><label>Overview</label><textarea id="${prefix}Overview" rows="4" placeholder="Markdown — paragraphs separated by a blank line."></textarea></div>
      <div class="field">
        <label>Development Status</label>
        <select id="${prefix}DevelopmentStatus">
          <option value="draft">Draft</option>
          <option value="in-progress">In Progress</option>
          <option value="established">Established</option>
          <option value="canonical">Canonical</option>
        </select>
      </div>
      <div class="field"><label>Colour Accent (hex)</label><input type="text" id="${prefix}ColourAccent" placeholder="#8B2E2E"></div>
      <div class="field"><label>Page Footer CTA</label><textarea id="${prefix}PageFooterCTA" rows="2" placeholder="Markdown"></textarea></div>
      <div class="field"><label>Map Image URL</label><input type="text" id="${prefix}MapImageUrl" placeholder="https://..."></div>
  `;
}

// World-only select — for worldUnit itself, which belongs to a world but
// not to another world unit.
function worldOnlyFieldBlock(prefix) {
  return `<div class="field"><label>World *</label><select id="${prefix}World"></select></div>`;
}

// World+Unit select pair — for faction/keyFigure/magicItem/notablePlace,
// where both are optional per schema (unlike worldUnit.world/loreEntry.world).
function worldUnitRefFieldsBlock(prefix) {
  return `
      <div class="field"><label>World</label><select id="${prefix}World"><option value="">—</option></select></div>
      <div class="field"><label>Unit</label><select id="${prefix}Unit"><option value="">—</option></select></div>
  `;
}

function factionFieldsBlock(prefix) {
  return `
      <div class="field"><label>Faction Type</label><input type="text" id="${prefix}FactionType" placeholder="e.g. smuggling ring, noble house"></div>
      <div class="field"><label>Description</label><textarea id="${prefix}Description" rows="4" placeholder="Markdown"></textarea></div>
      <div class="field"><label>Members (Key Figures)</label><select id="${prefix}Members" multiple size="5"></select></div>
      <div class="field"><label>DM Notes (private)</label><textarea id="${prefix}DmNotes" rows="3" placeholder="Markdown"></textarea></div>
  `;
}

function keyFigureFieldsBlock(prefix) {
  return `
      <div class="field"><label>Also Known As</label><input type="text" id="${prefix}AlsoKnownAs"></div>
      <div class="field">
        <label>Status</label>
        <select id="${prefix}Status">
          <option value="alive">Alive</option>
          <option value="dead">Dead</option>
          <option value="unknown">Unknown</option>
          <option value="missing">Missing</option>
        </select>
      </div>
      <div class="field"><label>Faction</label><select id="${prefix}Faction"><option value="">—</option></select></div>
      <div class="field"><label>Role</label><input type="text" id="${prefix}Role" placeholder="e.g. Ruler, Merchant, Villain, Ally"></div>
      <div class="field">
        <label>Threat Level</label>
        <select id="${prefix}ThreatLevel">
          <option value="friendly">Friendly</option>
          <option value="neutral" selected>Neutral</option>
          <option value="cautious">Cautious</option>
          <option value="dangerous">Dangerous</option>
          <option value="deadly">Deadly</option>
        </select>
      </div>
      <div class="field"><label>Description</label><textarea id="${prefix}Description" rows="4" placeholder="Markdown"></textarea></div>
      <div class="field">
        <label class="checkline"><input type="checkbox" id="${prefix}HasStatBlock"> Has Stat Block</label>
      </div>
      <div id="${prefix}StatBlockFields" style="display:none;">
        <div class="field">
          <label>Size</label>
          <select id="${prefix}SbSize">
            <option value="">—</option>
            <option>Tiny</option><option>Small</option><option>Medium</option>
            <option>Large</option><option>Huge</option><option>Gargantuan</option>
          </select>
        </div>
        <div class="field"><label>Creature Type</label><input type="text" id="${prefix}SbCreatureType" placeholder="humanoid, dragon, undead, beast, fiend, etc."></div>
        <div class="field"><label>Alignment</label><input type="text" id="${prefix}SbAlignment" placeholder="e.g. Chaotic Evil"></div>
        <div class="field"><label>Armor Class</label><input type="text" id="${prefix}SbAc" placeholder='e.g. 15 (studded leather)'></div>
        <div class="field"><label>Hit Points</label><input type="text" id="${prefix}SbHp" placeholder='e.g. 58 (9d8+18)'></div>
        <div class="field"><label>Speed</label><input type="text" id="${prefix}SbSpeed" placeholder='e.g. 30 ft., fly 60 ft.'></div>
        <div class="field"><label>STR</label><input type="number" id="${prefix}SbStr"></div>
        <div class="field"><label>DEX</label><input type="number" id="${prefix}SbDex"></div>
        <div class="field"><label>CON</label><input type="number" id="${prefix}SbCon"></div>
        <div class="field"><label>INT</label><input type="number" id="${prefix}SbInt"></div>
        <div class="field"><label>WIS</label><input type="number" id="${prefix}SbWis"></div>
        <div class="field"><label>CHA</label><input type="number" id="${prefix}SbCha"></div>
        <div class="field"><label>Saving Throws</label><input type="text" id="${prefix}SbSavingThrows" placeholder='e.g. Dex +6, Con +13, Wis +7'></div>
        <div class="field"><label>Skills</label><input type="text" id="${prefix}SbSkills"></div>
        <div class="field"><label>Resistances</label><input type="text" id="${prefix}SbResistances"></div>
        <div class="field"><label>Immunities</label><input type="text" id="${prefix}SbImmunities"></div>
        <div class="field"><label>Vulnerabilities</label><input type="text" id="${prefix}SbVulnerabilities"></div>
        <div class="field"><label>Condition Immunities</label><input type="text" id="${prefix}SbConditionImmunities"></div>
        <div class="field"><label>Senses</label><input type="text" id="${prefix}SbSenses"></div>
        <div class="field"><label>Passive Perception</label><input type="number" id="${prefix}SbPassivePerception"></div>
        <div class="field"><label>Languages</label><input type="text" id="${prefix}SbLanguages"></div>
        <div class="field"><label>Challenge Rating</label><input type="text" id="${prefix}SbChallengeRating" placeholder='supports fractions, e.g. "1/2"'></div>
        <div class="field"><label>Traits</label><div class="repeater" id="${prefix}SbTraits"></div><button type="button" class="btn small" data-add-row="${prefix}SbTraits:namedTextItem">+ Add Trait</button></div>
        <div class="field"><label>Actions</label><div class="repeater" id="${prefix}SbActions"></div><button type="button" class="btn small" data-add-row="${prefix}SbActions:namedTextItem">+ Add Action</button></div>
        <div class="field"><label>Legendary Actions</label><div class="repeater" id="${prefix}SbLegendaryActions"></div><button type="button" class="btn small" data-add-row="${prefix}SbLegendaryActions:namedTextItem">+ Add Legendary Action</button></div>
        <div class="field"><label>Reactions</label><div class="repeater" id="${prefix}SbReactions"></div><button type="button" class="btn small" data-add-row="${prefix}SbReactions:namedTextItem">+ Add Reaction</button></div>
      </div>
      <div class="field"><label>DM Notes (private)</label><textarea id="${prefix}DmNotes" rows="3" placeholder="Markdown"></textarea></div>
  `;
}

function magicItemFieldsBlock(prefix) {
  return `
      <div class="field"><label>Item Type</label><input type="text" id="${prefix}ItemType"></div>
      <div class="field">
        <label>Rarity</label>
        <select id="${prefix}Rarity">
          <option value="common" selected>Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="very-rare">Very Rare</option>
          <option value="legendary">Legendary</option>
          <option value="artifact">Artifact</option>
        </select>
      </div>
      <div class="field"><label>Current Holder (Key Figure)</label><select id="${prefix}CurrentHolder"><option value="">—</option></select></div>
      <div class="field"><label>Found At (Notable Place)</label><select id="${prefix}FoundAt"><option value="">—</option></select></div>
      <div class="field"><label>Lore</label><textarea id="${prefix}Lore" rows="4" placeholder="Markdown"></textarea></div>
      <div class="field">
        <label class="checkline"><input type="checkbox" id="${prefix}HasMechanics"> Has Mechanics</label>
      </div>
      <div id="${prefix}MechanicsFields" style="display:none;">
        <div class="field"><label>Item Type Detail</label><input type="text" id="${prefix}MItemTypeDetail"></div>
        <div class="field"><label>Attunement</label><input type="text" id="${prefix}MAttunement"></div>
        <div class="field"><label>Mechanics Text</label><textarea id="${prefix}MText" rows="4"></textarea></div>
      </div>
      <div class="field"><label>DM Notes (private)</label><textarea id="${prefix}DmNotes" rows="3" placeholder="Markdown"></textarea></div>
  `;
}

function loreEntryFieldsBlock(prefix) {
  return `
      <div class="field"><label>Also Known As</label><input type="text" id="${prefix}AlsoKnownAs"></div>
      <div class="field">
        <label>Category</label>
        <select id="${prefix}Category">
          <option value="">—</option>
          <option>Location</option><option>Faction</option><option>NPC</option>
          <option>History</option><option>Creature</option><option>Artefact</option>
          <option>Magic</option><option>Pantheon</option><option>Culture</option>
        </select>
      </div>
      <div class="field"><label>Summary (max 300 chars)</label><textarea id="${prefix}Summary" rows="2" maxlength="300"></textarea></div>
      <div class="field"><label>Body</label><textarea id="${prefix}Body" rows="5" placeholder="Markdown"></textarea></div>
      <div class="field">
        <label>Canon Status</label>
        <select id="${prefix}CanonStatus">
          <option value="canon" selected>Canon</option>
          <option value="homebrew">Homebrew</option>
          <option value="disputed">Disputed</option>
          <option value="rumour">Rumour</option>
          <option value="retconned">Retconned</option>
          <option value="dm-eyes-only">DM Eyes Only</option>
        </select>
      </div>
      <div class="field"><label>First Appeared</label><input type="text" id="${prefix}FirstAppeared" placeholder="e.g. Session 3"></div>
      <div class="field"><label>Related Entries</label><select id="${prefix}RelatedEntries" multiple size="5"></select></div>
      <div class="field"><label>Tags (comma-separated)</label><input type="text" id="${prefix}Tags"></div>
      <div class="field"><label>Submitted By</label><select id="${prefix}SubmittedBy"><option value="">—</option></select></div>
  `;
}

function notablePlaceFieldsBlock(prefix) {
  return `
      <div class="field"><label>Place Type</label><input type="text" id="${prefix}PlaceType" placeholder="e.g. tavern, dungeon, temple, ruin, market"></div>
      <div class="field">
        <label>Danger Level</label>
        <select id="${prefix}DangerLevel">
          <option value="safe" selected>Safe</option>
          <option value="low-risk">Low Risk</option>
          <option value="dangerous">Dangerous</option>
          <option value="deadly">Deadly</option>
        </select>
      </div>
      <div class="field"><label>Description</label><textarea id="${prefix}Description" rows="4" placeholder="Markdown"></textarea></div>
      <div class="field"><label>Key Figures</label><select id="${prefix}KeyFigures" multiple size="5"></select></div>
      <div class="field"><label>Items</label><select id="${prefix}Items" multiple size="5"></select></div>
      <div class="field"><label>DM Notes (private)</label><textarea id="${prefix}DmNotes" rows="3" placeholder="Markdown"></textarea></div>
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
  html{font-size:18px;}
  body{background:var(--bg); color:var(--text); font-family:var(--font-body); min-height:100vh;}
  .app{display:grid; grid-template-columns:220px 1fr; min-height:100vh;}
  @media(max-width:820px){.app{grid-template-columns:1fr;}}
  .side{background:var(--panel-2); border-right:1px solid var(--line); padding:20px 14px; display:flex; flex-direction:column; gap:18px;}
  .brand{font-family:var(--font-display); font-size:1rem; line-height:1.3; letter-spacing:.5px; color:var(--emerald); display:flex; align-items:flex-start; gap:8px;}
  .brand .dot{margin-top:6px; flex-shrink:0;}
  .brand .dot{width:8px; height:8px; border-radius:50%; background:var(--pink); box-shadow:0 0 8px var(--pink);}
  .navgroup .label{font-family:var(--font-mono); font-size:9.5px; letter-spacing:2px; color:var(--text-faint); margin:14px 0 8px;}
  .navgroup .label.collapse-toggle{display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none;}
  .navgroup .label.collapse-toggle .chev{font-size:11px; transition:transform .15s ease;}
  .navgroup.collapsible:not(.collapsed) .label.collapse-toggle .chev{transform:rotate(90deg);}
  .navgroup.collapsible.collapsed .navitem, .navgroup.collapsible.collapsed .sublabel{display:none;}
  .sublabel{font-family:var(--font-mono); font-size:9px; letter-spacing:1.5px; color:var(--text-faint); padding:8px 10px 4px; text-transform:uppercase;}
  .navitem{display:flex; align-items:center; justify-content:space-between; font-family:var(--font-mono); font-size:11px; letter-spacing:1px; padding:9px 10px; color:var(--text-dim); cursor:pointer; border-left:2px solid transparent;}
  .navitem.sub{padding-left:22px; font-size:10px;}
  .navitem.active{color:var(--emerald); border-left-color:var(--emerald); background:var(--panel);}
  .navitem .n{font-size:9px; color:var(--text-faint); border:1px solid var(--line); padding:1px 6px;}
  #themeToggle{margin-top:auto; font-family:var(--font-mono); font-size:10px; letter-spacing:1px; background:var(--panel); border:1px solid var(--line); color:var(--text-dim); padding:9px; cursor:pointer;}
  .main{padding:22px 26px 60px;}
  .topbar{display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:20px;}
  .topbar h1{font-family:var(--font-display); font-size:1.1rem; letter-spacing:2px; text-transform:uppercase;}
  .toolbar{display:flex; gap:8px; flex-wrap:wrap;}
  .btn{font-family:var(--font-mono); font-size:10px; letter-spacing:1.5px; padding:9px 14px; border:1px solid var(--line-strong); background:var(--panel); color:var(--text-dim); cursor:pointer; display:inline-block; text-decoration:none; box-sizing:border-box;}
  .btn:hover{border-color:var(--emerald); color:var(--emerald);}
  .btn.primary{border-color:var(--pink); color:var(--pink);}
  .btn.secondary{border-color:transparent; background:none; color:var(--text-faint);}
  .btn.secondary:hover{border-color:var(--emerald);}
  .btn.danger{border-color:var(--danger); color:var(--danger);}
  .btn.danger:hover{background:var(--danger); color:var(--bg);}
  input[type=file]{display:none;}
  .status{font-family:var(--font-mono); font-size:10px; color:var(--text-dim); margin-bottom:14px; min-height:16px;}
  .status.ok{color:var(--emerald);}
  .status.err{color:var(--danger); font-weight:bold;}
  table{width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line);}
  thead th{text-align:left; font-family:var(--font-mono); font-size:9.5px; letter-spacing:1.5px; color:var(--text-faint); padding:10px 12px; border-bottom:1px solid var(--line-strong); background:var(--panel-2); position:sticky; top:0;}
  tbody td{padding:9px 12px; border-bottom:1px solid var(--line); font-size:.85rem; color:var(--text);}
  tbody tr:hover{background:var(--panel-2);}
  td[contenteditable="true"]{cursor:text; outline:none;}
  td[contenteditable="true"]:focus{background:rgba(255,79,174,.08); box-shadow:inset 0 0 0 1px var(--pink);}
  .rowbtn{font-family:var(--font-mono); font-size:9px; color:var(--text-dim); border:1px solid var(--line); background:none; padding:4px 8px; cursor:pointer;}
  .rowbtn.danger{color:var(--danger); border-color:var(--danger);}
  .rowbtn.danger:hover{background:var(--danger); color:var(--bg);}
  .editor{display:none; background:var(--panel); border:1px solid var(--line-strong); margin-top:18px; padding:22px;}
  .editor.open{display:block;}
  .editor h2{font-family:var(--font-display); font-size:1rem; letter-spacing:2px; margin-bottom:16px; color:var(--emerald);}
  .field{margin-bottom:16px;}
  .field label{display:block; font-family:var(--font-mono); font-size:9.5px; letter-spacing:1.5px; color:var(--text-faint); margin-bottom:6px;}
  .field-tip{font-family:var(--font-body); font-size:.82rem; font-style:italic; color:var(--text-dim); margin:0 0 6px; line-height:1.4;}
  .field [contenteditable="true"]{background:var(--panel-2); border:1px solid var(--line); padding:10px 12px; font-size:.92rem; line-height:1.6; outline:none;}
  .field [contenteditable="true"]:focus{border-color:var(--pink); box-shadow:0 0 0 1px var(--pink);}
  .field input[type=text], .field input[type=number], .field input[type=email], .field select, .field textarea{width:100%; max-width:420px; background:var(--panel-2); border:1px solid var(--line); color:var(--text); padding:9px 12px; font-family:var(--font-body); font-size:.92rem; outline:none; box-sizing:border-box;}
  .field input[type=text]:focus, .field input[type=number]:focus, .field input[type=email]:focus, .field select:focus, .field textarea:focus{border-color:var(--pink); box-shadow:0 0 0 1px var(--pink);}
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
  let myTeamMember = INITIAL_MY_TEAM_MEMBER;
  let myArticles = INITIAL_MY_ARTICLES;
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
    bulk: { panel: 'bulkView', title: 'Dossier', toolbar: true },
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
    document.getElementById('bulkHint').style.display = target.toolbar ? '' : 'none';
    document.getElementById('xmlResults').style.display = target.toolbar ? '' : 'none';
    document.querySelectorAll('.navitem[data-view]').forEach(n=>n.classList.toggle('active', n.dataset.view===view));
    if(view === 'campaigns') renderCampaignGrid();
    if(view === 'createCampaign') populateThemeSelect();
    if(view === 'createDossier') populateCampaignSelect();
  }

  document.querySelectorAll('.navitem[data-view]').forEach(item=>{
    item.addEventListener('click', ()=> switchView(item.dataset.view));
  });

  document.querySelectorAll('.navgroup.collapsible .collapse-toggle').forEach(toggle=>{
    toggle.addEventListener('click', ()=> toggle.closest('.navgroup').classList.toggle('collapsed'));
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
        <td>
          <button class="rowbtn" data-open="\${d._id}">OPEN →</button>
          <button class="rowbtn danger" data-delete="\${d._id}">DELETE</button>
        </td>
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
    gridBody.querySelectorAll('[data-delete]').forEach(btn=>{
      btn.addEventListener('click', ()=>deleteDossier(btn.dataset.delete));
    });
  }

  // Shared by the grid's row DELETE button and the single-dossier
  // editor's Delete Dossier button — hard delete, no undo, so this is
  // the one confirmation gate both entry points go through.
  async function deleteDossier(id){
    const d = dossiers.find(x=>x._id===id);
    const label = d ? (d.code || d.title || id) : id;
    if(!confirm(\`Delete dossier "\${label}"? This cannot be undone.\`)) return;
    try{
      const res = await fetch('/api/dossier/' + encodeURIComponent(id), { method: 'DELETE' });
      const body = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error || \`HTTP \${res.status}\`);
      dossiers = dossiers.filter(x=>x._id!==id);
      renderGrid();
      if(activeId === id){ navSingle.style.display = 'none'; switchView('bulk'); }
      flashStatus(\`Deleted "\${label}".\`, 'ok');
    }catch(err){
      flashStatus(\`Delete failed: \${err.message}\`, 'err');
    }
  }

  // Returns {ok, error} rather than throwing/swallowing — callers doing a
  // single field's save (grid inline-edit-on-blur) want the old flash-
  // and-forget behavior; edSave's bulk multi-field save needs to know
  // exactly which field(s) failed and why before it can honestly report
  // "Saved" (previously it always did, even when every patch had failed,
  // because this function never propagated its own caught errors).
  async function patchDossierField(id, field, value, opts){
    const silent = opts && opts.silent;
    try{
      const res = await fetch('/api/dossier/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ field, value }),
      });
      const body = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error || \`HTTP \${res.status}\`);
      const d = dossiers.find(x=>x._id===id);
      if(d) d[field] = value;
      if(!silent) flashStatus('Saved ' + field + ' → ' + id, 'ok');
      return { ok: true };
    }catch(err){
      if(!silent) flashStatus('Save failed: ' + err.message, 'err');
      return { ok: false, field, error: err.message };
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
    document.getElementById('ecSlug').value = cmp.slug?.current || '';
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
    if(cdHeaderImageAsset){
      body.headerImage = { _type: 'image', asset: { _type: 'reference', _ref: cdHeaderImageAsset } };
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
      dossiers.unshift({ _id: result.id, code: body.code, title: body.title, location: body.location, overview: body.overview, heroImage: body.heroImage, headerImage: body.headerImage, objectives: body.objectives, campaignId: body.campaign });
      flag.textContent = '✓ Created.';
      flag.className = 'savedflag show';
      ['cdCode','cdTitle','cdClassification','cdDistribution','cdSessionLabel','cdLocation','cdOverview'].forEach(id=>document.getElementById(id).value='');
      ['cdQuickFacts','cdLocationFacts','cdStatTiles','cdThreatAssessment','cdObjectives','cdLog'].forEach(clearRepeater);
      cdHeroImageAsset = null;
      cdHeaderImageAsset = null;
      renderExistingThumb('cd', null);
      renderExistingThumb('cdHeader', null);
      document.getElementById('cdSizeWarn').textContent = '';
      document.getElementById('cdHeaderSizeWarn').textContent = '';
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
    { field: 'code', id: 'edCode', kind: 'text' },
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
    renderExistingThumb('edHeader', d.headerImage);
    document.getElementById('edHeaderSizeWarn').textContent = '';
    navSingle.style.display = 'flex';
    navSingle.textContent = 'Editing: ' + (d.code||d._id);
    switchView('single');
  }
  document.getElementById('closeEditor').addEventListener('click', ()=>{
    navSingle.style.display = 'none';
    switchView('bulk');
  });
  document.getElementById('edDelete').addEventListener('click', ()=>{
    if(activeId) deleteDossier(activeId);
  });

  document.getElementById('edSave').addEventListener('click', async ()=>{
    if(!activeId) return;
    const flag = document.getElementById('savedFlag');
    const updates = {};
    DOSSIER_FIELD_MAP.forEach(({ field, id, kind })=>{
      updates[field] = kind === 'text' ? document.getElementById(id).value.trim() : collectRepeaterRows(id);
    });
    flag.textContent = 'Saving…';
    flag.className = 'savedflag show';
    // silent:true — 12 fields patching in parallel would otherwise race
    // to overwrite each other's flashStatus lines; edSave reports one
    // consolidated result instead once every patch has settled.
    const results = await Promise.all(Object.entries(updates).map(([field, value])=>
      patchDossierField(activeId, field, value, { silent: true })
    ));
    renderGrid();
    const failures = results.filter(r=>!r.ok);
    if(failures.length === 0){
      flag.textContent = '✓ Saved';
      flag.className = 'savedflag show';
      setTimeout(()=>flag.classList.remove('show'), 1600);
      const d = dossiers.find(x=>x._id===activeId);
      if(d){ navSingle.textContent = 'Editing: ' + (d.code||d._id); document.getElementById('editorTitle').textContent = (d.code||d._id) + ' — DETAIL'; }
    } else {
      // No auto-clear timeout on failure — an error a GM can't act on
      // because it vanished in a couple seconds is the exact complaint
      // this fix addresses. It stays until the next save attempt.
      flag.textContent = failures.map(f=>\`\${f.field}: \${f.error}\`).join(' · ');
      flag.className = 'savedflag show err';
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
  // Same, for the separate header-banner slot.
  wireImageUpload('edHeader', async (assetId)=>{
    if(!activeId) return;
    await patchDossierField(activeId, 'headerImage', { _type: 'image', asset: { _type: 'reference', _ref: assetId } });
  });

  // Create-dossier form — stores the reference locally (cdHeroImageAsset/
  // cdHeaderImageAsset) since the dossier doesn't exist yet to PATCH;
  // included in the POST body when it's actually created.
  let cdHeroImageAsset = null;
  wireImageUpload('cd', async (assetId)=>{ cdHeroImageAsset = assetId; });
  let cdHeaderImageAsset = null;
  wireImageUpload('cdHeader', async (assetId)=>{ cdHeaderImageAsset = assetId; });

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
  // renderXmlResults / clearXmlResults: mirrors renderBulkWikiResults'
  // pattern (persistent summary + per-row failure table, not a one-line
  // flashStatus that the next unrelated action or a page reload wipes
  // out before it's readable) — added 2026-08-27 after a GM reported a
  // failed import's error had no actionable detail and vanished almost
  // immediately (it was being clobbered by the unconditional reload
  // right below it, even on partial failure).
  function clearXmlResults(){
    document.getElementById('xmlResults').innerHTML = '';
  }
  function renderXmlResults(data){
    const container = document.getElementById('xmlResults');
    container.innerHTML = '';
    const summary = document.createElement('p');
    summary.className = 'hint';
    summary.textContent = \`Created \${data.created}, updated \${data.updated}, failed \${data.failed}.\`;
    container.appendChild(summary);

    if(data.failures && data.failures.length){
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Code</th><th>Reason</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      data.failures.forEach(f=>{
        const tr = document.createElement('tr');
        [f.code, f.reason].forEach(text=>{
          const td = document.createElement('td');
          td.textContent = text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }
  }

  document.getElementById('exportXml').addEventListener('click', async ()=>{
    window.location.href = '/api/export.xml';
  });
  document.getElementById('importXmlBtn').addEventListener('click', ()=> document.getElementById('importXml').click());
  document.getElementById('importXml').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    clearXmlResults();
    flashStatus('Importing…', '');
    try{
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import', { method:'POST', body: form });
      // A 502/500 from an upstream failure (or any non-JSON error page)
      // must not surface as a raw "Unexpected token < in JSON" — that's
      // exactly the kind of non-actionable message this fix is for.
      const body = await res.json().catch(()=>null);
      if(!body) throw new Error(\`Server returned an unreadable response (HTTP \${res.status}). Try again — if it persists, the file may be malformed.\`);
      if(!res.ok) throw new Error(body.error || \`HTTP \${res.status}\`);

      renderXmlResults(body);
      if(body.failed > 0){
        flashStatus(\`Imported with \${body.failed} failure\${body.failed===1?'':'s'} — see details below.\`, 'err');
        // Deliberately no reload here: a reload would wipe the failure
        // detail above before the GM can read which codes failed and
        // why. Whatever DID succeed is already live in Sanity; the grid
        // just won't reflect it until the next reload/navigation.
      } else {
        flashStatus(\`Imported \${body.imported} dossiers (\${body.created} created, \${body.updated} updated).\`, 'ok');
        window.location.reload();
      }
    }catch(err){
      flashStatus('XML import failed: ' + err.message, 'err');
    }
    e.target.value = '';
  });

  // CSV export/import (objectives) buttons removed from the Dossier
  // toolbar 2026-08-27 — UI only; /api/export.csv and /api/import/csv
  // routes are untouched server-side in case this needs to come back.

  // ========== MY PROFILE / ARTICLES ==========
  // Both scoped server-side by the caller's OWN resolved teamMember _id
  // (see lib/identity.js) — myTeamMember is null if this login isn't
  // linked to a profile yet, which every view/handler here has to
  // degrade gracefully for rather than assume it exists.
  REPEATER_SHAPES.socialLink = [
    { key: 'platform', ph: 'Platform', type: 'select', options: ['Discord','Twitter','Twitch','Instagram','YouTube'] },
    { key: 'url', ph: 'URL' },
  ];

  const MP_FIELD_MAP = [
    { field: 'realName', idSuffix: 'RealName', kind: 'text' },
    { field: 'dndClass', idSuffix: 'DndClass', kind: 'text' },
    { field: 'race', idSuffix: 'Race', kind: 'text' },
    { field: 'alignment', idSuffix: 'Alignment', kind: 'select' },
    { field: 'backstory', idSuffix: 'Backstory', kind: 'text' },
    { field: 'signatureMove', idSuffix: 'SignatureMove', kind: 'text' },
  ];

  function renderMyProfileForm(){
    const unlinkedHint = document.getElementById('mpUnlinkedHint');
    const form = document.getElementById('mpForm');
    if(!myTeamMember){
      unlinkedHint.style.display = '';
      form.style.display = 'none';
      return;
    }
    unlinkedHint.style.display = 'none';
    form.style.display = '';
    document.getElementById('mpHandle').value = myTeamMember.handle || '';
    populateFieldMap(MP_FIELD_MAP, 'mp', myTeamMember);
    const stats = myTeamMember.stats || {};
    document.getElementById('mpCharisma').value = stats.charisma ?? '';
    document.getElementById('mpWisdom').value = stats.wisdom ?? '';
    document.getElementById('mpIntelligence').value = stats.intelligence ?? '';
    document.getElementById('mpLuck').value = stats.luck ?? '';
    populateRepeater('mpSocialLinks', 'socialLink', myTeamMember.socialLinks);
    renderExistingThumb('mp', myTeamMember.avatar);
    document.getElementById('mpSizeWarn').textContent = '';
    document.getElementById('mpFlag').className = 'savedflag';
  }

  document.getElementById('mpSave').addEventListener('click', async ()=>{
    if(!myTeamMember) return;
    const flag = document.getElementById('mpFlag');
    const updates = collectFieldMap(MP_FIELD_MAP, 'mp');
    updates.stats = {
      charisma: document.getElementById('mpCharisma').value === '' ? undefined : Number(document.getElementById('mpCharisma').value),
      wisdom: document.getElementById('mpWisdom').value === '' ? undefined : Number(document.getElementById('mpWisdom').value),
      intelligence: document.getElementById('mpIntelligence').value === '' ? undefined : Number(document.getElementById('mpIntelligence').value),
      luck: document.getElementById('mpLuck').value === '' ? undefined : Number(document.getElementById('mpLuck').value),
    };
    updates.socialLinks = collectRepeaterRows('mpSocialLinks');
    flag.textContent = 'Saving…';
    flag.className = 'savedflag show';
    const results = await Promise.all(Object.entries(updates).map(([field, value])=> patchMyTeamMember(field, value, true)));
    const failures = results.filter(r=>!r.ok);
    if(failures.length === 0){
      Object.assign(myTeamMember, updates);
      flag.textContent = '✓ Saved';
      flag.className = 'savedflag show';
      setTimeout(()=>flag.classList.remove('show'), 1600);
    } else {
      flag.textContent = failures.map(f=>\`\${f.field}: \${f.error}\`).join(' · ');
      flag.className = 'savedflag show err';
    }
  });

  async function patchMyTeamMember(field, value, silent){
    try{
      const res = await fetch('/api/me/team-member', {
        method: 'PATCH',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ field, value }),
      });
      const resBody = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(resBody.error || \`HTTP \${res.status}\`);
      if(!silent){ myTeamMember[field] = value; }
      return { ok: true };
    }catch(err){
      return { ok: false, field, error: err.message };
    }
  }

  wireImageUpload('mp', async (assetId)=>{
    if(!myTeamMember) return;
    const value = { _type: 'image', asset: { _type: 'reference', _ref: assetId } };
    const result = await patchMyTeamMember('avatar', value);
    if(result.ok) myTeamMember.avatar = value;
  });

  // ---------- MY ARTICLES (list + create + edit) ----------
  const ARTICLE_FIELD_MAP = [
    { field: 'title', idSuffix: 'Title', kind: 'text' },
    { field: 'excerpt', idSuffix: 'Excerpt', kind: 'text' },
    { field: 'category', idSuffix: 'Category', kind: 'select' },
    { field: 'tags', idSuffix: 'Tags', kind: 'commaList' },
    { field: 'worlds', idSuffix: 'Worlds', kind: 'multiSelect' },
    { field: 'body', idSuffix: 'Body', kind: 'markdown' },
  ];

  function renderMyArticleGrid(){
    const tbody = document.getElementById('myArticleGridBody');
    const unlinkedHint = document.getElementById('maUnlinkedHint');
    unlinkedHint.style.display = myTeamMember ? 'none' : '';
    tbody.innerHTML = '';
    myArticles.forEach(a=>{
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${a.title||''}</td>
        <td style="font-family:var(--font-mono); font-size:1rem; color:var(--text-dim);">\${a.category||''}</td>
        <td style="font-family:var(--font-mono); font-size:1rem; color:var(--text-dim);">\${a.status||''}</td>
        <td style="font-family:var(--font-mono); font-size:1rem; color:var(--text-dim);">\${a.readTimeMinutes ? a.readTimeMinutes + ' min' : ''}</td>
        <td><button class="rowbtn" data-open-article="\${a._id}">OPEN →</button></td>
      \`;
      tbody.appendChild(tr);
    });
    document.getElementById('myArticleCountTag').textContent = myArticles.length;
    tbody.querySelectorAll('[data-open-article]').forEach(btn=>{
      btn.addEventListener('click', ()=>openArticleEditor(btn.dataset.openArticle));
    });
  }

  document.getElementById('caSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('caFlag');
    if(!myTeamMember){
      flag.textContent = 'No profile linked to your login yet — ask an admin to link one.';
      flag.className = 'savedflag show err';
      return;
    }
    const body = collectFieldMap(ARTICLE_FIELD_MAP, 'ca');
    if(!body.title){
      flag.textContent = 'Title is required.';
      flag.className = 'savedflag show err';
      return;
    }
    if(caCoverImageAsset) body.coverImageAssetId = caCoverImageAsset;
    try{
      const res = await fetch('/api/me/articles', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      myArticles.unshift({ _id: result.id, title: body.title, category: body.category, status: 'draft', readTimeMinutes: null });
      flag.textContent = '✓ Saved as draft.';
      flag.className = 'savedflag show';
      ['caTitle','caExcerpt','caTags','caBody'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('caCategory').value = '';
      Array.from(document.getElementById('caWorlds').options).forEach(o=>o.selected=false);
      caCoverImageAsset = null;
      renderExistingThumb('ca', null);
      document.getElementById('caSizeWarn').textContent = '';
      setTimeout(()=>switchView('myArticles'), 900);
    }catch(err){
      flag.textContent = 'Failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  });

  let caCoverImageAsset = null;
  wireImageUpload('ca', async (assetId)=>{ caCoverImageAsset = assetId; });

  let activeArticleId = null;

  function openArticleEditor(id){
    const article = myArticles.find(a=>a._id===id);
    if(!article) return;
    activeArticleId = id;
    document.getElementById('eaTitleHeading').textContent = (article.title||article._id) + ' — DETAIL';
    document.getElementById('eaStatusNote').textContent =
      article.status === 'published'
        ? 'Published — content edits here still require Studio review to reflect the change publicly if the site caches it.'
        : 'Draft — not visible on the public site until a Studio admin publishes it.';
    // Populate the Worlds <select>'s <option>s before prefilling it —
    // setFieldValue('multiSelect', ...) marks options selected by
    // iterating el.options, which is empty until this runs.
    populateSelect('eaWorlds', worlds, 'name');
    populateFieldMap(ARTICLE_FIELD_MAP, 'ea', article);
    renderExistingThumb('ea', article.coverImage);
    document.getElementById('eaSizeWarn').textContent = '';
    document.getElementById('eaFlag').className = 'savedflag';
    switchView('editArticle');
  }

  document.getElementById('eaCancel').addEventListener('click', ()=> switchView('myArticles'));

  document.getElementById('eaSave').addEventListener('click', async ()=>{
    if(!activeArticleId) return;
    const flag = document.getElementById('eaFlag');
    const updates = collectFieldMap(ARTICLE_FIELD_MAP, 'ea');
    flag.textContent = 'Saving…';
    flag.className = 'savedflag show';
    const results = await Promise.all(Object.entries(updates).map(([field, value])=> patchMyArticle(activeArticleId, field, value, true)));
    const failures = results.filter(r=>!r.ok);
    if(failures.length === 0){
      const article = myArticles.find(a=>a._id===activeArticleId);
      if(article) Object.assign(article, updates);
      renderMyArticleGrid();
      flag.textContent = '✓ Saved';
      flag.className = 'savedflag show';
      setTimeout(()=>flag.classList.remove('show'), 1600);
    } else {
      flag.textContent = failures.map(f=>\`\${f.field}: \${f.error}\`).join(' · ');
      flag.className = 'savedflag show err';
    }
  });

  async function patchMyArticle(id, field, value, silent){
    try{
      const res = await fetch('/api/me/articles/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ field, value }),
      });
      const resBody = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(resBody.error || \`HTTP \${res.status}\`);
      if(!silent){ const article = myArticles.find(a=>a._id===id); if(article) article[field] = value; }
      return { ok: true, field };
    }catch(err){
      return { ok: false, field, error: err.message };
    }
  }

  wireImageUpload('ea', async (assetId)=>{
    if(!activeArticleId) return;
    const value = { _type: 'image', asset: { _type: 'reference', _ref: assetId } };
    const result = await patchMyArticle(activeArticleId, 'coverImage', value);
    if(result.ok){ const article = myArticles.find(a=>a._id===activeArticleId); if(article) article.coverImage = value; }
  });

  // ========== ADMIN ==========
  // Only rendered/reachable at all when myTeamMember.tier === 'Horsemen'
  // (see the nav item's server-side conditional above) — but every
  // /api/admin/* route re-checks this itself, same "console hiding is a
  // convenience, not the boundary" rule as everywhere else in this app.
  let adminMembers = [];

  async function loadAdminMembers(){
    const flag = document.getElementById('alFlag');
    try{
      const res = await fetch('/api/admin/team-members');
      const body = await res.json();
      if(!res.ok) throw new Error(body.error || res.statusText);
      adminMembers = body.members;
      populateSelect('alMember', adminMembers, 'handle');
      renderAdminMemberGrid();
    }catch(err){
      flag.textContent = 'Failed to load team members: ' + err.message;
      flag.className = 'savedflag show err';
    }
  }

  function renderAdminMemberGrid(){
    const tbody = document.getElementById('adminMemberGridBody');
    tbody.innerHTML = '';
    adminMembers.forEach(m=>{
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${m.handle||''}</td>
        <td style="font-family:var(--font-mono); font-size:1rem; color:var(--text-dim);">\${m.realName||''}</td>
        <td style="font-family:var(--font-mono); font-size:1rem; color:var(--text-dim);">\${m.tier||''}</td>
        <td style="font-family:var(--font-mono); font-size:1rem; color:var(--text-dim);">\${m.linked ? '✓ linked' : '—'}</td>
        <td>\${m.linked ? '<button class="rowbtn danger" data-unlink="'+m._id+'">UNLINK</button>' : ''}</td>
      \`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-unlink]').forEach(btn=>{
      btn.addEventListener('click', ()=>unlinkMember(btn.dataset.unlink));
    });
  }

  document.getElementById('alLink').addEventListener('click', async ()=>{
    const flag = document.getElementById('alFlag');
    const teamMemberId = document.getElementById('alMember').value;
    const email = document.getElementById('alEmail').value.trim();
    if(!teamMemberId || !email){
      flag.textContent = 'Pick a team member and enter their email.';
      flag.className = 'savedflag show err';
      return;
    }
    flag.textContent = 'Linking…';
    flag.className = 'savedflag show';
    try{
      const res = await fetch('/api/admin/link-team-member', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ email, teamMemberId }),
      });
      const body = await res.json();
      if(!res.ok) throw new Error(body.error || res.statusText);
      flag.textContent = '✓ Linked.';
      flag.className = 'savedflag show';
      document.getElementById('alEmail').value = '';
      await loadAdminMembers();
    }catch(err){
      flag.textContent = 'Failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  });

  async function unlinkMember(teamMemberId){
    if(!confirm('Unlink this team member? They will lose console access until relinked.')) return;
    const flag = document.getElementById('alFlag');
    try{
      const res = await fetch('/api/admin/unlink-team-member', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ teamMemberId }),
      });
      const body = await res.json();
      if(!res.ok) throw new Error(body.error || res.statusText);
      flag.textContent = '✓ Unlinked.';
      flag.className = 'savedflag show';
      await loadAdminMembers();
    }catch(err){
      flag.textContent = 'Failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  }

  // ========== WIKI MANUAL BUILDER ==========
  // Six types (worldUnit/faction/keyFigure/magicItem/loreEntry/
  // notablePlace) share the same generic field-kind collect/populate
  // helpers below instead of six hand-copied versions of
  // openEditor()/edSave() — 'text'/'select'/'checkbox' etc. cover every
  // plain field; statBlock/mechanics (nested objects) and the two
  // World/Unit reference selects are handled by dedicated code per type
  // since they don't fit the flat-field-map shape. All six use
  // createOrReplace server-side (see api-*.js) — re-submitting the same
  // name under the same world/unit updates that document in place.
  let worldUnits = INITIAL_WORLD_UNITS;
  let factions = INITIAL_FACTIONS;
  let keyFigures = INITIAL_KEY_FIGURES;
  let magicItems = INITIAL_MAGIC_ITEMS;
  let notablePlaces = INITIAL_NOTABLE_PLACES;
  let loreEntries = INITIAL_LORE_ENTRIES;
  const worlds = INITIAL_WORLDS;
  const teamMembers = INITIAL_TEAM_MEMBERS;

  function worldNameFor(id){ const w = worlds.find(x=>x._id===id); return w ? w.name : ''; }
  function unitNameFor(id){ const u = worldUnits.find(x=>x._id===id); return u ? u.name : ''; }

  function populateSelect(selectId, items, labelKey, allowEmpty){
    const sel = document.getElementById(selectId);
    if(!sel) return;
    const opts = items.map(it=> \`<option value="\${it._id}">\${it[labelKey]}</option>\`);
    sel.innerHTML = (allowEmpty ? '<option value="">—</option>' : '') + opts.join('');
  }

  function getFieldValue(kind, id){
    const el = document.getElementById(id);
    if(!el) return undefined;
    if(kind === 'text' || kind === 'markdown') return el.value.trim();
    if(kind === 'number') return el.value === '' ? null : Number(el.value);
    if(kind === 'select') return el.value || undefined;
    // refSelect: explicit null (not undefined) when cleared — undefined is
    // dropped by JSON.stringify, so a PATCH clearing a reference would
    // otherwise send a body with no "value" key at all and silently fail
    // to unset the stale reference server-side.
    if(kind === 'refSelect') return el.value || null;
    if(kind === 'checkbox') return el.checked;
    if(kind === 'multiSelect') return Array.from(el.selectedOptions).map(o=>o.value);
    if(kind === 'commaList') return el.value.split(',').map(s=>s.trim()).filter(Boolean);
    return el.value;
  }

  function setFieldValue(kind, id, value){
    const el = document.getElementById(id);
    if(!el) return;
    if(kind === 'multiSelect'){
      const ids = new Set(value||[]);
      Array.from(el.options).forEach(o=> o.selected = ids.has(o.value));
      return;
    }
    if(kind === 'checkbox'){ el.checked = !!value; return; }
    if(kind === 'commaList'){ el.value = (value||[]).join(', '); return; }
    if(kind === 'number'){ el.value = value ?? ''; return; }
    el.value = value ?? '';
  }

  function collectFieldMap(fieldMap, prefix){
    const out = {};
    fieldMap.forEach(({ field, idSuffix, kind })=>{ out[field] = getFieldValue(kind, prefix + idSuffix); });
    return out;
  }

  function populateFieldMap(fieldMap, prefix, data){
    fieldMap.forEach(({ field, idSuffix, kind })=>{ setFieldValue(kind, prefix + idSuffix, data[field]); });
  }

  async function patchWikiField(kind, id, field, value){
    const res = await fetch('/api/' + kind + '/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({ field, value }),
    });
    if(!res.ok) throw new Error((await res.json()).error || res.statusText);
  }

  function auditLine(doc){
    if(!doc.consoleEditedByEmail) return 'Not yet edited via this console.';
    return 'Last edited via console by ' + doc.consoleEditedByEmail + (doc.consoleEditedAt ? ' at ' + new Date(doc.consoleEditedAt).toLocaleString() : '');
  }

  REPEATER_SHAPES.namedTextItem = [
    { key: 'name', ph: 'Name' },
    { key: 'text', ph: 'Text', type: 'textarea' },
  ];

  // ---------- WORLD UNIT ----------
  const WORLD_UNIT_EDIT_MAP = [
    { field: 'name', idSuffix: 'Name', kind: 'text' },
    { field: 'dmOwner', idSuffix: 'DmOwner', kind: 'refSelect' },
    { field: 'overview', idSuffix: 'Overview', kind: 'markdown' },
    { field: 'developmentStatus', idSuffix: 'DevelopmentStatus', kind: 'select' },
    { field: 'colourAccent', idSuffix: 'ColourAccent', kind: 'text' },
    { field: 'pageFooterCTA', idSuffix: 'PageFooterCTA', kind: 'markdown' },
    { field: 'mapImageUrl', idSuffix: 'MapImageUrl', kind: 'text' },
  ];

  function renderWorldUnitGrid(){
    const body = document.getElementById('worldUnitGridBody');
    body.innerHTML = worldUnits.map(u=> \`
      <tr>
        <td>\${u.name||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${worldNameFor(u.world)}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${u.developmentStatus||''}</td>
        <td style="font-size:9px; color:var(--text-faint);">\${u.consoleEditedByEmail||'—'}</td>
        <td><button class="rowbtn" data-edit-world-unit="\${u._id}">Edit</button></td>
      </tr>
    \`).join('');
    document.getElementById('worldUnitCountTag').textContent = worldUnits.length;
    body.querySelectorAll('[data-edit-world-unit]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditWorldUnit(btn.dataset.editWorldUnit));
    });
  }

  document.getElementById('cwuSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('cwuFlag');
    const world = document.getElementById('cwuWorld').value;
    const rest = collectFieldMap(WORLD_UNIT_EDIT_MAP, 'cwu');
    if(!world || !rest.name){
      flag.textContent = 'World and Name are required.';
      flag.className = 'savedflag show err';
      return;
    }
    try{
      const res = await fetch('/api/world-unit', {
        method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({ world, ...rest }),
      });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      worldUnits.push({ _id: result.id, world, ...rest });
      flag.textContent = '✓ Created.';
      flag.className = 'savedflag show';
      setTimeout(()=>switchView('worldUnits'), 900);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  let activeWorldUnitEditId = null;
  function openEditWorldUnit(id){
    const u = worldUnits.find(x=>x._id===id);
    if(!u) return;
    activeWorldUnitEditId = id;
    document.getElementById('ewuWorldTitle').value = worldNameFor(u.world);
    populateSelect('ewuDmOwner', teamMembers, 'handle', true);
    populateFieldMap(WORLD_UNIT_EDIT_MAP, 'ewu', u);
    document.getElementById('ewuAudit').textContent = auditLine(u);
    document.getElementById('ewuFlag').className = 'savedflag';
    switchView('editWorldUnit');
  }
  document.getElementById('ewuCancel').addEventListener('click', ()=> switchView('worldUnits'));
  document.getElementById('ewuSave').addEventListener('click', async ()=>{
    if(!activeWorldUnitEditId) return;
    const flag = document.getElementById('ewuFlag');
    const updates = collectFieldMap(WORLD_UNIT_EDIT_MAP, 'ewu');
    try{
      await Promise.all(Object.entries(updates).map(([field,value])=> patchWikiField('world-unit', activeWorldUnitEditId, field, value)));
      const u = worldUnits.find(x=>x._id===activeWorldUnitEditId);
      if(u) Object.assign(u, updates);
      flag.textContent = '✓ Saved.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('worldUnits'), 700);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  // ---------- FACTION ----------
  const FACTION_EDIT_MAP = [
    { field: 'name', idSuffix: 'Name', kind: 'text' },
    { field: 'factionType', idSuffix: 'FactionType', kind: 'text' },
    { field: 'description', idSuffix: 'Description', kind: 'markdown' },
    { field: 'members', idSuffix: 'Members', kind: 'multiSelect' },
    { field: 'dmNotes', idSuffix: 'DmNotes', kind: 'markdown' },
  ];

  function renderFactionGrid(){
    const body = document.getElementById('factionGridBody');
    body.innerHTML = factions.map(f=> \`
      <tr>
        <td>\${f.name||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${f.factionType||''}</td>
        <td style="font-size:9px; color:var(--text-faint);">\${f.consoleEditedByEmail||'—'}</td>
        <td><button class="rowbtn" data-edit-faction="\${f._id}">Edit</button></td>
      </tr>
    \`).join('');
    document.getElementById('factionCountTag').textContent = factions.length;
    body.querySelectorAll('[data-edit-faction]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditFaction(btn.dataset.editFaction));
    });
  }

  document.getElementById('cfaSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('cfaFlag');
    const world = document.getElementById('cfaWorld').value || undefined;
    const unit = document.getElementById('cfaUnit').value || undefined;
    const rest = collectFieldMap(FACTION_EDIT_MAP, 'cfa');
    if(!rest.name){ flag.textContent = 'Name is required.'; flag.className = 'savedflag show err'; return; }
    try{
      const res = await fetch('/api/faction', {
        method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({ world, unit, ...rest }),
      });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      factions.push({ _id: result.id, world, unit, ...rest });
      flag.textContent = '✓ Created.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('factions'), 900);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  let activeFactionEditId = null;
  function openEditFaction(id){
    const f = factions.find(x=>x._id===id);
    if(!f) return;
    activeFactionEditId = id;
    populateSelect('efaMembers', keyFigures, 'name');
    populateFieldMap(FACTION_EDIT_MAP, 'efa', f);
    document.getElementById('efaAudit').textContent = auditLine(f);
    document.getElementById('efaFlag').className = 'savedflag';
    switchView('editFaction');
  }
  document.getElementById('efaCancel').addEventListener('click', ()=> switchView('factions'));
  document.getElementById('efaSave').addEventListener('click', async ()=>{
    if(!activeFactionEditId) return;
    const flag = document.getElementById('efaFlag');
    const updates = collectFieldMap(FACTION_EDIT_MAP, 'efa');
    try{
      await Promise.all(Object.entries(updates).map(([field,value])=> patchWikiField('faction', activeFactionEditId, field, value)));
      const f = factions.find(x=>x._id===activeFactionEditId);
      if(f) Object.assign(f, updates);
      flag.textContent = '✓ Saved.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('factions'), 700);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  // ---------- KEY FIGURE (includes statBlock, handled separately) ----------
  const KEY_FIGURE_EDIT_MAP = [
    { field: 'name', idSuffix: 'Name', kind: 'text' },
    { field: 'alsoKnownAs', idSuffix: 'AlsoKnownAs', kind: 'text' },
    { field: 'status', idSuffix: 'Status', kind: 'select' },
    { field: 'faction', idSuffix: 'Faction', kind: 'refSelect' },
    { field: 'role', idSuffix: 'Role', kind: 'text' },
    { field: 'threatLevel', idSuffix: 'ThreatLevel', kind: 'select' },
    { field: 'description', idSuffix: 'Description', kind: 'markdown' },
    { field: 'dmNotes', idSuffix: 'DmNotes', kind: 'markdown' },
  ];
  const STAT_BLOCK_MAP = [
    { field: 'size', idSuffix: 'SbSize', kind: 'select' },
    { field: 'creatureType', idSuffix: 'SbCreatureType', kind: 'text' },
    { field: 'alignment', idSuffix: 'SbAlignment', kind: 'text' },
    { field: 'ac', idSuffix: 'SbAc', kind: 'text' },
    { field: 'hp', idSuffix: 'SbHp', kind: 'text' },
    { field: 'speed', idSuffix: 'SbSpeed', kind: 'text' },
    { field: 'savingThrows', idSuffix: 'SbSavingThrows', kind: 'text' },
    { field: 'skills', idSuffix: 'SbSkills', kind: 'text' },
    { field: 'resistances', idSuffix: 'SbResistances', kind: 'text' },
    { field: 'immunities', idSuffix: 'SbImmunities', kind: 'text' },
    { field: 'vulnerabilities', idSuffix: 'SbVulnerabilities', kind: 'text' },
    { field: 'conditionImmunities', idSuffix: 'SbConditionImmunities', kind: 'text' },
    { field: 'senses', idSuffix: 'SbSenses', kind: 'text' },
    { field: 'passivePerception', idSuffix: 'SbPassivePerception', kind: 'number' },
    { field: 'languages', idSuffix: 'SbLanguages', kind: 'text' },
    { field: 'challengeRating', idSuffix: 'SbChallengeRating', kind: 'text' },
  ];

  function collectStatBlock(prefix){
    const sb = collectFieldMap(STAT_BLOCK_MAP, prefix);
    sb.abilities = {
      str: getFieldValue('number', prefix+'SbStr'), dex: getFieldValue('number', prefix+'SbDex'),
      con: getFieldValue('number', prefix+'SbCon'), int: getFieldValue('number', prefix+'SbInt'),
      wis: getFieldValue('number', prefix+'SbWis'), cha: getFieldValue('number', prefix+'SbCha'),
    };
    sb.traits = collectRepeaterRows(prefix+'SbTraits');
    sb.actions = collectRepeaterRows(prefix+'SbActions');
    sb.legendaryActions = collectRepeaterRows(prefix+'SbLegendaryActions');
    sb.reactions = collectRepeaterRows(prefix+'SbReactions');
    return sb;
  }
  function populateStatBlock(prefix, sb){
    sb = sb || {};
    populateFieldMap(STAT_BLOCK_MAP, prefix, sb);
    const ab = sb.abilities || {};
    setFieldValue('number', prefix+'SbStr', ab.str); setFieldValue('number', prefix+'SbDex', ab.dex);
    setFieldValue('number', prefix+'SbCon', ab.con); setFieldValue('number', prefix+'SbInt', ab.int);
    setFieldValue('number', prefix+'SbWis', ab.wis); setFieldValue('number', prefix+'SbCha', ab.cha);
    populateRepeater(prefix+'SbTraits', 'namedTextItem', sb.traits);
    populateRepeater(prefix+'SbActions', 'namedTextItem', sb.actions);
    populateRepeater(prefix+'SbLegendaryActions', 'namedTextItem', sb.legendaryActions);
    populateRepeater(prefix+'SbReactions', 'namedTextItem', sb.reactions);
  }
  function wireStatBlockToggle(prefix){
    const cb = document.getElementById(prefix+'HasStatBlock');
    const section = document.getElementById(prefix+'StatBlockFields');
    cb.addEventListener('change', ()=>{ section.style.display = cb.checked ? '' : 'none'; });
  }
  wireStatBlockToggle('ckf'); wireStatBlockToggle('ekf');

  function renderKeyFigureGrid(){
    const body = document.getElementById('keyFigureGridBody');
    body.innerHTML = keyFigures.map(k=> \`
      <tr>
        <td>\${k.name||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${k.status||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${k.threatLevel||''}</td>
        <td style="font-size:9px; color:var(--text-faint);">\${k.consoleEditedByEmail||'—'}</td>
        <td><button class="rowbtn" data-edit-key-figure="\${k._id}">Edit</button></td>
      </tr>
    \`).join('');
    document.getElementById('keyFigureCountTag').textContent = keyFigures.length;
    body.querySelectorAll('[data-edit-key-figure]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditKeyFigure(btn.dataset.editKeyFigure));
    });
  }

  document.getElementById('ckfSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('ckfFlag');
    const world = document.getElementById('ckfWorld').value || undefined;
    const unit = document.getElementById('ckfUnit').value || undefined;
    const rest = collectFieldMap(KEY_FIGURE_EDIT_MAP, 'ckf');
    const hasStatBlock = getFieldValue('checkbox', 'ckfHasStatBlock');
    if(!rest.name){ flag.textContent = 'Name is required.'; flag.className = 'savedflag show err'; return; }
    try{
      const body = { world, unit, ...rest, hasStatBlock };
      if(hasStatBlock) body.statBlock = collectStatBlock('ckf');
      const res = await fetch('/api/key-figure', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      keyFigures.push({ _id: result.id, ...body });
      flag.textContent = '✓ Created.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('keyFigures'), 900);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  let activeKeyFigureEditId = null;
  function openEditKeyFigure(id){
    const k = keyFigures.find(x=>x._id===id);
    if(!k) return;
    activeKeyFigureEditId = id;
    populateSelect('ekfFaction', factions, 'name', true);
    populateFieldMap(KEY_FIGURE_EDIT_MAP, 'ekf', k);
    setFieldValue('checkbox', 'ekfHasStatBlock', k.hasStatBlock);
    document.getElementById('ekfStatBlockFields').style.display = k.hasStatBlock ? '' : 'none';
    populateStatBlock('ekf', k.statBlock);
    document.getElementById('ekfAudit').textContent = auditLine(k);
    document.getElementById('ekfFlag').className = 'savedflag';
    switchView('editKeyFigure');
  }
  document.getElementById('ekfCancel').addEventListener('click', ()=> switchView('keyFigures'));
  document.getElementById('ekfSave').addEventListener('click', async ()=>{
    if(!activeKeyFigureEditId) return;
    const flag = document.getElementById('ekfFlag');
    const updates = collectFieldMap(KEY_FIGURE_EDIT_MAP, 'ekf');
    updates.hasStatBlock = getFieldValue('checkbox', 'ekfHasStatBlock');
    updates.statBlock = updates.hasStatBlock ? collectStatBlock('ekf') : null;
    try{
      await Promise.all(Object.entries(updates).map(([field,value])=> patchWikiField('key-figure', activeKeyFigureEditId, field, value)));
      const k = keyFigures.find(x=>x._id===activeKeyFigureEditId);
      if(k) Object.assign(k, updates);
      flag.textContent = '✓ Saved.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('keyFigures'), 700);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  // ---------- MAGIC ITEM (includes mechanics) ----------
  const MAGIC_ITEM_EDIT_MAP = [
    { field: 'name', idSuffix: 'Name', kind: 'text' },
    { field: 'itemType', idSuffix: 'ItemType', kind: 'text' },
    { field: 'rarity', idSuffix: 'Rarity', kind: 'select' },
    { field: 'currentHolder', idSuffix: 'CurrentHolder', kind: 'refSelect' },
    { field: 'foundAt', idSuffix: 'FoundAt', kind: 'refSelect' },
    { field: 'lore', idSuffix: 'Lore', kind: 'markdown' },
    { field: 'dmNotes', idSuffix: 'DmNotes', kind: 'markdown' },
  ];
  const MECHANICS_MAP = [
    { field: 'itemTypeDetail', idSuffix: 'MItemTypeDetail', kind: 'text' },
    { field: 'attunement', idSuffix: 'MAttunement', kind: 'text' },
    { field: 'text', idSuffix: 'MText', kind: 'text' },
  ];
  function wireMechanicsToggle(prefix){
    const cb = document.getElementById(prefix+'HasMechanics');
    const section = document.getElementById(prefix+'MechanicsFields');
    cb.addEventListener('change', ()=>{ section.style.display = cb.checked ? '' : 'none'; });
  }
  wireMechanicsToggle('cmi'); wireMechanicsToggle('emi');

  function renderMagicItemGrid(){
    const body = document.getElementById('magicItemGridBody');
    body.innerHTML = magicItems.map(m=> \`
      <tr>
        <td>\${m.name||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${m.rarity||''}</td>
        <td style="font-size:9px; color:var(--text-faint);">\${m.consoleEditedByEmail||'—'}</td>
        <td><button class="rowbtn" data-edit-magic-item="\${m._id}">Edit</button></td>
      </tr>
    \`).join('');
    document.getElementById('magicItemCountTag').textContent = magicItems.length;
    body.querySelectorAll('[data-edit-magic-item]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditMagicItem(btn.dataset.editMagicItem));
    });
  }

  document.getElementById('cmiSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('cmiFlag');
    const world = document.getElementById('cmiWorld').value || undefined;
    const unit = document.getElementById('cmiUnit').value || undefined;
    const rest = collectFieldMap(MAGIC_ITEM_EDIT_MAP, 'cmi');
    const hasMechanics = getFieldValue('checkbox', 'cmiHasMechanics');
    if(!rest.name){ flag.textContent = 'Name is required.'; flag.className = 'savedflag show err'; return; }
    try{
      const body = { world, unit, ...rest, hasMechanics };
      if(hasMechanics) body.mechanics = collectFieldMap(MECHANICS_MAP, 'cmi');
      const res = await fetch('/api/magic-item', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      magicItems.push({ _id: result.id, ...body });
      flag.textContent = '✓ Created.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('magicItems'), 900);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  let activeMagicItemEditId = null;
  function openEditMagicItem(id){
    const m = magicItems.find(x=>x._id===id);
    if(!m) return;
    activeMagicItemEditId = id;
    populateSelect('emiCurrentHolder', keyFigures, 'name', true);
    populateSelect('emiFoundAt', notablePlaces, 'name', true);
    populateFieldMap(MAGIC_ITEM_EDIT_MAP, 'emi', m);
    setFieldValue('checkbox', 'emiHasMechanics', m.hasMechanics);
    document.getElementById('emiMechanicsFields').style.display = m.hasMechanics ? '' : 'none';
    populateFieldMap(MECHANICS_MAP, 'emi', m.mechanics || {});
    document.getElementById('emiAudit').textContent = auditLine(m);
    document.getElementById('emiFlag').className = 'savedflag';
    switchView('editMagicItem');
  }
  document.getElementById('emiCancel').addEventListener('click', ()=> switchView('magicItems'));
  document.getElementById('emiSave').addEventListener('click', async ()=>{
    if(!activeMagicItemEditId) return;
    const flag = document.getElementById('emiFlag');
    const updates = collectFieldMap(MAGIC_ITEM_EDIT_MAP, 'emi');
    updates.hasMechanics = getFieldValue('checkbox', 'emiHasMechanics');
    updates.mechanics = updates.hasMechanics ? collectFieldMap(MECHANICS_MAP, 'emi') : null;
    try{
      await Promise.all(Object.entries(updates).map(([field,value])=> patchWikiField('magic-item', activeMagicItemEditId, field, value)));
      const m = magicItems.find(x=>x._id===activeMagicItemEditId);
      if(m) Object.assign(m, updates);
      flag.textContent = '✓ Saved.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('magicItems'), 700);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  // ---------- LORE ENTRY ----------
  const LORE_ENTRY_EDIT_MAP = [
    { field: 'title', idSuffix: 'Title', kind: 'text' },
    { field: 'unit', idSuffix: 'Unit', kind: 'refSelect' },
    { field: 'alsoKnownAs', idSuffix: 'AlsoKnownAs', kind: 'text' },
    { field: 'category', idSuffix: 'Category', kind: 'select' },
    { field: 'summary', idSuffix: 'Summary', kind: 'text' },
    { field: 'body', idSuffix: 'Body', kind: 'markdown' },
    { field: 'canonStatus', idSuffix: 'CanonStatus', kind: 'select' },
    { field: 'firstAppeared', idSuffix: 'FirstAppeared', kind: 'text' },
    { field: 'relatedEntries', idSuffix: 'RelatedEntries', kind: 'multiSelect' },
    { field: 'tags', idSuffix: 'Tags', kind: 'commaList' },
    { field: 'submittedBy', idSuffix: 'SubmittedBy', kind: 'refSelect' },
  ];

  function renderLoreEntryGrid(){
    const body = document.getElementById('loreEntryGridBody');
    body.innerHTML = loreEntries.map(l=> \`
      <tr>
        <td>\${l.title||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${l.category||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${l.canonStatus||''}</td>
        <td style="font-size:9px; color:var(--text-faint);">\${l.consoleEditedByEmail||'—'}</td>
        <td><button class="rowbtn" data-edit-lore-entry="\${l._id}">Edit</button></td>
      </tr>
    \`).join('');
    document.getElementById('loreEntryCountTag').textContent = loreEntries.length;
    body.querySelectorAll('[data-edit-lore-entry]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditLoreEntry(btn.dataset.editLoreEntry));
    });
  }

  document.getElementById('cleSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('cleFlag');
    const world = document.getElementById('cleWorld').value;
    const rest = collectFieldMap(LORE_ENTRY_EDIT_MAP, 'cle');
    if(!world || !rest.title){ flag.textContent = 'World and Title are required.'; flag.className = 'savedflag show err'; return; }
    try{
      const res = await fetch('/api/lore-entry', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ world, ...rest }) });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      loreEntries.push({ _id: result.id, world, ...rest });
      flag.textContent = '✓ Created.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('loreEntries'), 900);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  let activeLoreEntryEditId = null;
  function openEditLoreEntry(id){
    const l = loreEntries.find(x=>x._id===id);
    if(!l) return;
    activeLoreEntryEditId = id;
    document.getElementById('eleWorldTitle').value = worldNameFor(l.world);
    populateSelect('eleUnit', worldUnits, 'name', true);
    populateSelect('eleRelatedEntries', loreEntries.filter(x=>x._id!==id), 'title');
    populateSelect('eleSubmittedBy', teamMembers, 'handle', true);
    populateFieldMap(LORE_ENTRY_EDIT_MAP, 'ele', l);
    document.getElementById('eleAudit').textContent = auditLine(l);
    document.getElementById('eleFlag').className = 'savedflag';
    switchView('editLoreEntry');
  }
  document.getElementById('eleCancel').addEventListener('click', ()=> switchView('loreEntries'));
  document.getElementById('eleSave').addEventListener('click', async ()=>{
    if(!activeLoreEntryEditId) return;
    const flag = document.getElementById('eleFlag');
    const updates = collectFieldMap(LORE_ENTRY_EDIT_MAP, 'ele');
    try{
      await Promise.all(Object.entries(updates).map(([field,value])=> patchWikiField('lore-entry', activeLoreEntryEditId, field, value)));
      const l = loreEntries.find(x=>x._id===activeLoreEntryEditId);
      if(l) Object.assign(l, updates);
      flag.textContent = '✓ Saved.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('loreEntries'), 700);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  // ---------- NOTABLE PLACE ----------
  const NOTABLE_PLACE_EDIT_MAP = [
    { field: 'name', idSuffix: 'Name', kind: 'text' },
    { field: 'placeType', idSuffix: 'PlaceType', kind: 'text' },
    { field: 'dangerLevel', idSuffix: 'DangerLevel', kind: 'select' },
    { field: 'description', idSuffix: 'Description', kind: 'markdown' },
    { field: 'keyFigures', idSuffix: 'KeyFigures', kind: 'multiSelect' },
    { field: 'items', idSuffix: 'Items', kind: 'multiSelect' },
    { field: 'dmNotes', idSuffix: 'DmNotes', kind: 'markdown' },
  ];

  function renderNotablePlaceGrid(){
    const body = document.getElementById('notablePlaceGridBody');
    body.innerHTML = notablePlaces.map(p=> \`
      <tr>
        <td>\${p.name||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${p.placeType||''}</td>
        <td style="font-size:10px; color:var(--text-dim);">\${p.dangerLevel||''}</td>
        <td style="font-size:9px; color:var(--text-faint);">\${p.consoleEditedByEmail||'—'}</td>
        <td><button class="rowbtn" data-edit-notable-place="\${p._id}">Edit</button></td>
      </tr>
    \`).join('');
    document.getElementById('notablePlaceCountTag').textContent = notablePlaces.length;
    body.querySelectorAll('[data-edit-notable-place]').forEach(btn=>{
      btn.addEventListener('click', ()=> openEditNotablePlace(btn.dataset.editNotablePlace));
    });
  }

  document.getElementById('cnpSubmit').addEventListener('click', async ()=>{
    const flag = document.getElementById('cnpFlag');
    const world = document.getElementById('cnpWorld').value || undefined;
    const unit = document.getElementById('cnpUnit').value || undefined;
    const rest = collectFieldMap(NOTABLE_PLACE_EDIT_MAP, 'cnp');
    if(!rest.name){ flag.textContent = 'Name is required.'; flag.className = 'savedflag show err'; return; }
    try{
      const res = await fetch('/api/notable-place', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ world, unit, ...rest }) });
      const result = await res.json();
      if(!res.ok) throw new Error(result.error || res.statusText);
      notablePlaces.push({ _id: result.id, world, unit, ...rest });
      flag.textContent = '✓ Created.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('notablePlaces'), 900);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  let activeNotablePlaceEditId = null;
  function openEditNotablePlace(id){
    const p = notablePlaces.find(x=>x._id===id);
    if(!p) return;
    activeNotablePlaceEditId = id;
    populateSelect('enpKeyFigures', keyFigures, 'name');
    populateSelect('enpItems', magicItems, 'name');
    populateFieldMap(NOTABLE_PLACE_EDIT_MAP, 'enp', p);
    document.getElementById('enpAudit').textContent = auditLine(p);
    document.getElementById('enpFlag').className = 'savedflag';
    switchView('editNotablePlace');
  }
  document.getElementById('enpCancel').addEventListener('click', ()=> switchView('notablePlaces'));
  document.getElementById('enpSave').addEventListener('click', async ()=>{
    if(!activeNotablePlaceEditId) return;
    const flag = document.getElementById('enpFlag');
    const updates = collectFieldMap(NOTABLE_PLACE_EDIT_MAP, 'enp');
    try{
      await Promise.all(Object.entries(updates).map(([field,value])=> patchWikiField('notable-place', activeNotablePlaceEditId, field, value)));
      const p = notablePlaces.find(x=>x._id===activeNotablePlaceEditId);
      if(p) Object.assign(p, updates);
      flag.textContent = '✓ Saved.'; flag.className = 'savedflag show';
      setTimeout(()=>switchView('notablePlaces'), 700);
    }catch(err){ flag.textContent = 'Failed: ' + err.message; flag.className = 'savedflag show err'; }
  });

  // ---------- WIKI VIEWS registration ----------
  Object.assign(VIEWS, {
    worldUnits: { panel: 'worldUnitsView', title: 'My World Units', toolbar: false },
    createWorldUnit: { panel: 'createWorldUnitView', title: 'Create World Unit', toolbar: false },
    editWorldUnit: { panel: 'editWorldUnitView', title: 'Edit World Unit', toolbar: false },
    factions: { panel: 'factionsView', title: 'My Factions', toolbar: false },
    createFaction: { panel: 'createFactionView', title: 'Create Faction', toolbar: false },
    editFaction: { panel: 'editFactionView', title: 'Edit Faction', toolbar: false },
    keyFigures: { panel: 'keyFiguresView', title: 'My Key Figures', toolbar: false },
    createKeyFigure: { panel: 'createKeyFigureView', title: 'Create Key Figure', toolbar: false },
    editKeyFigure: { panel: 'editKeyFigureView', title: 'Edit Key Figure', toolbar: false },
    magicItems: { panel: 'magicItemsView', title: 'My Magic Items', toolbar: false },
    createMagicItem: { panel: 'createMagicItemView', title: 'Create Magic Item', toolbar: false },
    editMagicItem: { panel: 'editMagicItemView', title: 'Edit Magic Item', toolbar: false },
    loreEntries: { panel: 'loreEntriesView', title: 'My Lore Entries', toolbar: false },
    createLoreEntry: { panel: 'createLoreEntryView', title: 'Create Lore Entry', toolbar: false },
    editLoreEntry: { panel: 'editLoreEntryView', title: 'Edit Lore Entry', toolbar: false },
    notablePlaces: { panel: 'notablePlacesView', title: 'My Notable Places', toolbar: false },
    createNotablePlace: { panel: 'createNotablePlaceView', title: 'Create Notable Place', toolbar: false },
    editNotablePlace: { panel: 'editNotablePlaceView', title: 'Edit Notable Place', toolbar: false },
    bulkWiki: { panel: 'bulkWikiView', title: 'Wiki', toolbar: false },
    myProfile: { panel: 'myProfileView', title: 'My Bio', toolbar: false },
    createArticle: { panel: 'createArticleView', title: 'New Article', toolbar: false },
    myArticles: { panel: 'myArticlesView', title: 'My Articles', toolbar: false },
    editArticle: { panel: 'editArticleView', title: 'Article Detail', toolbar: false },
    adminLink: { panel: 'adminLinkView', title: 'Link Team Members', toolbar: false },
  });
  [
    'createWorldUnitView','editWorldUnitView','createFactionView','editFactionView',
    'createKeyFigureView','editKeyFigureView','createMagicItemView','editMagicItemView',
    'createLoreEntryView','editLoreEntryView','createNotablePlaceView','editNotablePlaceView',
    'myProfileView','createArticleView','editArticleView',
  ].forEach(p=> EDITOR_PANELS.add(p));

  document.getElementById('bwCopyPrompt').addEventListener('click', async ()=>{
    const flag = document.getElementById('bwCopyFlag');
    try{
      const res = await fetch('/console/templates/wiki-import-prompt.txt');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      flag.textContent = '✓ Copied.';
      flag.className = 'savedflag show';
    }catch(err){
      flag.textContent = 'Copy failed — see /console/templates/wiki-import-prompt.txt';
      flag.className = 'savedflag show err';
    }
  });

  // Renders the per-item report as a real table via DOM APIs (not
  // innerHTML string-concat) — document names/error reasons here can
  // contain arbitrary text a GM typed or an AI agent generated, so this
  // avoids any HTML-injection risk from that content.
  function renderBulkWikiResults(data){
    const container = document.getElementById('bwResults');
    container.innerHTML = '';
    const summary = document.createElement('p');
    summary.className = 'hint';
    summary.textContent = \`Created \${data.created}, updated \${data.updated}, failed \${data.failed}.\`;
    container.appendChild(summary);

    if(data.report && data.report.length){
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Type</th><th>Name</th><th>Status</th><th>Reason</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      data.report.forEach(r=>{
        const tr = document.createElement('tr');
        [r.type, r.name, r.status, r.reason || ''].forEach(text=>{
          const td = document.createElement('td');
          td.textContent = text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }

    if(data.warnings && data.warnings.length){
      const warnHeading = document.createElement('p');
      warnHeading.className = 'hint';
      warnHeading.textContent = 'Warnings (entry still imported, this field/reference was dropped):';
      container.appendChild(warnHeading);
      const ul = document.createElement('ul');
      data.warnings.forEach(w=>{
        const li = document.createElement('li');
        li.textContent = w;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }
  }

  document.getElementById('bwImport').addEventListener('click', async ()=>{
    const flag = document.getElementById('bwFlag');
    const worldId = document.getElementById('bwWorld').value;
    const fileInput = document.getElementById('bwFile');
    const file = fileInput.files[0];
    if(!worldId){ flag.textContent = 'Pick a target World first.'; flag.className = 'savedflag show err'; return; }
    if(!file){ flag.textContent = 'Choose a JSON file first.'; flag.className = 'savedflag show err'; return; }

    const form = new FormData();
    form.append('file', file);
    form.append('worldId', worldId);

    flag.textContent = 'Importing…';
    flag.className = 'savedflag show';
    try{
      const res = await fetch('/api/import/wiki', { method: 'POST', body: form });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || res.statusText);
      flag.textContent = '✓ Import complete.';
      flag.className = 'savedflag show';
      renderBulkWikiResults(data);
    }catch(err){
      flag.textContent = 'Import failed: ' + err.message;
      flag.className = 'savedflag show err';
    }
  });

  // Re-populate the relevant selects/grid each time a WORLD BUILDING view
  // is switched into — mirrors switchView()'s existing
  // populateThemeSelect()/populateCampaignSelect() calls for create*.
  const _origSwitchView = switchView;
  switchView = function(view){
    _origSwitchView(view);
    if(view === 'worldUnits') renderWorldUnitGrid();
    if(view === 'factions') renderFactionGrid();
    if(view === 'keyFigures') renderKeyFigureGrid();
    if(view === 'magicItems') renderMagicItemGrid();
    if(view === 'loreEntries') renderLoreEntryGrid();
    if(view === 'notablePlaces') renderNotablePlaceGrid();
    if(view === 'createWorldUnit'){ populateSelect('cwuWorld', worlds, 'name'); populateSelect('cwuDmOwner', teamMembers, 'handle', true); }
    if(view === 'createFaction'){ populateSelect('cfaWorld', worlds, 'name', true); populateSelect('cfaUnit', worldUnits, 'name', true); populateSelect('cfaMembers', keyFigures, 'name'); }
    if(view === 'createKeyFigure'){ populateSelect('ckfWorld', worlds, 'name', true); populateSelect('ckfUnit', worldUnits, 'name', true); populateSelect('ckfFaction', factions, 'name', true); }
    if(view === 'createMagicItem'){ populateSelect('cmiWorld', worlds, 'name', true); populateSelect('cmiUnit', worldUnits, 'name', true); populateSelect('cmiCurrentHolder', keyFigures, 'name', true); populateSelect('cmiFoundAt', notablePlaces, 'name', true); }
    if(view === 'createLoreEntry'){ populateSelect('cleWorld', worlds, 'name'); populateSelect('cleUnit', worldUnits, 'name', true); populateSelect('cleRelatedEntries', loreEntries, 'title'); populateSelect('cleSubmittedBy', teamMembers, 'handle', true); }
    if(view === 'createNotablePlace'){ populateSelect('cnpWorld', worlds, 'name', true); populateSelect('cnpUnit', worldUnits, 'name', true); populateSelect('cnpKeyFigures', keyFigures, 'name'); populateSelect('cnpItems', magicItems, 'name'); }
    if(view === 'bulkWiki'){ populateSelect('bwWorld', worlds, 'name'); document.getElementById('bwResults').innerHTML = ''; document.getElementById('bwFlag').textContent = ''; }
    if(view === 'myProfile') renderMyProfileForm();
    if(view === 'myArticles') renderMyArticleGrid();
    if(view === 'createArticle'){
      populateSelect('caWorlds', worlds, 'name');
      ['caTitle','caExcerpt','caTags','caBody'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('caCategory').value = '';
      caCoverImageAsset = null;
      renderExistingThumb('ca', null);
      document.getElementById('caSizeWarn').textContent = '';
      document.getElementById('caFlag').className = 'savedflag';
    }
    if(view === 'editArticle') populateSelect('eaWorlds', worlds, 'name');
    if(view === 'adminLink'){ document.getElementById('alFlag').className = 'savedflag'; loadAdminMembers(); }
  };

  renderGrid();
`;
