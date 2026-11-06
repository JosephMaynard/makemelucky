import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import posthog from '@posthog/rollup-plugin';

// Source maps for PostHog error tracking: hidden maps are built, uploaded and
// deleted again, so stack traces read as src/ lines without shipping the maps.
// Only when POSTHOG_API_KEY (a personal key with error tracking write) is in
// the build environment; without it the build is exactly as before.
const sourcemapUpload = process.env.POSTHOG_API_KEY
	? [
			posthog({
				personalApiKey: process.env.POSTHOG_API_KEY,
				projectId: process.env.POSTHOG_PROJECT_ID || '217549',
				host: process.env.POSTHOG_HOST || 'https://eu.posthog.com',
				sourcemaps: {
					releaseName: 'makemelucky',
					releaseVersion: process.env.VERCEL_GIT_COMMIT_SHA,
					deleteAfterUpload: true
				}
			})
		]
	: [];

// Short commit id, baked in so every event (and every captured exception)
// says which deploy it came from; stale service-worker bundles stay visible.
const build = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev';

export default defineConfig({
	define: { __BUILD__: JSON.stringify(build) },
	build: {
		target: 'es2020',
		assetsInlineLimit: 0
	},
	plugins: [
		...sourcemapUpload,
		VitePWA({
			registerType: 'autoUpdate',
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
				globPatterns: ['**/*.{js,css,html,ico,svg}', 'fonts/*.woff*', 'icons/icon180.png'],
				globIgnores: ['v1/**', 'v2/**'],
				navigateFallback: '/index.html',
				navigateFallbackDenylist: [/^\/v1\//, /^\/v2\//],
				runtimeCaching: [
					{
						urlPattern: /\/soundfx\/.*\.mp3$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'soundfx',
							expiration: {
								// the sprite, the bell and every soundtrack — with room to grow.
							// At 10 the cache was already full and evicting tunes.
							maxEntries: 24,
								maxAgeSeconds: 60 * 60 * 24 * 365
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			}
		})
	]
});
