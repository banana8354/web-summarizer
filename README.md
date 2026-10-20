# 网页总结工具

输入任意公开网页地址，本地抓取正文并用抽取式算法生成中文要点摘要。无需 API Key，无需 `npm install`。

## 环境要求

- Node.js **18+**（需要全局 `fetch`）

## 启动

```bash
node server.js
```

或：

```bash
npm start
```

浏览器打开：**http://localhost:3000**

## 使用方式

1. 在输入框粘贴以 `http://` 或 `https://` 开头的网址  
2. 点击「开始总结」  
3. 等待抓取完成后，下方卡片会展示标题与 3–4 句摘要  

## 项目结构

```
web-summarizer/
├── server.js           # 后端：静态资源 + /api/summarize
├── package.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docs/
│   └── tech-notes.md
├── AGENTS.md
└── README.md
```

## 说明

更多实现细节与已知限制见 [docs/tech-notes.md](docs/tech-notes.md)。
