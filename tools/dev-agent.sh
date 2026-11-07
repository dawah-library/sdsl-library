#!/bin/bash
# الوكيل البرمجي للمساعد التقني — ينفّذ طلبات المدير من #/dev (انظر tools/dev-agent.py لدورة الطلب).
# يُشغَّل من dev-agent.yml. المتغيرات: GH_TOKEN (رمز المهمة)، REPO، ACT، ID، BR، ENG، AUTO،
# ومفاتيح المحركات: CLAUDE_CODE_OAUTH_TOKEN أو ANTHROPIC_API_KEY (Claude)، وGEMINI_API_KEY… (Gemini).
set -uo pipefail
ROOT=$(pwd); META=/tmp/meta; RUN_URL="https://github.com/$REPO/actions/runs/${GITHUB_RUN_ID:-0}"
authed() { git -C "$1" remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"; }
unauth() { git -C "$1" remote set-url origin "https://github.com/${REPO}.git"; }
git config --global user.name "sdsl-dev-agent"; git config --global user.email "sdsl-bot@users.noreply.github.com"

# نسخة جانبية من main لتحديث حالة الطلب دون المساس بفرع العمل
authed "$ROOT"; git fetch -q origin main; git worktree add -q -f "$META" origin/main 2>/dev/null || true; authed "$META"
meta() { ( cd "$META" && git fetch -q origin main && git reset -q --hard origin/main && python3 "$ROOT/tools/dev-agent.py" "$@" && bash "$ROOT/tools/git-save.sh" "المساعد التقني: $1 $ID" data/dev-requests.json data/dev-agent.json >/dev/null ); }

engines() { local c=0 g=0; [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}${ANTHROPIC_API_KEY:-}" ] && c=1; for i in "" _2 _3 _4 _5 _6 _7 _8 _9 _10 _11 _12 _13 _14 _15 _16 _17 _18 _19 _20; do v="GEMINI_API_KEY$i"; [ -n "${!v:-}" ] && g=$((g+1)); done; echo "$c $g"; }
read HAS_C HAS_G < <(engines)

run_claude() {
  [ "$HAS_C" = 1 ] || return 1
  command -v claude >/dev/null || npm i -g -s @anthropic-ai/claude-code >/dev/null 2>&1 || return 1
  timeout 50m claude -p "$(cat .dev-prompt.md)" --dangerously-skip-permissions --max-turns 120 > .dev-log.txt 2>&1; local r=$?
  tail -c 3000 .dev-log.txt; [ $r = 0 ] && ! grep -qiE "usage limit|rate limit|credit balance|invalid api key|authentication" .dev-log.txt
}
run_gemini() {
  [ "$HAS_G" -gt 0 ] || return 1
  command -v gemini >/dev/null || npm i -g -s @google/gemini-cli >/dev/null 2>&1 || return 1
  for m in gemini-2.5-pro gemini-2.5-flash; do
    for i in "" _2 _3 _4 _5 _6 _7 _8 _9 _10 _11 _12 _13 _14 _15 _16 _17 _18 _19 _20; do
      v="GEMINI_API_KEY$i"; [ -n "${!v:-}" ] || continue
      GEMINI_API_KEY="${!v}" timeout 40m gemini -m "$m" -y -p "$(cat .dev-prompt.md)" > .dev-log.txt 2>&1; local r=$?
      tail -c 2000 .dev-log.txt
      if [ $r = 0 ] && ! grep -qiE "quota|RESOURCE_EXHAUSTED|429|API key not valid" .dev-log.txt; then echo "gemini:$m" > .dev-eng; return 0; fi
    done
  done
  return 1
}
engine() {  # يشغّل المحرك المطلوب، ومع «تلقائي» يبدأ بـ Claude ثم Gemini إن تعذر
  rm -f .dev-eng
  case "$ENG" in
    claude) run_claude && echo claude > .dev-eng ;;
    gemini) run_gemini ;;
    *) { run_claude && echo claude > .dev-eng; } || run_gemini ;;
  esac
  [ -s .dev-eng ]
}

