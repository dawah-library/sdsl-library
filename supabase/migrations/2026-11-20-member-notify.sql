-- ٢٠ نوفمبر ٢٠٢٦ (طلب المدير): كل عضو يسجّل بالبريد يُشترك تلقائيًّا في الرسائل البريدية والإشعارات،
-- مع تفضيلات يتحكم بها من «حسابي» (member_prefs)، وتذكير القراءة الجماعية قبل موعدها بثلاث ساعات، وجديد المكتبة والصوتيات، والرسائل التحفيزية.
-- آمن للتكرار.
create table if not exists public.member_prefs (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  mail boolean not null default true,          -- الرسائل البريدية عمومًا
  push boolean not null default true,          -- إشعارات الجهاز
  off text[] not null default '{}',            -- أنواع موقوفة: read new audio group motiv newsletter
  last_nudge date, created_at timestamptz not null default now()
);
alter table public.member_prefs enable row level security;
drop policy if exists "prefs own" on public.member_prefs;
create policy "prefs own" on public.member_prefs for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- حالة خدمة الإشعارات (ما أُعلن من الكتب والصوتيات، وآخر رسالة تحفيزية) — للخادم وحده
create table if not exists public.notify_state (k text primary key, v jsonb not null default '{}', at timestamptz not null default now());
alter table public.notify_state enable row level security;

alter table public.group_reads add column if not exists remind_on date;
alter table public.broadcasts add column if not exists kind text;

-- الاشتراك التلقائي عند إنشاء الحساب أو تأكيد بريده (لا يعطّل التسجيل أبدًا)
create or replace function public.member_autosub() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  begin
    insert into public.member_prefs(user_id) values (new.id) on conflict do nothing;
    if new.email is not null and new.email_confirmed_at is not null then
      insert into public.subscribers(email, kinds, confirmed) values (lower(new.email), array['newsletter','member'], true)
      on conflict (email) do update set kinds = (select array_agg(distinct k) from unnest(subscribers.kinds || array['newsletter','member']) k),
        confirmed = true, unsub_at = case when 'member' = any(subscribers.kinds) then subscribers.unsub_at else null end;
      if tg_op = 'INSERT' or old.email_confirmed_at is null then
        insert into public.notifications(user_id, title, body, url) values (new.id, 'مرحبًا بك في مكتبة الدعوة السلفية الرقمية',
          'اشتركتَ تلقائيًّا في النشرة الأسبوعية والتذكيرات (القراءة، وجديد الكتب والصوتيات، والقراءة الجماعية، ورسائل تحفيزية). تتحكم فيها من «حسابي».', '#/account');
      end if;
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists member_autosub on auth.users;
create trigger member_autosub after insert or update of email_confirmed_at on auth.users for each row execute function public.member_autosub();

-- الأعضاء الحاليون: يُضافون إلى النشرة ما لم يكن لهم اشتراك سابق (من ألغى سابقًا لا يُعاد)
insert into public.member_prefs(user_id) select id from auth.users on conflict do nothing;
insert into public.subscribers(email, kinds, confirmed)
  select lower(email), array['newsletter','member'], true from auth.users where email is not null and email_confirmed_at is not null
  on conflict (email) do nothing;
