-- «العقل المتعلّم» للمساعد العلمي: أسئلة الأعضاء وأجوبة المساعد وتقييمهم، بلا هوية أصحابها (لا معرف عضو ولا بريد).
-- يكتب فيه الخادم وحده (api/ask بمفتاح الخدمة)، ويقرؤه tools/brain.py في GitHub Actions؛ لا سياسات للعموم (RLS بلا سياسات = مغلق).
create table if not exists public.ask_learn (
  id text primary key,                       -- معرف عشوائي للجواب من المتصفح
  at timestamptz not null default now(),
  q text not null,                           -- السؤال (حتى ٢٠٠٠ حرف)
  a text,                                    -- الجواب (حتى ٦٠٠٠ حرف)
  mode text, eng text,
  refs text[] not null default '{}',         -- المراجع المذكورة في الجواب (كتاب:صفحة)
  searches text[] not null default '{}',     -- عبارات البحث التي استعملها
  vote smallint not null default 0 check (vote between -1 and 1),
  note text                                  -- تصحيح العضو أو ملاحظته (حتى ١٠٠٠ حرف)
);
create index if not exists ask_learn_at on public.ask_learn (at);
alter table public.ask_learn enable row level security;
revoke all on public.ask_learn from anon, authenticated;
