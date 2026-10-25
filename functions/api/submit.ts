// functions/api/submit.ts
interface Env {
    GITHUB_APP_ID: string;
    GITHUB_INSTALLATION_ID: string;
    GITHUB_PRIVATE_KEY: string;
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BASE_BRANCH?: string;   // 默认 main
    CONTENT_DIR?: string;          // 默认 src/content（对齐 Pages CMS 的 path）
    MEDIA_DIR?: string;            // 默认 public/pages/static
    MEDIA_URL_PREFIX?: string;     // 默认 /pages/static
    SONGS_DIR?: string;            // 默认 src/songs（音乐投稿的目标目录）
    TURNSTILE_SECRET_KEY?: string; // Turnstile 私钥；未设置则跳过校验（本地开发）
}

const enc = new TextEncoder();

// ---------- 编码/加密工具 ----------
function b64url(bytes: Uint8Array | ArrayBuffer): string {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < arr.length; i += chunk) {
        bin += String.fromCharCode(...arr.subarray(i, i + chunk));
    }
    return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
const b64utf8 = (s: string) => b64url(enc.encode(s));

function abToBase64(buf: ArrayBuffer): string {
    const arr = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < arr.length; i += chunk) bin += String.fromCharCode(...arr.subarray(i, i + chunk));
    return btoa(bin);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const fixed = pem.includes('\n')
        ? pem
        : pem.replace(/-----BEGIN [^-]+-----\s*/, '-----BEGIN PRIVATE KEY-----\n')
            .replace(/\s*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');
    const b64 = fixed
        .replace(/-----BEGIN [^-]+-----/, '')
        .replace(/-----END [^-]+-----/, '')
        .replace(/\s+/g, '');
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}

async function makeAppJwt(appId: string, pem: string) {
    const now = Math.floor(Date.now() / 1000);
    const head = b64utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = b64utf8(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
    const data = `${head}.${body}`;
    const key = await crypto.subtle.importKey(
        'pkcs8', pemToArrayBuffer(pem),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(data));
    return `${data}.${b64url(sig)}`;
}

async function getInstallationToken(env: Env): Promise<string> {
    const jwt = await makeAppJwt(env.GITHUB_APP_ID, env.GITHUB_PRIVATE_KEY);
    const res = await fetch(
        `https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${jwt}`,
                accept: 'application/vnd.github+json',
                'user-agent': 'astro-chronicle-fn',
            },
        },
    );
    if (!res.ok) throw new Error(`installation token failed: ${res.status} ${await res.text()}`);
    return (await res.json()).token as string;
}

// ---------- Turnstile ----------
async function verifyTurnstile(
    secret: string,
    token: string,
    remoteIp?: string,
): Promise<boolean> {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
        },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
}

// ---------- GitHub REST ----------
function gh(token: string) {
    return async function api<T = any>(path: string, init: RequestInit = {}): Promise<T | null> {
        const res = await fetch(`https://api.github.com${path}`, {
            ...init,
            headers: {
                authorization: `Bearer ${token}`,
                accept: 'application/vnd.github+json',
                'user-agent': 'astro-chronicle-fn',
                'content-type': 'application/json',
                ...(init.headers || {}),
            },
        });
        if (res.status === 404) return null;   // 用于探测文件是否存在
        if (!res.ok) throw new Error(`GitHub ${path} → ${res.status}: ${await res.text()}`);
        return res.json() as Promise<T>;
    };
}

// ---------- 业务辅助 ----------
const yyyymmdd = (iso: string) => iso.replace(/-/g, '');

function extFromMime(mime: string): string {
    const m = mime.toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    if (m.includes('avif')) return 'avif';
    if (m.includes('svg')) return 'svg';
    return 'bin';
}

function yamlQuote(s: string): string {
    // 始终用 JSON 字符串（YAML 兼容）
    return JSON.stringify(s);
}

// 生成 frontmatter + 正文（严格对齐 Pages CMS 字段）
function renderMarkdown(f: {
    title: string; date: string; summary?: string;
    author?: string; cover?: string; body: string;
}) {
    const fm = ['---', `title: ${yamlQuote(f.title)}`, `date: ${yamlQuote(f.date)}`];
    if (f.summary) fm.push(`summary: ${yamlQuote(f.summary)}`);
    if (f.author) fm.push(`author: ${yamlQuote(f.author)}`);
    if (f.cover) fm.push(`cover: ${yamlQuote(f.cover)}`);
    fm.push('---');
    return `${fm.join('\n')}\n\n${f.body.trim()}\n`;
}

