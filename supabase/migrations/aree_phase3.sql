create table if not exists roadmaps (
  id text primary key,
  title text not null,
  created_at bigint not null,
  updated_at bigint not null
);
create table if not exists roadmap_tasks (
  id text primary key,
  roadmap_id text references roadmaps(id) on delete cascade,
  phase_id text not null,
  title text not null,
  description text not null,
  depends_on text[],
  status text not null,
  result text,
  error text,
  cost numeric default 0,
  updated_at bigint not null
);
create table if not exists roadmap_executions (
  id bigint primary key,
  roadmap_id text,
  started_at bigint,
  completed_at bigint,
  status text
);
create table if not exists roadmap_locks (
  roadmap_id text primary key,
  locked_at bigint not null
);
create table if not exists roadmap_costs (
  id bigserial primary key,
  roadmap_id text,
  task_id text,
  model text,
  provider text,
  tokens_used numeric,
  estimated_cost numeric,
  created_at bigint
);

create table if not exists user_monthly_usage (
  id bigserial primary key,
  user_id text,
  month text,
  execution_count integer default 0,
  total_cost numeric default 0,
  updated_at bigint
);

create unique index if not exists user_monthly_unique
on user_monthly_usage(user_id, month);


create table if not exists user_subscriptions (
  id bigserial primary key,
  user_id text not null,
  provider text not null, -- stripe | paypal | etc
  provider_subscription_id text,
  plan_tier text not null,
  status text not null, -- active | canceled | past_due
  current_period_end bigint,
  created_at bigint,
  updated_at bigint
);

create unique index if not exists user_subscription_unique
on user_subscriptions(user_id);

