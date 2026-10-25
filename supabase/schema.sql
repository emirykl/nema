-- Nema: Supabase schema. Run once in the Supabase SQL Editor.
--
-- Only the server (service-role key) touches these tables: RLS is enabled
-- with no policies, so the public anon key can read or write nothing.
-- Every row is namespaced by vault contract id, so a fresh testnet
-- deployment starts with clean history.

-- Share-price samples for the chart and realized APY.
create table if not exists snapshots (
  vault        text        not null,
  t            bigint      not null,          -- unix ms
  share_price  text        not null,          -- stroops, kept as text (i128)
  total_assets text        not null,
  total_shares text        not null,
  primary key (vault, t)
);

-- Vault contract events (deposit, withdraw, rebalance, harvest).
create table if not exists vault_events (
  id       text        primary key,           -- RPC event id
  vault    text        not null,
  kind     text        not null,
  account  text,
  data     jsonb       not null default '{}',
  tx_hash  text        not null,
  at       timestamptz not null
);
create index if not exists vault_events_recent on vault_events (vault, at desc);
create index if not exists vault_events_account on vault_events (vault, account, at desc);

-- Faucet cooldown per address and per IP.
create table if not exists faucet_drips (
  key      text        primary key,
  last_at  timestamptz not null
);

-- Small key/value state: indexer cursor, keeper timestamps, tick lock.
create table if not exists kv (
  key        text        primary key,
  value      jsonb       not null default '{}',
  updated_at timestamptz not null default now()
);

-- New tables are not exposed automatically: grant the server role only.
-- anon/authenticated get nothing, so the public key can't read or write.
grant usage on schema public to service_role;
grant select, insert, update, delete on snapshots, vault_events, faucet_drips, kv to service_role;
revoke all on snapshots, vault_events, faucet_drips, kv from anon, authenticated;

alter table snapshots    enable row level security;
alter table vault_events enable row level security;
alter table faucet_drips enable row level security;
alter table kv           enable row level security;
