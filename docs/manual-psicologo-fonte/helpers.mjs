import {BASE} from './lib.mjs';
export async function prodLink(p){
  await p.evaluate(()=>{
    const fix=s=>s.replace(/https?:\/\/localhost:3100/g,'https://clinicavivermais.cloud');
    document.querySelectorAll('input').forEach(i=>{ if(i.value.includes('localhost')) i.value=fix(i.value); });
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(w.nextNode()){ const n=w.currentNode; if(n.nodeValue.includes('localhost')) n.nodeValue=fix(n.nodeValue); }
  });
}
export async function mark(p, items){
  await prodLink(p);
  const boxes=[];
  for (const it of items){
    const loc = typeof it.loc==='string'? p.locator(it.loc).first() : it.loc;
    if(!it.noScroll) await loc.scrollIntoViewIfNeeded().catch(()=>{});
    const bb = await loc.boundingBox({timeout:6000}).catch(()=>null);
    if(!bb){ console.log('SEM BOX', it.n, String(it.loc)); continue; }
    if(it.maxW) bb.width=Math.min(bb.width,it.maxW); boxes.push({n:it.n,pad:it.pad,round:it.round,bb,sy:await p.evaluate(()=>scrollY)});
  }
  // posições em coordenadas de página
  const sc = await p.evaluate(()=>({x:scrollX,y:scrollY}));
  await p.evaluate(({boxes,sc})=>{
    for(const b of boxes){
      const pad=b.pad??3, x=b.bb.x+sc.x-pad, y=b.bb.y+b.sy-pad, w=b.bb.width+pad*2, h=b.bb.height+pad*2;
      const ring=document.createElement('div');
      ring.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid #F59E0B;border-radius:${b.round??14}px;box-shadow:0 0 0 3px rgba(255,255,255,.55);pointer-events:none;z-index:2147483000`;
      const badge=document.createElement('div');
      badge.textContent=b.n;
      badge.style.cssText=`position:absolute;left:${x-13}px;top:${y-13}px;width:26px;height:26px;border-radius:50%;background:#F59E0B;color:#2a1740;font:800 14px Inter,system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:none;z-index:2147483001`;
      document.body.append(ring,badge);
    }
  },{boxes,sc});
  return boxes;
}
export async function unmark(p){ await p.evaluate(()=>{document.querySelectorAll('body > div[style*="2147483"]').forEach(e=>e.remove())}); }
export async function snap(p,name,clip){
  await p.screenshot({path:`shots/${name}.png`,clip,fullPage:true});
  console.log('ok',name);
}
