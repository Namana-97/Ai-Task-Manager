const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.SHELL_PORT || 4200);
const host = process.env.SHELL_HOST || '127.0.0.1';
const root = path.join(process.cwd(), 'apps', 'shell', 'preview');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((request, response) => {
  const url = request.url === '/' ? '/index.html' : request.url || '/index.html';
  const target = path.join(root, url.replace(/^\/+/, ''));

  if (!target.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(target, (error, buffer) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream'
    });
    response.end(buffer);
  });
});

server.listen(port, host, () => {
  console.log(`Shell preview running at http://${host}:${port}`);
});
