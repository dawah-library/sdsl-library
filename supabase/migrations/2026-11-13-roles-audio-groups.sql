-- ===== الأدوار (٧ نوفمبر ٢٠٢٦): شريك مدير، عضو مميز، وحماية المدير الأصلي =====
-- admin: المدير الأصلي منشئ الموقع • partner: شريك مدير (المجلس الأعلى) بصلاحيات كاملة عدا إزالة المدير الأصلي وتعطيل الموقع
-- editor: عضو فريق الإدارة بصلاحيات محدودة (team_perms) • premium: عضو مميز (نشر حر وخدمات إضافية) • member: عضو • الحظر: community_bans
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','premium','editor','partner','admin','sheikh'));
do $$ declare r record; d text; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and prokind='f' and proname in ('is_admin','is_staff','has_perm','my_perms','report_notify','dm_allowed','dm_people','team_can','team_notify','notify_staff') loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'role in (''editor'',''admin'')', 'role in (''editor'',''admin'',''partner'')');
    d := replace(d, 'role in (''admin'',''editor'')', 'role in (''admin'',''partner'',''editor'')');
    d := replace(d, 'role = ''admin''', 'role in (''admin'',''partner'')');
    execute d;
  end loop; end $$;
create or replace function public.guard_roles() returns trigger language plpgsql security definer set search_path = public as $$
declare me text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select role into me from public.profiles where id = auth.uid();
  if me = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.role = 'admin' then raise exception 'لا يمكن حذف المدير الأصلي'; end if; return old; end if;
  if old.role = 'admin' and (new.role is distinct from old.role) then raise exception 'لا يمكن تغيير دور المدير الأصلي'; end if;
  if new.role = 'admin' and old.role is distinct from 'admin' then raise exception 'دور المدير الأصلي لا يُمنح'; end if;
  if (new.role = 'partner') is distinct from (old.role = 'partner') and me is distinct from 'partner' then raise exception 'منح الشراكة للمدير وشركائه فقط'; end if;
  return new;
end $$;
drop trigger if exists profiles_guard_roles on public.profiles;
create trigger profiles_guard_roles before update or delete on public.profiles for each row execute function public.guard_roles();
-- ١٣ نوفمبر ٢٠٢٦: صلاحيات مفوَّضة جديدة (profiles.perms): audio_upload رفع الكتب الصوتية وتسجيلاتها، radio جدول البث،
-- ask_vision رفع الصور والملفات إلى المساعدَين، ask_web المصادر الخارجية للمساعد العلمي، ask_models اختيار النماذج.
-- صاحب audio_upload يرفع إلى صندوق inbox (التسجيلات) كالمشرفين.
drop policy if exists "inbox audio insert" on storage.objects;
create policy "inbox audio insert" on storage.objects for insert to authenticated with check (bucket_id = 'inbox' and public.has_perm('audio_upload'));
drop policy if exists "inbox audio update" on storage.objects;
create policy "inbox audio update" on storage.objects for update to authenticated using (bucket_id = 'inbox' and public.has_perm('audio_upload'));

-- ١٣ نوفمبر ٢٠٢٦: جدول أسبوعي مرن للقراءة الجماعية (أيام القراءة في الأسبوع: 0 الأحد … 6 السبت؛ فارغ = كل يوم)
alter table public.group_reads add column if not exists week_days int[];
create or replace function public.gr_set_days(g bigint, wd int[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.group_reads where id = g and (owner = auth.uid() or public.is_staff())) then raise exception 'غير مسموح'; end if;
  update public.group_reads set week_days = (select array_agg(distinct x order by x) from unnest(wd) x where x between 0 and 6) where id = g;
end $$;
grant execute on function public.gr_set_days(bigint, int[]) to authenticated;
