const API_BASE = 'https://web-summarizer-gbzgdotbqz.cn-hangzhou.fcapp.run';  // 后端 API 部署在阿里云函数计算 FC
'use strict';

const form = document.getElementById('summarize-form');
const input = document.getElementById('url-input');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const resultEl = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultUrl = document.getElementById('result-url');
const resultMeta = document.getElementById('result-meta');
const summaryList = document.getElementById('summary-list');

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('loading', loading);
  if (loading) {
    statusEl.hidden = false;
    statusEl.textContent = '正在抓取网页内容…';
    errorEl.hidden = true;
    resultEl.hidden = true;
  } else {
    statusEl.hidden = true;
  }
}

function showError(message) {
  errorEl.hidden = false;
  errorEl.textContent = message;
  resultEl.hidden = true;
}

function showResult(data) {
  errorEl.hidden = true;
  resultEl.hidden = false;

  resultTitle.textContent = data.title || '未命名页面';
  resultUrl.href = data.url;
  resultUrl.textContent = data.url;
  resultMeta.textContent = `正文约 ${data.chars.toLocaleString()} 字 · 摘要 ${data.summary.length} 句`;

  summaryList.innerHTML = '';
  for (const sentence of data.summary) {
    const li = document.createElement('li');
    li.textContent = sentence;
    summaryList.appendChild(li);
  }
}

function validateUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return '请输入网页地址';
  if (!/^https?:\/\//i.test(trimmed)) {
    return '网址必须以 http:// 或 https:// 开头';
  }
  try {
    new URL(trimmed);
  } catch {
    return '网址格式不正确，请检查后重试';
  }
  return null;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = input.value.trim();
  const validationError = validateUrl(url);
  if (validationError) {
    showError(validationError);
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/api/summarize?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!data.ok) {
      showError(data.error || '总结失败，请稍后重试');
      return;
    }

    showResult(data);
  } catch {
    showError('网络请求失败，请确认服务已启动后重试');
  } finally {
    setLoading(false);
  }
});