// ---------- 请求方环境信息（仅写入 PR 描述，不写入仓库文件） ----------
interface SubmitMeta {
    ip: string;
    ua: string;
    country: string;
    time: string;
}

function requestMeta(request: Request): SubmitMeta {
    const fwd = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
    return {
        ip: request.headers.get('CF-Connecting-IP') ?? fwd ?? '',
        ua: (request.headers.get('User-Agent') ?? '').slice(0, 400),
        country: request.headers.get('CF-IPCountry') ?? '',
        time: new Date().toISOString(),
    };
}

function metaSection(m: SubmitMeta): string {
    return [
        '<details>',
        '<summary>提交环境信息（仅记录于 PR，未写入仓库文件）</summary>',
        '',
        `- **IP：** \`${m.ip || '未知'}\``,
        `- **User-Agent：** \`${m.ua || '未知'}\``,
        `- **国家/地区：** \`${m.country || '未知'}\``,
        `- **提交时间：** \`${m.time}\``,
        '',
        '</details>',
    ].join('\n');
}

// ---------- 音乐投稿 ----------
function renderSongJson(f: {
    title: string; artist: string; link?: string;
    note?: string; author?: string; date: string;
}) {
    const obj: Record<string, string> = {
        title: f.title,
        artist: f.artist,
        date: f.date,
    };
    if (f.link) obj.link = f.link;
    if (f.note) obj.note = f.note;
    if (f.author) obj.author = f.author;
    return JSON.stringify(obj, null, 2) + '\n';
}

async function handleSongSubmit(
    env: Env, fd: FormData, json: (data: unknown, status?: number) => Response,
    meta: SubmitMeta,
): Promise<Response> {
    const title = (fd.get('title') as string | null)?.trim() ?? '';
    const artist = (fd.get('artist') as string | null)?.trim() ?? '';
    const link = (fd.get('link') as string | null)?.trim() ?? '';
    const note = (fd.get('note') as string | null)?.trim() ?? '';
    const author = (fd.get('author') as string | null)?.trim() ?? '';
    const message = (fd.get('message') as string | null)?.trim() ?? '';

    if (!title) return json({ error: '歌名不能为空' }, 400);
    if (!artist) return json({ error: '歌手不能为空' }, 400);
    if (title.length > 200) return json({ error: '歌名过长' }, 400);
    if (artist.length > 120) return json({ error: '歌手名过长' }, 400);
    if (note.length > 500) return json({ error: '备注过长' }, 400);
    if (link && !/^https?:\/\//i.test(link)) {
        return json({ error: '链接必须以 http:// 或 https:// 开头' }, 400);
    }

    const baseBranch = env.GITHUB_BASE_BRANCH ?? 'main';
    const songsDir = env.SONGS_DIR ?? 'src/songs';
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;

    const token = await getInstallationToken(env);
    const api = gh(token);

    // 歌曲文件名：YYYYMMDD-<随机>，避免冲突
    const today = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const ymd = `${today.getFullYear()}${pad2(today.getMonth() + 1)}${pad2(today.getDate())}`;
    const songPath = `${songsDir}/${ymd}-${Math.random().toString(36).slice(2, 8)}.json`;

    const content = renderSongJson({ title, artist, link, note, author, date: ymd });

    const baseRef = await api<{ object: { sha: string } }>(
        `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
    );
    if (!baseRef) throw new Error(`分支不存在: ${baseBranch}`);
    const baseCommitSha = baseRef.object.sha;
    const baseCommit = await api<{ tree: { sha: string } }>(
        `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
    );
    if (!baseCommit) throw new Error('无法获取 base commit');

    const blob = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content, encoding: 'utf-8' }),
    });
    if (!blob) throw new Error('创建歌曲 blob 失败');

    const newTree = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
            base_tree: baseCommit.tree.sha,
            tree: [{ path: songPath, mode: '100644', type: 'blob', sha: blob.sha }],
        }),
    });
    if (!newTree) throw new Error('创建 tree 失败');

    const commitMsg = `feat(music): add "${title}" - ${artist}` +
        (author ? ` by ${author}` : '');
    const newCommit = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({
            message: commitMsg,
            tree: newTree.sha,
            parents: [baseCommitSha],
        }),
    });
    if (!newCommit) throw new Error('创建 commit 失败');

    const branch = `music/${ymd}-${Math.random().toString(36).slice(2, 7)}`;
    await api(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
    });

    const prBody = [
        '**投稿类型：** 🎵 音乐',
        `**歌名：** ${title}`,
        `**歌手：** ${artist}`,
        author ? `**推荐人：** ${author}` : '',
        link ? `**链接：** ${link}` : '',
        note ? `**备注：** ${note}` : '',
        '',
        `**目标文件：** \`${songPath}\``,
        '',
        message ? `**留言：**\n\n${message}` : '',
        '',
        metaSection(meta),
        '---',
        '由音乐投稿表单自动创建，请审核后合并。',
    ].filter(Boolean).join('\n');

    const pr = await api<{ html_url: string; number: number }>(
        `/repos/${owner}/${repo}/pulls`,
        {
            method: 'POST',
            body: JSON.stringify({
                title: `🎵 音乐投稿：${title} - ${artist}`,
                head: branch,
                base: baseBranch,
                body: prBody,
            }),
        },
    );
    if (!pr) throw new Error('创建 PR 失败');

    return json({ prUrl: pr.html_url, number: pr.number, file: songPath });
}

