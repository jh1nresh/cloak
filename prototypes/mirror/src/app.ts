import '@ui-sdk/web/button';
import '@ui-sdk/web/toggle';
import {createAgent,registerTools} from '@ui-sdk/web/agent';
import {SwipeGesture,indexPoint,sensorRect} from './gesture.mjs';

type Product={variant_id:string;name:string;title:string;store:string;source_url:string;result:string;garment:string;legacy?:boolean};
type Toggle=HTMLElement&{pressed:boolean};
type Group=HTMLElement&{value:string[]};
type Button=HTMLElement&{disabled:boolean};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const products:Product[]=JSON.parse($('catalog').textContent!).items;
const group=$<Group>('garments'), gestures=$<Toggle>('gestures'), cameraMode=$<Toggle>('cameraMode');
const source=$<HTMLVideoElement>('cameraPreview'), cameraMain=$<HTMLVideoElement>('cameraMain');
const shell=$('clothingShell'), clothing=$<HTMLImageElement>('clothingImage');
let selected=0,displayed=-1,revision=0,phase='loading',mode='demo';
let cameraRun=0,stream:MediaStream|null=null,cameraPhase='idle',startPromise:Promise<MediaStream|null>|null=null;
let worker:Worker|null=null,gestureRun=0,raf=0,busy=false,lastFrame=0,lastVideoTime=-1,autoStop:number|undefined,handInitTimer:number|undefined;
let gestureFrames=0,gestureSwitches=0,handError='';
const gesture=new SwipeGesture(), warmed=new Map<string,Promise<void>>();
const status=(text:string)=>{$('cameraState').textContent=text;};
const buttonState=()=>{
  $<Button>('startCamera').disabled=cameraPhase==='starting'||cameraPhase==='ready';
  $<Button>('stopCamera').disabled=cameraPhase!=='starting'&&cameraPhase!=='ready';
};

function views(){
  mode=cameraMode.pressed?'camera':'demo';
  document.body.dataset.mode=mode;
  $('demoStage').hidden=mode!=='demo';
  cameraMain.hidden=mode!=='camera'||!stream;
  $('cameraPlaceholder').hidden=mode!=='camera'||!!stream;
  $('originalImage').hidden=!!stream||mode==='camera';
  source.hidden=!stream;
  $('modeBadge').textContent=mode==='demo'?'示範試穿 · 預先生成':'原始鏡頭 · 尚未 AI 換裝';
  $('originalCaption').textContent=stream?(mode==='demo'?'本機鏡頭 · 只用於手勢':'本機鏡頭 · 原樣'):(mode==='demo'?'示範人物 · 黑色背心':'鏡頭尚未開啟');
  $('privacyNote').textContent=stream?'鏡頭只在本機 · 不錄影':'鏡頭已關閉 · 不錄影';
  selectionLabel();
  positionSensor();
}

function positionSensor(){
  const marker=$('previewSensor');marker.hidden=!stream||!worker||!gestures.pressed;
  if(marker.hidden||!source.videoWidth)return;
  const rect=sensorRect(source.clientWidth,source.clientHeight,source.videoWidth,source.videoHeight);
  marker.style.left=rect.x+'px';marker.style.top=rect.y+'px';marker.style.width=rect.width+'px';marker.style.height=rect.height+'px';
}

function selectionLabel(){
  const name=products[selected].name;
  let text='';
  if(mode==='camera')text='已選 '+name+'；鏡頭尚未 AI 換裝';
  else if(phase==='error')text=displayed<0?'試穿圖未載入；保留背心底圖':'載入失敗；保留 '+products[displayed].name;
  else if(phase==='pending')text='正在準備 '+name;
  else if(phase==='dressing')text='正在穿上 · 示範圖片';
  else text='畫面試穿中 · 示範人物';
  $('selectionState').textContent=text;
  $('retryLook').hidden=phase!=='error'||mode!=='demo';
}

