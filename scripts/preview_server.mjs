// SÓ LOCAL / DADOS DE EXEMPLO: serve um build estático e faz proxy de /rest/v1 → PostgREST local.
// /auth responde vazio (a sessão vem pronta no localStorage). /storage assina URLs falsas e serve imagens de
// exemplo de $PREVIEW_STORAGE (padrão /tmp/fitlocal/storage/<bucket>/<path>). Nunca aponta para o Supabase real.
// Uso: node scripts/preview_server.mjs <dist> [porta=4174] [porta_postgrest=3011]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2]
const port = Number(process.argv[3] || 4174)
const rest = Number(process.argv[4] || 3011)
const store = process.env.PREVIEW_STORAGE || '/tmp/fitlocal/storage'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  if (req.url.startsWith('/rest/v1/')) {
    const p = http.request({ host: '127.0.0.1', port: rest, path: req.url.slice(8), method: req.method, headers: { ...req.headers, host: `127.0.0.1:${rest}` } }, (r) => {
      res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res)
    })
    p.on('error', (e) => { res.writeHead(502, cors); res.end(String(e)) })
    return req.pipe(p)
  }
  const sign = req.url.match(/^\/storage\/v1\/object\/sign\/([\w-]+)(\/[^?]*)?/)
  if (sign && req.method === 'POST' && !sign[2]) {   // createSignedUrls: { paths } → [{ path, signedURL }]
    let body = ''
    req.on('data', (c) => { body += c })
    return req.on('end', () => {
      const { paths = [] } = JSON.parse(body || '{}')
      res.writeHead(200, { 'content-type': 'application/json', ...cors })
      res.end(JSON.stringify(paths.map((p) => ({ path: p, error: null, signedURL: `/object/sign/${sign[1]}/${p}?token=local` }))))
    })
  }
  if (sign && sign[2]) {
    const f = path.join(store, sign[1], decodeURIComponent(sign[2]))
    if (!f.startsWith(store + path.sep) || !fs.existsSync(f)) { res.writeHead(404, cors); return res.end() }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', ...cors })
    return fs.createReadStream(f).pipe(res)
  }
  if (req.url.startsWith('/auth/v1/') || req.url.startsWith('/storage/v1/')) {
    res.writeHead(200, { 'content-type': 'application/json', ...cors }); return res.end('[]')
  }
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html')
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`preview local em http://127.0.0.1:${port}/ (dados de exemplo)`))
