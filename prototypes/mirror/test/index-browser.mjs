import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
import {handPose} from './hand-fixtures.mjs';
const base='http://127.0.0.1:'+(process.env.CLOAK_MIRROR_PORT||'8781');
const checks=[],errors=[];
const check=(name,ok)=>{checks.push({name,pass:!!ok});if(!ok)throw Error(name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const end=Date.now()+6000;while(Date.now()<end){if(await fn())return;await sleep(80);}throw Error('Index gesture condition timed out');}
const context=await chromium.launchPersistentContext('./qa/profile',{channel:'chrome',headless:true,viewport:{width:1440,height:900},args:['--cloak-mirror-qa','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
let failure,page;
try{
  await context.tracing.start({screenshots:true,snapshots:true});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.fixturePose=null;window.fixtureCameraStreams=[];
    const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);window.fixtureCameraStreams.push(stream);return stream;};
    const NativeWorker=window.Worker;
    window.Worker=class {
      constructor(url,options){if(!String(url).endsWith('/hand-worker.js'))return new NativeWorker(url,options);this.dead=false;}
      postMessage(data){
        if(data.type==='init')setTimeout(()=>{if(!this.dead)this.onmessage?.({data:{type:'ready'}});},10);
        if(data.type==='frame'){
          data.frame.close();const points=window.fixturePose;
          setTimeout(()=>{if(!this.dead)this.onmessage?.({data:{type:'result',points,worldPoints:points}});},5);
        }
      }
      terminate(){this.dead=true;}
    };
  });
  await page.goto(base+'/');await page.locator('body[data-ready="true"]').waitFor();
  const state=()=>page.evaluate(()=>window.cloakMirror.getState());
  const pose=options=>page.evaluate(points=>{window.fixturePose=points;},options?handPose(options):null);
  await pose({pose:'palm',tipY:.65});await page.click('#gestures button');await until(async()=>(await state()).gestureFrames>=2);
  await pose({pose:'palm',tipY:.42});await sleep(500);
  check('old open-palm motion no longer changes garments',(await state()).selected===0);
  await pose({tipY:.65});await until(async()=>(await state()).gesturePhase==='armed');
  check('index-only guidance is visible',(await page.locator('#cameraState').innerText()).includes('食指'));
  await page.screenshot({path:'qa/index-finger-guide.png'});
  await pose({tipY:.47});await until(async()=>(await state()).selected===1&&(await state()).displayed===1);
  check('index up stroke reaches actual outfit selection',(await state()).gestureSwitches===1);
  await pose({tipY:.7});await sleep(1300);
  check('extended-finger return cannot select previous',(await state()).selected===1&&(await state()).gestureSwitches===1);
  await pose(null);await sleep(350);await pose({tipY:.65});await sleep(300);await pose({tipY:.45});await sleep(300);
  check('tracking loss cannot rearm a fired stroke',(await state()).selected===1&&(await state()).gestureSwitches===1);
  check('return hint requests explicit finger folding',(await page.locator('#gestureHint').innerText()).includes('收起食指'));
  await pose({pose:'folded',tipY:.45});await sleep(140);await pose({pose:'folded',tipY:.7});await sleep(300);
  check('folded-finger return does not change garments',(await state()).selected===1&&(await state()).gestureSwitches===1);
  await pose({tipY:.32});await until(async()=>(await state()).gesturePhase==='armed');
  await pose({tipY:.5});await until(async()=>(await state()).selected===0&&(await state()).displayed===0);
  check('newly extended index down stroke selects previous',(await state()).gestureSwitches===2);
  await page.click('#stopCamera button');
  check('index gesture mode releases camera and worker',await page.evaluate(()=>!window.cloakMirror.getState().worker&&window.fixtureCameraStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
  check('no browser runtime errors',errors.length===0);
}catch(error){failure=error.message;if(page)await page.screenshot({path:'qa/index-finger-failure.png'}).catch(()=>{});}
finally{
  await context.tracing.stop({path:'qa/index-finger-trace.zip'}).catch(()=>{});await context.close();
  await writeFile('qa/index-finger-results.json',JSON.stringify({passed:!failure,checks,errors,failure,evidence:'Synthetic landmarks injected at QA worker boundary; actual app pose/gesture/navigation handlers. Not physical human accuracy evidence.'},null,2));
}
console.log(JSON.stringify({passed:!failure,checks:checks.length,failure,errors}));
if(failure)process.exitCode=1;
