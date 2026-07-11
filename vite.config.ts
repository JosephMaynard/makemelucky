import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	build: {
		target: 'es2020',
		assetsInlineLimit: 0
	},
	plugins: [
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.ico', 'icons/*.png', 'fonts/*.woff', 'soundfx/*.mp3'],
			manifest: {
				name: 'Make Me Lucky',
				short_name: 'Make Me Lucky',
				description:
					'The internet’s luck machine. Need a bit of luck? Find good fortune, prosperity, triumph and success at the touch of a button!',
				start_url: '/',
				display: 'standalone',
				orientation: 'portrait',
				background_color: '#0c1f0e',
				theme_color: '#12320f',
				icons: [
					{ src: '/icons/icon192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icons/icon512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,png,jpg,woff,mp3,ico,svg,webmanifest}'],
				globIgnores: ['v1/**', 'v2/**'],
				maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
				navigateFallback: '/index.html',
				navigateFallbackDenylist: [/^\/v1\//, /^\/v2\//]
			}
		})
	]
});
