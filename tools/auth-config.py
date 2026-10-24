#!/usr/bin/env python3
"""ضبط إعدادات الدخول في Supabase عبر Management API برمز SUPABASE_ACCESS_TOKEN (سر في GitHub، صلاحية Auth Config فقط).
الوضع read: يطبع ملخصًا آمنًا للإعدادات (بلا أسرار). الوضع apply: يضبط رابط الموقع وروابط الرجوع، وقوالب البريد العربية،
وحدود الأمان؛ ويفعّل Google إن وُجد GOOGLE_CLIENT_ID/SECRET، وSMTP إن وُجد SMTP_HOST/USER/PASS. لا يحذف شيئًا ولا يمس المستخدمين."""
import json, os, sys, urllib.request

REF = "nqxkkdexpodjjwfdkxoq"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
SITE = "https://dawahlibrary.org"
API = "https://api.supabase.com/v1/projects/%s/config/auth" % REF


def call(method, body=None):
    req = urllib.request.Request(API, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "User-Agent": "sdsl-library"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def mail(title, intro, btn, note):
    return f"""<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e1d8;border-radius:14px;background:#fffdf8;color:#222;line-height:1.9">
<h2 style="color:#0f5c4d;margin:0 0 8px">مكتبة الدعوة السلفية الرقمية</h2><h3 style="margin:0 0 12px">{title}</h3><p>{intro}</p>
<p style="text-align:center;margin:22px 0"><a href="{{{{ .ConfirmationURL }}}}" style="background:#0f5c4d;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold">{btn}</a></p>
<p style="font-size:13px;color:#666">{note}</p><p style="font-size:12px;color:#999">dawahlibrary.org — الدعوة السلفية بمصر • جمعية الدعاة الخيرية</p></div>"""


SAFE = ["site_url", "uri_allow_list", "disable_signup", "mailer_autoconfirm", "external_email_enabled", "external_google_enabled", "external_apple_enabled",
        "external_phone_enabled", "smtp_host", "smtp_admin_email", "smtp_sender_name", "password_min_length", "password_hibp_enabled", "rate_limit_email_sent",
        "jwt_exp", "sessions_timebox", "sessions_inactivity_timeout", "refresh_token_rotation_enabled", "security_captcha_enabled", "mailer_secure_email_change_enabled"]


def show(c, title):
    print("== " + title)
    for k in SAFE:
        if k in c:
            print("  %s = %s" % (k, c[k]))


def main():
    if not TOKEN:
        print("::error::السر SUPABASE_ACCESS_TOKEN غير موجود"); sys.exit(1)
    cur = call("GET")
    show(cur, "الإعدادات الحالية")
    if (sys.argv[1:] or ["read"])[0] != "apply":
        return
    allow = set(x for x in (cur.get("uri_allow_list") or "").split(",") if x)
    allow |= {SITE + "/**", SITE, "https://www.dawahlibrary.org/**", "https://sdsl-library.vercel.app/**"}
    p = {
        "site_url": SITE,
        "uri_allow_list": ",".join(sorted(allow)),
        "password_min_length": 8,
        "mailer_subjects_confirmation": "تأكيد حسابك في مكتبة الدعوة السلفية الرقمية",
        "mailer_templates_confirmation_content": mail("مرحبًا بك عضوًا في المكتبة", "شكرًا لتسجيلك. اضغط الزر لتأكيد بريدك وتفعيل حسابك.", "تأكيد البريد وتفعيل الحساب", "إن لم تُنشئ حسابًا في المكتبة فتجاهل هذه الرسالة."),
        "mailer_subjects_recovery": "تعيين كلمة مرور جديدة — مكتبة الدعوة السلفية الرقمية",
        "mailer_templates_recovery_content": mail("تعيين كلمة مرور جديدة", "طلبتَ تعيين كلمة مرور جديدة لحسابك. اضغط الزر وافتح الرابط من الجهاز نفسه.", "تعيين كلمة مرور جديدة", "إن لم تطلب ذلك فتجاهل الرسالة، وتبقى كلمة مرورك كما هي."),
        "mailer_subjects_magic_link": "رابط الدخول إلى مكتبة الدعوة السلفية الرقمية",
        "mailer_templates_magic_link_content": mail("رابط الدخول إلى حسابك", "اضغط الزر للدخول مباشرة دون كلمة مرور. الرابط صالح لمدة قصيرة ولمرة واحدة.", "الدخول إلى المكتبة", "إن لم تطلب الدخول فتجاهل الرسالة."),
        "mailer_subjects_email_change": "تأكيد تغيير البريد — مكتبة الدعوة السلفية الرقمية",
        "mailer_templates_email_change_content": mail("تأكيد البريد الجديد", "اضغط الزر لتأكيد تغيير بريد حسابك إلى هذا البريد.", "تأكيد البريد الجديد", "إن لم تطلب ذلك فتجاهل الرسالة."),
        "refresh_token_rotation_enabled": True,
    }
    gid, gsec = os.environ.get("GOOGLE_CLIENT_ID", "").strip(), os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    if gid and gsec:
        p.update({"external_google_enabled": True, "external_google_client_id": gid, "external_google_secret": gsec})
        print("سيُفعَّل الدخول بـ Google")
    sh, su, sp = os.environ.get("SMTP_HOST", "").strip(), os.environ.get("SMTP_USER", "").strip(), os.environ.get("SMTP_PASS", "").strip()
    if sh and su and sp:
        p.update({"smtp_host": sh, "smtp_port": os.environ.get("SMTP_PORT", "587").strip() or "587", "smtp_user": su, "smtp_pass": sp,
                  "smtp_admin_email": os.environ.get("SMTP_FROM", "").strip() or su, "smtp_sender_name": "مكتبة الدعوة السلفية الرقمية",
                  "rate_limit_email_sent": 100})
        print("سيُربط البريد SMTP")
    try:
        new = call("PATCH", p)
    except urllib.error.HTTPError as e:
        print("::error::تعذر الحفظ: %s %s" % (e.code, e.read()[:300].decode("utf-8", "ignore"))); sys.exit(1)
    show(new, "بعد الضبط")


if __name__ == "__main__":
    main()
