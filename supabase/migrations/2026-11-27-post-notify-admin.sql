-- إشعار الإدارة بالتعليقات على المنشورات (طلب المدير، ٢٧ نوفمبر ٢٠٢٦). آمن للتكرار.
create or replace function public.social_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; who text; pid bigint;
begin
  who := coalesce((select name from public.member_pages where user_id = auth.uid()), 'عضو');
  if tg_table_name = 'post_comments' then
    if new.parent_id is not null then
      select user_id into owner from public.post_comments where id = new.parent_id;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications(user_id, title, body, url) values (owner, who || ' ردّ على تعليقك', left(new.body, 140), '#/post/' || new.post_id);
      end if;
    end if;
    if new.post_id ~ '^m[0-9]+$' then
      pid := substr(new.post_id, 2)::bigint;
      select user_id into owner from public.member_posts where id = pid;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications(user_id, title, body, url) values (owner, who || ' علّق على منشورك', left(new.body, 140), '#/post/' || new.post_id);
      end if;
    end if;
    -- إشعار الإدارة (المدير وشريكه) بكل تعليق على المنشورات (طلب المدير، ٢٧ نوفمبر)
    insert into public.notifications(user_id, title, body, url)
      select p.id, who || ' علّق على منشور', left(new.body, 140), '#/post/' || new.post_id
      from public.profiles p where p.role in ('admin','partner') and p.id <> new.user_id;
  elsif tg_table_name = 'post_reactions' then
    if new.post_id ~ '^m[0-9]+$' then
      pid := substr(new.post_id, 2)::bigint;
      select user_id into owner from public.member_posts where id = pid;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications(user_id, title, url) values (owner, who || ' أعجبه منشورك', '#/post/' || new.post_id);
      end if;
    end if;
  elsif tg_table_name = 'follows' then
    if new.followee like 'u:%' then
      insert into public.notifications(user_id, title, url) values (substr(new.followee, 3)::uuid, who || ' بدأ متابعتك', '#/member/' || new.follower);
    end if;
  end if;
  return new;
exception when others then return new;  -- الإشعار لا يمنع التفاعل نفسه
end $$;
