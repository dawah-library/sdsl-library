// حارس «يدوي فقط» (انظر manual_guard.py)
module.exports = function guard(key) {
  let ev = process.env.GITHUB_EVENT_NAME || "";
  if (ev === "push") { try { if (require("child_process").execSync("git log -1 --format=%B", { encoding: "utf8" }).includes("[queue-pause]")) ev = "schedule"; } catch (e) {} }
  if (ev !== "schedule") return;
  try {
    const keys = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "data", "manual-only.json"), "utf8")).keys || [];
    if (keys.includes(key)) { console.log("manual-only: " + key + " skipped on schedule"); process.exit(0); }
  } catch (e) {}
};
