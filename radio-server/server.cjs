'use strict';
const http=require('node:http'),{spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const wav=path.join(os.tmpdir(),'kg-pilot.wav'),sr=24000,duration=16,n=sr*duration;
const b=Buffer.alloc(44+n*2);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
// Original synthetic test jingle. No third-party recordings or news.
const notes=[261.63,329.63,392,440,349.23,293.66,220,261.63];
for(let i=0;i<n;i++){let t=i/sr,beat=Math.floor(t/0.5),q=t%0.5,f=notes[beat%notes.length],env=Math.min(1,q/.035)*Math.exp(-q*5),edge=Math.min(1,t/.12,(duration-t)/.12);let x=(Math.sin(2*Math.PI*f*t)+.20*Math.sin(4*Math.PI*f*t))*.10*env+Math.sin(2*Math.PI*notes[Math.floor(t/4)%notes.length]/2*t)*.045;b.writeInt16LE(Math.round(x*edge*32767),44+i*2)}
fs.writeFileSync(wav,b);
const mp3=path.join(os.tmpdir(),'kg-pilot.mp3');
const enc=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-codec:a','libmp3lame','-b:a','48k','-ar','24000','-ac','1',mp3]);if(enc.status!==0)throw new Error('Audio encoder failed: '+String(enc.stderr));
let active=0,used=0,day=new Date().toISOString().slice(0,10);
const maxListeners=3,maxTests=30,seconds=60;
const page='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Radio Studio — пилот</title><style>body{background:#10231e;color:#f2f8f4;font:16px system-ui;margin:0;padding:24px}main{max-width:720px;margin:auto}section{background:#1c362e;border:1px solid #436356;border-radius:20px;padding:20px;margin:16px 0}h1{font-size:clamp(26px,7vw,42px);margin:0}small,p{color:#c7d9d0;line-height:1.6}button{background:#eac579;border:0;border-radius:12px;padding:14px;color:#17251d;font-weight:bold;font-size:16px;cursor:pointer}a{color:#eac579}audio{width:100%;margin-top:14px}strong{color:#eac579}</style><main><small>ТЕХНИЧЕСКИЙ ПИЛОТ · НЕ ОФИЦИАЛЬНЫЙ ЭФИР</small><h1>Radio «Абдыш-Ата»</h1><p>Музыка, новости, интервью — концепция будущей станции.</p><section><h2>Тестовый аудиопоток</h2><p>Оригинальная синтетическая заставка, 60 секунд. Без коммерческих песен. До трёх одновременных подключений.</p><button id="play">▶ Начать тест</button><audio id="a" controls preload="none"></audio><p id="msg" role="status">Сервер готов к тесту.</p></section><section><h2>Студия · мониторинг</h2><p id="stats">Загрузка состояния...</p><p>Следующий этап: авторизованная загрузка аудио, AutoDJ, плейлисты, ведущие, права на музыку. Управление настоящим эфиром ещё не реализовано.</p></section><a href="https://kg-radio.onrender.com/">← KG Radio</a></main><script>const a=document.getElementById("a"),m=document.getElementById("msg");document.getElementById("play").onclick=()=>{a.src="/stream.mp3?t="+Date.now();a.play().catch(()=>m.textContent="Тест недоступен. Повторите после проверки статуса.")};a.onplaying=()=>m.textContent="Тестовая заставка воспроизводится.";a.onended=()=>m.textContent="60-секундный тест завершён.";a.onerror=()=>m.textContent="Нет соединения или исчерпан лимит теста.";async function stats(){try{const s=await fetch("/status").then(r=>r.json());document.getElementById("stats").textContent="Подключения: "+s.listeners+" / "+s.maxListeners+". Тестов осталось: "+s.testsRemaining+"."}catch{document.getElementById("stats").textContent="Статус недоступен"}}stats();a.onplay=stats;a.onpause=stats;</script></html>';
function rotate(){const d=new Date().toISOString().slice(0,10);if(d!==day){day=d;used=0}}
const server=http.createServer((req,res)=>{
const route=new URL(req.url,'http://localhost').pathname;
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
if(route==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok')}
if(route==='/status'){rotate();res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://kg-radio.onrender.com'});return res.end(JSON.stringify({mode:'technical-pilot',listeners:active,maxListeners,testsRemaining:Math.max(0,maxTests-used),seconds}))}
if(route==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(page)}
if(route!=='/stream.mp3'){res.writeHead(404);return res.end('Not found')}
if(req.method==='HEAD'){res.writeHead(200,{'Content-Type':'audio/mpeg'});return res.end()}
if(req.method!=='GET'){res.writeHead(405);return res.end()}
rotate();if(active>=maxListeners||used>=maxTests){res.writeHead(429,{'Content-Type':'text/plain','Retry-After':'60'});return res.end('Pilot test limit reached')}
active++;used++;
res.writeHead(200,{'Content-Type':'audio/mpeg','Access-Control-Allow-Origin':'https://kg-radio.onrender.com','X-Accel-Buffering':'no','Accept-Ranges':'none'});
const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-re','-stream_loop','-1','-i',mp3,'-t',String(seconds),'-c:a','copy','-f','mp3','-write_xing','0','pipe:1'],{stdio:['ignore','pipe','ignore']});
let finished=false;function close(){if(finished)return;finished=true;active--;clearTimeout(timer);if(!proc.killed)proc.kill();if(!res.writableEnded)res.end()}
const timer=setTimeout(close,(seconds+8)*1000);res.on('close',close);proc.on('error',close);proc.on('close',close);proc.stdout.pipe(res);
});
server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Pilot ready on port '+(process.env.PORT||10000)));
