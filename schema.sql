-- D1 数据库结构（留言墙 /api/messages 使用，绑定名 DB）
--
-- 无需手动执行：Functions 首次访问会自动建表并为旧表补齐缺失的列
-- （见 functions/api/messages.js 的 ensureSchema）。本文件仅作结构参考，
-- 需要手工干预（如排查问题）时再执行。

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,          -- 留言人昵称
  text       TEXT NOT NULL,          -- 留言内容
  time       TEXT NOT NULL,          -- 展示用日期 YYYY.MM.DD
  ip         TEXT,                   -- 访客 IP（限流 + 审计）
  ua         TEXT,                   -- User-Agent（审计）
  country    TEXT,                   -- 国家/地区代码，来自 CF-IPCountry（审计）
  created_at INTEGER NOT NULL        -- Unix 秒，排序与限流用
);
