create table if not exists ai_usage_logs (
  id text primary key,
  organization_id text null,
  user_id text null,
  timestamp timestamptz not null,
  endpoint text null,
  feature text null,
  provider text not null,
  model text null,
  duration_ms integer not null default 0,
  input_size integer not null default 0,
  output_size integer not null default 0,
  success boolean not null,
  status text not null,
  error_code text null,
  request_id text null,
  source text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_logs_timestamp_desc
  on ai_usage_logs (timestamp desc);

create index if not exists idx_ai_usage_logs_org_timestamp_desc
  on ai_usage_logs (organization_id, timestamp desc);

create index if not exists idx_ai_usage_logs_feature_timestamp_desc
  on ai_usage_logs (feature, timestamp desc);

create index if not exists idx_ai_usage_logs_provider_timestamp_desc
  on ai_usage_logs (provider, timestamp desc);

create index if not exists idx_ai_usage_logs_success_timestamp_desc
  on ai_usage_logs (success, timestamp desc);

create table if not exists error_log (
  id text primary key,
  organization_id text null,
  timestamp timestamptz not null,
  severity text not null,
  status text null,
  source text null,
  page text null,
  module text null,
  endpoint text null,
  http_status integer null,
  error_code text null,
  message text not null,
  stack_trace text null,
  user_facing_message text null,
  technical_details text null,
  request_id text null,
  related_lead_id text null,
  related_customer_id text null,
  suggested_fix text null,
  likely_cause text null,
  raw_metadata jsonb null,
  deployment jsonb null,
  timeline jsonb null,
  ai_analysis jsonb null,
  first_seen_at timestamptz null,
  last_seen_at timestamptz null,
  occurrence_count integer not null default 1,
  archived boolean not null default false,
  dedup_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_error_log_org_created_at_desc
  on error_log (organization_id, created_at desc);

create index if not exists idx_error_log_org_severity_status
  on error_log (organization_id, severity, status);

create index if not exists idx_error_log_dedup_key
  on error_log (dedup_key);

create index if not exists idx_error_log_endpoint_created_at_desc
  on error_log (endpoint, created_at desc);

