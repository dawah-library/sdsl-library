# دليل التسليم التقني الموحّد — لأي نموذج ذكاء اصطناعي أو مطوّر جديد

> نقطة البداية الوحيدة لأي وكيل (Claude من أي حساب، Gemini، Codex/GPT، أو مطور بشري). اقرأه كاملًا، ثم
> `HANDOFF.md` (القواعد في أوله ونقطة الاستئناف في آخره)، ثم `tools/agents/BOARD.md` (لوحة المهام الموزعة)،
> ثم `tools/plan-status.md` (حالة كل بند). المشروع قائم على الملفات وسجل git، لا على ذاكرة أي محادثة.

## ١. قواعد ملزمة
- **مرحلة الكتب (قرار المدير، ٧ نوفمبر ٢٠٢٦):** لا أقسام جديدة ولا تطويرات تقنية جديدة حتى يأذن المدير. العمل محصور في: (١) كتب مكتبة الدعوة والمكتبة العامة: التجهيز (التحويل وربط المصورات وتقسيم «الوجهين» والبطاقات والفهارس) والتصحيح والتدقيق (proof.yml وscan-proof والحواشي وموافقة صفحات المطبوع)؛ (٢) تفعيل خدمات الدراسة عليها: التشجير والاختصارات والكراسات والاختبارات؛ (٣) إصلاح أي خلل فني في الموقع أو المهام. حصة Gemini: آخر ٦ مفاتيح محجوزة لخدمات الكتب (tools/gkeys.py، STUDY_KEYS). طلب صريح من المدير بغير ذلك يُنفَّذ، وما سواه يؤجَّل.
- الردود ورسائل الإيداع **بالعربية مختصرة**؛ رسائل الإيداع تنتهي بسطر إسناد يبيّن الوكيل والحساب (مثال: `Agent: claude/acc-2`).
- **الدمج والنشر تلقائيًّا (إذن دائم من المدير، ٧ نوفمبر ٢٠٢٦):** بعد إنجاز أي طلب وفحصه، افتح PR إلى main وادمجه بنفسك فور نجاح فحوصه (agent-ci وcf-check) دون انتظار الإذن، ثم تحقق من نجاح «النشر على Cloudflare Pages». إن تعارض الفرع مع main فحدّثه وحل التعارض أولًا؛ وإن فشل فحص فأصلحه ولا تدمج وهو أحمر.
- نفّذ ولا تكتفِ بالاقتراح. **لا حذف لمحتوى، ولا مساس بحسابات الأعضاء** إلا بإذن صريح من المدير.
- **لا تكتب سرًّا** (مفتاح، رمز، كلمة مرور) في ملف أو محادثة أو سجل. الأسرار في GitHub Secrets وCloudflare وVercel وSupabase فقط.
- كل خدمة جديدة تُضاف إلى `about.js` (ABOUT_SECS وABOUT_MODULES) في الإيداع نفسه — يفحصه `tools/check-about.py`.
- ملف واجهة جديد: يُضاف إلى `index.html` وإلى `CORE` في `sw.js`.
- قبل كل رفع: `node --check` لكل JS عدّلته، و`python3 tools/check-about.py`، وتجربة بالمتصفح (`python3 -m http.server 8765` ثم Playwright).
- بعد كل بند: حدّث سطره في `tools/plan-status.md` وحالته في `tools/agents/BOARD.md`.

## ٢. المكوّنات والخدمات
| الخدمة | المعرّف / الرابط | الوظيفة | ما يمكن للوكيل فعله |
|---|---|---|---|
| الموقع | https://dawahlibrary.org | الواجهة العامة (PWA) | فحص حي بـ Playwright |
| GitHub | github.com/dawah-library/sdsl-library (عام) | الكود والبيانات؛ **main ينشر تلقائيًا** | فروع، إيداع، PR، تشغيل المهام (Actions) |
| Cloudflare Pages | المشروع `sdsl-library` (wrangler.toml) | الاستضافة الحالية + الدوال في `functions/` (تغلّف `api/`) + DNS والحماية | إعدادات عبر `CLOUDFLARE_API_TOKEN` في المهام (cf-*.yml) |
| Cloudflare R2 | الحاوية `dawah-books` (خاصة) | المصورات وصور الصفحات والصوت والنسخ الاحتياطية | الرفع من المهام عبر `api/r2put` بـ OIDC |
| Vercel | الفريق team_hkvbWbn7gR8fa3JBEkvFY8gy، المشروع prj_T0weniXupGk0eOmqISVlwfNQZgZf | الاستضافة السابقة (sdsl-library.vercel.app يحوّل للنطاق) | سجلات وإعدادات عبر موصّل Vercel |
| Supabase | المشروع `nqxkkdexpodjjwfdkxoq` (Postgres 17) | الحسابات، الأدوار، المجتمع، الإشعارات، سجلات القراءة | المخطط في `supabase/schema.sql` (يعاد تنفيذه بأمان)؛ الترحيل عبر الموصّل يحتاج موافقة المالك في التطبيق |
| Gemini (Google AI) | ٢٠ مفتاحًا GEMINI_API_KEY…_20 | التحويل الضوئي، التدقيق، المساعد، الصوت (TTS) | يُقرأ في المهام؛ الحد لكل مشروع Google |
| GitHub Models | رمز Actions (`models: read`) | محرك تحويل مجاني ثانٍ | — |
| Mistral | MISTRAL_API_KEY | OCR بديل | — |
| Telegram | TELEGRAM_BOT_TOKEN / CHAT_ID | تقارير وتنبيهات للإدارة (`lib/tg.js`) | — |
| البريد | RESEND_API_KEY أو SMTP_* | التذكير بالبريد | — |
| Google OAuth | GOOGLE_CLIENT_ID/SECRET | الدخول بحساب Google (auth-config.yml) | — |
| فيسبوك | FB_PAGE_TOKEN، FB_TOKENS | استجلاب المنشورات العامة (fbin.js) | — |

