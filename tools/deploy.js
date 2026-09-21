#!/usr/bin/env node
// Despliega el sitio a Cloudflare Pages SIN subir carpetas internas.
// `wrangler pages deploy .` publica todo lo que hay en la raíz (incluidos videos/, tools/,
// plan-tiktok/ y CLAUDE.md); este script copia a un directorio temporal solo lo que es sitio
// y despliega esa copia. Uso: node tools/deploy.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
// Todo lo que empieza por "." (.git, .claude, .wrangler...) se excluye además de esta lista.
const INTERNAL = new Set(['videos', 'tools', 'plan-tiktok', 'node_modules', 'CLAUDE.md']);

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'til-deploy-'));
for (const name of fs.readdirSync(root)) {
  if (name.startsWith('.') || INTERNAL.has(name)) continue;
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log(`Sitio preparado en ${out}: ${fs.readdirSync(out).join(', ')}`);

const r = spawnSync(
  'npx',
  ['wrangler', 'pages', 'deploy', '.', '--project-name=tuindemnizacionlaboral', '--commit-dirty=true'],
  { cwd: out, stdio: 'inherit', shell: true }
);
fs.rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
