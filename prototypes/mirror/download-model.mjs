import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directoryDefault=fileURLToPath(new URL('models/',import.meta.url));
const modelURL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const limit=12_000_000;
async function metadata(directory){
  const source=JSON.parse(await readFile(path.join(directory,'source.json'),'utf8'));
  if(source.url!==modelURL||!Number.isSafeInteger(source.bytes)||source.bytes<1||source.bytes>limit||!/^[a-f0-9]{64}$/.test(source.sha256))throw Error('Invalid pinned hand-model metadata');
  return source;
}
function validate(bytes,source){
  if(bytes.length!==source.bytes||createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Hand-model size or SHA-256 mismatch');
}
async function cached(directory,source){
  const file=path.join(directory,'hand_landmarker.task'),info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size!==source.bytes)throw Error('Cached hand model is not the pinned regular file');
  validate(await readFile(file),source);
}
export async function verifyModel({directory=directoryDefault}={}){
  const source=await metadata(directory);
  try{await cached(directory,source);}catch(error){
    if(error.code==='ENOENT')throw Error('Hand model missing. Run npm run download-model first.');
    throw error;
  }
}
export async function prepareModel({directory=directoryDefault,fetcher=fetch}={}){
  const source=await metadata(directory);
  try{await cached(directory,source);return 'Verified existing hand model';}catch(error){if(error.code!=='ENOENT')throw error;}
  const response=await fetcher(source.url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok||!response.body)throw Error('Hand-model download failed: HTTP '+response.status);
  const chunks=[];let total=0;
  for await(const chunk of response.body){
    total+=chunk.byteLength;
    if(total>source.bytes||total>limit)throw Error('Hand-model download exceeds pinned size');
    chunks.push(Buffer.from(chunk));
  }
  const bytes=Buffer.concat(chunks,total);validate(bytes,source);
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'hand_landmarker.task'),bytes,{flag:'wx'});
  return 'Downloaded and verified hand model';
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  prepareModel().then(message=>console.log(message)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
