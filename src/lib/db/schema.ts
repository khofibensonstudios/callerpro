export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  formats TEXT[] NOT NULL DEFAULT '{}',
  avatar_hue INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  cover_url TEXT,
  balance_micros BIGINT NOT NULL DEFAULT 0,
  lifetime_micros BIGINT NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('video','clip','blog','note','story')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  skill TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  cover_image TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone','followers')),
  published BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  earn_micros BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_reposts (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_views (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('view','ad')),
  micros BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS liked_by TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS deleted_posts (
  id TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Live',
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  viewer_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS live_signals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  from_peer TEXT NOT NULL,
  to_peer TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('offer','answer','ice','join','leave')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_comments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_hearts (
  session_id TEXT PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
  count BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS live_guests (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS peak_viewers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
UPDATE live_sessions SET last_heartbeat_at = COALESCE(last_heartbeat_at, started_at) WHERE status = 'live';
ALTER TABLE follows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_kind_check;
ALTER TABLE activity ADD CONSTRAINT activity_kind_check CHECK (kind IN ('follow','like','comment','mention','comment_like'));

CREATE TABLE IF NOT EXISTS thread_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  typing_thread TEXT,
  typing_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS activity_user_created_idx ON activity (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_viewers (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS live_follow_events (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, follower_id)
);

CREATE TABLE IF NOT EXISTS live_stats (
  session_id TEXT PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
  host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  total_joins INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  new_followers INTEGER NOT NULL DEFAULT 0,
  earnings_micros BIGINT NOT NULL DEFAULT 0,
  duration_secs INTEGER NOT NULL DEFAULT 0,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_sessions_status_idx ON live_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS live_signals_session_to_idx ON live_signals (session_id, to_peer, created_at);
CREATE INDEX IF NOT EXISTS live_signals_session_from_idx ON live_signals (session_id, from_peer, created_at);
CREATE INDEX IF NOT EXISTS live_comments_session_idx ON live_comments (session_id, created_at);

CREATE INDEX IF NOT EXISTS posts_author_created_idx ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_kind_pub_created_idx ON posts (kind, published, created_at DESC);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id);
CREATE INDEX IF NOT EXISTS messages_thread_created_idx ON messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS comments_post_created_idx ON comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS views_post_viewer_created_idx ON post_views (post_id, viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_user_created_idx ON ledger_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS threads_users_idx ON threads (user_a, user_b);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS member_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS chat_calls (
  thread_id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL,
  callee_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_call_signals (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_call_signals_to_idx ON chat_call_signals (thread_id, to_id, created_at);
CREATE INDEX IF NOT EXISTS chat_calls_user_idx ON chat_calls (caller_id, status);
CREATE INDEX IF NOT EXISTS chat_calls_callee_idx ON chat_calls (callee_id, status);
ALTER TABLE chat_calls ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'audio';
ALTER TABLE chat_calls ADD COLUMN IF NOT EXISTS participant_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE chat_calls ADD COLUMN IF NOT EXISTS joined_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS shops (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'off' CHECK (status IN ('off','setup','pending','verified','rejected')),
  name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  location TEXT NOT NULL DEFAULT '',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  sells TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  socials JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  images TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'Other',
  stock INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'placed',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  image TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS shop_products_seller_idx ON shop_products (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_products_pub_idx ON shop_products (published, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_buyer_idx ON shop_orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_order_items_seller_idx ON shop_order_items (seller_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE shops ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS sells TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS socials JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_status_check CHECK (status IN ('off','setup','pending','verified','rejected'));

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active','suspended','banned'));

ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_source_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_source_check CHECK (source IN ('view','ad','adjust','payout'));

CREATE TABLE IF NOT EXISTS contacts (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, user_id),
  CHECK (owner_id <> user_id)
);
CREATE INDEX IF NOT EXISTS contacts_owner_idx ON contacts (owner_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS caller_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_digest TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_caller_id_uidx ON users (caller_id) WHERE caller_id IS NOT NULL AND caller_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS users_pin_digest_uidx ON users (pin_digest) WHERE pin_digest IS NOT NULL AND pin_digest <> '';

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reporter_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_type, target_id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'console';

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS ops_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_micros BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  method TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wallet_withdrawals_status_idx ON wallet_withdrawals (status, created_at DESC);
`;
