# AGENTS.md

本仓库是可复用的班史模板（Astro 7 静态站 + Cloudflare Pages Functions）。

## 维护规则

- 本仓库是**通用模板**：`src/site.config.ts` 保持 `XX届X班` 占位值，内容目录只保留标注清楚的示例；不要引入任何真实班级信息（文章正文、歌曲、照片、师生姓名、学校名、真实班号、Bing/统计验证 meta 等）。
- 修改功能（页面、样式、functions、构建配置）时保持结构通用、可复用。
- 使用文档在本仓库 [Wiki](https://github.com/Vb-Lg/class-history-template/wiki)。

## 结构速览

- `src/site.config.ts`：班级信息占位值，各页面引用
- 示例内容（使用者应删除）：`src/content/20250101.md`、`src/songs/20250101-example.json`；`public/pages/static/cover-placeholder.svg` 为占位封面
- `functions/api/submit.ts`：投稿 → GitHub App（cms-bot，见 Wiki）建分支开 PR；`functions/api/messages.js`：留言墙（D1，绑定名 `DB`）
- 构建：Node ≥ 22.12，`npm run build`；本地 `npm run dev` 没有 `/api/*`
