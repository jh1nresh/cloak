import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:'+(process.env.CLOAK_MIRROR_PORT||'8781');
const sources=JSON.parse(await readFile(new URL('fixtures/hand-images.json',import.meta.url),'utf8'));
await mkdir('qa/fixtures',{recursive:true});
for(const name of ['pointing_up','fist']){
  const spec=sources[name],url=new URL(spec.url),file='qa/fixtures/'+name+'.jpg';
  if(url.protocol!=='https:'||url.hostname!=='storage.googleapis.com'||url.pathname!=='/mediapipe-assets/tasks/testdata/vision/'+name+'.jpg'||!Number.isSafeInteger(spec.bytes)||spec.bytes<1||spec.bytes>2_000_000||!/^[a-f0-9]{64}$/.test(spec.sha256))throw Error('Invalid public hand fixture metadata');
  let bytes;
  try{const info=await lstat(file);if(!info.isFile()||info.size!==spec.bytes)throw Error('Invalid cached hand fixture');bytes=await readFile(file);}
  catch(error){
    if(error.code!=='ENOENT')throw error;
    const response=await fetch(spec.url,{redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok||!response.body)throw Error('Public hand fixture download failed');
    const chunks=[];let length=0;
    for await(const chunk of response.body){length+=chunk.byteLength;if(length>spec.bytes)throw Error('Oversized hand fixture');chunks.push(Buffer.from(chunk));}
    bytes=Buffer.concat(chunks,length);
  }
  if(bytes.length!==spec.bytes||createHash('sha256').update(bytes).digest('hex')!==spec.sha256)throw Error('Hand fixture checksum mismatch');
  try{await writeFile(file,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
}
const checks=[],errors=[];
const check=(name,ok)=>{checks.push({name,pass:!!ok});if(!ok)throw Error(name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const end=Date.now()+25000;while(Date.now()<end){if(await fn())return;await sleep(100);}throw Error('Actual hand-model condition timed out');}
const context=await chromium.launchPersistentContext('./qa/profile',{channel:'chrome',headless:true,viewport:{width:1440,height:900},args:['--cloak-mirror-qa','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page,failure;
try{
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  for(const name of ['pointing_up','fist'])await page.route('**/__qa_'+name+'.jpg',route=>route.fulfill({path:fileURLToPath(new URL('../qa/fixtures/'+name+'.jpg',import.meta.url)),contentType:'image/jpeg'}));
  await page.addInitScript(()=>{
    window.handFixture='pointing_up';window.handFixtureStreams=[];
    navigator.mediaDevices.getUserMedia=async()=>{
      const images=await Promise.all(['pointing_up','fist'].map(async name=>[name,await createImageBitmap(await fetch('/__qa_'+name+'.jpg').then(r=>r.blob()))]));
      const map=Object.fromEntries(images),canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
      const ctx=canvas.getContext('2d');
      const draw=()=>{ctx.fillStyle='#eee';ctx.fillRect(0,0,512,512);if(map[window.handFixture])ctx.drawImage(map[window.handFixture],0,0,512,512);};
      draw();const timer=setInterval(draw,100),stream=canvas.captureStream(10);window.handFixtureStreams.push(stream);
      const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
      track.stop=()=>{clearInterval(timer);for(const image of Object.values(map))image.close();stop();};
      return stream;
    };
  });
  await page.goto(base);await page.locator('body[data-ready="true"]').waitFor();await page.click('#gestures button');
  const state=()=>page.evaluate(()=>window.cloakMirror.getState());
  await until(async()=>(await state()).handPresent&&(await state()).indexPose==='index');
  check('real hand model detects official pointing photograph',true);
  check('tracked hand renders21 visible landmarks',await page.locator('#handOverlay circle').count()===21&&await page.locator('#handOverlay').isVisible());
  check('index outside the activation box gets specific guidance',(await page.locator('#handStatus').innerText()).includes('移入虛線區'));
  const aligned=()=>page.evaluate(()=>{
    const source=document.getElementById('cameraPreview'),v=source.getBoundingClientRect(),o=document.getElementById('handOverlay').getBoundingClientRect();
    const scale=Math.min(v.width/source.videoWidth,v.height/source.videoHeight),w=source.videoWidth*scale,h=source.videoHeight*scale;
    return Math.abs(o.x-v.x-(v.width-w)/2)<1&&Math.abs(o.y-v.y-(v.height-h)/2)<1&&Math.abs(o.width-w)<1&&Math.abs(o.height-h)<1;
  });
  check('hand overlay aligns with desktop camera pixels',await aligned());
  await page.screenshot({path:'qa/actual-hand-feedback.png'});
  await page.setViewportSize({width:390,height:844});await until(aligned);check('hand overlay aligns with portrait camera pixels',true);await page.screenshot({path:'qa/actual-hand-mobile.png'});await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>window.handFixture='fist');await until(async()=>(await state()).handPresent&&(await state()).indexPose==='folded');
  check('real fist is tracked without changing outfits',(await state()).selected===0);
  check('folded pose is distinguished from missing hand',(await page.locator('#handStatus').innerText()).includes('已追到手'));
  await page.evaluate(()=>window.handFixture='none');await until(async()=>!(await state()).handPresent);
  check('missing hand removes stale overlay',await page.locator('#handOverlay circle').count()===0&&!(await page.locator('#handOverlay').isVisible()));
  check('missing hand has actionable feedback',(await page.locator('#handStatus').innerText()).includes('還沒追到手'));
  await page.click('#stopCamera button');
  check('Stop releases fixture input and detector',await page.evaluate(()=>!window.cloakMirror.getState().worker&&window.handFixtureStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  check('no runtime errors',errors.length===0);
}catch(error){failure=error.message;if(page)await page.screenshot({path:'qa/actual-hand-failure.png'}).catch(()=>{});}
finally{await context.close();await writeFile('qa/actual-hand-results.json',JSON.stringify({passed:!failure,checks,errors,failure,evidence:'Official pinned public photographs used as canvas camera input; real MediaPipe worker and app classification/overlay. No physical camera or user imagery.'},null,2));}
console.log(JSON.stringify({passed:!failure,checks:checks.length,failure,errors}));if(failure)process.exitCode=1;
