// Public, cookie-free samples. TTFB includes shell streaming; total consumes the body.
import { execFileSync } from 'node:child_process';
const origin = new URL(process.argv[2] || 'https://speakwow.ai');
const paths = ['/', '/courses', '/courses?category=adult-english', '/settings'];
for (const path of paths) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const value = execFileSync('curl', ['--silent', '--show-error', '--max-time', '30', '--output', '/dev/null', '--write-out', '%{http_code} %{time_starttransfer} %{time_total} %{size_download}', new URL(path, origin).href], { encoding: 'utf8' }).trim().split(' ');
    const [status, ttfb, total, bytes] = value.map(Number);
    samples.push({status,ttfb,total,bytes});
  }
  console.log(JSON.stringify({path,samples}));
}
