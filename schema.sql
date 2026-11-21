-- Knowsies schema (Cloudflare D1). Nothing personal is stored: a display name, a nickname per taker and answer choices.
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,        -- SHA-256 of the creator's secret token
  name TEXT NOT NULL,              -- creator's display name
  pack TEXT NOT NULL,
  questions TEXT NOT NULL,         -- JSON [{q, a:[4 options], c: correct index}]
  created_at INTEGER NOT NULL,
  reports INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quizzes_created ON quizzes(created_at);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  nick TEXT NOT NULL,
  nick_key TEXT NOT NULL,          -- lower-cased nickname, unique per quiz
  token_hash TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '[]', -- JSON array of chosen indexes, in order
  score INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  done_at INTEGER,
  UNIQUE (quiz_id, nick_key)
);
CREATE INDEX IF NOT EXISTS attempts_quiz ON attempts(quiz_id, done, score);

CREATE TABLE IF NOT EXISTS rate (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
