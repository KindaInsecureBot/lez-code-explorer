/* ============================================================
   LEZ Code Explorer — Application Logic
   ============================================================ */
(function () {
  'use strict';

  var activeFileKey = null;

  /* ---- Boot ---- */
  document.addEventListener('DOMContentLoaded', function () {
    buildTree();
  });

  /* ---- File Tree ---- */
  function buildTree() {
    var tree = document.getElementById('file-tree');
    var groups = { token: [], amm: [] };

    Object.keys(FILES).forEach(function (key) {
      if (key.startsWith('token/')) groups.token.push(key);
      else if (key.startsWith('amm/')) groups.amm.push(key);
    });

    ['token', 'amm'].forEach(function (prog) {
      var keys = groups[prog];
      if (!keys.length) return;

      var group = document.createElement('div');
      group.className = 'tree-group';

      var label = document.createElement('div');
      label.className = 'tree-group-label';
      label.textContent = prog === 'token' ? 'Token Program' : 'AMM Program';
      label.addEventListener('click', function () {
        group.classList.toggle('collapsed');
      });

      var items = document.createElement('div');
      items.className = 'tree-items';

      keys.forEach(function (key) {
        var item = document.createElement('div');
        item.className = 'tree-item';
        item.title = key;
        var parts = key.split('/');
        item.textContent = parts[parts.length - 1];
        item.addEventListener('click', function () {
          renderFile(key);
          document.getElementById('sidebar').classList.add('hidden');
        });
        items.appendChild(item);
      });

      group.appendChild(label);
      group.appendChild(items);
      tree.appendChild(group);
    });
  }

  /* ---- Render File ---- */
  function renderFile(fileKey) {
    var file = FILES[fileKey];
    if (!file) return;

    activeFileKey = fileKey;

    // Sidebar highlight
    document.querySelectorAll('.tree-item').forEach(function (el) {
      el.classList.toggle('active', el.title === fileKey);
    });

    // Header
    var hdr = document.getElementById('header-content');
    hdr.innerHTML = '<span class="path">' + esc(fileKey) + '</span>' +
      (file.description ? ' &mdash; <span class="desc">' + esc(file.description) + '</span>' : '');

    // Show toolbar
    document.getElementById('toolbar').style.display = '';

    // Build code table
    var lines = file.code.replace(/\n$/, '').split('\n');
    var exps = file.explanations || {};

    var html = '<table class="code-table"><tbody>';
    lines.forEach(function (rawLine, idx) {
      var n = idx + 1;
      var expHtml = exps[n] || fallbackExplanation(rawLine, n);
      var hasExp = !!expHtml;

      html += '<tr class="code-line" id="line-' + n + '" onclick="' +
        (hasExp ? '_lez.toggle(' + n + ')' : '') + '">' +
        '<td class="line-num">' + n + '</td>' +
        '<td class="line-code">' + highlightRust(rawLine) + '</td></tr>';

      html += '<tr class="explanation-row" id="expl-' + n + '">' +
        '<td class="explanation-cell" colspan="2">' +
        (expHtml || '') + '</td></tr>';
    });
    html += '</tbody></table>';

    var container = document.getElementById('code-container');
    // Hide welcome screen if present
    var welcome = document.getElementById('welcome');
    if (welcome) welcome.style.display = 'none';
    container.innerHTML = html;
  }

  /* ---- Toggle Explanation ---- */
  function toggleExplanation(lineNum) {
    var row = document.getElementById('expl-' + lineNum);
    var lineRow = document.getElementById('line-' + lineNum);
    if (!row) return;
    var isOpen = row.classList.contains('visible');
    // Close all
    document.querySelectorAll('.explanation-row.visible').forEach(function (r) {
      r.classList.remove('visible');
    });
    document.querySelectorAll('.code-line.expanded').forEach(function (r) {
      r.classList.remove('expanded');
    });
    if (!isOpen) {
      row.classList.add('visible');
      if (lineRow) lineRow.classList.add('expanded');
      setTimeout(function () {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 30);
    }
  }

  window._lez = { toggle: toggleExplanation };

  /* ---- Expand / Collapse All ---- */
  window.expandAll = function () {
    document.querySelectorAll('.explanation-row').forEach(function (r) {
      var td = r.querySelector('td');
      if (td && td.textContent.trim()) r.classList.add('visible');
    });
    document.querySelectorAll('.code-line').forEach(function (r) {
      r.classList.add('expanded');
    });
  };
  window.collapseAll = function () {
    document.querySelectorAll('.explanation-row.visible').forEach(function (r) {
      r.classList.remove('visible');
    });
    document.querySelectorAll('.code-line.expanded').forEach(function (r) {
      r.classList.remove('expanded');
    });
  };

  /* ================================================================
     Fallback Explanation Generator
     For lines without a hand-written explanation, generate a
     concise automatic explanation based on the line's content.
     ================================================================ */
  function fallbackExplanation(line, lineNum) {
    var t = line.trim();
    if (!t || t === '{' || t === '}' || t === '};' || t === ')' || t === ');' || t === ',' || t === '=>') return null;

    // Doc comment ///
    if (/^\/\/\//.test(t)) {
      var msg = t.replace(/^\/\/\/\s*/, '');
      return '<strong>Doc comment</strong> — Documentation attached to the next item. ' +
        (msg ? 'Says: <em>' + esc(msg) + '</em>. ' : '') +
        'In Python this is like a docstring or <code># comment</code>.';
    }
    // Regular comment //
    if (/^\/\//.test(t)) {
      var msg = t.replace(/^\/\/\s*/, '');
      return '<strong>Comment</strong> — ' + (msg ? esc(msg) : 'Inline note for readers; ignored by the compiler.');
    }
    // use statement
    if (/^use\s/.test(t)) {
      var path = t.replace(/^use\s+/, '').replace(/;$/, '');
      return '<strong><code>use</code> import</strong> — Brings <code>' + esc(path) + '</code> into scope. ' +
        'Like <code>from some.module import Something</code> in Python.';
    }
    // pub fn / fn signature
    if (/^pub\s+fn\s|^fn\s/.test(t)) {
      var name = (t.match(/fn\s+(\w+)/) || [])[1] || '';
      return '<strong>Function definition</strong> — Defines <code>' + esc(name) + '</code>. ' +
        'Like <code>def ' + esc(name) + '(...):</code> in Python. ' +
        'Click lines inside to explore parameters and logic.';
    }
    // pub struct
    if (/^pub\s+struct\s|^struct\s/.test(t)) {
      var name = (t.match(/struct\s+(\w+)/) || [])[1] || '';
      return '<strong>Struct definition</strong> — <code>' + esc(name) + '</code> is a data structure. ' +
        'Like a Python <code>class ' + esc(name) + ':</code> with only <code>__init__</code> fields, no methods here.';
    }
    // pub enum
    if (/^pub\s+enum\s|^enum\s/.test(t)) {
      var name = (t.match(/enum\s+(\w+)/) || [])[1] || '';
      return '<strong>Enum definition</strong> — <code>' + esc(name) + '</code> is a type with named variants, each potentially carrying data. ' +
        'Much more powerful than Python\'s <code>enum.Enum</code> — closer to a tagged union.';
    }
    // impl block
    if (/^impl\b/.test(t)) {
      return '<strong><code>impl</code> block</strong> — Attaches method or trait implementations to a type. ' +
        'Like defining methods inside a Python <code>class</code>.';
    }
    // #[derive(...)]
    if (/^#\[derive/.test(t)) {
      var traits = (t.match(/derive\(([^)]+)\)/) || [])[1] || '';
      return '<strong><code>#[derive(...)]</code> attribute</strong> — Auto-generates trait implementations: <code>' + esc(traits) + '</code>. ' +
        'Like Python dataclass decorators that auto-generate <code>__eq__</code>, <code>__repr__</code>, etc.';
    }
    // Other attribute #[...]
    if (/^#\[/.test(t)) {
      return '<strong>Attribute</strong> — Compiler directive: <code>' + esc(t) + '</code>. ' +
        'Like a Python decorator but applied at compile-time.';
    }
    // let mut
    if (/^let\s+mut\s/.test(t)) {
      var name = (t.match(/let\s+mut\s+(\w+)/) || [])[1] || 'x';
      return '<strong><code>let mut</code> binding</strong> — Declares a <em>mutable</em> variable <code>' + esc(name) + '</code>. ' +
        'In Python all variables are mutable by default; in Rust you must opt-in with <code>mut</code>.';
    }
    // let (immutable)
    if (/^let\s/.test(t)) {
      var name = (t.match(/let\s+(\w+)/) || [])[1] || 'x';
      return '<strong><code>let</code> binding</strong> — Declares an <em>immutable</em> variable <code>' + esc(name) + '</code>. ' +
        'Like <code>' + esc(name) + ' = ...</code> in Python except it cannot be reassigned.';
    }
    // assert! / assert_eq!
    if (/^assert(_eq|_ne)?!/.test(t)) {
      var macro = (t.match(/^(assert\w*!)/) || [])[1] || 'assert!';
      return '<strong><code>' + esc(macro) + '</code> macro</strong> — Runtime guard that panics (crashes) if the condition fails. ' +
        'Like Python\'s <code>assert</code> statement, but always active (not removed by optimizations).';
    }
    // panic!
    if (/^panic!/.test(t)) {
      return '<strong><code>panic!</code> macro</strong> — Immediately terminates with an error message. ' +
        'Like Python\'s <code>raise RuntimeError(...)</code>.';
    }
    // match expression
    if (/^match\s/.test(t)) {
      return '<strong><code>match</code> expression</strong> — Pattern-matches a value against cases exhaustively. ' +
        'Like a Python <code>match</code>/<code>case</code> (3.10+) or a chain of <code>if isinstance(x, Foo):</code>.';
    }
    // vec! macro
    if (/\bvec!\[/.test(t) || /^vec!\[/.test(t)) {
      return '<strong><code>vec![...]</code> macro</strong> — Creates a heap-allocated list. ' +
        'Equivalent to a Python <code>list</code> literal <code>[...]</code>.';
    }
    // return statement
    if (/^return\s/.test(t)) {
      return '<strong><code>return</code></strong> — Returns a value from the function. ' +
        'Same as Python\'s <code>return</code>.';
    }
    // Field or variant line ending with comma (inside struct/enum)
    if (/^\w+:\s/.test(t) && t.endsWith(',')) {
      var field = (t.match(/^(\w+):/) || [])[1] || '';
      return '<strong>Field <code>' + esc(field) + '</code></strong> — A named field in a struct or a key in a struct literal. ' +
        'Like an attribute in a Python <code>__init__</code>.';
    }
    // Closing with vec! return pattern
    if (/^vec!\[/.test(t)) {
      return '<strong>Return value</strong> — Returns a list of account state changes to the runtime.';
    }

    return null;
  }

  /* ================================================================
     Rust Syntax Highlighter — character-level tokenizer
     Uses CSS classes matching index.html: .kw .ty .fn .str .cm .mc .num .lf
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
    if (!line.trim()) return '\u00a0';
    var out = '', i = 0, len = line.length;
    while (i < len) {
      var c = line[i];
      // Line comment
      if (c === '/' && line[i+1] === '/') {
        out += '<span class="cm">' + esc(line.slice(i)) + '</span>';
        break;
      }
      // String literal
      if (c === '"') {
        var j = i+1;
        while (j < len) { if (line[j] === '\\') { j+=2; continue; } if (line[j] === '"') { j++; break; } j++; }
        out += '<span class="str">' + esc(line.slice(i,j)) + '</span>';
        i = j; continue;
      }
      // Char literal / lifetime
      if (c === "'") {
        if (i+1 < len && /[a-zA-Z_]/.test(line[i+1])) {
          var j = i+1; while (j < len && /[a-zA-Z0-9_]/.test(line[j])) j++;
          if (j >= len || line[j] !== "'") {
            out += '<span class="lf">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
          }
        }
        var j = i+1; if (j < len && line[j] === '\\') j+=2; else j++;
        if (j < len && line[j] === "'") j++;
        out += '<span class="str">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
      }
      // Attribute #[...]
      if (c === '#' && line[i+1] === '[') {
        var j = i, depth = 0;
        while (j < len) { if (line[j]==='[') depth++; else if (line[j]===']') { depth--; if (!depth) { j++; break; } } j++; }
        out += '<span class="mc">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
      }
      // Number
      if (/[0-9]/.test(c) && (i===0 || !/[a-zA-Z_]/.test(line[i-1]))) {
        var j = i; while (j < len && /[0-9_a-zA-Z.xXbBoO]/.test(line[j])) j++;
        out += '<span class="num">' + esc(line.slice(i,j)) + '</span>'; i = j; continue;
      }
      // Identifier
      if (/[a-zA-Z_]/.test(c)) {
        var j = i; while (j < len && /[a-zA-Z0-9_]/.test(line[j])) j++;
        var word = line.slice(i,j);
        // Macro call: word followed by !
        if (j < len && line[j] === '!') {
          out += '<span class="mc">' + esc(word+'!') + '</span>'; i = j+1; continue;
        }
        if (KW.has(word)) out += '<span class="kw">' + esc(word) + '</span>';
        else if (PRIM.has(word)) out += '<span class="ty">' + esc(word) + '</span>';
        else if (STDT.has(word)) out += '<span class="ty">' + esc(word) + '</span>';
        else if (/^[A-Z]/.test(word)) out += '<span class="ty">' + esc(word) + '</span>';
        else if (j < len && line[j] === '(') out += '<span class="fn">' + esc(word) + '</span>';
        else out += esc(word);
        i = j; continue;
      }
      out += esc(c); i++;
    }
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();
