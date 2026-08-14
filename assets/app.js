/* ============================================================
 * 求职冲刺营 · 站点逻辑（无任何外部依赖，纯原生 JS）
 * 功能：导航 / 路由 / Markdown 渲染 / 搜索 / 打卡进度 / 暗色模式
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 导航配置 ---------- */
  const NAV = [
    { group: '概览', items: [
      { id: '00-overview', title: '总览与时间线' },
      { id: '01-target',   title: '目标定位与公司' }
    ]},
    { group: 'OTA 专项', items: [
      { id: '14-ota', title: 'OTA 学习与复习' }
    ]},
    { group: 'C / C++', items: [
      { id: '02-c',     title: 'C 语言与数据结构' },
      { id: '13-memory', title: 'C 语言内存分布与管理' },
      { id: '11-cpp',   title: 'C++ 面试题' }
    ]},
    { group: '操作系统', items: [
      { id: '03-os',    title: '操作系统与 Linux' }
    ]},
    { group: '计算机网络', items: [
      { id: '04-net',   title: '网络与 MQTT' }
    ]},
    { group: '嵌入式', items: [
      { id: '12-embedded', title: '嵌入式基础' },
      { id: '05-auto',  title: '车载协议与 OTA' }
    ]},
    { group: '笔试算法', items: [
      { id: '06-algo',  title: '算法与手写题' }
    ]},
    { group: '面试', items: [
      { id: '07-projects', title: '项目故事库' },
      { id: '08-interview', title: '自测题库' },
      { id: '09-resume',    title: '优化版简历' }
    ]},
    { group: '项目复习', items: [
      { id: 'proj-pcc',    title: '① 预见性巡航 PCC ★' },
      { id: 'proj-gnss',   title: '② GNSS 固件升级' },
      { id: 'proj-adas',   title: '③ 主动安全系统' },
      { id: 'proj-bus',    title: '④ 云公交一体机' },
      { id: 'proj-market', title: '⑤ 市场问题分析' },
      { id: 'proj-ota',    title: '⑥ OTA 链路排查' }
    ]},
    { group: '追踪', items: [
      { id: '10-checkin', title: '每日打卡表' }
    ]},
    { group: '记忆工具', items: [
      { id: 'mindmap', title: '🧠 思维导图' }
    ]}
  ];
  const FLAT = [];
  NAV.forEach(g => g.items.forEach(it => FLAT.push(it)));
  const TITLES = {};
  FLAT.forEach(it => { TITLES[it.id] = it.title; });

  const CONTENT_DIR = 'content/';
  const $ = s => document.querySelector(s);
  const cache = {};           // id -> { md, html }
  let currentId = null;
  let searchIndex = null;

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }
  function mdHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff; }
    return 'h' + h.toString(36);
  }

  /* ---------- Markdown 渲染（子集：标题/代码块/列表/复选框/引用/粗体/行内码） ---------- */
  function mdToHtml(md) {
    const lines = md.split(/\r?\n/);
    let html = '';
    let i = 0;
    let secCount = 0;
    let inCode = false, codeLang = '', codeBuf = [];
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        if (!inCode) { inCode = true; codeLang = fence[1] || 'code'; codeBuf = []; }
        else {
          html += '<div class="codeblock"><div class="codehead"><span>' + esc(codeLang) +
            '</span><button class="copybtn" type="button">复制</button></div><pre><code>' +
            codeBuf.map(esc).join('\n') + '</code></pre></div>';
          inCode = false;
        }
        i++; continue;
      }
      if (inCode) { codeBuf.push(line); i++; continue; }

      if (/^####\s/.test(line)) { html += '<h4 id="sec-' + (secCount++) + '">' + inline(line.replace(/^####\s/, '')) + '</h4>'; i++; continue; }
      if (/^###\s/.test(line))  { html += '<h3 id="sec-' + (secCount++) + '">' + inline(line.replace(/^###\s/, '')) + '</h3>'; i++; continue; }
      if (/^##\s/.test(line))   { html += '<h2 id="sec-' + (secCount++) + '">' + inline(line.replace(/^##\s/, '')) + '</h2>'; i++; continue; }
      if (/^#\s/.test(line))    { html += '<h1 id="sec-' + (secCount++) + '">' + inline(line.replace(/^#\s/, '')) + '</h1>'; i++; continue; }
      if (/^---+\s*$/.test(line)) { html += '<hr>'; i++; continue; }

      if (/^>\s?/.test(line)) {
        const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(inline(lines[i].replace(/^>\s?/, ''))); i++; }
        html += '<blockquote>' + q.join('<br>') + '</blockquote>';
        continue;
      }
      if (/^-\s*\[[ xX]\]\s/.test(line)) {
        const checked = /^-\s*\[x\]/i.test(line);
        const text = line.replace(/^-\s*\[[ xX]\]\s*/, '');
        const key = mdHash(text);
        html += '<label class="chk"><input type="checkbox" data-key="' + key + '"' + (checked ? ' checked' : '') +
          '><span>' + inline(text) + '</span></label>';
        i++; continue;
      }
      if (/^-\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^-\s/.test(lines[i])) { items.push(inline(lines[i].replace(/^-\s/, ''))); i++; }
        html += '<ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul>';
        continue;
      }
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(inline(lines[i].replace(/^\d+\.\s/, ''))); i++; }
        html += '<ol>' + items.map(x => '<li>' + x + '</li>').join('') + '</ol>';
        continue;
      }
      if (line.trim() === '') { i++; continue; }
      html += '<p>' + inline(line) + '</p>';
      i++;
    }
    if (inCode) { // 未闭合的代码块
      html += '<div class="codeblock"><div class="codehead"><span>' + esc(codeLang) +
        '</span><button class="copybtn" type="button">复制</button></div><pre><code>' +
        codeBuf.map(esc).join('\n') + '</code></pre></div>';
    }
    return html;
  }

  /* ---------- 内容加载 ---------- */
  async function fetchMd(id) {
    if (cache[id] && cache[id].md) return cache[id].md;
    if (location.protocol === 'file:') {
      throw new Error('file 协议无法加载内容，请用本地服务器预览（见 README）。');
    }
    const r = await fetch(CONTENT_DIR + id + '.md', { cache: 'no-cache' });
    if (!r.ok) throw new Error('加载 ' + id + '.md 失败：HTTP ' + r.status);
    const md = await r.text();
    cache[id] = { md: md };
    return md;
  }

  async function loadPage(id, opts) {
    opts = opts || {};
    try {
      currentId = id;
      if (id === 'mindmap') {
        $('#content').innerHTML = '<div class="mm-wrap" id="mmWrap"></div>';
        renderBreadcrumb();
        setActiveNav(id);
        document.title = '思维导图 · 求职冲刺营';
        renderPagination();
        window.scrollTo({ top: 0 });
        buildMindMap();
        return;
      }
      const md = await fetchMd(id);
      $('#content').innerHTML = mdToHtml(md);
      renderChecklist($('#content'));
      buildToc();
      renderPagination();
      renderBreadcrumb();
      setActiveNav(id);
      document.title = (TITLES[id] || id) + ' · 求职冲刺营';
      if (opts.scroll) { opts.scroll(); } else { window.scrollTo({ top: 0 }); }
    } catch (e) {
      $('#content').innerHTML =
        '<div class="progress" style="border-color:var(--danger)"><div class="progress-label" style="color:var(--danger)">⚠️ ' +
        esc(e.message) + '</div></div>';
    }
  }

  function renderBreadcrumb() {
    $('#breadcrumb').innerHTML = '<span>首页</span><span>' + esc(TITLES[currentId] || '') + '</span>';
  }

  function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.id === id);
    });
  }

  /* ---------- 侧边栏 ---------- */
  function renderNav() {
    let html = '';
    NAV.forEach(g => {
      html += '<div class="nav-group"><div class="nav-group-title">' + esc(g.group) + '</div>';
      g.items.forEach(it => {
        html += '<a class="nav-item" data-id="' + it.id + '" href="#/' + it.id + '">' + esc(it.title) + '</a>';
      });
      html += '</div>';
    });
    $('#nav').innerHTML = html;
  }

  /* ---------- 打卡进度 ---------- */
  function renderChecklist(root) {
    const boxes = root.querySelectorAll('input[data-key]');
    if (!boxes.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'progress';
    wrap.innerHTML = '<div class="progress-track"><div class="progress-fill"></div></div>' +
      '<div class="progress-label"></div>';
    root.insertBefore(wrap, root.firstChild);
    let done = 0;
    boxes.forEach(b => {
      const key = b.dataset.key;
      if (localStorage.getItem('tboxchk:' + key) === '1') b.checked = true;
      if (b.checked) { done++; b.closest('.chk').classList.add('done'); }
      b.addEventListener('change', () => {
        localStorage.setItem('tboxchk:' + key, b.checked ? '1' : '0');
        b.closest('.chk').classList.toggle('done', b.checked);
        done += b.checked ? 1 : -1;
        updateProgress(wrap, done, boxes.length);
      });
    });
    updateProgress(wrap, done, boxes.length);
  }
  function updateProgress(wrap, done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    wrap.querySelector('.progress-fill').style.width = pct + '%';
    wrap.querySelector('.progress-label').textContent = '已完成 ' + done + ' / ' + total + '（' + pct + '%）';
  }

  /* ---------- 本页目录（右侧小侧边栏） ---------- */
  function buildToc() {
    const toc = $('#toc');
    const heads = $('#content').querySelectorAll('h2, h3, h4');
    if (heads.length < 2) { toc.classList.remove('show'); toc.innerHTML = ''; return; }
    let html = '<div class="toc-label">本页目录</div>';
    heads.forEach(h => {
      html += '<a class="toc-item toc-' + h.tagName.toLowerCase() + '" href="#' + h.id +
        '" data-target="' + h.id + '">' + esc(h.textContent) + '</a>';
    });
    toc.innerHTML = html;
    toc.classList.add('show');
    // 点击跳转（阻止默认锚点跳转，避免污染 hash 路由）
    toc.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.getElementById(a.dataset.target);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    // 滚动高亮（scrollspy）
    if ('IntersectionObserver' in window) {
      const links = {};
      toc.querySelectorAll('a').forEach(a => { links[a.dataset.target] = a; });
      const setActive = id => {
        toc.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.target === id));
      };
      const observer = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) setActive(en.target.id); });
      }, { rootMargin: '-15% 0px -75% 0px' });
      heads.forEach(h => observer.observe(h));
    }
  }

  /* ---------- 上一节 / 下一节 ---------- */
  function renderPagination() {
    const idx = FLAT.findIndex(it => it.id === currentId);
    const box = $('#pagination');
    let html = '';
    if (idx > 0) {
      html += '<a class="pagelink" href="#/' + FLAT[idx - 1].id + '"><span class="plabel">← 上一节</span>' +
        esc(FLAT[idx - 1].title) + '</a>';
    }
    if (idx >= 0 && idx < FLAT.length - 1) {
      html += '<a class="pagelink next" href="#/' + FLAT[idx + 1].id + '"><span class="plabel">下一节 →</span>' +
        esc(FLAT[idx + 1].title) + '</a>';
    }
    box.innerHTML = html;
  }

  /* ---------- 搜索 ---------- */
  async function buildSearchIndex() {
    if (searchIndex) return searchIndex;
    const idx = [];
    for (const it of FLAT) {
      let md;
      try { md = await fetchMd(it.id); } catch (e) { continue; }
      md.split(/\r?\n/).forEach(ln => {
        const t = ln.trim();
        if (t && !t.startsWith('```')) idx.push({ id: it.id, title: it.title, line: t });
      });
    }
    searchIndex = idx;
    return idx;
  }
  function openSearch(query) {
    buildSearchIndex().then(idx => {
      const q = query.toLowerCase().trim();
      const drop = $('#searchDrop');
      if (q.length < 2) { drop.hidden = true; return; }
      const hits = [];
      for (const it of idx) {
        if (it.line.toLowerCase().indexOf(q) !== -1) hits.push(it);
        if (hits.length >= 40) break;
      }
      if (!hits.length) {
        drop.innerHTML = '<div class="sempty">没有匹配结果，换个关键词试试</div>';
        drop.hidden = false;
        return;
      }
      drop.innerHTML = hits.map(it => {
        const hl = it.line.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
        return '<div class="sitem" data-id="' + it.id + '" data-q="' + esc(q) + '"><span class="sfile">' +
          esc(it.title) + '</span>' + hl.slice(0, 120) + '</div>';
      }).join('');
      drop.hidden = false;
    });
  }
  function bindSearch() {
    const input = $('#searchInput');
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => openSearch(input.value), 250);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { $('#searchDrop').hidden = true; input.blur(); }
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    });
    document.addEventListener('click', e => {
      const sitem = e.target.closest('.sitem');
      if (sitem) {
        const q = sitem.dataset.q;
        $('#searchDrop').hidden = true;
        input.value = q;
        location.hash = '#/' + sitem.dataset.id;
        // 等页面加载后滚动并高亮
        setTimeout(() => highlightInPage(q), 350);
      } else if (!e.target.closest('.searchbox')) {
        $('#searchDrop').hidden = true;
      }
    });
  }
  function highlightInPage(q) {
    const els = $('#content').querySelectorAll('p, li, h2, h3, h4, pre, blockquote');
    const norm = q.toLowerCase();
    let first = null;
    els.forEach(el => {
      if (el.textContent.toLowerCase().indexOf(norm) !== -1) {
        el.classList.add('flash');
        if (!first) first = el;
      }
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- 思维导图 ---------- */
  const MM_PAGES = [
    { id: '02-c', title: 'C 语言与数据结构' },
    { id: '11-cpp', title: 'C++ 面试题' },
    { id: '13-memory', title: 'C 语言内存分布与管理' },
    { id: '03-os', title: '操作系统与 Linux' },
    { id: '04-net', title: '网络与 MQTT' },
    { id: '12-embedded', title: '嵌入式基础' },
    { id: '05-auto', title: '车载协议与 OTA' },
    { id: '06-algo', title: '算法与手写题' },
    { id: '07-projects', title: '项目故事库' }
  ];

  function parseHeadings(md) {
    const tree = [];
    let cur = null;
    md.split(/\r?\n/).forEach(line => {
      const m4 = line.match(/^####\s+(.*)/);
      const m3 = line.match(/^###\s+(.*)/);
      if (m3) { cur = { t: m3[1].trim(), subs: [] }; tree.push(cur); }
      else if (m4 && cur) { cur.subs.push(m4[1].trim()); }
    });
    return tree;
  }

  function mmNodeHtml(pageId, n) {
    const goto = pageId + '?goto=' + encodeURIComponent(n.t);
    let h = '<div class="mm-node" data-goto="' + goto + '">' + esc(n.t);
    if (n.subs.length) {
      h += '<div class="mm-subs">' + n.subs.map(s => '<span class="mm-sub">' + esc(s) + '</span>').join('') + '</div>';
    }
    return h + '</div>';
  }

  async function buildMindMap() {
    const wrap = $('#mmWrap');
    let html = '<div class="mm-chips"><button class="mm-chip active" data-page="all">全部</button>';
    MM_PAGES.forEach(p => {
      html += '<button class="mm-chip" data-page="' + p.id + '">' + esc(p.title) + '</button>';
    });
    html += '</div><p class="mm-hint">中心为主题学科，分支为知识点，子项为下属小节。点击任意知识点节点可跳转到对应页面定位复习。</p><div class="mm-list"></div>';
    wrap.innerHTML = html;

    const data = [];
    for (const p of MM_PAGES) {
      try { data.push({ id: p.id, title: p.title, tree: parseHeadings(await fetchMd(p.id)) }); }
      catch (e) { /* skip */ }
    }
    const list = wrap.querySelector('.mm-list');
    const render = sel => {
      const showAll = sel === 'all';
      let h = '';
      data.forEach(d => {
        if (!showAll && d.id !== sel) return;
        h += '<div class="mm" data-page="' + d.id + '">' +
          '<div class="mm-root">' + esc(d.title) + '<span class="mm-count">' + d.tree.length + ' 个知识点</span></div>' +
          '<div class="mm-col">' + d.tree.map(n => mmNodeHtml(d.id, n)).join('') + '</div></div>';
      });
      list.innerHTML = h;
      list.querySelectorAll('[data-goto]').forEach(el => {
        el.addEventListener('click', () => { location.hash = '#/' + el.dataset.goto; });
      });
    };
    render('all');

    wrap.querySelectorAll('.mm-chip').forEach(c => {
      c.addEventListener('click', () => {
        wrap.querySelectorAll('.mm-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        render(c.dataset.page);
      });
    });
  }

  function scrollToTitle(text) {
    const els = $('#content').querySelectorAll('h1, h2, h3, h4');
    let target = null;
    els.forEach(el => { if (!target && el.textContent.trim() === text) target = el; });
    if (!target) els.forEach(el => { if (!target && el.textContent.indexOf(text) !== -1) target = el; });
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('flash');
    }
  }

  /* ---------- 主题 / 移动端 ---------- */
  function initTheme() {
    const saved = localStorage.getItem('tbox-theme') || 'light';
    document.documentElement.dataset.theme = saved;
    $('#themeBtn').textContent = saved === 'dark' ? '☀️' : '🌙';
  }
  function bindTheme() {
    $('#themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme;
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('tbox-theme', next);
      $('#themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }
  function bindMobile() {
    const sb = $('#sidebar'), ov = $('#overlay');
    $('#menuBtn').addEventListener('click', () => {
      sb.classList.toggle('open'); ov.hidden = !sb.classList.contains('open');
    });
    ov.addEventListener('click', () => { sb.classList.remove('open'); ov.hidden = true; });
    document.querySelectorAll('.nav-item').forEach(a => {
      a.addEventListener('click', () => { sb.classList.remove('open'); ov.hidden = true; });
    });
  }

  /* ---------- 代码复制 ---------- */
  function bindCopy() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.copybtn');
      if (!btn) return;
      const code = btn.closest('.codeblock').querySelector('pre code').innerText;
      const done = () => { const old = btn.textContent; btn.textContent = '已复制 ✓'; setTimeout(() => btn.textContent = old, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
      } else { fallbackCopy(code, done); }
    });
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); done();
  }

  /* ---------- 路由 ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('?');
    const id = parts[0] || '00-overview';
    let opts = {};
    if (parts[1]) {
      const q = new URLSearchParams(parts[1]);
      const goto = q.get('goto');
      if (goto) opts.scroll = () => scrollToTitle(goto);
    }
    loadPage(id, opts);
  }

  /* ---------- 启动 ---------- */
  initTheme();
  renderNav();
  bindTheme();
  bindMobile();
  bindCopy();
  bindSearch();
  window.addEventListener('hashchange', route);
  route();
})();
