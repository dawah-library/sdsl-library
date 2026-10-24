#!/usr/bin/env python3
"""Qari-OCR: نموذج مفتوح مجاني متخصص في العربية (مبني على Qwen2-VL-2B، يقرأ التشكيل)، يعمل على معالج أجهزة GitHub بلا بطاقة رسومية ولا حصة.
يُستعمل قارئًا ثانيًا في مرحلة المسودات (أجهزة متوازية) فيراجع Gemini مسودته على الصورة بدل القراءة من الصفر.

الاستعمال المستقل للقياس: python3 tools/qari.py file.pdf 1 5
"""
import os, re, subprocess, sys, tempfile, time

MODEL = os.environ.get("QARI_MODEL", "NAMAA-Space/Qari-OCR-0.2.2.1-VL-2B-Instruct")
PROMPT = ("Below is the image of one page of a document, as well as some raw textual content that was previously extracted for it. "
          "Just return the plain text representation of this document as if you were reading it naturally. Do not hallucinate.")
_M = {}


def _load():
    if _M: return _M["m"], _M["p"]
    import torch
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
    torch.set_num_threads(os.cpu_count() or 4)
    t = time.time()
    dt = torch.bfloat16 if os.environ.get("QARI_BF16", "1") == "1" else torch.float32
    base = os.environ.get("QARI_BASE", "Qwen/Qwen2-VL-2B-Instruct")
    try:  # النموذج منشور مُكيِّفًا (LoRA) على Qwen2-VL-2B: نحمّل الأساس الكامل ثم ندمج المكيِّف
        from peft import PeftModel
        m = Qwen2VLForConditionalGeneration.from_pretrained(base, dtype=dt)
        m = PeftModel.from_pretrained(m, MODEL).merge_and_unload()
    except Exception as e:
        print("  تحميل المكيِّف تعذر (%s)؛ يُجرَّب النموذج مباشرة" % str(e)[:120], flush=True)
        m = Qwen2VLForConditionalGeneration.from_pretrained(MODEL, dtype=dt)
    m.eval()
    px = int(os.environ.get("QARI_PIXELS", str(1024 * 28 * 28)))  # حجم الصورة يحدد عدد الرموز وبالتالي السرعة
    p = AutoProcessor.from_pretrained(MODEL, min_pixels=256 * 28 * 28, max_pixels=px)
    print("  حُمِّل Qari-OCR في %.0f ث" % (time.time() - t), flush=True)
    _M.update(m=m, p=p)
    return m, p


def read_image(img):
    import torch
    from qwen_vl_utils import process_vision_info
    m, p = _load()
    msgs = [{"role": "user", "content": [{"type": "image", "image": "file://" + os.path.abspath(img)}, {"type": "text", "text": PROMPT}]}]
    text = p.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    ii, vi = process_vision_info(msgs)
    inp = p(text=[text], images=ii, videos=vi, padding=True, return_tensors="pt")
    with torch.inference_mode():
        out = m.generate(**inp, max_new_tokens=int(os.environ.get("QARI_MAX_TOKENS", "1500")), do_sample=False, repetition_penalty=1.05)
    t = p.batch_decode([o[len(i):] for i, o in zip(inp.input_ids, out)], skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]
    t = re.sub(r"</?(?:html|body|div|p)[^>]*>", "", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def qari_pages(pdf, nums, deadline=None):
    """{رقم الصفحة: نص} لما تتسع له المهلة."""
    out = {}
    with tempfile.TemporaryDirectory() as td:
        for p in nums:
            if deadline and time.time() > deadline:
                print("  Qari: انتهت مهلة الجهاز بعد %d صفحة" % len(out), flush=True); break
            base = os.path.join(td, "q%d" % p)
            subprocess.run(["pdftoppm", "-r", os.environ.get("QARI_DPI", "150"), "-jpeg", "-f", str(p), "-l", str(p), "-singlefile", pdf, base], check=True)
            t0 = time.time()
            try:
                out[p] = read_image(base + ".jpg")
            except Exception as e:
                print("  Qari: تعذرت الصفحة %d: %s" % (p, str(e)[:150]), flush=True); continue
            print("  Qari ص%d: %.0f ث، %d حرفًا" % (p, time.time() - t0, len(out[p])), flush=True)
    return out


if __name__ == "__main__":
    pdf, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    t = time.time()
    r = qari_pages(pdf, list(range(a, b + 1)))
    for k, v in r.items(): print("=== ص %d ===\n%s\n" % (k, v[:1500]))
    print("المتوسط: %.0f ث للصفحة" % ((time.time() - t) / max(1, len(r))))
