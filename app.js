// Syntax highlighting for Rust
function highlightRust(line) {
  // Escape HTML first
  line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Comments (// and ///)
  if (/^\s*\/\//.test(line)) {
    return `<span class="cm">${line}</span>`;
  }
  
  // Inline comments
  line = line.replace(/(\/\/[^"]*$)/g, '<span class="cm">$1</span>');
  
  // Strings
  line = line.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="str">$1</span>');
  
  // Numbers
  line = line.replace(/\b(\d+(?:u\d+|i\d+|f\d+)?)\b/g, '<span class="num">$1</span>');
  
  // Macros (word!)
  line = line.replace(/\b([a-z_]+!)/g, '<span class="mc">$1</span>');
  
  // Keywords
  const keywords = ['pub', 'fn', 'let', 'mut', 'use', 'mod', 'enum', 'struct', 'impl', 'for',
    'if', 'else', 'match', 'return', 'type', 'self', 'Self', 'crate', 'super', 'where',
    'as', 'in', 'ref', 'true', 'false', 'const', 'static', 'extern', 'unsafe', 'trait',
    'move', 'async', 'await', 'dyn', 'loop', 'while', 'break', 'continue'];
  
  keywords.forEach(kw => {
    const re = new RegExp(`\\b(${kw})\\b`, 'g');
    line = line.replace(re, '<span class="kw">$1</span>');
  });
  
  // Types (capitalized words)
  line = line.replace(/\b([A-Z][A-Za-z0-9]+)\b/g, (match, p1) => {
    if (['Self'].includes(p1)) return match; // already highlighted
    return `<span class="ty">${p1}</span>`;
  });
  
  // Function names after fn keyword
  line = line.replace(/(fn\s+)([a-z_][a-z0-9_]*)/g, '$1<span class="fn">$2</span>');
  
  // Lifetimes
  line = line.replace(/'([a-z]+)/g, '<span class="lf">\'$1</span>');
  
  // #[...] attributes
  line = line.replace(/(#\[(?:derive|expect|allow|cfg|test|doc)[^\]]*\])/g, '<span class="mc">$1</span>');
  
  return line;
}

function renderFile(fileKey) {
  const file = FILES[fileKey];
  if (!file) return;
  
  // Update sidebar active state
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-file="${fileKey}"]`)?.classList.add('active');
  
  // Update header
  document.getElementById('header-content').innerHTML = 
    `<span class="path">${fileKey}</span> <span class="desc">— ${file.description}</span>`;
  document.getElementById('toolbar').style.display = 'flex';
  
  // Build code table
  const lines = file.code.split('\n');
  let html = '<table class="code-table">';
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const explanation = file.explanations[lineNum];
    const hasExplanation = !!explanation;
    
    html += `<tr class="code-line${hasExplanation ? '' : ' no-explain'}" data-line="${lineNum}" onclick="toggleExplanation(${lineNum})">`;
    html += `<td class="line-num">${lineNum}</td>`;
    html += `<td class="line-code">${highlightRust(line)}</td>`;
    html += `</tr>`;
    
    if (hasExplanation) {
      html += `<tr class="explanation-row" id="expl-${lineNum}">`;
      html += `<td colspan="2" class="explanation-cell">${explanation}</td>`;
      html += `</tr>`;
    }
  });
  
  html += '</table>';
  
  document.getElementById('welcome')?.remove();
  document.getElementById('code-container').innerHTML = html;
  
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

function toggleExplanation(lineNum) {
  const row = document.getElementById(`expl-${lineNum}`);
  if (!row) return;
  
  const codeLine = document.querySelector(`tr[data-line="${lineNum}"]`);
  row.classList.toggle('visible');
  codeLine?.classList.toggle('expanded');
}

function expandAll() {
  document.querySelectorAll('.explanation-row').forEach(el => el.classList.add('visible'));
  document.querySelectorAll('.code-line').forEach(el => {
    if (document.getElementById(`expl-${el.dataset.line}`)) {
      el.classList.add('expanded');
    }
  });
}

function collapseAll() {
  document.querySelectorAll('.explanation-row').forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('.code-line').forEach(el => el.classList.remove('expanded'));
}

// Build file tree
function buildTree() {
  const tree = document.getElementById('file-tree');
  const groups = {};
  
  Object.keys(FILES).forEach(key => {
    const parts = key.split('/');
    const program = parts[1]; // 'token' or 'amm'
    if (!groups[program]) groups[program] = [];
    groups[program].push(key);
  });
  
  // Sort: token first, then amm
  ['token', 'amm'].forEach(program => {
    if (!groups[program]) return;
    
    const group = document.createElement('div');
    group.className = 'tree-group';
    
    const label = document.createElement('div');
    label.className = 'tree-group-label';
    label.textContent = program === 'token' ? 'Token Program' : 'AMM Program';
    label.onclick = () => group.classList.toggle('collapsed');
    group.appendChild(label);
    
    const items = document.createElement('div');
    items.className = 'tree-items';
    
    groups[program].sort().forEach(fileKey => {
      const item = document.createElement('div');
      item.className = 'tree-item';
      item.dataset.file = fileKey;
      // Show just the filename
      const parts = fileKey.split('/');
      const subpath = parts.slice(2).join('/');
      item.textContent = subpath;
      item.onclick = () => renderFile(fileKey);
      items.appendChild(item);
    });
    
    group.appendChild(items);
    tree.appendChild(group);
  });
}

buildTree();
