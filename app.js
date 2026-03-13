/* ============================================================
   LEZ Code Explorer — Application Logic
   ============================================================ */
(function () {
  'use strict';

  var activeFileId = null;
  var openExpKey = null;  // "fileId:lineNum"

  /* ---- Boot ---- */
  document.addEventListener('DOMContentLoaded', function () {
    buildFileTree();
  });

  /* ---- File Tree ---- */
  function buildFileTree() {
    var tree = document.getElementById('file-tree');
    var groups = { token: [], amm: [] };

    SOURCE_FILES.forEach(function (f) {
      if (groups[f.program]) groups[f.program].push(f);
    });

    ['token', 'amm'].forEach(function (prog) {
      var files = groups[prog];
      if (!files.length) return;

      var section = document.createElement('div');
      section.className = 'tree-section';

      var label = document.createElement('div');
      label.className = 'tree-section-label';
      label.innerHTML =
        '<span class="program-icon">&#9670;</span>' +
        '<span style="flex:1">' + (prog === 'token' ? 'Token Program' : 'AMM Program') + '</span>' +
        '<span class="section-icon">&#9660;</span>';
      label.addEventListener('click', function () {
        section.classList.toggle('collapsed');
      });

      var filesDiv = document.createElement('div');
      filesDiv.className = 'tree-section-files';

      files.forEach(function (f) {
        var item = document.createElement('div');
        item.className = 'tree-file';
        item.dataset.fileId = f.id;
        item.innerHTML =
          '<span class="file-icon">&#9670;</span>' +
          '<div style="min-width:0;overflow:hidden">' +
          '<div class="file-name">' + esc(f.name) + '</div>' +
          '<div class="file-desc">' + esc(f.label) + '</div>' +
          '</div>';
        item.addEventListener('click', function () { loadFile(f.id); });
        filesDiv.appendChild(item);
      });

      section.appendChild(label);
      section.appendChild(filesDiv);
      tree.appendChild(section);
    });
  }

  /* ---- Load File ---- */
  function loadFile(fileId) {
    var file = SOURCE_FILES.find(function (f) { return f.id === fileId; });
    if (!file) return;

    activeFileId = fileId;
    openExpKey = null;

    // Sidebar highlight
    document.querySelectorAll('.tree-file').forEach(function (el) {
      el.classList.toggle('active', el.dataset.fileId === fileId);
    });

    // Breadcrumb
    var bc = document.getElementById('file-breadcrumb');
    var parts = file.path.split('/');
    bc.innerHTML =
      '<span style="color:var(--text-muted)">' + esc(parts.slice(0, -1).join('/')) + '</span>' +
      '<span style="color:var(--bg-surface1)"> / </span>' +
      '<span class="bc-file">' + esc(parts[parts.length - 1]) + '</span>';

    // Render
    var view = document.getElementById('code-view');
    var lines = file.content.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();

    var exps = EXPLANATIONS[fileId] || {};
    var html = '<div class="code-file">';

    lines.forEach(function (rawLine, idx) {
      var n = idx + 1;
      var hasExp = !!exps[n];
      var expKey = fileId + ':' + n;

      html += '<div class="code-line-wrap" id="wrap-' + expKey + '">';
      html += '<div class="code-line' + (hasExp ? ' has-exp' : '') + '" data-key="' + expKey + '" onclick="' + (hasExp ? '_lez.toggle(\'' + expKey + '\')' : '') + '">';
      html += '<span class="line-num">' + n + '</span>';
      html += '<span class="line-code">' + highlightRust(rawLine) + '</span>';
      if (hasExp) html += '<span class="click-hint">click to explain</span>';
      html += '</div>';

      if (hasExp) {
        var exp = exps[n];
        html += '<div class="exp-panel" id="exp-' + expKey + '">';
        html += '<div class="exp-inner">';
        html += '<div class="exp-title">' + esc(exp.title) + '</div>';
        html += '<div class="exp-body">' + exp.body + '</div>';
        html += '</div></div>';
      }

      html += '</div>';
    });

    html += '</div>';
    view.innerHTML = html;
  }

  /* ---- Toggle Explanation ---- */
  function toggleExp(expKey) {
    // Close previous
    if (openExpKey && openExpKey !== expKey) {
      var prevPanel = document.getElementById('exp-' + openExpKey);
      var prevLine = document.querySelector('[data-key="' + openExpKey + '"]');
      if (prevPanel) prevPanel.classList.remove('open');
      if (prevLine) prevLine.classList.remove('active-line');
    }

    var panel = document.getElementById('exp-' + expKey);
    var lineEl = document.querySelector('[data-key="' + expKey + '"]');
    if (!panel) return;

    if (openExpKey === expKey) {
      panel.classList.remove('open');
      if (lineEl) lineEl.classList.remove('active-line');
      openExpKey = null;
    } else {
      panel.classList.add('open');
      if (lineEl) lineEl.classList.add('active-line');
      openExpKey = expKey;
      setTimeout(function () {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }
  }

  /* ---- Expose to HTML onclick ---- */
  window._lez = { toggle: toggleExp };

  /* ================================================================
     Rust Syntax Highlighter — character-level tokenizer
     ================================================================ */
  var KW = new Set(['as','async','await','break','const','continue','crate','dyn','else',
    'enum','extern','false','fn','for','if','impl','in','let','loop','match','mod','move',
    'mut','pub','ref','return','self','Self','static','struct','super','trait','true','type',
    'union','unsafe','use','where','while']);
  var PRIM = new Set(['bool','char','f32','f64','i8','i16','i32','i64','i128','isize',
    'str','u8','u16','u32','u64','u128','usize']);
  var STDT = new Set(['String','Vec','Option','Result','Box','HashMap','HashSet',
    'BTreeMap','BTreeSet','Rc','Arc','Cell','RefCell','Cow','Pin','PhantomData','NonZeroU128']);

  function highlightRust(line) {
    if (!line.trim()) return '&nbsp;';
    var out = '', i = 0, len = line.length;
    while (i < len) {
      var c = line[i];
      // Line comment
      if (c === '/' && line[i+1] === '/') {
        var cls2 = (line[i+2] === '/' || line[i+2] === '!') ? 'hl-doc' : 'hl-comment';
        out += '<span class="' + cls2 + '">' + esc(line.slice(i)) + '</span>';
        break;
      }
      // String
      if (c === '"') {
        var j = i+1;
        while (j < len) { if (line[j] === '\\') { j+=2; continue; } if (line[j] === '"') { j++; break; } j++; }
        out += '<span class="hl-string">' + esc(line.slice(i,j)) + '</span>';
        i = j; continue;
      }
      // Char/lifetime
      if (c === "'") {
        if (i+1 < len && /[a-zA-Z_]/.test(line[i+1])) {
          var j = i+1; while (j < len && /[a-zA-Z0-9_]/.test(line[j])) j++;
          if (j >= len || line[j] !== "'") { out += '<span class="hl-lifetime">' + esc(line.slice(i,j)) + '</span>'; i = j; continue; }
        }
        var j = i+1; if (j < len && line[j] === '\\') j+=2; else j++;
        if (j < len && line[j] === "'") j++;
        out += '<span class="hl-string">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
      }
      // Attribute #[
      if (c === '#' && line[i+1] === '[') {
        var j = i, depth = 0;
        while (j < len) { if (line[j]==='[') depth++; else if (line[j]===']') { depth--; if (!depth) { j++; break; } } j++; }
        out += '<span class="hl-attr">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
      }
      // Number
      if (/[0-9]/.test(c) && (i===0 || !/[a-zA-Z_]/.test(line[i-1]))) {
        var j = i; while (j < len && /[0-9_a-zA-Z.xXbBoO]/.test(line[j])) j++;
        out += '<span class="hl-number">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
      }
      // Identifier
      if (/[a-zA-Z_]/.test(c)) {
        var j = i; while (j < len && /[a-zA-Z0-9_]/.test(line[j])) j++;
        var word = line.slice(i,j);
        if (j < len && line[j] === '!') {
          out += '<span class="hl-macro">' + esc(word+'!') + '</span>'; i = j+1; continue;
        }
        if (word === 'self' || word === 'Self') out += '<span class="hl-self">' + esc(word) + '</span>';
        else if (word === 'true' || word === 'false') out += '<span class="hl-bool">' + esc(word) + '</span>';
        else if (KW.has(word)) out += '<span class="hl-keyword">' + esc(word) + '</span>';
        else if (PRIM.has(word)) out += '<span class="hl-type">' + esc(word) + '</span>';
        else if (STDT.has(word)) out += '<span class="hl-typename">' + esc(word) + '</span>';
        else if (/^[A-Z]/.test(word)) out += '<span class="hl-typename">' + esc(word) + '</span>';
        else if (j < len && line[j] === '(') out += '<span class="hl-fn-name">' + esc(word) + '</span>';
        else out += esc(word);
        i = j; continue;
      }
      // Operator
      if ('+-*/%=<>!&|^~'.includes(c)) { out += '<span class="hl-operator">' + esc(c) + '</span>'; i++; continue; }
      out += esc(c); i++;
    }
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
