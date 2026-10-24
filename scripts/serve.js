// Servidor local para ver o site (e para testar atualizações): node scripts/serve.js <pasta> [porta]
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || 'site');
const port = Number(process.argv[3] || 4321);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.yml': 'text/yaml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

http
  .createServer((req, res) => {
    let file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    const ext = path.extname(file);
    const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': fs.statSync(file).size };
    // instaladores baixam como arquivo, com o nome certo
    if (ext === '.exe') headers['content-disposition'] = `attachment; filename="${path.basename(file)}"`;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, '127.0.0.1', () => console.log(`site em http://127.0.0.1:${port}`));
