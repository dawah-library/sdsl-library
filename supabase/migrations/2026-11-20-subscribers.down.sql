-- التراجع عن 2026-11-20-subscribers.sql (يُؤخذ نسخه احتياطيًّا أولًا: db-backup.yml)
drop function if exists public.is_founder();
drop table if exists public.subscribers;
