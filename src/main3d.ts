// Ttydyn 3D Engine - Entry point (личный движок)
import './style.css';
import { TtydynEngine } from './engine3d/engine';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudLog = document.getElementById('hud-log')!;
const hudStats = document.getElementById('hud-stats')!;

// Fallback if old layout
const engine = new TtydynEngine(canvas);

engine.onHud = (msg:string)=>{
  hudLog.textContent = msg;
  hudLog.style.opacity='1';
  setTimeout(()=> hudLog.style.opacity='0.7', 2000);
};
engine.onStats = (o:any)=>{
  const hour=Math.floor(o.hour), min=Math.floor((o.hour%1)*60);
  const timeStr = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
  const isNight = o.hour<6||o.hour>20;
  hudStats.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <span style="background:#111;padding:2px 6px;border:1px solid #444">❤️ ${Math.floor(o.hp)}% ${o.hp<=0?'DEAD':''}</span>
      <span style="background:#0a2a4a;padding:2px 6px;border:1px solid #2a6">⚡ ${Math.floor(o.stamina)}%</span>
      <span style="background:#2a1a0a;padding:2px 6px;border:1px solid #a63">🍖 ${Math.floor(o.hunger)}%</span>
      <span style="background:#0a1a3a;padding:2px 6px;border:1px solid #38f">💧 ${Math.floor(o.thirst)}%</span>
      ${o.bleeding>0?`<span style="background:#4a0a0a;padding:2px 6px;border:1px solid red">🩸 ${Math.floor(o.bleeding)}%</span>`:''}
      ${o.infected>0?`<span style="background:#1a3a0a;padding:2px 6px;border:1px solid #3a5">🤢 ${Math.floor(o.infected)}%</span>`:''}
      <span style="background:#1a1a0a;padding:2px 6px;border:1px solid #666">🧟 ${o.zombies}</span>
      <span style="background:${isNight?'#0a0f2a':'#2a2a0a'};padding:2px 6px;border:1px solid #aa6">${isNight?'🌙':'☀️'} ${timeStr}</span>
      <span style="background:#111;padding:2px 6px;border:1px solid gold">☠️ Kills ${o.kills}</span>
    </div>
  `;
};

// Loop with fixed timestep
let last=performance.now();
function loop(){
  const now=performance.now();
  let dt=(now-last)/1000; last=now;
  dt=Math.min(dt,0.05);
  engine.update(dt);
  engine.render();
  requestAnimationFrame(loop);
}
loop();

// quick tips
engine.log('🎮 WASD ходьба | Shift бег | Пробел прыжок | Мышь прицел | ЛКМ стрельба | E лут | F баррикада | R респавн');

// handle visibility
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) last=performance.now(); });