function warm(product:Product){
  if(!warmed.has(product.result)){
    const image=new Image();image.src=product.result;
    warmed.set(product.result,image.decode().catch(error=>{warmed.delete(product.result);throw error;}));
  }
  return warmed.get(product.result)!;
}

async function select(index:number,origin='navigation'){
  selected=(index+products.length)%products.length;
  const item=products[selected],request=++revision;
  document.body.dataset.selected=String(selected);
  group.value=[item.variant_id];
  $('store').textContent=item.store;
  $('garmentName').textContent=item.name;
  const link=$<HTMLAnchorElement>('productLink'),url=new URL(item.source_url);
  if(url.protocol!=='https:')throw Error('Invalid product URL');
  link.href=url.href;
  $('position').replaceChildren(document.createTextNode(String(selected+1).padStart(2,'0')+' '));
  const count=document.createElement('span');count.textContent='/ '+products.length;$('position').append(count);
  if(origin!=='rail')group.querySelectorAll('ui-toggle')[selected]?.scrollIntoView({block:'nearest',behavior:'instant'});
  phase='pending';shell.hidden=true;shell.classList.remove('dressing');selectionLabel();
  try{
    await Promise.all([warm(item),new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:140))]);
    if(request!==revision)return;
    clothing.src=item.result;clothing.alt=item.store+' '+item.name+' 預先生成的示範試穿圖';
    await clothing.decode();
    if(request!==revision)return;
    shell.classList.toggle('legacy',!!item.legacy);shell.hidden=false;
    phase='dressing';displayed=selected;document.body.dataset.displayed=String(displayed);shell.classList.add('dressing');selectionLabel();
    const finish=()=>{if(request===revision){phase='ready';selectionLabel();}};
    clothing.onanimationend=finish;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();
    else setTimeout(finish,560);
  }catch{
    if(request!==revision)return;
    if(displayed>=0){clothing.src=products[displayed].result;shell.classList.toggle('legacy',!!products[displayed].legacy);shell.hidden=false;}
    phase='error';selectionLabel();
  }
  for(let offset=1;offset<=2;offset++)void warm(products[(selected+offset)%products.length]).catch(()=>{});
}

function next(delta:number,origin='navigation'){void select(selected+delta,origin);}

for(const [i,item] of products.entries()){
  const toggle=document.createElement('ui-toggle');toggle.setAttribute('value',item.variant_id);
  const button=document.createElement('button');button.className='garment';button.setAttribute('aria-label','試穿 '+item.store+' '+item.name);
  const image=document.createElement('img');image.src=item.garment;image.alt='';image.loading=i>4?'lazy':'eager';
  const label=document.createElement('small');label.textContent=item.store;
  button.append(image,label);toggle.append(button);group.append(toggle);
}

function stopHands(){
  gestureRun++;cancelAnimationFrame(raf);clearTimeout(handInitTimer);raf=0;
  worker?.terminate();worker=null;busy=false;lastFrame=0;lastVideoTime=-1;gesture.reset();
  gestures.pressed=false;$('gestureZone').hidden=true;
  $('previewSensor').hidden=true;
}

function stopCamera(reason='鏡頭已停止；可以重新開啟'){
  cameraRun++;clearTimeout(autoStop);stopHands();
  const owned=stream;stream=null;startPromise=null;cameraPhase='idle';
  owned?.getTracks().forEach(track=>track.stop());
  for(const video of [source,cameraMain]){video.pause();video.srcObject=null;}
  buttonState();views();status(reason);
}

