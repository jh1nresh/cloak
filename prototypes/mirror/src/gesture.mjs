export function cameraRect(width,height,videoWidth,videoHeight){
  const scale=Math.min(width/videoWidth,height/videoHeight),w=videoWidth*scale,h=videoHeight*scale;
  return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
export class SwipeGesture {
  constructor() { this.reset(); }
  reset() { this.anchor=null; this.blocked=false; this.foldedSince=null; this.resetConfirmed=false; this.lastFired=-Infinity; this.phase='idle'; }
  update(point, now) {
    if(this.blocked){
      if(point?.retracted){
        this.foldedSince ??= now;
        if(now-this.foldedSince>=220)this.resetConfirmed=true;
      }else this.foldedSince=null;
      if(!this.resetConfirmed||now-this.lastFired<1000){this.phase=this.resetConfirmed?'cooldown':'retract';return 0;}
      this.blocked=false;this.resetConfirmed=false;this.foldedSince=null;
    }
    const visible=point?.pointing && point.x>=0 && point.x<=1 && point.y>=0 && point.y<=1;
    if (!visible) {
      this.anchor=null;
      this.phase='idle';
      return 0;
    }
    if(!this.anchor) { this.anchor={...point,at:now}; this.phase='arming'; return 0; }
    const elapsed=now-this.anchor.at, dx=Math.abs(point.x-this.anchor.x), dy=point.y-this.anchor.y;
    if(this.phase==='arming') {
      if(dx>.06 || Math.abs(dy)>.06) this.anchor={...point,at:now};
      else if(elapsed>=180) { this.anchor={...point,at:now}; this.phase='armed'; }
      return 0;
    }
    if(dx>.14 || elapsed>900) { this.anchor={...point,at:now}; this.phase='arming'; return 0; }
    this.phase='armed';
    if(Math.abs(dy)<.12) return 0;
    this.lastFired=now;this.blocked=true;this.resetConfirmed=false;this.foldedSince=null;this.anchor=null;this.phase='fired';
    return dy<0?1:-1;
  }
}

export function indexPoint(points,worldPoints) {
  const valid=rows=>Array.isArray(rows)&&rows.length===21&&rows.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.z===undefined||Number.isFinite(p.z)));
  if(!valid(points))return null;
  const hand=valid(worldPoints)?worldPoints:points;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
  const angle=(a,b,c)=>{
    const first=distance(a,b),second=distance(c,b);
    if(first<1e-6||second<1e-6)return 0;
    const dot=(a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y)+((a.z??0)-(b.z??0))*((c.z??0)-(b.z??0));
    return Math.acos(Math.max(-1,Math.min(1,dot/(first*second))))*180/Math.PI;
  };
  const scale=distance(hand[0],hand[5]);
  if(scale<1e-4||distance(hand[5],hand[17])<1e-4||[[5,6],[6,7],[7,8]].some(([a,b])=>distance(hand[a],hand[b])<scale*.08))return null;
  const extended=(mcp,pip,dip,tip)=>angle(hand[mcp],hand[pip],hand[dip])>=155&&angle(hand[pip],hand[dip],hand[tip])>=140&&distance(hand[tip],hand[0])>distance(hand[pip],hand[0])*1.15;
  const folded=(mcp,pip,dip,tip)=>angle(hand[mcp],hand[pip],hand[dip])<=125&&distance(hand[tip],hand[0])<=distance(hand[pip],hand[0])*1.05;
  const pointing=extended(5,6,7,8)&&[[9,10,11,12],[13,14,15,16],[17,18,19,20]].every(finger=>folded(...finger));
  return {x:1-points[8].x,y:points[8].y,pointing,retracted:folded(5,6,7,8)};
}
