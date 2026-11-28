#!/bin/bash
# حفظ نتائج مهام GitHub Actions في المستودع مع حل التعارض تلقائيًا إن عدّل أحد الملفات نفسها في الوقت ذاته.
# الاستخدام: bash tools/git-save.sh "رسالة الحفظ" مسار1 مسار2 ...
msg="$1"; shift
# لا يحفظ في main إلا تشغيل على main: تشغيل فرع (طلب دمج أو فرع وكيل) كان يرفع إيداعات الفرع نفسها إلى main
if [ -n "${GITHUB_REF:-}" ] && [ "${GITHUB_REF}" != "refs/heads/main" ] && [ "${GIT_SAVE_ANY_BRANCH:-}" != "1" ]; then echo "تشغيل على ${GITHUB_REF}: لا يُحفظ في main"; exit 0; fi
git config user.name "sdsl-bot"; git config user.email "sdsl-bot@users.noreply.github.com"
for p in "$@" data/usage; do [ -e "$p" ] && git add -A "$p"; done
git diff --cached --quiet && { echo "لا تغييرات"; exit 0; }
git commit -q -m "$msg"
for i in 1 2 3 4 5 6; do
  git fetch -q origin main
  if git rebase -q origin/main; then git push -q origin HEAD:main && { echo "حُفظ"; exit 0; }; sleep 3; continue; fi
  # أسماء الملفات العربية تُطبع مقتبسة بأرقام ثمانية ما لم يُعطَّل quotepath، فكانت git add تفشل ودارت الحلقة بلا نهاية (٢٨ نوفمبر ٢٠٢٦)؛ لذا -z وquotepath=off وسقف للمحاولات
  n=0
  while git status | grep -q "rebase in progress"; do
    n=$((n+1)); [ $n -gt 40 ] && { echo "تجاوز سقف محاولات دمج التعارض"; git rebase --abort >/dev/null 2>&1; break; }
    git -c core.quotepath=off diff -z --name-only --diff-filter=U | while IFS= read -r -d '' f; do
      case "$f" in *.json) python3 tools/merge-json.py "$f" || git checkout --theirs -- "$f" ;; *) git checkout --theirs -- "$f" ;; esac
      git add -- "$f"
    done
    GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 || { git diff --name-only --diff-filter=U | grep -q . || { git rebase --skip >/dev/null 2>&1 || break; }; }
  done
  git push -q origin HEAD:main && { echo "حُفظ بعد دمج التعارض"; exit 0; }
  sleep 5
done
echo "تعذر الحفظ"; exit 1