## ٣. المتغيرات البيئية (الأسماء والوظائف فقط — لا قيم)
- **الدوال (Cloudflare/Vercel):** SUPABASE_URL، SUPABASE_ANON_KEY، SUPABASE_SECRET_KEY (أو SUPABASE_SERVICE_ROLE_KEY)، GEMINI_API_KEY، GEMINI_MODEL، ANTHROPIC_API_KEY وASK_CLAUDE_MODEL (محرك Claude للمساعد العلمي، اختياريان)، GITHUB_WRITE_TOKEN (حفظ المشرفين في المستودع)، GITHUB_REPO، SITE_URL، R2_ACCOUNT_ID، R2_ACCESS_KEY_ID، R2_SECRET_ACCESS_KEY، R2_BUCKET، TELEGRAM_BOT_TOKEN، TELEGRAM_CHAT_ID، VAPID_SEED (إشعارات الجهاز)، RESEND_API_KEY، MAIL_FROM، SMTP_HOST/PORT/USER/PASS/FROM، SDSL_HOURLY_LIMIT، SDSL_EDIT_HOURLY.
- **أسرار GitHub Actions:** GEMINI_API_KEY…_20، GITHUB_MODELS_TOKEN، GH_WRITE_TOKEN، MISTRAL_API_KEY، R2_*، SUPABASE_ACCESS_TOKEN، SUPABASE_SECRET_KEY، CLOUDFLARE_API_TOKEN، FB_PAGE_TOKEN، FB_TOKENS، GOOGLE_CLIENT_ID/SECRET، RESEND_API_KEY، SMTP_*.
- **متغيرات Actions (vars):** OCR_MACHINES، OCR_SHARD، OCR_SURYA، OCR_TESS، OCR_QARI، OCR_PRO_MAX، QARI_PIXELS، MISTRAL_MAX_PAGES، GHM_WORKERS.

