// 서버가 뜰 때까지 기다렸다가 브라우저로 주소를 연다.  사용: node scripts/open-when-ready.mjs http://localhost:8000/demo
import { exec } from 'node:child_process'

const url = process.argv[2] || 'http://localhost:8000/demo'
const health = new URL('/api/health', url).href
const deadline = Date.now() + 180_000

async function wait() {
  while (Date.now() < deadline) {
    try {
      const r = await fetch(health)
      if (r.ok) break
    } catch { /* 아직 준비 안 됨 */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd)
}
wait()
