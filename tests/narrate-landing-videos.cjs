// Add French narration to recorded demo scenes. No app/account/data operation.
// Audio clips are committed assets; repeat encoding needs only FFmpeg/FFprobe.
// NAITEA_GENERATE_NARRATION=1 regenerates the public French script via edge-tts.
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), media = path.join(root, 'assets/landing');
const audioDir = path.join(media, 'narration'), raw = '/workspace/artifacts/naitea-landing-narration';
fs.mkdirSync(audioDir, { recursive: true }); fs.mkdirSync(raw, { recursive: true });
const scripts = {
  pro: [
    'Votre activité, dans un seul espace.',
    'Vos ateliers et vos rendez-vous, sur le même calendrier.',
    'Créez un atelier, choisissez son public et son format.',
    'Publiez vos disponibilités pour plusieurs jours.',
    'Retrouvez chaque famille et ses inscriptions.',
    'Créez vos publications avec vos textes et vos photos.',
    'Personnalisez aussi vos bons cadeaux.',
    'Tout est fictif, sans achat ni envoi réel.'
  ],
  familles: [
    'Une fiche pour découvrir votre approche et vos offres.',
    'Les familles découvrent vos ateliers et leurs informations.',
    'Un formulaire clair pour réserver une place.',
    'Pour une séance individuelle, les dates sont visibles.',
    'Choisissez un horaire et la modalité de votre séance.',
    'Offrez un accompagnement avec un bon cadeau.',
    'Une question ? Préparez un message depuis la fiche.',
    'Aucun paiement ni e-mail réel dans cette démonstration.'
  ]
};
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', file], { encoding: 'utf8' }));
const seconds = text => { const [h,m,s] = text.split(':').map(Number); return h * 3600 + m * 60 + s; };
const jobs = [];
for (const kind of Object.keys(scripts)) {
  const vtt = fs.readFileSync(path.join(media, 'demo-' + kind + '.vtt'), 'utf8');
  const cues = [...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)\n([^\n]+)/g)].map((m, i) => ({ startText:m[1], endText:m[2], start:seconds(m[1]), end:seconds(m[2]), text:scripts[kind][i], file:path.join(audioDir, kind + '-' + String(i + 1).padStart(2, '0') + '.mp3') }));
  if (cues.length !== scripts[kind].length) throw Error('Unexpected scene count: ' + kind);
  jobs.push({ kind, cues });
}
fs.writeFileSync(path.join(audioDir, 'scripts.json'), JSON.stringify({ language:'fr-FR', voice:'DeniseNeural', scripts, scenes:jobs.map(({kind,cues})=>({kind,cues:cues.map(({file,...cue})=>({...cue,file:path.basename(file)}))})) }, null, 2) + '\n');
if (process.env.NAITEA_GENERATE_NARRATION === '1') {
  const python = String.raw`
import asyncio,json,os,pathlib
import edge_tts.communicate as edge
for cert in pathlib.Path('/usr/local/share/ca-certificates').glob('*.crt'):
 edge._SSL_CTX.load_verify_locations(cafile=str(cert))
data=json.loads(pathlib.Path(os.environ['NAITEA_SCRIPT_MANIFEST']).read_text())
folder=pathlib.Path(os.environ['NAITEA_AUDIO_DIRECTORY'])
limit=asyncio.Semaphore(3)
async def generate(cue):
 async with limit:
  target=folder/cue['file']
  if target.exists() and target.stat().st_size>1000:return
  voice=edge.Communicate(cue['text'],voice='fr-FR-DeniseNeural',rate='+0%',proxy=os.environ.get('HTTPS_PROXY'),connect_timeout=10,receive_timeout=20)
  await asyncio.wait_for(voice.save(str(target)),40)
  print('Generated '+cue['file'],flush=True)
async def main():
 await asyncio.gather(*(generate(cue) for item in data['scenes'] for cue in item['cues']))
asyncio.run(main())
`;
  execFileSync('python', ['-c', python], { stdio:'inherit', env:{...process.env, PYTHONPATH:process.env.NAITEA_TTS_PYTHONPATH || '/workspace/.cache/naitea-tts', NAITEA_SCRIPT_MANIFEST:path.join(audioDir, 'scripts.json'), NAITEA_AUDIO_DIRECTORY:audioDir} });
}
const report = [];
for (const {kind,cues} of jobs) {
  const output = path.join(media, 'demo-' + kind + '.mp4'), source = path.join(raw, kind + '-source.mp4');
  const current = probe(output);
  if (!current.streams.some(s => s.codec_type === 'audio')) fs.copyFileSync(output, source);
  if (!fs.existsSync(source)) throw Error('Missing silent original: ' + source);
  const duration = Number(probe(source).format.duration), tracks = [];
  for (const [i,cue] of cues.entries()) {
    if (!fs.existsSync(cue.file)) throw Error('Missing narration clip: ' + cue.file);
    const audioDuration = Number(probe(cue.file).format.duration);
    const slot = Math.min(duration,cue.end) - cue.start;
    const tempo = Math.max(1, audioDuration / Math.max(.5,slot - .12));
    const track = path.join(raw, kind + '-' + i + '.wav'); tracks.push(track);
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',cue.file,'-af',`atempo=${tempo.toFixed(5)},loudnorm=I=-17:TP=-1.5:LRA=8,apad,atrim=duration=${slot.toFixed(3)}`,'-ac','1','-ar','48000',track]);
  }
  const audioArgs = tracks.flatMap(file=>['-i',file]);
  const concat = tracks.map((_,i)=>`[${i}:a]`).join('') + `concat=n=${tracks.length}:v=0:a=1[out]`;
  const narration = path.join(audioDir, kind + '-voix-fr.mp3');
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y',...audioArgs,'-filter_complex',concat,'-map','[out]','-c:a','libmp3lame','-b:a','128k',narration]);
  // Remove the old tiny burned captions. The app is preserved above the neutral
  // bottom band, where the large accessible native VTT captions will be shown.
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',source,'-i',narration,'-vf','crop=1440:810:0:0,pad=1440:900:0:0:color=0xFEF8ED','-map','0:v:0','-map','1:a:0','-t',String(duration),'-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',output]);
  const newVtt = 'WEBVTT\n\n' + cues.map(c=>`${c.startText} --> ${c.endText}\n${c.text}\n`).join('\n');
  fs.writeFileSync(path.join(media,'demo-' + kind + '.vtt'),newVtt);
  const result=probe(output);
  if (!result.streams.some(s=>s.codec_type==='audio')) throw Error('Narration not muxed: ' + kind);
  report.push({kind,duration:result.format.duration,streams:result.streams,bytes:fs.statSync(output).size});
}
fs.writeFileSync(path.join(raw,'verification.json'),JSON.stringify({voice:'French synthetic narration; no voice cloning',realData:false,report},null,2)+'\n');
console.log(JSON.stringify(report));
