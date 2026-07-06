// Simple page screenshot: node tools/pageshot.mjs <url> <out> [fullPage]
import puppeteer from 'puppeteer-core';

const [, , url, out = 'page.png', full = ''] = process.argv;
const browser = await puppeteer.launch({
	executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	headless: 'new',
	args: ['--mute-audio']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }).catch((e) => console.log('[nav]', e.message));
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: out, fullPage: full === 'full' });
console.log('wrote', out);
await browser.close();
