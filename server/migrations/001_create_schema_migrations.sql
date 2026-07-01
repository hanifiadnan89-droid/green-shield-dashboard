create table if not exists schema_migrations (
  id bigserial primary key,
  name text not null unique,
  checksum text not null,
  applied_at timestamptz not null default now()
);

