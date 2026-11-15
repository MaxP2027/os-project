/* Dependency-free local server. Bind to loopback; expose only application assets. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['index.html', 'styles.css', 'app.js', 'scheduler.js']);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file =
    pathname === '/' || pathname === '/os-project/'
      ? 'index.html'
      : pathname.replace(/^\/(?:os-project\/)?/, '');
  if (!allowed.has(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)],
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(path.join(root, file)).pipe(res);
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log(`CPU Lab: http://127.0.0.1:${server.address().port}`),
);