function startCamera(showCamera=true):Promise<MediaStream|null>{
  if(showCamera){cameraMode.pressed=true;views();}
  if(stream)return Promise.resolve(stream);
  if(startPromise)return startPromise;
  const run=++cameraRun;cameraPhase='starting';buttonState();status('等待鏡頭權限；影像只在本機、不錄影');
  startPromise=(async()=>{
    let acquired:MediaStream|null=null;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(Error(),{name:'UnsupportedError'});
      acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30},facingMode:'user'}});
      if(run!==cameraRun){acquired.getTracks().forEach(track=>track.stop());return null;}
      stream=acquired;
      for(const video of [source,cameraMain])video.srcObject=acquired;
      views();
      await Promise.all([source.play(),cameraMain.play()]);
      if(run!==cameraRun)return null;
      cameraPhase='ready';buttonState();status(mode==='camera'?'本機鏡頭預覽；尚未連接 Lucy 2.6 換裝':'示範人物試穿；你的鏡頭只用於本機手勢');
      for(const track of acquired.getTracks())track.addEventListener('ended',()=>{if(run===cameraRun)stopCamera('鏡頭已中斷；可重新開啟');},{once:true});
      autoStop=window.setTimeout(()=>stopCamera('本機預覽已結束；可以重新開啟'),180000);
      return acquired;
    }catch(error){
      acquired?.getTracks().forEach(track=>track.stop());
      if(run!==cameraRun)return null;
      const name=error instanceof Error?error.name:'';
      stopCamera(name==='NotAllowedError'?'未允許鏡頭；仍可用示範試穿':name==='NotFoundError'?'找不到鏡頭；仍可用示範試穿':'鏡頭無法啟動；仍可用示範試穿');
      return null;
    }finally{if(run===cameraRun)startPromise=null;}
  })();
  return startPromise;
}

async function startHands(){
  const run=++gestureRun;
  status('開啟本機手勢；不傳送鏡頭影像');
  const camera=await startCamera(false);
  if(run!==gestureRun||!gestures.pressed||!camera)return;
  if(!window.Worker||!window.createImageBitmap){stopHands();status('此瀏覽器無法使用手勢；可點選或上下滑');return;}
  const owned=new Worker(new URL('hand-worker.js',import.meta.url));worker=owned;
  let ready=false;handError='';handInitTimer=window.setTimeout(()=>fail(),20000);
  const fail=()=>{if(run!==gestureRun)return;stopHands();status('手勢未能啟動；可點選或上下滑');};
  owned.onerror=event=>{handError=event.message.slice(0,300);fail();};
  owned.onmessage=(event:MessageEvent)=>{
    if(run!==gestureRun)return;
    if(event.data.type==='error'){handError=event.data.stage+': '+event.data.message;fail();return;}
    if(event.data.type==='ready'){
      ready=true;clearTimeout(handInitTimer);$('gestureZone').hidden=false;positionSensor();status('食指尖放進右下虛線區，上劃下一件、下劃上一件；收指回位');return;
    }
    if(event.data.type==='result'){
      busy=false;gestureFrames++;
      const delta=gesture.update(indexPoint(event.data.points,event.data.worldPoints),performance.now());
      $('gestureZone').dataset.phase=gesture.phase;
      $('gestureHint').textContent=gesture.phase==='armed'?'已就緒 · 上劃下一件／下劃上一件':gesture.phase==='retract'||gesture.phase==='fired'?'已切換 · 請收起食指回位':gesture.phase==='cooldown'?'回位完成 · 稍等一下再伸食指':'只伸食指，指尖放進虛線區停一下';
      if(delta){gestureSwitches++;next(delta,'gesture');}
    }
  };
  owned.postMessage({type:'init',base:new URL('./',location.href).href});
  const loop=async(now:number)=>{
    if(run!==gestureRun)return;
    raf=requestAnimationFrame(loop);
    if(!ready||busy||source.readyState<2||now-lastFrame<100||source.currentTime===lastVideoTime)return;
    busy=true;lastFrame=now;lastVideoTime=source.currentTime;
    try{
      const frame=await createImageBitmap(source,{resizeWidth:384,resizeHeight:Math.max(1,Math.round(384*source.videoHeight/source.videoWidth))});
      if(run!==gestureRun){frame.close();return;}
      owned.postMessage({type:'frame',frame,at:now},[frame]);
    }catch{fail();}
  };
  raf=requestAnimationFrame(loop);
}

