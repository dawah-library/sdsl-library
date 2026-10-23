#!/bin/bash
# حفظ نتائج مهام GitHub Actions في المستودع مع حل التعارض تلقائيًا إن عدّل أحد الملفات نفسها في الوقت ذاته.
# الاستخدام: bash tools/git-save.sh "رسالة الحفظ" مسار1 مسار2 ...
msg="$1"; shift
git config user.name "sdsl-bot"; git config user.email "sdsl-bot@users.noreply.github.com"
for p in "$@"; do [ -e "$p" ] && git add -A "$p"; done
git diff --cached --quiet && { echo "لا تغييرات"; exit 0; }
git commit -q -m "$msg"
for i in 1 2 3 4 5 6; do
  git fetch -q origin main
  if git rebase -q origin/main; then git push -q origin HEAD:main && { echo "حُفظ"; exit 0; }; sleep 3; continue; fi
  while git status | grep -q "rebase in progress"; do
    for f in $(git diff --name-only --diff-filter=U); do
      case "$f" in *.json) python3 tools/merge-json.py "$f" || git checkout --theirs -- "$f" ;; *) git checkout --theirs -- "$f" ;; esac
      git add "$f"
    done
    GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 || { git diff --name-only --diff-filter=U | grep -q . || { git rebase --skip >/dev/null 2>&1 || break; }; }
  done
  git push -q origin HEAD:main && { echo "حُفظ بعد دمج التعارض"; exit 0; }
  sleep 5
done
echo "تعذر الحفظ"; exit 1
