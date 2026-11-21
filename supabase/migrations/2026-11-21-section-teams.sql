-- ٢١ نوفمبر ٢٠٢٦: فرق الأقسام (secteams.js) — علامات t_<القسم> في profiles.perms مع صلاحياته.
-- فريق التفريغات (tafrigh_upload) يرفع التسجيلات الصوتية والمرئية والتفريغات المصورة إلى صندوق inbox الخاص كفريق الصوتيات.
drop policy if exists "inbox audio insert" on storage.objects;
create policy "inbox audio insert" on storage.objects for insert to authenticated with check (bucket_id = 'inbox' and (public.has_perm('audio_upload') or public.has_perm('tafrigh_upload')));
drop policy if exists "inbox audio update" on storage.objects;
create policy "inbox audio update" on storage.objects for update to authenticated using (bucket_id = 'inbox' and (public.has_perm('audio_upload') or public.has_perm('tafrigh_upload')));
