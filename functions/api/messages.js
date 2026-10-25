/**
 * Cloudflare Pages Functions
 * GET  /api/messages   → 返回最新留言列表
 * POST /api/messages   → 新增一条留言
 * 依赖绑定：环境变量 DB（D1 数据库）
 * 表结构由 ensureSchema 在首次访问时自动创建/迁移，无需手动执行 SQL
 */

const MAX_NAME = 12;
const MAX_TEXT = 120;
const MAX_LIST = 200;      // 列表最多返回多少条
const COOLDOWN = 20;       // 同一 IP 两条留言的最小间隔（秒）

/* ---------- 工具 ---------- */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      // 如果前端和接口不同域，可加上 CORS 头；同域可删掉
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/* 清理文本：去掉控制字符、折叠多余空白 */
function clean(str, max) {
  return String(str ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ---------- 表结构：自动建表/迁移（幂等，旧表缺列时自动补齐） ---------- */
const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS messages (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     name       TEXT NOT NULL,
     text       TEXT NOT NULL,
     time       TEXT NOT NULL,
     ip         TEXT,
     ua         TEXT,
     country    TEXT,
     created_at INTEGER NOT NULL
   )`,
  'ALTER TABLE messages ADD COLUMN ua TEXT',
  'ALTER TABLE messages ADD COLUMN country TEXT',
];

let schemaPromise = null;   // 每个 isolate 只迁移一次；失败不缓存，下个请求重试

function ensureSchema(env) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const sql of SCHEMA_SQL) {
        try {
          await env.DB.prepare(sql).run();
        } catch (err) {
          // 列已存在时 SQLite 报 duplicate column name，属预期
          if (!/duplicate column/i.test(String(err && err.message))) throw err;
        }
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/* ---------- OPTIONS（预检） ---------- */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/* ---------- GET：拉取列表 ---------- */
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: false, error: '数据库未绑定' }, 500);

  try {
    await ensureSchema(env);

    const { results } = await env.DB
      .prepare(
        `SELECT id, name, text, time
           FROM messages
          ORDER BY created_at DESC, id DESC
          LIMIT ?`
      )
      .bind(MAX_LIST)
      .all();

    return json({ ok: true, data: results ?? [] });
  } catch (err) {
    console.error('[GET /api/messages]', err);
    return json({ ok: false, error: '读取失败，请稍后再试' }, 500);
  }
}

/* ---------- POST：新增留言 ---------- */
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '数据库未绑定' }, 500);

  // 1. 解析请求体
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: '请求格式错误' }, 400);
  }

  // 2. 校验内容
  const name = clean(body.name, MAX_NAME) || '匿名同学';
  const text = clean(body.text, MAX_TEXT);

  if (!text) {
    return json({ ok: false, error: '内容不能为空' }, 400);
  }
  if (String(body.text ?? '').length > 500) {
    return json({ ok: false, error: '内容过长' }, 400);
  }

  // 3. 简单限流：同一 IP 冷却时间内只能发一条
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    '';
  // 审计信息：入库保存，但列表接口只返回 id/name/text/time，不会外泄
  const ua = (request.headers.get('User-Agent') || '').slice(0, 400);
  const country = request.headers.get('CF-IPCountry') || '';
  const now = Math.floor(Date.now() / 1000);

  try {
    await ensureSchema(env);

    if (ip) {
      const last = await env.DB
        .prepare(
          `SELECT created_at FROM messages
            WHERE ip = ?
            ORDER BY created_at DESC
            LIMIT 1`
        )
        .bind(ip)
        .first();

      if (last && now - last.created_at < COOLDOWN) {
        const wait = COOLDOWN - (now - last.created_at);
        return json(
          { ok: false, error: `发得太快啦，请等 ${wait} 秒` },
          429
        );
      }
    }

    // 4. 写入数据库
    const time = today();
    const res = await env.DB
      .prepare(
        `INSERT INTO messages (name, text, time, ip, ua, country, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(name, text, time, ip, ua, country, now)
      .run();

    // 5. 顺手裁剪：只保留最近 500 条，避免无限增长
    //    如果不需要可以删掉这一段
    try {
      await env.DB
        .prepare(
          `DELETE FROM messages
            WHERE id NOT IN (
              SELECT id FROM messages
               ORDER BY created_at DESC, id DESC
               LIMIT 500
            )`
        )
        .run();
    } catch (e) {
      console.warn('[cleanup]', e);
    }

    return json({
      ok: true,
      data: {
        id: res.meta?.last_row_id ?? null,
        name,
        text,
        time
      }
    });
  } catch (err) {
    console.error('[POST /api/messages]', err);
    return json({ ok: false, error: '保存失败，请稍后再试' }, 500);
  }
}