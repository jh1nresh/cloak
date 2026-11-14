import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createTokenGate,tokenOptions,MODEL} from '../trial-policy.mjs';
const origin='http://127.0.0.1:8781';
async function fixture(t,options={}){
  const dir=await mkdtemp(path.join(tmpdir(),'cloak-token-'));t.after(()=>rm(dir,{recursive:true}));let calls=0;
  const mint=async opts=>{calls++;return {apiKey:'fixture-short-token',expiresAt:new Date(Date.now()+45000).toISOString(),permissions:{models:opts.allowedModels,origins:opts.allowedOrigins},constraints:opts.constraints};};
  const config={reservationPath:path.join(dir,'reservation.json'),configured:true,mint,...options},gate=createTokenGate(config);
  const request=overrides=>({origin,expectedOrigin:origin,secret:gate.config().csrf,body:{start:true},...overrides});
  return {gate,config,request,calls:()=>calls};
}
test('Lucy trial uses model/origin scope, short token and server duration rather than TTL for termination',()=>{
  assert.deepEqual(tokenOptions(origin),{expiresIn:45,allowedModels:['lucy-2.6'],allowedOrigins:[origin],constraints:{realtime:{maxSessionDuration:30}}});
});
test('foreign/missing origin, missing CSRF and implicit start cannot mint',async t=>{
  const f=await fixture(t);
  for(const overrides of [{origin:'https://evil.test'},{origin:undefined},{secret:''},{secret:'a'.repeat(64)},{body:{}}])assert.notEqual((await f.gate.issue(f.request(overrides))).code,200);
  assert.equal(f.calls(),0);assert.equal(f.gate.config().reserved,false);
});
test('unconfigured backend never reserves or calls provider',async t=>{
  const f=await fixture(t,{configured:false});assert.equal((await f.gate.issue(f.request())).code,503);assert.equal(f.calls(),0);assert.equal(f.gate.config().reserved,false);
});
test('concurrent clicks and server restart cannot mint a second trial',async t=>{
  const f=await fixture(t);const results=await Promise.all([f.gate.issue(f.request()),f.gate.issue(f.request())]);
  assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);assert.equal(f.calls(),1);
  const fresh=createTokenGate(f.config);assert.equal(fresh.config().reserved,true);assert.equal((await fresh.issue({...f.request(),secret:fresh.config().csrf})).code,409);assert.equal(f.calls(),1);
});
test('provider failure and invalid scope remain consumed with no automatic retry',async t=>{
  for(const token of [null,{apiKey:'fixture',permissions:{models:[MODEL]},constraints:{realtime:{maxSessionDuration:300}}},{apiKey:'dct_permanent',permissions:{models:[MODEL],origins:[origin]},constraints:{realtime:{maxSessionDuration:30}}}]){
    const f=await fixture(t,{mint:async()=>{if(!token)throw Error('Fixture failure');return token;}});const r=await f.gate.issue(f.request());assert.equal(r.code,502);assert.equal(r.apiKey,undefined);assert.equal((await f.gate.issue(f.request())).code,409);
  }
});
