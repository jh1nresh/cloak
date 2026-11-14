import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const routes=new Map();
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
routes.set('/',routes.get('/index.html'));routes.set('/static/',routes.get('/static/index.html'));
const server=http.createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  const send=(code,body,type='text/plain; charset=utf-8')=>{
    res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(self), microphone=(), display-capture=()','Content-Security-Policy':(req.url.startsWith('/static/')?"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'":"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'sha256-cEReegDi9rwqo6z2ihrxKQ8n5PBz6Rqn0LjZkNcUG/8=' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-56q5+4wMXoKjcOj/C4ObpGeZ0pjR0MFJRSYUx0oZM94=' 'sha256-+/qs8opwave2OpLeJU8D3vKojkqcm9Wwpcj5Y49+iPg='; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")});
    res.end(req.method==='HEAD'?undefined:body);
  };
  if(req.headers.host!==new URL(origin).host)return send(403,'Host rejected');
  if(!['GET','HEAD'].includes(req.method))return send(405,'Read only');
  if(req.headers.origin&&req.headers.origin!==origin)return send(403,'Origin rejected');
  const file=routes.get(req.url);
  if(!file)return send(404,'Not found');
  try{send(200,await readFile(file),types[path.extname(file)]);}catch{send(500,'Local asset unavailable');}
});
const port=Number(process.env.PORT||8781);
server.listen(port,'127.0.0.1',()=>console.log(`Cloak mirror: http://127.0.0.1:${server.address().port}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
