import {chromium} from 'playwright-core';
import {writeFile,readFile} from 'node:fs/promises';
const base='http://127.0.0.1:'+(process.env.CLOAK_MIRROR_PORT||'8781');
const checks=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
const context=await chromium.launchPersistentContext('./qa/profile',{channel:'chrome',headless:true,viewport:{width:1440,height:900},args:['--cloak-mirror-qa']});
let failure,probe,externalRequests=0;
try{
 const page=await context.newPage();page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('data:'))externalRequests++;});
 await page.goto(base);await page.locator('body[data-ready="true"]').waitFor();
 probe=await page.evaluate(async()=>{
  const workers=[],NativeWorker=window.Worker,NativeSocket=window.WebSocket;
  window.Worker=class extends NativeWorker{constructor(url,options){workers.push(String(url));super(url,options);}};
  window.WebSocket=class{constructor(){throw Error('QA forbids provider dial');}};
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.getContext('2d').fillRect(0,0,1280,720);const input=canvas.captureStream(1);
  try{const {connectLucy}=await import('/lucy.js');const image=new File([await fetch('/wardrobe-assets/garment-0.jpg').then(r=>r.blob())],'garment.jpg',{type:'image/jpeg'});await connectLucy(input,{token:async()=>'qa-invalid-never-dial-token',image,prompt:'QA only',onStream:s=>s.getTracks().forEach(t=>t.stop()),onConnection:()=>{}});}catch{}
  finally{input.getTracks().forEach(t=>t.stop());window.Worker=NativeWorker;window.WebSocket=NativeSocket;}
  return {workers,runtime:typeof RTCRtpSender?.prototype?.createEncodedStreams==='function'&&typeof RTCRtpReceiver?.prototype?.createEncodedStreams==='function',tracksStopped:input.getTracks().every(t=>t.readyState==='ended')};
 });
 check('real SDK requests metadata worker on supported Chrome runtime',!probe.runtime||probe.workers.some(u=>new URL(u).pathname==='/frame-metadata-worker.js'));
 const response=await context.request.get(base+'/frame-metadata-worker.js');check('SDK metadata worker asset is served successfully',response.status()===200);
 check('served SDK worker bytes match the pinned installed package',Buffer.compare(await response.body(),await readFile(new URL('../node_modules/@decartai/sdk/dist/realtime/browser/frame-metadata-worker.js',import.meta.url)))===0);
 check('SDK probe sends no external requests or media',externalRequests===0&&probe.tracksStopped);
} catch(error){failure=error.message;}
finally{await context.close();await writeFile('qa/sdk-assets-results.json',JSON.stringify({passed:!failure,checks,probe,externalRequests,failure,evidence:'Actual bundled SDK with canvas-only input, fake credential callback and WebSocket constructor blocked before any dial. No token endpoint, provider session or physical camera.'},null,2));}
console.log(JSON.stringify({passed:!failure,checks:checks.length,probe,externalRequests,failure}));if(failure)process.exitCode=1;
