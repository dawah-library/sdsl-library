"""حارس «يدوي فقط»: يتخطى التشغيل المجدول للمهام المدرجة في data/manual-only.json،
ويُبقي التشغيل اليدوي (workflow_dispatch) وطلبات الإدارة (دفع ملف الطابور) يعملان."""
import json, os, sys

def guard(key):
    # يحرس السكربت المشغَّل نفسه فقط: إن استُورد ملف محروس مكتبةً من سكربت آخر (مثل tashjir داخل sharh-ai، أو sharh-align داخل sharh-dawah)
    # فلا يُنهي ذلك السكربت؛ وللسكربت المشغَّل حارسه بمفتاحه. (كان هذا يوقف «رحلة شرح السنة» صامتًا منذ ٢٦ نوفمبر.)
    if sys._getframe(1).f_globals.get("__name__") != "__main__":
        return
    ev = os.environ.get("GITHUB_EVENT_NAME", "")
    if ev == "push":
        try:
            import subprocess
            m = subprocess.run(["git", "log", "-1", "--format=%B"], capture_output=True, text=True).stdout
        except Exception:
            m = ""
        if "[queue-pause]" in m:
            ev = "schedule"  # دفعة تفريغ الطوابير نفسها لا تشغّل شيئًا
    if ev != "schedule":
        return
    try:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "manual-only.json")
        keys = json.load(open(p, encoding="utf-8")).get("keys", [])
    except Exception:
        return
    if key in keys:
        print(f"manual-only: {key} skipped on schedule (needs explicit request)")
        sys.exit(0)
