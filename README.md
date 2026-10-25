# 班史模板 class-history-template

一个可直接部署的班级纪念册模板，基于 **Astro 7 + Cloudflare Pages**。

> 📖 **完整文档见 [Wiki](https://github.com/Vb-Lg/class-history-template/wiki)**：[快速开始与定制](https://github.com/Vb-Lg/class-history-template/wiki/Quick-Start) · [内容格式](https://github.com/Vb-Lg/class-history-template/wiki/Content-Format) · [部署](https://github.com/Vb-Lg/class-history-template/wiki/Deployment) · [cms-bot 使用教程](https://github.com/Vb-Lg/class-history-template/wiki/CMS-Bot) · [留言墙（D1）](https://github.com/Vb-Lg/class-history-template/wiki/Message-Board) · [Turnstile](https://github.com/Vb-Lg/class-history-template/wiki/Turnstile)

功能一览：

- 🏠 **首页**：班级简介、人物志、荣誉墙、记忆墙（均为示例文案，可自行替换）
- 📖 **班史列表 / 文章页**：`src/content/*.md` 自动生成，按日期升序排列，支持封面、摘要、上下篇导航
- 🎵 **班级歌单**：`src/songs/*.json` 自动生成，支持每日随机排序、随机抽歌
- 💬 **留言墙**：Cloudflare D1 数据库存储
- 📝 **在线投稿**：班史 / 音乐两种表单，提交后自动建分支并发 PR，管理员审核合并后上线（由 GitHub App 驱动）

## 目录结构

```
├── functions/api/          # Cloudflare Pages Functions
│   ├── submit.ts           # 投稿 → GitHub PR
│   └── messages.js         # 留言墙（需绑定 D1）
├── public/
│   ├── css/  js/           # 样式与脚本
│   └── pages/static/       # 文章引用的静态资源（封面图、照片等）
├── src/
│   ├── content/            # 班史文章（YYYYMMDD.md）
│   ├── songs/              # 歌单（*.json）
│   ├── pages/              # 页面
│   ├── layouts/            # 文章页布局
│   ├── plugins/            # markdown 入场动画插件
│   └── site.config.ts      # ★ 班级信息配置
└── .env.example            # 环境变量示例
```

## 快速开始

需要 Node.js ≥ 22.12。

```bash
npm install
npm run dev        # http://localhost:4321
```

注意：`npm run dev` 只渲染页面，`/api/*` 由 Pages Functions 提供服务，只有线上可用——本地留言墙会显示「加载失败」、投稿提交会报错，属正常现象。需要本地调试 API 时：`npm run build` 后运行 `npx wrangler pages dev dist --d1 DB`，步骤详见 [Wiki · Quick Start](https://github.com/Vb-Lg/class-history-template/wiki/Quick-Start)。

## 定制班级信息

1. **`src/site.config.ts`**：班级名、顶栏 logo、首屏徽章、统计数字，改这一个文件即可。
2. **`src/pages/index.astro`**：班级简介、人物志、荣誉、记忆墙的示例文案（搜索 `20XX` 和各区块的中文示例）。
3. **`public/js/index.js`**：首屏打字机轮播文案（`lines` 数组）。
4. 主题色（金色 `#e6c068`）在 `public/css/*.css` 中定义。

## 内容格式

### 班史文章 `src/content/YYYYMMDD.md`

文件名用日期（同日多篇加 `-1`、`-2` 后缀），frontmatter 字段：

| 字段     | 必填 | 说明                                    |
| -------- | ---- | --------------------------------------- |
| `title`  | ✓    | 标题                                    |
| `date`   | ✓    | 日期 `YYYY-MM-DD`，决定排序             |
| `summary`|      | 摘要，显示在列表页和文章页副标题        |
| `author` |      | 记录人                                  |
| `cover`  |      | 封面图路径，如 `/pages/static/xxx.png`  |

正文支持完整 Markdown，含 `<details>` 折叠块。

### 歌曲 `src/songs/*.json`

```json
{
  "title": "歌名",
  "artist": "歌手",
  "date": "20250901",
  "link": "https://...",
  "note": "这首歌和班级的故事",
  "author": "推荐人"
}
```

`title`、`artist` 必填；`link` 须以 `http(s)://` 开头。

> 模板自带一篇示例文章（`src/content/20250101.md`）、一首示例歌曲（`src/songs/20250101-example.json`）和一张占位封面（`public/pages/static/cover-placeholder.svg`），正式使用前请删除前两者。

## 部署（Cloudflare Pages）

1. 推送到 GitHub 仓库。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接该仓库：
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 环境变量加 `NODE_VERSION = 22.12.0`
3. `functions/` 目录会被自动部署为 Pages Functions。

### 创建 GitHub App（投稿功能需要）

1. GitHub → Settings → Developer settings → **GitHub Apps** → New GitHub App。
   - Homepage URL 随意填（如仓库地址）；不需要回调与 webhook。
   - Repository permissions：**Contents → Read and write**，**Pull requests → Read and write**。
2. 创建后点 **Generate a private key**，下载 `.pem` 文件。
3. 左侧 **Install App**，安装到你的仓库；安装页 URL 中的数字即 **Installation ID**（如 `https://github.com/settings/installations/12345` 中的 `12345`）。
4. 在 Pages 项目 → Settings → Variables and Secrets 中配置环境变量（Production 与 Preview 都要）：

| 变量                    | 必填 | 说明                                              |
| ----------------------- | ---- | ------------------------------------------------- |
| `GITHUB_APP_ID`         | ✓    | GitHub App 的 App ID                              |
| `GITHUB_INSTALLATION_ID`| ✓    | 安装后的 Installation ID                          |
| `GITHUB_PRIVATE_KEY`    | ✓    | `.pem` 私钥全文（含 BEGIN/END 行）                |
| `GITHUB_OWNER`          | ✓    | 仓库所有者（用户名或组织名）                      |
| `GITHUB_REPO`           | ✓    | 仓库名                                            |
| `GITHUB_BASE_BRANCH`    |      | 投稿目标分支，默认 `main`                         |
| `CONTENT_DIR` 等        |      | 投稿落盘目录，默认值见 `functions/api/submit.ts`  |

### 留言墙（D1 数据库）

1. Dashboard → Storage & Databases → **D1** → 创建数据库。
2. Pages 项目 → Settings → Functions → **D1 database bindings**，绑定名必须为 **`DB`**。

表结构无需手动创建：Functions 首次访问时会自动建表，并为旧表自动补齐缺失的列（见 `functions/api/messages.js` 的 `ensureSchema`）。

### 人机验证（可选，Cloudflare Turnstile）

Dashboard → Turnstile → 添加站点，拿到一对 key：

- `PUBLIC_TURNSTILE_SITE_KEY`：**构建时**变量（也写入本地 `.env` 供本地构建）；
- `TURNSTILE_SECRET_KEY`：运行时变量。

两个都配置后投稿表单才启用人机验证；不配置则跳过。

## 投稿流程

表单提交 → `/api/submit` 用 GitHub App 建分支（`chronicle/*` 或 `music/*`）并开 PR → 管理员在 GitHub 审核合并 → Pages 自动重新构建，内容上线。`.github/labeler.yml` 会给投稿 PR 自动打标签。

## 常用命令

```bash
npm run dev       # 本地开发
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
```
