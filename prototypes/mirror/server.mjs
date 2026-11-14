import http from 'node:http';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {createTokenGate} from './trial-policy.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function createMirrorServer({mint,reservationPath=path.join(root,'qa','lucy-reservation.json'),configured=!!process.env.DECART_API_KEY}={}){
const routes=new Map();
await mkdir(path.dirname(reservationPath),{recursive:true});
const gate=createTokenGate({reservationPath,configured,mint:mint??(async options=>{
  const response=await fetch('https://api.decart.ai/v1/client/tokens',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':process.env.DECART_API_KEY},body:JSON.stringify(options),signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw Error('Token request failed');
  return response.json();
})});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.task':'application/octet-stream','.json':'application/json'};
async function mapFiles(folder,prefix){
  for(const entry of await readdir(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name),url=prefix+entry.name;
    if(entry.isDirectory())await mapFiles(file,url+'/');
    else if(entry.isFile()&&types[path.extname(file)])routes.set(url,file);
  }
}
await mapFiles(path.join(root,'dist'),'/');
await mapFiles(path.resolve(root,'../../public/prototypes/wardrobe'),'/static/');
routes.set('/stopped',path.join(root,'stopped.html'));
routes.set('/',routes.get('/index.html'));routes.set('/static/',routes.get('/static/index.html'));
const server=http.createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  const send=(code,body,type='text/plain; charset=utf-8')=>{
    res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(self), microphone=(), display-capture=()','Content-Security-Policy':(req.url.startsWith('/static/')?"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'":"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'sha256-cEReegDi9rwqo6z2ihrxKQ8n5PBz6Rqn0LjZkNcUG/8=' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-56q5+4wMXoKjcOj/C4ObpGeZ0pjR0MFJRSYUx0oZM94=' 'sha256-+/qs8opwave2OpLeJU8D3vKojkqcm9Wwpcj5Y49+iPg='; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' https://api.decart.ai wss://api.decart.ai wss://lk.decart.ai wss://*.lkc.decart.ai; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")});
    res.end(req.method==='HEAD'?undefined:body);
  };
  if(req.headers.host!==new URL(origin).host)return send(403,'Host rejected');
  if(req.headers.origin&&req.headers.origin!==origin)return send(403,'Origin rejected');
  if(req.url==='/api/realtime-config'&&req.method==='GET')return send(200,JSON.stringify(gate.config()),'application/json');
  if(req.url==='/api/realtime-token'&&req.method==='POST'){
    if(req.headers.origin!==origin)return send(403,'Origin required');
    if(req.headers['content-type']!=='application/json')return send(415,'JSON required');
    const length=Number(req.headers['content-length']);if(!Number.isSafeInteger(length)||length<1||length>1024)return send(413,'Body rejected');
    try{
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1024)return send(413,'Body rejected');chunks.push(chunk);}
      const result=await gate.issue({origin:req.headers.origin,expectedOrigin:origin,secret:req.headers['x-cloak-token'],body:JSON.parse(Buffer.concat(chunks).toString())});
      const {code,...body}=result;return send(code,JSON.stringify(body),'application/json');
    }catch{return send(400,'Invalid request');}
  }
  if(!['GET','HEAD'].includes(req.method))return send(405,'Read only');
  const file=routes.get(req.url);
  if(!file)return send(404,'Not found');
  try{send(200,await readFile(file),types[path.extname(file)]);}catch{send(500,'Local asset unavailable');}
});
server.requestTimeout=10000;server.headersTimeout=10000;
return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const server=await createMirrorServer(),port=Number(process.env.PORT||8781);
  server.listen(port,'127.0.0.1',()=>console.log(`Cloak mirror: http://127.0.0.1:${server.address().port}`));
  process.on('SIGINT',()=>server.close(()=>process.exit(0)));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
