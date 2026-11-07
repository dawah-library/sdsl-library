#!/usr/bin/env python3
"""فحص تشخيصي لمحرك GitHub Models: الحالة، ونوع الرد، وسبب التوقف، لكل نموذج."""
import json, os, urllib.request, urllib.error
T = os.environ.get("GITHUB_MODELS_TOKEN", "").strip()
print("token:", "present" if T else "missing")
txt = open(os.path.join(os.path.dirname(__file__), "..", "data", "books", "uluwhimma.json"), encoding="utf-8")
pages = (json.load(txt).get("pages") or [])[20:24]
src = "\n".join(p if isinstance(p, str) else json.dumps(p, ensure_ascii=False) for p in pages)[:6000]
for m in ["openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4o-mini", "deepseek/DeepSeek-V3-0324", "meta/Llama-3.3-70B-Instruct"]:
    for label, prompt, fmt in [("short", "قل: السلام عليكم. أخرج JSON {\"t\": \"...\"}", True), ("book", "لخص النص في JSON {\"s\": \"...\"}\n\n" + src, True), ("book-nofmt", "لخص النص في JSON {\"s\": \"...\"}\n\n" + src, False)]:
        b = {"model": m, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "max_tokens": 600}
        if fmt: b["response_format"] = {"type": "json_object"}
        req = urllib.request.Request("https://models.github.ai/inference/chat/completions", data=json.dumps(b).encode(),
              headers={"content-type": "application/json", "authorization": "Bearer " + T, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read(); print(m, label, r.status, r.headers.get("content-type"), len(raw))
                try:
                    j = json.loads(raw); ch = (j.get("choices") or [{}])[0]
                    print("   finish:", ch.get("finish_reason"), "| content:", repr(((ch.get("message") or {}).get("content") or "")[:150]), "| filter:", json.dumps(ch.get("content_filter_results"), ensure_ascii=False)[:200])
                except Exception as e:
                    print("   raw:", repr(raw[:300]))
        except urllib.error.HTTPError as e:
            print(m, label, "HTTP", e.code, e.read()[:300].decode("utf-8", "ignore"))
        except Exception as e:
            print(m, label, "EXC", type(e).__name__, str(e)[:200])