checks() {  # فحص التعديلات: الصياغة، وصفحة التعريف، والأسرار، وفحص دخان للواجهة
  local errs="" f
  git checkout -q origin/main -- .github/workflows 2>/dev/null; git clean -qfd .github/workflows 2>/dev/null
  for f in $(git diff --name-only --diff-filter=AM origin/main; git ls-files --others --exclude-standard); do
    case "$f" in vendor/*|.dev-*) ;;
      *.js) node --check "$f" 2>/tmp/e || errs+="$f: $(head -c 400 /tmp/e)"$'\n' ;;
      *.py) python3 -m py_compile "$f" 2>/tmp/e || errs+="$f: $(head -c 400 /tmp/e)"$'\n' ;;
      *.json) python3 -c "import json,sys; json.load(open(sys.argv[1], encoding='utf-8'))" "$f" 2>/tmp/e || errs+="$f: JSON غير صالح"$'\n' ;;
    esac
  done
  python3 tools/check-about.py > /tmp/e 2>&1 || errs+="صفحة التعريف: $(head -c 600 /tmp/e)"$'\n'
  if (git diff origin/main; git ls-files --others --exclude-standard | xargs -r cat) 2>/dev/null | grep -qE 'AIza[0-9A-Za-z_-]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY'; then errs+="يبدو أن التعديل يتضمن مفتاحًا سريًا؛ أزله."$'\n'; fi
  if git diff --name-only origin/main | grep -qE '\.(js|css|html)$' || git ls-files --others --exclude-standard | grep -qE '\.(js|css|html)$'; then
    [ -d node_modules/playwright ] || { npm i -s --no-save playwright@1.48.2 >/dev/null 2>&1 && npx -y playwright@1.48.2 install --with-deps chromium >/dev/null 2>&1; }
    node tools/agent-smoke.js > /tmp/e 2>&1 || errs+="$(head -c 1500 /tmp/e)"$'\n'
  fi
  printf "%s" "$errs" > .dev-check.txt; [ -z "$errs" ]
}

merge_main() {  # دمج الفرع في main ونشره، ثم رفع إصدار عامل الخدمة
  git fetch -q origin main "$BR" || return 1
  git checkout -q -B main origin/main
  git merge -q --no-ff -m "المساعد التقني: دمج طلب $ID" "origin/$BR" || { git merge --abort; return 2; }
  python3 tools/sw-bump.py >/dev/null 2>&1 && { git add sw.js tools/sw-hash.txt; git commit -qm "رفع إصدار عامل الخدمة (طلب $ID)" || true; }
  git push -q origin main && git push -q origin --delete "$BR" 2>/dev/null; return 0
}

case "$ACT" in
merge)
  merge_main; r=$?
  if [ $r = 0 ]; then meta set "$ID" st=done closed=1 && meta log "$ID" "اعتمده المدير، ودُمج في main ونُشر."
  elif [ $r = 2 ]; then meta set "$ID" st=pending && meta log "$ID" "تعارض مع تعديلات أحدث في main؛ سيعيد الوكيل تأسيس الفرع وحل التعارض ثم يعرضه للاعتماد."
  else meta set "$ID" st=review && meta log "$ID" "تعذر الدمج الآن؛ سيُعاد."; fi
  meta status "run={\"id\":\"$ID\",\"act\":\"merge\",\"ok\":$([ $r = 0 ] && echo true || echo false),\"at\":\"$(date -u +%FT%TZ)\"}"
  ;;
close)
  git push -q origin --delete "$BR" 2>/dev/null; meta set "$ID" closed=1; meta log "$ID" "أُغلق الطلب وحُذف فرعه."
  ;;
run)
  meta set "$ID" st=doing t0="$(date -u +%FT%TZ)" br="$BR" run="$RUN_URL"
  if git ls-remote --exit-code --quiet origin "$BR" >/dev/null 2>&1; then
    git fetch -q origin "$BR"; git checkout -q -B "$BR" "origin/$BR"
    git merge -q --no-edit origin/main || { git merge --abort; git checkout -q -B "$BR" origin/main; DEV_EXTRA="الفرع السابق تعارض مع main فبُدئ من main من جديد؛ أعد تنفيذ ما في المتابعات على الأساس الجديد."; export DEV_EXTRA; }
  else git checkout -q -B "$BR" origin/main; fi
  unauth "$ROOT"   # لا يملك المحرك صلاحية الرفع
  python3 tools/dev-agent.py prompt "$ID"
  ok=0; engine && ok=1
  if [ $ok = 1 ] && [ ! -s .dev-need.md ] && ! checks; then
    DEV_EXTRA="فشل الفحص الآلي بعد تعديلك؛ أصلح هذه الأخطاء دون تغيير المطلوب:"$'\n'"$(cat .dev-check.txt)"; export DEV_EXTRA
    python3 tools/dev-agent.py prompt "$ID"; engine; checks; fi
  authed "$ROOT"
  E=$(cat .dev-eng 2>/dev/null || echo "—")
  if [ $ok = 0 ]; then
    meta set "$ID" st=pending eng="${ENG}"
    meta log "$ID" "تعذر تشغيل محرك البرمجة الآن (المحركات المتاحة: Claude=$HAS_C، مفاتيح Gemini=$HAS_G). يُعاد تلقائيًا في الجولة القادمة."
    meta status engines="{\"claude\":$HAS_C,\"gemini\":$HAS_G}" "run={\"id\":\"$ID\",\"act\":\"run\",\"ok\":false,\"at\":\"$(date -u +%FT%TZ)\"}"
    exit 0
  fi
  cp .dev-result.md /tmp/res 2>/dev/null || echo "نُفّذ الطلب." > /tmp/res
  if [ -s .dev-need.md ]; then cp .dev-need.md /tmp/need; git checkout -q -- . ; git clean -qfd -e .dev-need.md
    meta set "$ID" st=need r=@/tmp/need eng="$E"; meta log "$ID" "@/tmp/need"; exit 0; fi
  rm -f .dev-prompt.md .dev-result.md .dev-need.md .dev-log.txt .dev-eng
  CHK=$(cat .dev-check.txt 2>/dev/null); rm -f .dev-check.txt
  git add -A; git reset -q -- node_modules package-lock.json 2>/dev/null
  if git diff --cached --quiet; then meta set "$ID" st=done r=@/tmp/res eng="$E"; meta log "$ID" "@/tmp/res"; exit 0; fi
  FILES=$(git diff --cached --name-only | head -40 | tr '\n' ' ')
  git commit -qm "المساعد التقني: $(python3 -c "import json;x=[i for i in json.load(open('$META/data/dev-requests.json'))['items'] if i['id']=='$ID'][0];print(x['t'][:70].replace(chr(10),' '))")

Agent: $E (dev-agent)"
  git push -q -f origin "$BR"
  DIFF="https://github.com/$REPO/compare/main...$BR"
  PR=$(gh pr create -R "$REPO" -B main -H "$BR" -t "المساعد التقني: طلب $ID" -b "$(cat /tmp/res)" 2>/dev/null || true)
  if [ -n "$CHK" ]; then echo $'\n\n'"⚠️ لم يجتز الفحص الآلي كاملًا:"$'\n'"$CHK" >> /tmp/res; fi
  meta set "$ID" st=review r=@/tmp/res eng="$E" diff="$DIFF" pr="${PR}" files="$FILES" chk=$([ -z "$CHK" ] && echo 1 || echo 0)
  meta log "$ID" "@/tmp/res"
  if [ "$AUTO" = 1 ] && [ -z "$CHK" ]; then
    merge_main && { meta set "$ID" st=done closed=1; meta log "$ID" "اجتاز الفحص، ونُشر مباشرة بإذن المدير (نشر تلقائي)."; }
  fi
  meta status engines="{\"claude\":$HAS_C,\"gemini\":$HAS_G}" "run={\"id\":\"$ID\",\"act\":\"run\",\"ok\":true,\"eng\":\"$E\",\"at\":\"$(date -u +%FT%TZ)\"}"
  ;;
esac
exit 0
