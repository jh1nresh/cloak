import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SwipeGesture,indexPoint,cameraRect} from '../src/gesture.mjs';
import {handPose} from './hand-fixtures.mjs';
const point=(x,y,pose='index')=>({x,y,pointing:pose==='index',retracted:pose==='folded'});
function fire(g,direction=1,at=0,x=.82){
  const y=direction>0?.65:.3;
  assert.equal(g.update(point(x,y),at),0);assert.equal(g.update(point(x,y),at+200),0);
  assert.equal(g.update(point(x,y-direction*.18),at+400),direction);
}
test('index tip, rather than palm centre, provides mirrored navigation coordinates',()=>{
  const p=indexPoint(handPose({tipY:.4,mirroredX:.81}));
  assert.equal(p.pointing,true);assert.equal(p.retracted,false);assert.ok(Math.abs(p.x-.81)<1e-8);assert.equal(p.y,.4);
});
test('folded index is explicit neutral and cannot activate a swipe',()=>{
  const p=indexPoint(handPose({pose:'folded'}));assert.equal(p.retracted,true);assert.equal(p.pointing,false);
});
test('official MediaPipe pointing-up pose accepts natural distal-joint curvature',async()=>{
  const sample=JSON.parse(await readFile(new URL('fixtures/pointing-up.json',import.meta.url),'utf8'));
  const pose=indexPoint(sample.landmarks,sample.worldLandmarks);assert.equal(pose.pointing,true);assert.equal(pose.retracted,false);
});
test('a substantially bent fingertip cannot activate index navigation',()=>{
  const points=handPose(),world=structuredClone(points);world[8]={...world[7],x:world[7].x+.05};
  assert.equal(indexPoint(points,world).pointing,false);
});
test('open palm and two extended fingers do not activate or reset the index gesture',()=>{
  for(const pose of ['palm','two']){const p=indexPoint(handPose({pose}));assert.equal(p.pointing,false);assert.equal(p.retracted,false);}
});
test('pose classification uses world geometry even when image projection distorts it',()=>{
  const world=handPose(),image=world.map(p=>({...p,y:p.x}));
  assert.equal(indexPoint(image,world).pointing,true);
  const rotated=world.map(p=>({x:p.x,y:p.y*Math.cos(.8),z:p.y*Math.sin(.8)}));
  assert.equal(indexPoint(world,rotated).pointing,true);
});
test('missing, malformed and collapsed hand results cannot reset the latch',()=>{
  for(const rows of [null,[],Array(21).fill({x:0,y:0}),handPose().map(p=>({...p,x:NaN}))])assert.equal(indexPoint(rows),null);
  assert.equal(indexPoint(handPose(),[]).pointing,true);
});
test('upward stroke selects next exactly once, including after a long held return',()=>{
  const g=new SwipeGesture();fire(g);
  for(const [at,y]of [[500,.7],[1500,.4],[1800,.7],[2400,.3]])assert.equal(g.update(point(.82,y),at),0);
  assert.equal(g.phase,'retract');
});
test('downward stroke selects previous exactly once',()=>{const g=new SwipeGesture();fire(g,-1);assert.equal(g.update(point(.82,.3),1800),0);});
test('tracking loss, crossing the frame and an open palm cannot rearm after a switch',()=>{
  const g=new SwipeGesture();fire(g);
  for(const [at,p]of [[500,null],[900,null],[1200,point(.3,.4)],[1600,point(.3,.4)],[1900,point(.82,.5,'palm')],[2200,point(.82,.5,'palm')],[2500,point(.82,.6)],[2800,point(.82,.6)],[3000,point(.82,.4)]])assert.equal(g.update(p,at),0);
});
test('a brief or interrupted index fold cannot rearm',()=>{
  const g=new SwipeGesture();fire(g);
  g.update(point(.82,.7,'folded'),1400);g.update(point(.82,.5,'folded'),1500);g.update(null,1600);
  for(const [at,y]of [[1800,.6],[2100,.6],[2300,.4]])assert.equal(g.update(point(.82,y),at),0);
});
test('folded return causes no action; only a newly armed stroke can switch',()=>{
  const g=new SwipeGesture();fire(g);
  assert.equal(g.update(point(.82,.45,'folded'),1500),0);assert.equal(g.update(point(.82,.7,'folded'),1800),0);
  fire(g,-1,2000);
});
test('fold confirmation is retained during cooldown without requiring a one-second fold',()=>{
  const g=new SwipeGesture();fire(g);
  g.update(point(.82,.5,'folded'),500);g.update(point(.82,.5,'folded'),750);
  assert.equal(g.phase,'cooldown');assert.equal(g.update(point(.82,.3),1200),0);
  assert.equal(g.update(point(.82,.3),1450),0);assert.equal(g.update(point(.82,.3),1650),0);assert.equal(g.update(point(.82,.5),1800),-1);
});
test('small jitter, diagonal motion and movement before the stationary dwell cannot fire',()=>{
  const g=new SwipeGesture();
  for(let i=0;i<12;i++)assert.equal(g.update(point(.80,.5+(i%2)*.03),i*90),0);
  g.reset();g.update(point(.72,.7),0);g.update(point(.72,.7),200);assert.equal(g.update(point(.96,.4),400),0);
  g.reset();g.update(point(.82,.65),0);assert.equal(g.update(point(.82,.4),90),0);assert.equal(g.update(point(.82,.4),300),0);
});
test('index swipes work across the full camera frame in both directions',()=>{
  for(const x of [.02,.15,.5,.85,.98])for(const direction of [1,-1])fire(new SwipeGesture(),direction,0,x);
});
test('off-camera or invalid coordinates and expired strokes do not fire',()=>{
  for(const x of [-.01,1.01,NaN]){const g=new SwipeGesture();for(const [at,y]of [[0,.65],[200,.65],[400,.4]])assert.equal(g.update(point(x,y),at),0);}
  const g=new SwipeGesture();g.update(point(.5,.65),0);g.update(point(.5,.65),200);assert.equal(g.update(point(.5,.4),1200),0);
});
test('raw landmark sequence integrates pose, directional strokes and a folded return',()=>{
  const g=new SwipeGesture(),actions=[];
  for(const [at,pose,tipY]of [[0,'index',.65],[200,'index',.65],[400,'index',.47],[1600,'index',.7],[1900,'index',.4],[2000,'folded',.4],[2300,'folded',.7],[2500,'index',.3],[2700,'index',.3],[2900,'index',.48]]){
    const action=g.update(indexPoint(handPose({pose,tipY})),at);if(action)actions.push(action);
  }
  assert.deepEqual(actions,[1,-1]);
});
test('new camera session reset clears stale pose and cooldown',()=>{const g=new SwipeGesture();fire(g);g.reset();fire(g,-1,2000);});
test('camera overlay follows contained desktop and portrait video',()=>{
  assert.deepEqual(cameraRect(160,205,1280,720),{x:0,y:57.5,width:160,height:90});
  assert.deepEqual(cameraRect(99,130,1280,720),{x:0,y:37.15625,width:99,height:55.6875});
});