await Promise.all(['ui-button','ui-toggle','ui-toggle-group'].map(tag=>customElements.whenDefined(tag)));
group.addEventListener('valuechange',event=>{const values=(event as CustomEvent).detail.value;const index=products.findIndex(item=>item.variant_id===values[0]);if(index>=0)void select(index,'rail');});
$('next').addEventListener('action',()=>next(1));
$('previous').addEventListener('action',()=>next(-1));
$('retryLook').addEventListener('action',()=>{void select(selected,'retry');});
$('startCamera').addEventListener('action',()=>{void startCamera();});
$('stopCamera').addEventListener('action',()=>stopCamera());
$('fullBody').addEventListener('pressedchange',event=>{$('mirror').classList.toggle('full',(event as CustomEvent).detail.value);});
cameraMode.addEventListener('pressedchange',()=>{views();status(mode==='camera'?'原始鏡頭預覽；尚未連接 AI 換裝':'示範人物 · 預先生成試穿圖');});
gestures.addEventListener('pressedchange',event=>{if((event as CustomEvent).detail.value)void startHands();else{stopHands();status('手勢已關閉；可點選或上下滑');}});
let wheelAmount=0,wheelConsumed=false,wheelTimer:number|undefined;
$('mirror').addEventListener('wheel',event=>{
  if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY)||(event.target as Element).closest('.wardrobe'))return;
  event.preventDefault();clearTimeout(wheelTimer);wheelTimer=window.setTimeout(()=>{wheelAmount=0;wheelConsumed=false;},180);
  if(wheelConsumed)return;
  wheelAmount+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
  if(Math.abs(wheelAmount)<45)return;wheelConsumed=true;next(wheelAmount>0?1:-1,'wheel');
},{passive:false});
let touch:{x:number;y:number}|null=null;
$('mirror').addEventListener('touchstart',event=>{touch=event.touches.length===1&&!(event.target as Element).closest('.wardrobe,button,a')?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
$('mirror').addEventListener('touchmove',event=>{if(event.touches.length!==1)touch=null;},{passive:true});
$('mirror').addEventListener('touchcancel',()=>{touch=null;},{passive:true});
$('mirror').addEventListener('touchend',event=>{const start=touch;touch=null;if(!start||event.touches.length||event.changedTouches.length!==1)return;const end=event.changedTouches[0],dy=end.clientY-start.y,dx=end.clientX-start.x;if(Math.abs(dy)>55&&Math.abs(dy)>Math.abs(dx)*1.3)next(dy<0?1:-1,'touch');},{passive:true});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){stopCamera();return;}
  if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||(event.target as Element).closest('button,a,input,textarea,[contenteditable]'))return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();next(event.key==='ArrowDown'?1:-1,'keyboard');}
});
const allow=(step:{confirm?:unknown;label?:string})=>!step.confirm&&(['下一件','上一件'].includes(step.label??'')||(step.label??'').startsWith('試穿 '));
const agent=createAgent({allow});
let unregister=registerTools(agent,{allow});
window.addEventListener('pageshow',event=>{if(event.persisted){unregister();unregister=registerTools(agent,{allow});}});
const getState=()=>({selected,displayed,phase,mode,cameraPhase,cameraGeneration:cameraRun,tracks:stream?.getTracks().map(track=>track.readyState)??[],worker:!!worker,gestureFrames,gestureSwitches,gesturePhase:gesture.phase,handError});
Object.assign(window,{cloakMirror:{agent,getState,stop:stopCamera}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera('頁面已離開；鏡頭已停止');});
window.addEventListener('pagehide',()=>{stopCamera();unregister();clearTimeout(wheelTimer);});
new ResizeObserver(positionSensor).observe(source);
buttonState();views();await select(0);document.body.dataset.ready='true';
