// 백엔드 실행: .env 의 BACKEND_PORT (기본 8000)
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let port = process.env.BACKEND_PORT || '8000'
const envFile = join(root, '.env')
if (existsSync(envFile)) {
  const m = readFileSync(envFile, 'utf8').match(/^\s*BACKEND_PORT\s*=\s*(\d+)/m)
  if (m) port = m[1]
}
const child = spawn(process.execPath, [join(root, 'scripts', 'py.mjs'), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', port],
  { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
