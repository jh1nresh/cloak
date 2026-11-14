import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:'+(process.env.CLOAK_MIRROR_PORT||'8781');
const checks=[],errors=[],consoleErrors=[],requests=[];
const assert=(name,ok)=>{checks.push({name,pass:!!ok});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=6000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await sleep(100);}throw Error('Condition timed out');}
await mkdir('qa/replay',{recursive:true});
const context=await chromium.launchPersistentContext('./qa/profile',{channel:'chrome',headless:true,viewport:{width:1440,height:900},args:['--cloak-mirror-qa','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
console.log('QA browser launched');
await context.tracing.start({screenshots:true,snapshots:true});
let page;
async function open(){
  const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message));
  p.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  p.on('request',request=>requests.push({method:request.method(),url:request.url()}));
  await p.addInitScript(()=>{
    window.policyErrors=[];document.addEventListener('securitypolicyviolation',event=>window.policyErrors.push(event.violatedDirective));
    window.cameraCalls=0;window.gumStreams=[];window.gumMode='normal';window.releaseCamera=null;
    const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{
      window.cameraCalls++;
      if(window.gumMode==='deny')throw new DOMException('Fixture denied','NotAllowedError');
      const stream=await get(constraints);window.gumStreams.push(stream);
      if(window.gumMode==='defer')await new Promise(resolve=>{window.releaseCamera=resolve;});
      return stream;
    };
  });
  await p.goto(base);await p.locator('body[data-ready="true"]').waitFor();
  await until(()=>p.evaluate(()=>window.cloakMirror.getState().phase==='ready'));
  return p;
}
let failure;
try{
  page=await open();
  assert('12 distinct selectable products',await page.locator('#garments ui-toggle').count()===12&&await page.evaluate(()=>new Set([...document.querySelectorAll('#garments ui-toggle')].map(el=>el.getAttribute('value'))).size===12));
  assert('no camera request on page open',await page.evaluate(()=>window.cameraCalls===0));
  assert('demo mode is explicit',await page.locator('#modeBadge').innerText()==='示範試穿 · 預先生成');
  await page.screenshot({path:'qa/desktop.png'});
  const anchors=await page.evaluate(()=>{
    const rect=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
    return {rail:rect('garments'),original:document.querySelector('.original').getBoundingClientRect().toJSON(),stage:rect('demoStage'),controls:document.querySelector('.bottom-bar').getBoundingClientRect().toJSON()};
  });
  assert('desktop fixed left rail, full stage, bottom-right original',anchors.rail.right<200&&anchors.original.x>1100&&anchors.original.y>400&&anchors.stage.width===1440&&anchors.stage.height===900);
  await page.click('#next button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().phase==='dressing'));
  const motion=await page.locator('#clothingImage').evaluate(el=>el.getAnimations().map(a=>({duration:a.effect.getTiming().duration,keyframes:a.effect.getKeyframes()})));
  await writeFile('qa/animation.json',JSON.stringify(motion,null,2));
  assert('normal-speed dressing reveal runs on garment only',motion.some(a=>a.duration===480));
  await until(()=>page.evaluate(()=>window.cloakMirror.getState().displayed===1));
  assert('next changes visible garment',await page.evaluate(()=>window.cloakMirror.getState().selected===1));
  await page.locator('h1').click();await page.keyboard.press('ArrowDown');await until(()=>page.evaluate(()=>window.cloakMirror.getState().displayed===2));
  assert('ArrowDown uses same selection',await page.evaluate(()=>window.cloakMirror.getState().selected===2));
  await page.click('#previous button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().displayed===1));
  await page.locator('#mirror').hover({position:{x:1050,y:350}});await page.mouse.wheel(0,200);await until(()=>page.evaluate(()=>window.cloakMirror.getState().selected===2));
  assert('main wheel selects exactly one per burst',await page.evaluate(()=>window.cloakMirror.getState().selected===2));
  await sleep(250);await page.locator('#garments').evaluate(el=>{el.scrollTop=0;});await page.locator('#garments').hover({position:{x:25,y:100}});await page.mouse.wheel(0,250);await sleep(450);
  const railState=await page.evaluate(()=>({selected:window.cloakMirror.getState().selected,scrollTop:document.getElementById('garments').scrollTop}));
  await writeFile('qa/rail-state.json',JSON.stringify(railState));
  assert('rail scrolling browses without changing selection',railState.selected===2&&railState.scrollTop>0);
  for(const index of [0,7,10])await page.locator('#garments ui-toggle').nth(index).locator('button').click();
  await until(()=>page.evaluate(()=>window.cloakMirror.getState().displayed===10));
  assert('rapid selection settles on latest outfit',await page.evaluate(()=>window.cloakMirror.getState().selected===10));
  const agentResult=await page.evaluate(()=>window.cloakMirror.agent.act({steps:[{ref:'下一件',action:'press'}]}));
  assert('ui-sdk agent navigation is wired',agentResult.ok);
  await until(()=>page.evaluate(()=>window.cloakMirror.getState().selected===11));
  await page.click('#next button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().selected===0));
  assert('last garment wraps to first',await page.evaluate(()=>window.cloakMirror.getState().selected===0));
  const agentCamera=await page.evaluate(()=>window.cloakMirror.agent.act({steps:[{ref:'開啟本機鏡頭',action:'press'}]}));
  assert('agent cannot open camera',!agentCamera.ok&&await page.evaluate(()=>window.cameraCalls===0));
  await page.click('#fullBody button');assert('full-body mode remains fixed',await page.locator('#mirror').evaluate(el=>el.classList.contains('full')));await page.click('#fullBody button');
  await page.setViewportSize({width:390,height:844});
  assert('phone controls remain inside viewport',await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('.bottom-bar button')].filter(el=>el.getBoundingClientRect().width>0);
    return document.documentElement.scrollWidth<=innerWidth&&nodes.every(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;});
  }));
  await page.screenshot({path:'qa/mobile.png'});
  await page.evaluate(()=>{
    const target=document.getElementById('demoStage');
    const t=new Touch({identifier:1,target,clientX:210,clientY:480});target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t],changedTouches:[t]}));
    const end=new Touch({identifier:1,target,clientX:210,clientY:260});target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[end]}));
  });
  await until(()=>page.evaluate(()=>window.cloakMirror.getState().selected===1));assert('phone upward swipe selects next',true);
  await page.emulateMedia({reducedMotion:'reduce'});await page.click('#next button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().phase==='ready'));
  assert('reduced motion removes reveal animation',await page.locator('#clothingImage').evaluate(el=>getComputedStyle(el).animationName==='none'));
  assert('no CSP violations in full UI',await page.evaluate(()=>window.policyErrors.length===0));
  await page.close();

  page=await open();
  const catalog=JSON.parse(await page.locator('#catalog').textContent());const broken=base+'/'+catalog.items[8].result;
  await page.route(broken,route=>route.abort());await page.locator('#garments ui-toggle').nth(8).locator('button').click();
  await until(()=>page.evaluate(()=>window.cloakMirror.getState().phase==='error'));
  assert('failed outfit retains last successful image and names it',await page.evaluate(()=>window.cloakMirror.getState().displayed===0)&& (await page.locator('#selectionState').innerText()).includes('保留'));
  await page.unroute(broken);await page.click('#retryLook button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().displayed===8));
  assert('retry evicts failed image promise',true);await page.close();

  page=await open();await page.evaluate(()=>window.gumMode='defer');await page.click('#startCamera button');
  await until(()=>page.evaluate(()=>!!window.releaseCamera));await page.click('#stopCamera button');
  await page.evaluate(()=>window.releaseCamera());
  await until(()=>page.evaluate(()=>window.gumStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
  assert('Stop during permission closes late-acquired tracks',await page.evaluate(()=>window.cloakMirror.getState().cameraPhase==='idle'));
  await page.evaluate(()=>window.gumMode='deny');await page.click('#startCamera button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().cameraPhase==='idle'));
  assert('permission denial is explicit and recoverable',(await page.locator('#cameraState').innerText()).includes('未允許'));
  await page.evaluate(()=>window.gumMode='normal');await page.click('#startCamera button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().cameraPhase==='ready'));
  assert('camera preview clearly has no AI transformation',(await page.locator('#modeBadge').innerText()).includes('尚未 AI 換裝'));
  assert('one video-only camera owner',await page.evaluate(()=>window.gumStreams.filter(stream=>stream.getTracks().some(track=>track.readyState==='live')).length===1&&window.gumStreams.at(-1).getAudioTracks().length===0));
  await page.locator('#cameraMain').evaluate(el=>el.style.filter='brightness(0)');await page.screenshot({path:'qa/camera-dark.png'});
  await page.locator('#cameraMain').evaluate(el=>el.style.filter='brightness(20)');await page.screenshot({path:'qa/camera-bright.png'});
  await page.locator('#cameraMain').evaluate(el=>el.style.filter='none');await page.screenshot({path:'qa/camera-busy.png'});
  await page.click('#gestures button');
  await until(()=>page.evaluate(()=>window.cloakMirror.getState().gestureFrames>2),25000);
  assert('real local MediaPipe model processes camera fixture frames',await page.evaluate(()=>window.cloakMirror.getState().worker&&window.cloakMirror.getState().handError===''));
  const unrestricted=()=>page.evaluate(()=>!document.getElementById('previewSensor')&&document.getElementById('cameraState').textContent.includes('任何位置'));
  assert('desktop gestures have no activation box',await unrestricted());
  await page.screenshot({path:'qa/gesture-desktop.png'});
  await page.setViewportSize({width:390,height:844});await sleep(200);
  assert('portrait gestures have no activation box',await unrestricted());
  await page.screenshot({path:'qa/gesture-mobile.png'});await page.setViewportSize({width:1440,height:900});
  await page.click('#gestures button');assert('gesture off terminates worker but keeps visible local camera',await page.evaluate(()=>!window.cloakMirror.getState().worker&&window.cloakMirror.getState().tracks.length===1));
  await page.click('#stopCamera button');assert('Stop releases camera and both video bindings',await page.evaluate(()=>window.gumStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))&&['cameraMain','cameraPreview'].every(id=>document.getElementById(id).srcObject===null)));
  await page.route('**/hand_landmarker.task',async route=>{await sleep(900);await route.continue().catch(()=>{});});
  await page.click('#gestures button');await sleep(150);await page.click('#stopCamera button');await sleep(1100);
  assert('Stop during detector startup cannot restart worker or camera',await page.evaluate(()=>!window.cloakMirror.getState().worker&&window.cloakMirror.getState().cameraPhase==='idle'&&window.gumStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
  await page.unroute('**/hand_landmarker.task');
  await page.click('#startCamera button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().cameraPhase==='ready'));
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert('pagehide stops local camera resources',await page.evaluate(()=>window.cloakMirror.getState().tracks.length===0&&!window.cloakMirror.getState().worker));
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.click('#startCamera button');await until(()=>page.evaluate(()=>window.cloakMirror.getState().cameraPhase==='ready'));
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert('restored page still cleans up on its next exit',await page.evaluate(()=>window.gumStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
  assert('camera and model use no upload or external requests',requests.every(request=>request.method==='GET'&&new URL(request.url).origin===base));
  assert('no runtime errors',errors.length===0);assert('no CSP violations in camera and hand detector',await page.evaluate(()=>window.policyErrors.length===0));
  await page.close();

  page=await context.newPage();await page.setViewportSize({width:390,height:844});await page.goto(base+'/static/');await page.locator('body[data-ready="true"]').waitFor();await page.locator('#fitting').hover();await page.mouse.wheel(0,200);await sleep(500);
  assert('original static phone entry still renders and scrolls',await page.locator('body').getAttribute('data-active')==='1');
  assert('server rejects token mint without explicit origin and CSRF',(await context.request.post(base+'/api/realtime-token',{data:{}})).status()===403);
  assert('server rejects foreign Host',(await context.request.get(base,{headers:{Host:'attacker.invalid'}})).status()===403);
  assert('server does not serve credentials',(await context.request.get(base+'/.env')).status()===404);
}catch(error){failure=error.message;if(page&&!page.isClosed())await page.screenshot({path:'qa/failure.png'}).catch(()=>{});}
finally{
  await context.tracing.stop({path:'qa/browser-trace.zip'}).catch(()=>{});
  await context.close();
  await writeFile('qa/results.json',JSON.stringify({passed:!failure,checks,errors,consoleErrors,failure,requestCount:requests.length,source:'Browser fake camera and local real hand model; no real-person accuracy or paid inference verification'},null,2));
}
console.log(JSON.stringify({passed:!failure,checks:checks.length,failure,errors}));
if(failure)process.exitCode=1;
