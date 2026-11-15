export function handPose({pose='index',tipY=.6,mirroredX=.82,scale=.45}={}){
  const points=Array.from({length:21},()=>({x:.2,y:.7,z:0}));
  points[0]={x:.2,y:.85,z:0};
  for(const [i,x,y]of [[1,.12,.78],[2,.08,.7],[3,.1,.65],[4,.13,.68],[5,.2,.65],[6,.2,.50],[7,.2,.38],[8,.2,.27],[9,.25,.64],[10,.25,.49],[11,.24,.58],[12,.24,.67],[13,.30,.65],[14,.30,.51],[15,.29,.60],[16,.29,.69],[17,.35,.69],[18,.35,.56],[19,.34,.64],[20,.34,.72]])points[i]={x,y,z:0};
  if(pose==='folded'){points[7]={x:.21,y:.59,z:0};points[8]={x:.21,y:.69,z:0};}
  for(const [mcp,pip,dip,tip]of [[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
    if(pose==='palm'||(pose==='two'&&mcp===9)){
      points[dip]={x:points[pip].x,y:points[pip].y-.12,z:0};
      points[tip]={x:points[pip].x,y:points[pip].y-.23,z:0};
    }
  }
  const origin={...points[8]};
  return points.map(p=>({x:1-mirroredX+(p.x-origin.x)*scale,y:tipY+(p.y-origin.y)*scale,z:p.z*scale}));
}
