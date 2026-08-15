#!/usr/bin/env node
/*
 * sync-tm-pages.js — 把「面试准备」目录的 29 份 Markdown 同步为站点 content/tm-NN.md
 * 并做交叉引用链接化（"NN 文档" → #/tm-NN；加粗文档名 → 链接；mermaid/figN.mmd → 可下载链接）
 * 用法：node scripts/sync-tm-pages.js [源目录]
 * 默认源目录：C:/AI/softerware/deepseek_harness/deepseek_work/天迈_主动安全项目/面试准备
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || 'C:/AI/softerware/deepseek_harness/deepseek_work/天迈_主动安全项目/面试准备';
const ROOT = path.resolve(__dirname, '..');
const DST = path.join(ROOT, 'content');
const MMD_DST = path.join(ROOT, 'assets', 'mermaid');

const fileRe = /^(\d{2})-[^\.]+\.md$/;
const files = fs.readdirSync(SRC).filter(f => fileRe.test(f)).sort();
if (!files.length) { console.error('源目录没有找到 00-xx.md 文件: ' + SRC); process.exit(1); }

function pad(n) { return (n.length === 1 ? '0' : '') + n; }
function isTm(n) { const nn = pad(n); return nn >= '00' && nn <= '28'; }

/* 索引文档里实际用到的文档名（完整名 + 简称），按长度降序做白名单替换 */
const TITLE_WHITELIST = {
  '00': ['学习路线图', '路线图'],
  '01': ['项目全景与架构', '全景架构', '项目全景', '全景'],
  '02': ['外部数据与三急详解', '外部数据与三急', '三急'],
  '03': ['参数与配置详解', '参数配置', '参数与配置', '参数'],
  '04': ['算法抽象层详解', '算法抽象层', '算法抽象'],
  '05': ['协议层详解', '协议层', '协议'],
  '06': ['报警链路与主控详解', '报警链路与主控', '报警链路'],
  '07': ['角色故事与贡献梳理', '角色故事'],
  '08': ['嵌入式方向高频面试问答库', '问答库'],
  '09': ['优化建议与技术亮点清单', '优化清单', '亮点清单'],
  '10': ['模拟面试演练素材', '演练'],
  '11': ['优化实战案例:CAN信号级重构', '优化实战案例', 'CAN重构'],
  '12': ['速记卡片'],
  '13': ['简历项目描述', '简历描述', '简历'],
  '14': ['优化评审与设计取舍复盘', '取舍复盘'],
  '15': ['面试官视角评分卡', '评分卡'],
  '16': ['面试必画图', '必画图'],
  '17': ['代码阅读路线图'],
  '18': ['软问题与深挖问答', '软问题'],
  '19': ['完整模拟面试卷', '完整模拟卷', '模拟卷'],
  '20': ['外围知识扩展', '外围知识'],
  '21': ['三急算法物理模型设计深挖', '三急物理模型'],
  '22': ['整车CAN高速数据链路设计方案', '整车CAN方案'],
  '23': ['面试冲刺行动卡', '冲刺行动卡'],
  '24': ['练习进度追踪表', '追踪表'],
  '25': ['模拟面试官动态追问脚本', '追问脚本'],
  '26': ['简历信息采集表', '简历采集表'],
  '27': ['最终交付总览'],
  '28': ['示范面试答案'],
  '21b': ['物理模型已落地'],   // 21b 归入 tm-21
};

/* 生成 NN-标题 白名单（按长度降序），并记录每个候选的目标页 */
const TITLE_ALTS = [];
for (const [nn, titles] of Object.entries(TITLE_WHITELIST)) {
  for (const t of titles) {
    TITLE_ALTS.push({ text: `${nn}-${t}`, target: nn === '21b' ? '21' : nn });
  }
}
TITLE_ALTS.sort((a, b) => b.text.length - a.text.length);
const TITLE_PATTERN = new RegExp(
  '(?<![\\w\\u4e00-\\u9fa5\\[\\]])(?:' +
  TITLE_ALTS.map(a => '(' + a.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')').join('|') +
  ')(?![\\w\\u4e00-\\u9fa5])',
  'g'
);
function linkKnownTitles(l) {
  return l.replace(TITLE_PATTERN, (...args) => {
    const m = args[0];
    for (let i = 0; i < TITLE_ALTS.length; i++) {
      if (args[i + 1] !== undefined) {
        return `[${TITLE_ALTS[i].text}](#/tm-${TITLE_ALTS[i].target})`;
      }
    }
    return m;
  });
}

/* 交叉引用链接化：只在代码围栏外替换 */
function transform(md, filename) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inCode = false;
  for (const ln of lines) {
    if (/^```/.test(ln)) { inCode = !inCode; out.push(ln); continue; }
    if (inCode) { out.push(ln); continue; }
    let l = ln;
    // 1) "NN 文档"/"NN文档" → [NN 文档](#/tm-NN)
    l = l.replace(/(?<!\d)(\d{1,2})(?!\d)\s*文档/g, (m, n) => {
      const nn = pad(n);
      return isTm(n) ? `[${nn} 文档](#/tm-${nn})` : m;
    });
    // 2) 已知文档名 NN-标题 → [NN-标题](#/tm-NN)（完整名+简称，白名单精确匹配）
    l = linkKnownTitles(l);
    // 3) 加粗文档名 **NN-标题**（白名单没覆盖的，如带括号）→ **[NN-标题](#/tm-NN)**
    l = l.replace(/\*\*(\d{1,2})(b?)-([^*|]+?)\*\*/g, (m, n, b, title) => {
      const nn = pad(n);
      if (isTm(nn)) return `**[${nn}${b ? 'b' : ''}-${title}](#/tm-${nn})**`;
      return m;
    });
    // 4) mermaid/figN_xxx.mmd → 可下载链接（assets/mermaid/）
    l = l.replace(/mermaid\/(fig\d_[A-Za-z0-9_]+\.mmd)/g, (m, name) => `[${name}](assets/mermaid/${name})`);
    out.push(l);
  }
  return out.join('\n');
}

/* 主流程 */
if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });
if (!fs.existsSync(MMD_DST)) fs.mkdirSync(MMD_DST, { recursive: true });

let count = 0;
for (const f of files) {
  const num = f.slice(0, 2);
  const md = fs.readFileSync(path.join(SRC, f), 'utf8');
  const out = transform(md, f);
  fs.writeFileSync(path.join(DST, `tm-${num}.md`), out, 'utf8');
  count++;
  console.log(`tm-${num}.md  <-  ${f}`);
}

/* 复制 4 张 mermaid 图 */
const mmdSrc = path.join(SRC, 'mermaid');
if (fs.existsSync(mmdSrc)) {
  fs.readdirSync(mmdSrc).filter(x => x.endsWith('.mmd')).forEach(x => {
    fs.copyFileSync(path.join(mmdSrc, x), path.join(MMD_DST, x));
    console.log('assets/mermaid/' + x);
  });
}
console.log(`\n完成：${count} 个页面 → ${DST}`);
