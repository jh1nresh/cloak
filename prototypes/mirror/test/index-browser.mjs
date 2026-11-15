import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
import {handPose} from './hand-fixtures.mjs';
const base='http://127.0.0.1:'+(process.env.CLOAK_MIRROR_PORT||'8781');
const checks=[],errors=[];
const check=(name,ok)=>{checks.push({name,pass:!!ok});if(!ok)throw Error(name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=6000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await sleep(80);}throw Error('Index gesture condition timed out');}
const context=await chromium.launchPersistentContext('./qa/profile',{channel:'chrome',headless:true,viewport:{width:1440,height:900},args:['--cloak-mirror-qa','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
let failure,page;
try{
  await context.tracing.start({screenshots:true,snapshots:true});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.fixturePose=null;window.fixtureCameraStreams=[];window.fixtureStall=false;
    const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);window.fixtureCameraStreams.push(stream);return stream;};
    const NativeWorker=window.Worker;
    window.Worker=class {
      constructor(url,options){if(!String(url).endsWith('/hand-worker.js'))return new NativeWorker(url,options);this.dead=false;}
      postMessage(data){
        if(data.type==='init')setTimeout(()=>{if(!this.dead)this.onmessage?.({data:{type:'ready'}});},10);
        if(data.type==='frame'){
          data.frame.close();const points=window.fixturePose;
          if(window.fixtureStall)return;
          setTimeout(()=>{if(!this.dead)this.onmessage?.({data:{type:'result',points,worldPoints:points}});},5);
        }
      }
      terminate(){this.dead=true;}
    };
    window.fixtureWorker=window.Worker;
  });
  await page.goto(base+'/');await page.locator('body[data-ready="true"]').waitFor();
  const state=()=>page.evaluate(()=>window.cloakMirror.getState());
  const pose=options=>page.evaluate(points=>{window.fixturePose=points;},options?handPose(options):null);
  await pose({pose:'palm',tipY:.65});await page.click('#gestures button');await until(async()=>(await state()).gestureFrames>=2);
  await pose({pose:'palm',tipY:.42});await sleep(500);
  check('old open-palm motion no longer changes garments',(await state()).selected===0);
  await pose({tipY:.65,mirroredX:.18});await until(async()=>(await state()).gesturePhase==='armed');
  check('index-only guidance is visible',(await page.locator('#cameraState').innerText()).includes('食指'));
  check('no activation box or box instruction remains',await page.locator('#previewSensor').count()===0&&!(await page.locator('#gestureHint').innerText()).includes('虛線'));
  await page.screenshot({path:'qa/index-finger-guide.png'});
  await pose({tipY:.57,mirroredX:.18});await until(async()=>(await state()).selected===1&&(await state()).displayed===1);
  check('short index up stroke on left side reaches actual outfit selection',(await state()).gestureSwitches===1);
  await pose({tipY:.7});await sleep(1300);
  check('extended-finger return cannot select previous',(await state()).selected===1&&(await state()).gestureSwitches===1);
  await pose(null);await sleep(350);await pose({tipY:.65});await sleep(300);await pose({tipY:.45});await sleep(300);
  check('tracking loss cannot rearm a fired stroke',(await state()).selected===1&&(await state()).gestureSwitches===1);
  check('return hint requests explicit finger folding',(await page.locator('#gestureHint').innerText()).includes('收起食指'));
  await pose({pose:'folded',tipY:.45});await sleep(140);await pose({pose:'folded',tipY:.7});await sleep(300);
  check('folded-finger return does not change garments',(await state()).selected===1&&(await state()).gestureSwitches===1);
  await pose({tipY:.32,mirroredX:.5});await until(async()=>(await state()).gesturePhase==='armed');
  await pose({tipY:.40,mirroredX:.5});await until(async()=>(await state()).selected===0&&(await state()).displayed===0);
  check('short newly extended index down stroke at centre selects previous',(await state()).gestureSwitches===2);
  await page.click('#stopCamera button');
  check('index gesture mode releases camera and worker',await page.evaluate(()=>!window.cloakMirror.getState().worker&&window.fixtureCameraStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
  const cameraCalls=await page.evaluate(()=>window.fixtureCameraStreams.length);
  await page.route('**/models/source.json',route=>route.abort());await page.click('#gestures button');
  await until(()=>page.locator('#handStatus').getAttribute('data-state').then(value=>value==='error'));
  check('offline model preflight reports a preview connection problem',(await page.locator('#handStatus').innerText()).includes('無法連接'));
  check('offline preflight never opens a camera',await page.evaluate(count=>window.fixtureCameraStreams.length===count&&window.cloakMirror.getState().cameraPhase==='idle',cameraCalls));
  await page.unroute('**/models/source.json');
  await page.evaluate(()=>window.fixtureStall=true);await page.click('#gestures button');
  await until(()=>page.locator('#handStatus').getAttribute('data-state').then(value=>value==='error'),14000);
  check('stalled hand worker becomes an actionable error',(await page.locator('#handStatus').innerText()).includes('處理停住'));
  check('stalled hand worker is terminated',!(await state()).worker);await page.click('#stopCamera button');
  await page.evaluate(()=>{window.fixtureStall=false;window.Worker=class{constructor(){throw Error('Fixture worker construction failure');}};});await page.click('#gestures button');
  await until(()=>page.locator('#handStatus').getAttribute('data-state').then(value=>value==='error'));
  check('unsupported worker construction is reported without rejection',(await page.locator('#handStatus').innerText()).includes('程式無法啟動'));await page.click('#stopCamera button');
  check('no browser runtime errors',errors.length===0);
}catch(error){failure=error.message;if(page)await page.screenshot({path:'qa/index-finger-failure.png'}).catch(()=>{});}
finally{
  await context.tracing.stop({path:'qa/index-finger-trace.zip'}).catch(()=>{});await context.close();
  await writeFile('qa/index-finger-results.json',JSON.stringify({passed:!failure,checks,errors,failure,evidence:'Synthetic landmarks injected at QA worker boundary; actual app pose/gesture/navigation handlers. Not physical human accuracy evidence.'},null,2));
}
console.log(JSON.stringify({passed:!failure,checks:checks.length,failure,errors}));
if(failure)process.exitCode=1;
