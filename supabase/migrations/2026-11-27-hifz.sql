-- خطط الحفظ وسجله على الخادم (تفويض المستخدم 27 نوفمبر): لتذكير الورد اليومي بالإشعارات حتى والتطبيق مغلق.
-- المصدر الأصلي يبقى تقدم العضو في حسابه (S.mtn)؛ هذه نسخة تشغيلية مزامنة منه. آمن للتكرار.
create table if not exists public.hifz_plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  matn_id text not null, title text,
  daily int not null default 1 check (daily between 1 and 50),
  done int not null default 0, total int not null default 0,
  remind_at text default '20:00', tz_offset int not null default 180, hour_utc int,
  last_done date, last_sent date, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, matn_id)
);
alter table public.hifz_plans enable row level security;
drop policy if exists "hifz plans own" on public.hifz_plans;
create policy "hifz plans own" on public.hifz_plans for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists hifz_plans_due_idx on public.hifz_plans(hour_utc) where active;

create table if not exists public.hifz_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  matn_id text not null, day date not null, parts int not null default 0,
  primary key (user_id, matn_id, day)
);
alter table public.hifz_log enable row level security;
drop policy if exists "hifz log own" on public.hifz_log;
create policy "hifz log own" on public.hifz_log for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
