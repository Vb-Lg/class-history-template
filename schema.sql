-- D1 数据库结构（留言墙 /api/messages 使用，绑定名 DB）
--
-- 全新部署：直接执行下面的 CREATE TABLE。
-- 已有部署：老表缺少 ua / country 列时，执行文件末尾注释里的 ALTER TABLE。

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

-- 已有部署的增量迁移：
-- ALTER TABLE messages ADD COLUMN ua TEXT;
-- ALTER TABLE messages ADD COLUMN country TEXT;
