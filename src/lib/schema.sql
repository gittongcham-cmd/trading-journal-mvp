create table if not exists instruments (
  id uuid primary key default gen_random_uuid(),
  market_type text not null check (market_type in ('spot', 'futures')),
  asset_type text not null,
  name text not null,
  code text not null,
  display_name text not null,
  exchange text not null,
  sector text,
  initial_consonants text,
  aliases text[] default '{}',
  multiplier numeric,
  tick_size numeric,
  tick_value numeric,
  fee_rate numeric,
  contract_month text,
  expiry_date date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  trade_date date not null,
  market_type text not null check (market_type in ('spot', 'futures')),
  asset_type text not null,
  instrument_id uuid references instruments(id),
  instrument_name text not null,
  instrument_code text,
  position_side text not null check (position_side in ('long', 'short')),
  trade_action text not null check (trade_action in ('entry', 'exit', 'entry_exit')),
  entry_date date,
  entry_price numeric not null,
  exit_date date,
  exit_price numeric,
  quantity numeric,
  contract_count numeric,
  multiplier numeric,
  trade_amount numeric default 0,
  fee numeric default 0,
  realized_pnl numeric default 0,
  unrealized_pnl numeric default 0,
  cumulative_pnl numeric default 0,
  market_cumulative_pnl numeric default 0,
  return_rate numeric default 0,
  entry_reason text,
  exit_reason text,
  target_price numeric,
  emotion_tags text[] default '{}',
  review_memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists account_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null,
  total_asset numeric not null,
  cash numeric default 0,
  spot_evaluation_amount numeric default 0,
  futures_margin numeric default 0,
  futures_evaluation_amount numeric default 0,
  unrealized_pnl numeric default 0,
  realized_pnl numeric default 0,
  deposit numeric default 0,
  withdrawal numeric default 0,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  record_date date not null,
  total_balance numeric not null,
  previous_record_change_amount numeric,
  previous_record_change_rate numeric,
  previous_month_change_amount numeric,
  previous_month_change_rate numeric,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists account_balance_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references account_balance_snapshots(id) on delete cascade,
  bank_name text not null,
  account_number text,
  account_name text,
  amount numeric not null,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
