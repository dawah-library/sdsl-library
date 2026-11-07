// يصيّر film.html إطارًا إطارًا إلى فيديو صامت: node promo/render.js <out.mp4> [v=1] [voice] [fps]
// يتطلب خادمًا محليًا على جذر المستودع: python3 -m http.server 8765
const {chromium} = require('playwright'); const {spawn} = require('child_process'); const fs = require('fs');
const [out, vert, voice = 'Charon', fpsS = '30'] = process.argv.slice(2); const V = vert === '1', fps = +fpsS;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport: V ? {width: 1080, height: 1920} : {width: 1920, height: 1080}});
  p.on('pageerror', e => console.error('ERR', e.message));
  await p.goto(`http://localhost:8765/promo/film.html?voice=${voice}${V ? '&v=1' : ''}`);
  await p.waitForFunction('window.READY', null, {timeout: 60000});
  const cues = await p.evaluate('window.CUES'); fs.writeFileSync(out.replace(/\.mp4$/, '.cues.json'), JSON.stringify(cues));
  const N = Math.ceil(cues.total * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], {stdio: ['pipe', 'inherit', 'inherit']});
  for (let i = 0; i < N; i++) {
    await p.evaluate(t => seek(t), i / fps);
    const buf = await p.screenshot({type: 'jpeg', quality: 93});
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`${i}/${N}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); console.log('done', out, cues.total.toFixed(1) + 's');
})();
