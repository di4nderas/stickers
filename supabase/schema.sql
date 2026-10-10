create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  content_sha256 text not null unique,
  telegram_file_id text,
  telegram_message_id bigint,
  filename text not null,
  pack_title text not null,
  author text not null,
  is_animated boolean not null default false,
  status text not null default 'pending'
    check (status in ('uploading', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists stickers_approved_created_idx
  on public.stickers (created_at desc, id desc)
  where status = 'approved';

alter table public.stickers enable row level security;

create table if not exists public.sticker_upload_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);

alter table public.sticker_upload_limits enable row level security;

grant all on public.stickers, public.sticker_upload_limits to service_role;

create or replace function public.claim_sticker_upload(
  p_ip_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.sticker_upload_limits (ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set
    window_started_at = case
      when sticker_upload_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now()
      else sticker_upload_limits.window_started_at
    end,
    request_count = case
      when sticker_upload_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1
      else sticker_upload_limits.request_count + 1
    end
  returning request_count into current_count;

  if random() < 0.01 then
    delete from public.sticker_upload_limits
    where window_started_at < now() - interval '2 days';
  end if;

  return current_count <= p_limit;
end;
$$;

revoke all on public.stickers from anon, authenticated;
revoke all on public.sticker_upload_limits from anon, authenticated;
revoke all on function public.claim_sticker_upload(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_sticker_upload(text, integer, integer) to service_role;
