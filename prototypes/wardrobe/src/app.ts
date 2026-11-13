import '@ui-sdk/web/carousel';
import '@ui-sdk/web/button';
import '@ui-sdk/web/toggle';
import '@ui-sdk/web/dialog';
import '@ui-sdk/web/toast';
import { createToaster } from '@ui-sdk/web';
import { createAgent, registerTools } from '@ui-sdk/web/agent';
import type { UiCarouselElement, UiToggleElement, UiDialogElement, UiToastRegionElement } from '@ui-sdk/web';

type Product={variant_id:string;title:string;store:string;store_id:string;source_url:string;result:string;garment:string;name:string;legacy:boolean;options:{label:string}[];price:{amount:number;currency:string}};
const products:Product[]=JSON.parse(document.getElementById('catalog')!.textContent!).items;
const carousel=document.getElementById('fitting') as UiCarouselElement;
const feed=document.getElementById('feed')!;
const content=document.getElementById('looks')!;
const stage=document.getElementById('fixedStage')!;
const shell=document.getElementById('clothingShell')!;
const layer=document.getElementById('clothingImage') as HTMLImageElement;
const phase=document.getElementById('dressState')!;
const fullToggles:UiToggleElement[]=[],baseToggles:UiToggleElement[]=[];
const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
let saved=new Set<string>();
try{const data=JSON.parse(localStorage.getItem('cloak-static-saved')||'[]');if(Array.isArray(data))saved=new Set(data.filter(x=>typeof x==='string'))}catch{}
function node<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text?:string):HTMLElementTagNameMap[K]{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n}
const slides:HTMLElement[]=[];
const toast=createToaster();
(document.getElementById('notice') as UiToastRegionElement).toaster=toast;
for(const [i,p] of products.entries()){
 const slide=node('ui-carousel-item','look');slide.dataset.productId=p.variant_id;slide.setAttribute('aria-label',p.store+' '+p.name);
 const controls=node('div','controls');
 const save=node('ui-toggle') as UiToggleElement,saveButton=node('button','round save');saveButton.innerHTML=heart;saveButton.setAttribute('aria-label','收藏 '+p.store+' '+p.name);save.setAttribute('value',p.variant_id);if(saved.has(p.variant_id))save.setAttribute('default-pressed','');save.append(saveButton);
 save.addEventListener('pressedchange',event=>{if(event.detail.value)saved.add(p.variant_id);else saved.delete(p.variant_id);try{localStorage.setItem('cloak-static-saved',JSON.stringify([...saved]))}catch{}toast(event.detail.value?'已收藏這件衣服':'已取消收藏',{duration:1600})});
 const full=node('ui-toggle') as UiToggleElement,fullButton=node('button','round size-mode','全身');fullButton.setAttribute('aria-label',p.store+' '+p.name+' 全身顯示');full.append(fullButton);full.addEventListener('pressedchange',event=>{stage.classList.toggle('full',event.detail.value);for(const toggle of fullToggles)toggle.pressed=event.detail.value});fullToggles.push(full);
 const base=node('ui-toggle') as UiToggleElement,baseButton=node('button','round size-mode','底圖');baseButton.setAttribute('aria-label','顯示黑色背心底圖');base.append(baseButton);base.addEventListener('pressedchange',event=>{stage.classList.toggle('base-only',event.detail.value);for(const toggle of baseToggles)toggle.pressed=event.detail.value});baseToggles.push(base);controls.append(save,full,base);slide.append(controls);
 const card=node('div','product'),dialog=node('ui-dialog') as UiDialogElement;
 const trigger=node('ui-dialog-trigger'),reference=node('button','garment');reference.setAttribute('aria-label','放大查看 '+p.store+' '+p.name+' 商品原圖');const thumb=node('img');thumb.src=p.garment;thumb.alt=p.title+' 原圖';reference.append(thumb);trigger.append(reference);
 const backdrop=node('ui-dialog-backdrop');backdrop.hidden=true;
 const popup=node('ui-dialog-content','reference');popup.hidden=true;popup.setAttribute('keep-mounted','');
 const close=node('ui-dialog-close'),closeButton=node('button','close','×');closeButton.setAttribute('aria-label','關閉 '+p.store+' '+p.name+' 商品原圖');close.append(closeButton);
 const original=node('img');original.src=p.garment;original.alt=p.title+' 商品原圖';popup.append(close,node('span','eyebrow','商品原圖'),node('ui-dialog-title','',p.store+' '+p.name+' 商品原圖'),original,node('ui-dialog-description','',p.title+' · '+p.options.map(x=>x.label).join(' / ')),node('p','','AI 視覺試穿示意，花紋與細節可能有差異，不代表尺寸或合身保證。'));dialog.append(trigger,backdrop,popup);
 const details=node('div','details');details.append(node('span','store',p.store),node('h2','',p.name),node('p','options',p.options.map(x=>x.label).join(' / ')));
 const row=node('div','bottom-row'),linkAction=node('ui-button'),link=node('button','shop','查看商品 ↗');const url=new URL(p.source_url);if(url.protocol!=='https:')throw Error('Invalid product URL');linkAction.addEventListener('action',()=>{window.open(url.href,'_blank','noopener,noreferrer')});link.setAttribute('aria-label','前往 '+p.store+' '+p.name+' 查看商品');linkAction.append(link);row.append(node('span','price',new Intl.NumberFormat('en-US',{style:'currency',currency:p.price.currency}).format(p.price.amount/100)),linkAction);details.append(row);card.append(dialog,details);slide.append(card);
 const foot=node('div','foot');foot.append(node('span','swipe',i===products.length-1?'這批已看完，向下滑可回看':'↑ 上滑試穿下一件'),node('span','',`${String(i+1).padStart(2,'0')} / ${products.length} 件`));slide.append(foot);content.append(slide);slides.push(slide);
}
let revision=0,currentPage=0;
const warmed=new Map<string,Promise<void>>();
function warm(product:Product){if(!warmed.has(product.result)){const image=new Image();image.src=product.result;warmed.set(product.result,image.decode())}return warmed.get(product.result)!}
async function dress(page:number){
 if(page===currentPage)return;currentPage=page;const version=++revision,product=products[page-1];document.body.dataset.active=String(page-1);stage.dataset.phase='base';shell.hidden=true;shell.classList.remove('dressing');phase.textContent='黑色背心 · 準備換裝';
 try{await Promise.all([warm(product),new Promise(resolve=>setTimeout(resolve,200))]);if(version!==revision)return;shell.classList.toggle('legacy',product.legacy);layer.src=product.result;layer.alt=product.store+' '+product.name+' 的上身試穿圖層';await layer.decode();if(version!==revision)return;
 requestAnimationFrame(()=>{if(version!==revision)return;shell.hidden=false;stage.dataset.phase='dressing';phase.textContent='正在穿上';shell.classList.add('dressing');const finish=()=>{if(version!==revision)return;stage.dataset.phase='ready';phase.textContent='已穿上 · '+product.name};layer.onanimationend=finish;if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish()});
 }catch{if(version===revision){shell.hidden=true;stage.dataset.phase='error';phase.textContent='試穿圖未載入，保留人物底圖'}}
 for(const next of products.slice(page,page+3))warm(next).catch(()=>{});
}
carousel.addEventListener('pagechange',event=>{void dress(event.detail.value)});
// The short-flick policy uses the controller with native dragging disabled, so two gesture handlers cannot settle different pages.
let swipeStart:{x:number;y:number;page:number}|null=null;
feed.addEventListener('touchstart',event=>{const touch=event.touches[0];swipeStart=event.touches.length===1&&!(event.target as Element).closest('[data-slot="dialog-content"]')?{x:touch.clientX,y:touch.clientY,page:carousel.api.getPage()}:null},{passive:true});
feed.addEventListener('touchmove',event=>{if(event.touches.length!==1)swipeStart=null},{passive:true});
feed.addEventListener('touchend',event=>{const start=swipeStart;swipeStart=null;if(!start||event.touches.length||event.changedTouches.length!==1)return;const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dy)<=55||Math.abs(dy)<=Math.abs(dx)*1.3)return;const page=Math.max(1,Math.min(products.length,start.page+(dy<0?1:-1)));requestAnimationFrame(()=>carousel.api.setPage(page,{reason:'swipe',event}))},{passive:true});
feed.addEventListener('touchcancel',()=>{swipeStart=null},{passive:true});
let wheelDelta=0,wheelConsumed=false,wheelReset:number|undefined;
feed.addEventListener('wheel',event=>{if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY)||(event.target as Element).closest('[data-slot="dialog-content"]'))return;event.preventDefault();clearTimeout(wheelReset);wheelReset=window.setTimeout(()=>{wheelDelta=0;wheelConsumed=false},180);if(wheelConsumed)return;wheelDelta+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?feed.clientHeight:1);if(Math.abs(wheelDelta)<40)return;wheelConsumed=true;if(wheelDelta>0)carousel.api.next({reason:'scroll',event});else carousel.api.previous({reason:'scroll',event})},{passive:false});

document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.altKey||event.metaKey||event.ctrlKey||!['ArrowUp','ArrowDown'].includes(event.key))return;const target=event.target as Element;if(target.closest('button,a,input,textarea,[contenteditable]')||[...document.querySelectorAll<UiDialogElement>('ui-dialog')].some(d=>d.open))return;if(target===feed)return;event.preventDefault();if(event.key==='ArrowDown')carousel.api.next();else carousel.api.previous()});
await Promise.all(['ui-carousel','ui-toggle','ui-dialog','ui-button','ui-toast-region'].map(tag=>customElements.whenDefined(tag)));
void dress(carousel.page||1);
const agent=createAgent({allow:step=>!step.confirm&&!['play','setPlaying'].includes(step.action)});
const unregister=registerTools(agent,{allow:step=>!step.confirm&&!['play','setPlaying'].includes(step.action)});
Object.assign(window,{cloakAgent:agent});
window.addEventListener('pagehide',()=>{unregister();toast.dismiss()},{once:true});
document.body.dataset.ready='true';