// ---------- 主处理 ----------
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        });

    const meta = requestMeta(request);

    try {
        // 1) 解析 multipart
        const ct = request.headers.get('content-type') || '';
        if (!ct.includes('multipart/form-data')) {
            return json({ error: '需要 multipart/form-data' }, 400);
        }
        const fd = await request.formData();

        // 1.5) Turnstile 人机验证（配置了 secret 才启用）
        const turnstileSecret = env.TURNSTILE_SECRET_KEY?.trim();
        if (turnstileSecret) {
            const raw = fd.get('cf-turnstile-response');
            const token = typeof raw === 'string' ? raw.trim() : '';
            if (!token) {
                return json({ error: '请先完成人机验证' }, 400);
            }
            const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
            const ok = await verifyTurnstile(turnstileSecret, token, ip);
            if (!ok) {
                return json({ error: '人机验证未通过，请刷新页面后重试' }, 403);
            }
        }

        // 1.7) 音乐投稿分支（type=music）
        const submitType = (fd.get('type') as string | null)?.trim() ?? 'chronicle';
        if (submitType === 'music') {
            return await handleSongSubmit(env, fd, json, meta);
        }

        const title = (fd.get('title') as string | null)?.trim() ?? '';
        const date = (fd.get('date') as string | null)?.trim() ?? '';
        const summary = (fd.get('summary') as string | null)?.trim() ?? '';
        const author = (fd.get('author') as string | null)?.trim() ?? '';
        const message = (fd.get('message') as string | null)?.trim() ?? '';
        const body = (fd.get('body') as string | null)?.trim() ?? '';
        const cover = fd.get('cover');

        if (!title) return json({ error: '标题不能为空' }, 400);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: '日期格式应为 YYYY-MM-DD' }, 400);
        if (!body) return json({ error: '正文不能为空' }, 400);
        if (title.length > 200) return json({ error: '标题过长' }, 400);
        if (body.length > 200_000) return json({ error: '正文过长' }, 400);

        const baseBranch = env.GITHUB_BASE_BRANCH ?? 'main';
        const contentDir = env.CONTENT_DIR ?? 'src/content';
        const mediaDir = env.MEDIA_DIR ?? 'public/pages/static';
        const mediaUrl = env.MEDIA_URL_PREFIX ?? '/pages/static';
        const owner = env.GITHUB_OWNER;
        const repo = env.GITHUB_REPO;

        const token = await getInstallationToken(env);
        const api = gh(token);

        // 2) 处理封面图（若有）
        let coverPath: string | undefined;   // 仓库内路径
        let coverUrl: string | undefined;   // markdown 引用
        let coverBlob: { content: string; encoding: 'base64' } | undefined;

        if (cover instanceof File && cover.size > 0) {
            if (cover.size > 5 * 1024 * 1024) return json({ error: '封面图超过 5 MB' }, 413);
            if (!cover.type.startsWith('image/')) return json({ error: '封面必须是图片' }, 400);

            const ext = extFromMime(cover.type);
            const base = `${yyyymmdd(date)}-cover`;
            coverPath = `${mediaDir}/${base}.${ext}`;
            coverUrl = `${mediaUrl}/${base}.${ext}`;

            const buf = await cover.arrayBuffer();
            coverBlob = { content: abToBase64(buf), encoding: 'base64' };
        }

        // 3) 决定文章文件名（同日冲突 → -1, -2, …）
        let articleName = `${yyyymmdd(date)}.md`;
        let articlePath = `${contentDir}/${articleName}`;
        let n = 0;
        // 注意：Contents API 的 GET 返回 404 表示不存在；gh() 已把 404 转成 null
        while (await api(`/repos/${owner}/${repo}/contents/${encodeURIComponent(articlePath)}?ref=${baseBranch}`)) {
            n += 1;
            articleName = `${yyyymmdd(date)}-${n}.md`;
            articlePath = `${contentDir}/${articleName}`;
            if (n > 50) return json({ error: '同日投稿过多' }, 409);
        }

        const markdown = renderMarkdown({
            title, date, summary, author, cover: coverUrl, body,
        });

        // 4) 从 base 分支拿 commit & tree
        const baseRef = await api<{ object: { sha: string } }>(
            `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
        );
        if (!baseRef) throw new Error(`分支不存在: ${baseBranch}`);
        const baseCommitSha = baseRef.object.sha;

        const baseCommit = await api<{ tree: { sha: string } }>(
            `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
        );
        if (!baseCommit) throw new Error('无法获取 base commit');
        const baseTreeSha = baseCommit.tree.sha;

        // 5) 上传 blobs
        const treeEntries: Array<{
            path: string; mode: '100644'; type: 'blob'; sha: string;
        }> = [];

        // markdown blob（utf-8）
        const mdBlob = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST',
            body: JSON.stringify({ content: markdown, encoding: 'utf-8' }),
        });
        if (!mdBlob) throw new Error('创建 markdown blob 失败');
        treeEntries.push({ path: articlePath, mode: '100644', type: 'blob', sha: mdBlob.sha });

        // 封面 blob（base64）
        if (coverBlob && coverPath) {
            const imgBlob = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
                method: 'POST',
                body: JSON.stringify(coverBlob),
            });
            if (!imgBlob) throw new Error('创建封面 blob 失败');
            treeEntries.push({ path: coverPath, mode: '100644', type: 'blob', sha: imgBlob.sha });
        }

        // 6) 建 tree / commit / 分支
        const newTree = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
        });
        if (!newTree) throw new Error('创建 tree 失败');

        const commitMsg = `feat(chronicle): add "${title}" (${date})` +
            (author ? ` by ${author}` : '');

        const newCommit = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({
                message: commitMsg,
                tree: newTree.sha,
                parents: [baseCommitSha],
            }),
        });
        if (!newCommit) throw new Error('创建 commit 失败');

        const branch = `chronicle/${yyyymmdd(date)}-${Math.random().toString(36).slice(2, 7)}`;
        await api(`/repos/${owner}/${repo}/git/refs`, {
            method: 'POST',
            body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
        });

        // 7) 创建 PR
        const prBody = [
            `**标题：** ${title}`,
            `**日期：** ${date}`,
            author ? `**记录人：** ${author}` : '',
            summary ? `**摘要：** ${summary}` : '',
            coverUrl ? `**封面：** \`${coverUrl}\`` : '',
            '',
            `**目标文件：** \`${articlePath}\``,
            '',
            message ? `**留言：**\n\n${message}` : '',
            '',
            metaSection(meta),
            '---',
            '由 Astro 投稿表单自动创建，请审核后合并。',
        ].filter(Boolean).join('\n');

        const pr = await api<{ html_url: string; number: number }>(
            `/repos/${owner}/${repo}/pulls`,
            {
                method: 'POST',
                body: JSON.stringify({
                    title: `📝 班史投稿：${title}`,
                    head: branch,
                    base: baseBranch,
                    body: prBody,
                }),
            },
        );
        if (!pr) throw new Error('创建 PR 失败');

        return json({
            prUrl: pr.html_url,
            number: pr.number,
            file: articlePath,
            cover: coverUrl ?? null,
        });
    } catch (err: any) {
        console.error(err);
        return json({ error: err?.message ?? '服务异常' }, 500);
    }
};