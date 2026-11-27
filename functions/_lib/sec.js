// مولَّد آليًا بـ tools/cf-config.py من vercel.json — لا تعدّله يدويًا.
// ترويسات الأمان لاستجابات دوال Cloudflare Pages (لا يطبّق عليها _headers).
export const SEC = {
 "Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/ https://cdnjs.cloudflare.com/ajax/libs/pdf.js/ https://static.cloudflareinsights.com; worker-src 'self' blob: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https://github.com https://*.githubusercontent.com https://everyayah.com; connect-src 'self' https://nqxkkdexpodjjwfdkxoq.supabase.co wss://nqxkkdexpodjjwfdkxoq.supabase.co https://raw.githubusercontent.com https://api.github.com https://api.mymemory.translated.net https://api.pwnedpasswords.com https://*.r2.cloudflarestorage.com https://cdnjs.cloudflare.com https://cloudflareinsights.com https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; manifest-src 'self'; upgrade-insecure-requests",
 "X-Content-Type-Options": "nosniff",
 "X-Frame-Options": "DENY",
 "Referrer-Policy": "strict-origin-when-cross-origin",
 "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
 "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
 "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
};
export function secure(r) {
  const h = new Headers(r.headers);
  for (const k in SEC) if (!h.has(k)) h.set(k, SEC[k]);
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}
