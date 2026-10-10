// backend/.venv 의 파이썬으로 명령을 실행한다 (윈도우·맥·리눅스 공통).
// 사용: node scripts/py.mjs -m uvicorn app.main:app --port 8000
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backend = join(root, 'backend')
const win = process.platform === 'win32'
const venvPy = win ? join(backend, '.venv', 'Scripts', 'python.exe') : join(backend, '.venv', 'bin', 'python')

if (!existsSync(venvPy)) {
  console.error('\n[온잇다] 파이썬 가상환경이 없습니다. 먼저 `npm run setup` 을 실행하세요.\n')
  process.exit(1)
}

const child = spawn(venvPy, process.argv.slice(2), { cwd: backend, stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } })
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
