// Visual verification harness: loads the site in real Chrome (headless-new),
// waits for boot, optionally presses the button / forces an effect, and captures
// frames at given times.
// usage: node snap.mjs <outPrefix> [fx] [captureTimesMsCsv] [--press]
import puppeteer from 'puppeteer-core';

const [, , prefix = 'v3', fx = '', timesCsv = '0', pressFlag = ''] = process.argv;
const times = timesCsv.split(',').map(Number);
const url = `http://localhost:5199/${fx ? `?fx=${fx}` : ''}`;

const browser = await puppeteer.launch({
	executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	headless: 'new',
	args: ['--window-size=1280,900', '--hide-scrollbars', '--mute-audio', '--use-angle=metal']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
page.on('console', (m) => {
	const t = m.type();
	if (t === 'error' || t === 'warning') console.log(`[console.${t}]`, m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), {
	timeout: 20000
});
await new Promise((r) => setTimeout(r, 1200)); // let welcome text + idle settle

if (pressFlag === '--press') {
	await page.evaluate(() => {
		const el = document.getElementById('press-target');
		el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		setTimeout(() => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 140);
	});
}

const t0 = Date.now();
for (const t of times) {
	const wait = t - (Date.now() - t0);
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	await page.screenshot({ path: `${prefix}-${t}.png` });
	console.log(`captured ${prefix}-${t}.png`);
}
await browser.close();
