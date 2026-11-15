import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:'+(process.env.CLOAK_MIRROR_PORT||'8781');
const checks=[],errors=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
const context=await chromium.launchPersistentContext('./qa/profile',{channel:'chrome',headless:true,viewport:{width:1440,height:900},args:['--cloak-mirror-qa']});
let page,failure;const visible=()=>page.evaluate(()=>{const rail=document.getElementById('garments'),button=rail.querySelector('button[data-pressed]'),r=rail.getBoundingClientRect(),b=button.getBoundingClientRect();return {visible:b.top>=r.top-.5&&b.bottom<=r.bottom+.5,scrollTop:rail.scrollTop,docScroll:scrollY};});
try{
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('body[data-ready="true"]').waitFor();
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(let i=0;i<8;i++)await page.click('#next button');
  await page.waitForFunction(()=>document.body.dataset.selected==='8'&&document.body.dataset.displayed==='8');
  let r=await visible();check(viewport.width+' next keeps selected garment visible and scrolls rail',r.visible&&r.scrollTop>0);check(viewport.width+' navigation does not scroll whole page',r.docScroll===0);
  await page.screenshot({path:'qa/rail-selected-'+viewport.width+'.png'});
  for(let i=0;i<8;i++)await page.click('#previous button');
  await page.waitForFunction(()=>document.body.dataset.selected==='0'&&document.body.dataset.displayed==='0');
  r=await visible();check(viewport.width+' previous scrolls back to first garment',r.visible&&r.scrollTop<10);
 }
 check('no runtime errors',errors.length===0);
}catch(e){failure=e.message;if(page)await page.screenshot({path:'qa/rail-failure.png'}).catch(()=>{});}
finally{await context.close();await writeFile('qa/rail-results.json',JSON.stringify({passed:!failure,checks,errors,failure,evidence:'Actual app click/selection/image and DOM layout; no camera, token or inference start.'},null,2));}
console.log(JSON.stringify({passed:!failure,checks:checks.length,errors,failure}));if(failure)process.exitCode=1;