## ٤. البنية
- **الواجهة:** ملفات JS بلا إطار، كل قسم ملف: `app.js` (الموجّه والقارئ والإدارة)، `kurrasa.js` الكراسات، `stats.js` الإحصاءات، `groups.js` القراءة الجماعية وتحدي القراءة، `paths.js` المسارات، `mushaf.js` المصحف، `hadith.js` الحديث، `majalla.js` المجلة، `tala*.js` الطلائع، `arabic.js` العربية لغير الناطقين، `guide.js` المساعد الإرشادي، `team.js` مساحة الفريق والأدوار، `manage.js` إدارة المواد، `standards.js` دليل المعايير، `tashjir.js` التشجير، `hifz.js`/`mutun.js` حفظ المتون، `audio.js` الصوتيات، `fbin.js` فيسبوك، `stats.js`، `export.js` التصدير.
- **الدوال:** `api/*.js` (بأسلوب Node) تُشغَّل على Cloudflare عبر `functions/api/[[path]].js` و`functions/_lib/adapter.js`. الحد: لا تُضف دالة إن أمكن الدمج.
- **البيانات:** `data/catalog.json` (الكتب والمؤلفون)، `data/books/<id>.json` نصوص الكتب، `data/articles`، `vols/` المجلدات الكبيرة (تقرأ من raw.githubusercontent)، `data/*.json` لكل خدمة.
- **المعالجة الثقيلة:** `.github/workflows/*.yml` + `tools/*.py` (OCR، التدقيق، التشكيل، الصوت، الاستيراد، الفهارس، النسخ الاحتياطي…). الحفظ من المهام عبر `tools/git-save.sh`.
- **الأدوار (profiles.role):** admin (المدير الأصلي — محمي بمشغّل guard_roles)، partner (شريك مدير: كل الصلاحيات عدا إزالة المدير الأصلي وتعطيل الموقع)، editor (عضو فريق الإدارة بصلاحيات team_perms)، premium (عضو مميز: نشر حر)، sheikh (حساب شيخ)، member. الحظر في `community_bans`. التفويض الدقيق في `profiles.perms` (#/perms).

## ٥. الإجراءات الأساسية
| الإجراء | الطريقة |
|---|---|
| تشغيل محلي | `python3 -m http.server 8765` ثم افتح http://localhost:8765 (الدوال لا تعمل محليًا؛ الواجهة تتراجع بلطف) |
| اختبار | `node --check <file>`؛ `python3 tools/check-about.py`؛ `node tools/live-smoke.js` (فحص دخان) |
| النشر | الدمج في `main` ← Cloudflare Pages ينشر تلقائيًا (رقم إصدار sw.js يُرفع آليًا بـ sw-version.yml) |
| الاسترجاع | `git revert <sha>` ثم الرفع إلى main (لا تُعِد كتابة تاريخ main) |
| قاعدة البيانات | أضف SQL آمنًا قابلًا للتكرار في آخر `supabase/schema.sql`، ثم طبّقه بالموصّل (يحتاج موافقة المالك) |
| نسخة احتياطية | db-backup.yml أسبوعيًا إلى R2 (السجل data/db-backups.json) |
| الأعطال | #/ops لوحة التشغيل؛ `tools/health-report.md`؛ watchdog.yml يعيد تشغيل المتعثر |

## ٦. العمل المتعدد للوكلاء (الحسابات والنماذج المستقلة)
انظر `tools/agents/PROTOCOL.md` (التفاصيل الكاملة)، وباختصار:
1. **استلام مهمة:** اختر من `tools/agents/BOARD.md` مهمة حالتها «متاحة»، واكتب اسم الوكيل وتاريخ الاستلام في سطرها وارفع ذلك وحده أولًا (إيداع صغير) — هذا قفل يمنع التعارض.
2. **فرع لكل مهمة:** `agent/<اسم-الوكيل>/<رقم-المهمة>` ثم Pull Request إلى main؛ فحص `agent-ci.yml` يعمل آليًا على كل PR.
3. **الدمج:** المنسّق (الحساب الرئيسي أو المدير) يراجع ويدمج. التعديلات الصغيرة الآمنة على ملفات خدمة واحدة يجوز دمجها مباشرة بعد نجاح الفحص.
4. **التسليم:** عند التوقف لأي سبب (نفاد الباقة مثلًا) حدّث سطر المهمة: ما أُنجز، وما بقي، وآخر فرع/إيداع — ليكمل غيرك من النقطة نفسها.

## ٧. مصادر الحالة
- `tools/agents/BOARD.md` — المهام الموزعة وأصحابها الآن.
- `tools/plan-status.md` — الحالة التفصيلية لكل بند في خطط التطوير.
- `tools/NEXT-TASKS.md` — المتبقي بالأولوية، وما ينتظر المالك.
- `HANDOFF.md` — السجل الزمني والقرارات والملاحظات التقنية.
- `data/dev-requests.json` — طلبات المدير من #/dev.

## ٨. الوكيل البرمجي من داخل الموقع (#/dev)
- المدير يكتب الطلب في `#/dev` ← يُحفظ في `data/dev-requests.json` ← تعمل `dev-agent.yml` فورًا (وكل ساعتين احتياطًا).
- المحرك: Claude Code إن وُجد سر `CLAUDE_CODE_OAUTH_TOKEN` أو `ANTHROPIC_API_KEY`، وإلا Gemini CLI بالمفاتيح المجانية (gemini-2.5-pro ثم flash، مع التنقل بين المفاتيح).
- يعمل في الفرع `agent/dev/<id>` بلا صلاحية رفع، ثم يُفحص (صياغة، صفحة التعريف، أسرار، فحص دخان بالمتصفح)، ويُصلَح مرة إن فشل، ثم «بانتظار اعتمادك» برابط الفروق. الاعتماد من الموقع يدمجه في main. المتابعة على الطلب تكمل على الفرع نفسه.
- الملفات: tools/dev-agent.sh (المنفّذ)، tools/dev-agent.py (حالة الطلبات)، tools/agents/dev-agent-prompt.md (التكليف)، tools/agent-smoke.js. الإيقاف: مفتاح `dev_agent`.
