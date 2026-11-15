import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareModel,verifyModel} from '../download-model.mjs';

async function fixture(t,overrides={}){
  const directory=await mkdtemp(path.join(tmpdir(),'cloak-hand-model-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const bytes=Buffer.from('model fixture');
  const source={url:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...overrides};
  await writeFile(path.join(directory,'source.json'),JSON.stringify(source));
  return {directory,bytes,file:path.join(directory,'hand_landmarker.task')};
}
test('downloads only pinned source without redirects and reuses verified cache',async t=>{
  const {directory,bytes,file}=await fixture(t);let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.match(url,/^https:\/\/storage.googleapis.com\/mediapipe-models\//);assert.equal(options.redirect,'error');assert.ok(options.signal);return new Response(bytes);};
  await prepareModel({directory,fetcher});assert.deepEqual(await readFile(file),bytes);await verifyModel({directory});await prepareModel({directory,fetcher});assert.equal(calls,1);
});
test('rejects changed bytes before publishing a cache file',async t=>{
  const {directory,file}=await fixture(t);
  await assert.rejects(prepareModel({directory,fetcher:async()=>new Response(Buffer.from('wrong fixture'))}),/SHA-256 mismatch/);
  await assert.rejects(readFile(file),{code:'ENOENT'});
});
test('rejects an oversized stream before publishing it',async t=>{
  const {directory,bytes,file}=await fixture(t);
  await assert.rejects(prepareModel({directory,fetcher:async()=>new Response(Buffer.concat([bytes,bytes]))}),/exceeds pinned size/);
  await assert.rejects(readFile(file),{code:'ENOENT'});
});
test('rejects failed download responses',async t=>{
  const {directory,file}=await fixture(t);
  await assert.rejects(prepareModel({directory,fetcher:async()=>new Response(null,{status:302})}),/HTTP 302/);
  await assert.rejects(readFile(file),{code:'ENOENT'});
});
test('rejects an untrusted manifest URL without a request',async t=>{
  const {directory}=await fixture(t,{url:'http://127.0.0.1/private'});let calls=0;
  await assert.rejects(prepareModel({directory,fetcher:async()=>{calls++;return new Response('');}}),/Invalid pinned/);assert.equal(calls,0);
});
test('preserves corrupt cache rather than overwriting it',async t=>{
  const {directory,file}=await fixture(t);await writeFile(file,'wrong fixture');
  await assert.rejects(prepareModel({directory,fetcher:async()=>{throw Error('Must not fetch');}}),/SHA-256 mismatch/);assert.equal(await readFile(file,'utf8'),'wrong fixture');
});
test('does not follow a symlink model cache',async t=>{
  const {directory,bytes,file}=await fixture(t);const target=path.join(directory,'other');await writeFile(target,bytes);await symlink(target,file);
  await assert.rejects(prepareModel({directory,fetcher:async()=>{throw Error('Must not fetch');}}),/regular file/);
});
