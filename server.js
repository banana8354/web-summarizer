'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/* ---------- HTML helpers ---------- */

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return decodeEntities(m[1].replace(/\s+/g, ' ').trim());
}

const META_LABEL_LINE =
  /^(日期|发表日期|发布时间|发布日期|作者|阅读量|浏览量|标签|分类|栏目|来源|编辑|字数|评论|转载|版权|原文链接|永久链接)\s*[:：]?/i;

const PURE_DATE_LINE =
  /^(?:日期|发表日期|发布时间|发布日期)?\s*[:：]?\s*\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
const PURE_ISO_DATE_LINE =
  /^(?:日期|发表日期|发布时间|发布日期)?\s*[:：]?\s*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
const PURE_TIME_LINE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const COPYRIGHT_LINE =
  /^(©|版权所有|Copyright|All\s+Rights\s+Reserved|备案|ICP备)/i;
const NAV_RESIDUE_LINE =
  /^(首页|上一篇|下一篇|返回|目录|订阅|RSS|分享到|打印本页|相关文章|最新文章|热门文章)(\s|$)/i;

function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;
  // 只有几个字的短行（中文按字符计）
  if (t.length < 8) return true;
  if (PURE_DATE_LINE.test(t) || PURE_ISO_DATE_LINE.test(t) || PURE_TIME_LINE.test(t)) {
    return true;
  }
  if (META_LABEL_LINE.test(t) && t.length < 40) return true;
  if (COPYRIGHT_LINE.test(t)) return true;
  if (NAV_RESIDUE_LINE.test(t) && t.length < 30) return true;
  // 「日期：2023年12月15日」整行元信息
  if (/^(日期|发表日期|发布时间|发布日期|作者|阅读量|标签|来源)\s*[:：]/.test(t) && t.length < 50) {
    return true;
  }
  return false;
}

function extractText(html) {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|hr|p|div|li|h[1-6]|tr|td|th|section|article)[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  cleaned = decodeEntities(cleaned)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !isNoiseLine(l));

  return lines.join('\n');
}

/* ---------- Extractive summarizer ---------- */

const STOPWORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '他', '她', '它', '们', '与', '及', '或', '而', '但', '被',
  '把', '让', '从', '对', '为', '以', '及', '等', '之', '其', '此', '中', '后',
  '前', '时', '年', '月', '日', '可', '能', '已', '还', '又', '更', '最', '比',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'as', 'by', 'with', 'from',
  'not', 'no', 'yes', 'if', 'then', 'than', 'so', 'we', 'you', 'they', 'he',
  'she', 'our', 'their', 'his', 'her', 'who', 'what', 'which', 'when', 'where',
  'how', 'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'own', 'same', 'too', 'very', 'can', 'just', 'into',
]);

function tokenize(text) {
  const tokens = text.toLowerCase().match(/[\u4e00-\u9fff]|[a-z0-9]+/gi) || [];
  return tokens.filter((t) => {
    if (STOPWORDS.has(t)) return false;
    // 英文词至少 2 个字符；中文单字保留（无分词器时靠字频）
    if (/^[a-z0-9]+$/.test(t)) return t.length > 1;
    return true;
  });
}

const META_SENTENCE_PREFIX = /^(日期|发表|作者|时间|标签|来源)/;

function isMetaSentence(s) {
  if (META_SENTENCE_PREFIX.test(s)) return true;
  if (PURE_DATE_LINE.test(s) || PURE_ISO_DATE_LINE.test(s) || PURE_TIME_LINE.test(s)) {
    return true;
  }
  // 几乎全是数字/标点的短句
  const content = s.replace(/[\d\s年月日时分秒:：\-/.]/g, '');
  if (content.length < 4 && /\d{4}/.test(s)) return true;
  return false;
}

