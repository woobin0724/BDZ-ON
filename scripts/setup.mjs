// 최초 1회 설치: 파이썬 가상환경 + 백엔드 패키지 + 프론트엔드 패키지
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backend = join(root, 'backend')
const win = process.platform === 'win32'
const venvPy = win ? join(backend, '.venv', 'Scripts', 'python.exe') : join(backend, '.venv', 'bin', 'python')
const run = (cmd, cwd = root) => { console.log(`\n> ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }) }

function findPython() {
  for (const cmd of win ? ['py -3', 'python', 'python3'] : ['python3', 'python']) {
    try {
      const v = execSync(`${cmd} --version`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
      const [maj, min] = v.replace('Python', '').trim().split('.').map(Number)
      if (maj === 3 && min >= 10) return cmd
    } catch { /* 다음 후보 */ }
  }
  console.error('\n[온잇다] Python 3.10 이상이 필요합니다. https://www.python.org/downloads/ 에서 설치하세요.\n')
  process.exit(1)
}

if (!existsSync(venvPy)) run(`${findPython()} -m venv .venv`, backend)
run(`"${venvPy}" -m pip install --disable-pip-version-check -q -r requirements.txt`, backend)
run('npm install --no-audit --no-fund', join(root, 'frontend'))
if (!existsSync(join(root, '.env'))) {
  copyFileSync(join(root, '.env.example'), join(root, '.env'))
  console.log('\n.env 파일을 만들었습니다 (API 키가 비어 있어 mock 모드로 동작).')
}
console.log('\n[온잇다] 설치 완료! `npm run dev` 로 실행하세요.\n')
