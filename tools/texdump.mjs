// Dump a generated texture canvas to PNG for inspection.
// usage: node tools/texdump.mjs <fnName> <outPath> [size]
import puppeteer from 'puppeteer-core';

const [, , fn = 'createSkyTexture', out = 'tex.png', size = '512'] = process.argv;

const browser = await puppeteer.launch({
	executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	headless: 'new'
});
const page = await browser.newPage();
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
const dataUrl = await page.evaluate(
	async (fnName, sz) => {
		const mod = await import('/src/gfx/textures.js');
		const tex = mod[fnName](sz);
		const canvas = (tex.map || tex).image || (tex.map || tex).source.data;
		return canvas.toDataURL('image/png');
	},
	fn,
	Number(size)
);
const b64 = dataUrl.split(',')[1];
const { writeFileSync } = await import('fs');
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('wrote', out);
await browser.close();
