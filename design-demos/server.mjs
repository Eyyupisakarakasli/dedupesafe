import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/demo.js':'demo.js'};
http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end('Not found');return}try{const data=await readFile(fileURLToPath(new URL(file,import.meta.url)));res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(500);res.end('Unable to read demo')}}).listen(4180,'127.0.0.1',()=>console.log('Design demos: http://127.0.0.1:4180/'));
