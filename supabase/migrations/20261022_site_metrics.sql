-- Additive migration. No existing data or permissions are changed.
begin;
create table if not exists public.site_metric_events (
  id uuid primary key,
  session_id uuid not null,
  kind text not null check (kind in ('page_view','cipher_view','cipher_open','video_play','video_open','download_click')),
  page text not null check (length(page) between 1 and 160),
  item text not null default '' check(length(item)<=240),
  title text not null default '' check(length(title)<=160),
  created_at timestamptz not null default now()
);
create index if not exists site_metric_events_date_idx on public.site_metric_events(created_at);
create index if not exists site_metric_events_session_idx on public.site_metric_events(session_id,created_at);
alter table public.site_metric_events enable row level security;
revoke all on public.site_metric_events from anon, authenticated;
create table if not exists public.site_metric_admins(user_id uuid primary key references auth.users(id));
alter table public.site_metric_admins enable row level security;
revoke all on public.site_metric_admins from anon, authenticated;
-- Existing verified owner/admin accounts only. New signups cannot claim this permission.
insert into public.site_metric_admins(user_id)
select id from auth.users where email = 'admin@gal-einai.local'
and email_confirmed_at is not null on conflict do nothing;

create or replace function public.record_site_metric(p_id uuid,p_session uuid,p_kind text,p_page text,p_item text default '',p_title text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_session is null or p_kind not in ('page_view','cipher_view','cipher_open','video_play','video_open','download_click')
     or p_page is null or p_page !~ '^/[a-zA-Z0-9_./-]{0,159}$'
     or length(coalesce(p_item,''))>240 or length(coalesce(p_title,''))>160 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
  if (select count(*) from public.site_metric_events where session_id=p_session and created_at>now()-interval '1 minute')>=120 then
    return false;
  end if;
  insert into public.site_metric_events(id,session_id,kind,page,item,title)
  values(p_id,p_session,p_kind,p_page,coalesce(p_item,''),coalesce(p_title,'')) on conflict(id) do nothing;
  return true;
end $$;
revoke all on function public.record_site_metric(uuid,uuid,text,text,text,text) from public;
grant execute on function public.record_site_metric(uuid,uuid,text,text,text,text) to anon,authenticated;

create or replace function public.site_metric_report(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.site_metric_admins where user_id=auth.uid()) then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_days not in (1,7,30,90,365) then raise exception 'Invalid report period'; end if;
  with events as (
    select * from public.site_metric_events where created_at>=now()-make_interval(days=>p_days)
  ), totals as (
    select count(distinct session_id) as visits,
      count(*) filter(where kind='page_view') as page_views,
      count(*) filter(where kind='cipher_view') as cipher_views,
      count(*) filter(where kind='cipher_open') as cipher_opens,
      count(*) filter(where kind='video_play') as video_plays,
      count(*) filter(where kind='video_open') as video_opens,
      count(*) filter(where kind='download_click') as downloads from events
  ), items as (
    select kind,case when kind='page_view' then page else item end as item,
      max(title) as title,count(*) as total from events group by kind,case when kind='page_view' then page else item end
  ), daily as (
    select (created_at at time zone 'Asia/Jerusalem')::date as day,
      count(distinct session_id) as visits,count(*) filter(where kind='page_view') as views,
      count(*) filter(where kind='download_click') as downloads
    from events group by 1
  )
  select jsonb_build_object('totals',(select to_jsonb(t) from totals t),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by total desc) from items i),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by day desc) from daily d),'[]'::jsonb),
    'first_event',(select min(created_at) from public.site_metric_events),'days',p_days) into result;
  return result;
end $$;
revoke all on function public.site_metric_report(integer) from public, anon, authenticated;
grant execute on function public.site_metric_report(integer) to authenticated;
commit;
