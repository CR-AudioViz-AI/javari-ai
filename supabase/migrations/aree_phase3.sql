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