function splitSentences(text) {
  const parts = text
    .split(/(?<=[。！？.!?；;])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 300)
    .filter((s) => !isMetaSentence(s));

  const seen = new Set();
  const unique = [];
  for (const s of parts) {
    const key = s.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return unique;
}

function summarize(text, maxSentences = 4) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return text.slice(0, 200) ? [text.slice(0, 200) + (text.length > 200 ? '…' : '')] : [];
  }
  if (sentences.length <= maxSentences) return sentences;

  const freq = Object.create(null);
  for (const s of sentences) {
    for (const t of tokenize(s)) {
      freq[t] = (freq[t] || 0) + 1;
    }
  }

  const scored = sentences.map((sentence, index) => {
    const tokens = tokenize(sentence);
    let score = 0;
    for (const t of tokens) score += freq[t] || 0;
    if (tokens.length > 0) score /= tokens.length;

    // 实词越多、句子越完整，越优先
    score += Math.min(tokens.length, 12) * 0.08;
    if (/[。！？.!?]$/.test(sentence)) score += 0.2;
    if (sentence.length >= 25 && sentence.length <= 120) score += 0.25;

    // 略微提高靠前句子权重（常见于新闻/博客导语）
    score += Math.max(0, (sentences.length - index) / sentences.length) * 0.1;
    return { sentence, score, index };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxSentences).sort((a, b) => a.index - b.index);
  return top.map((x) => x.sentence);
}

/* ---------- Fetch page ---------- */

async function fetchPage(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`目标网站返回 HTTP ${res.status}`);
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.includes('html') && !contentType.includes('text')) {
      throw new Error('该地址返回的不是网页内容，无法总结');
    }

    const html = await res.text();
    if (!html || html.length < 50) {
      throw new Error('网页内容过少或为空，无法生成摘要');
    }

    return html;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('抓取超时（超过 15 秒），请换一个网址试试');
    }
    if (err.cause && err.cause.code === 'ENOTFOUND') {
      throw new Error('无法解析该域名，请检查网址是否正确');
    }
    if (err.cause && (err.cause.code === 'ECONNREFUSED' || err.cause.code === 'ECONNRESET')) {
      throw new Error('无法连接到目标网站');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- HTTP helpers ---------- */

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(PUBLIC_DIR, filePath);

  if (!abs.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleSummarize(req, res, searchParams) {
  const rawUrl = searchParams.get('url');
  if (!rawUrl) {
    return sendJson(res, 400, { ok: false, error: '请提供要总结的网页地址（url 参数）' });
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return sendJson(res, 400, { ok: false, error: '网址格式不正确，请检查后重试' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return sendJson(res, 400, {
      ok: false,
      error: '网址必须以 http:// 或 https:// 开头',
    });
  }

  try {
    const html = await fetchPage(parsed.href);
    const title = extractTitle(html) || parsed.hostname;
    const text = extractText(html);

    if (text.length < 80) {
      return sendJson(res, 200, {
        ok: false,
        error: '提取到的正文太少，可能是动态渲染页面或被反爬拦截',
      });
    }

    const summary = summarize(text, 4);
    if (summary.length === 0) {
      return sendJson(res, 200, {
        ok: false,
        error: '未能从该网页中提取出有效句子',
      });
    }

    return sendJson(res, 200, {
      ok: true,
      title,
      url: parsed.href,
      summary,
      chars: text.length,
    });
  } catch (err) {
    const message = err.message || '抓取或总结时发生未知错误';
    return sendJson(res, 200, { ok: false, error: message });
  }
}

/* ---------- Server ---------- */

/* ---------- 请求处理（本地运行与 Vercel 共用） ---------- */

function handler(req, res) {
  const host = req.headers.host || `localhost:${PORT}`;
  let parsed;
  try {
    parsed = new URL(req.url || '/', `http://${host}`);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/summarize') {
    handleSummarize(req, res, parsed.searchParams);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res, parsed.pathname);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method Not Allowed');
}

/* 直接运行 node server.js 时启动本地服务；被 Vercel 引入时只导出 handler */
if (require.main === module) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`Web Summarizer running at http://localhost:${PORT}`);
  });
}

module.exports = handler;