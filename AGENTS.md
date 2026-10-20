# AGENTS.md — 项目约定

给所有在本仓库内工作的 AI 工具 / Agent 阅读。修改代码前先遵守下列约定。

## 项目目标

本地「网页总结工具」：用户输入 URL → 服务端抓取 HTML → 抽取正文 → 本地抽取式摘要 → 前端展示。

## 硬性约束

1. **零第三方运行时依赖**  
   后端只用 Node.js 内置模块（`node:http`、`node:fs`、`node:path`、全局 `fetch` 等）。不要引入 express、cheerio、axios、openai 等包。`package.json` 保持无 `dependencies`。

2. **不要接大模型 API**  
   摘要必须是本地抽取式（词频打分选句）。不要要求用户配置 API Key。

3. **前端保持原生**  
   不用构建工具，不引 CDN 框架。页面文件在 `public/`。

4. **目录结构不要擅自改名**  
   ```
   server.js
   package.json
   public/index.html
   public/style.css
   public/app.js
   docs/tech-notes.md
   AGENTS.md
   README.md
   ```
   路径使用纯英文，不要出现中文文件名或空格。

5. **接口契约**  
   - `GET /` 提供静态页  
   - `GET /api/summarize?url=...` 返回 `{ ok, title?, url?, summary?, chars?, error? }`  
   - `url` 必须以 `http://` 或 `https://` 开头，否则 400

6. **视觉**  
   主色 `#7C5CFF`，浅底 `#F5F3FF`，卡片白底 + 柔和阴影，圆角 16px。保留导航栏、输入区、结果卡片、页脚、加载态与错误态。

## 改动建议

- 优先小步修改，保持「可直接 `node server.js` 启动」。
- 新增说明写到 `docs/tech-notes.md` 或 `README.md`，不要另起一堆无关文档。
- 不要提交 `.env` 或密钥文件（本项目本就不需要）。

## 验收自检

- [ ] `node server.js` 无缺模块报错  
- [ ] `http://localhost:3000` 页面完整  
- [ ] 合法 URL 能返回摘要；非法 URL 有友好错误  
- [ ] 淡紫色调 + 导航 + 页脚齐全  
