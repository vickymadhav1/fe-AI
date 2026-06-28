import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'
  const requiredClientVars = [
    'VITE_API_BASE_URL',
    'VITE_SOCKET_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const
  const requiredProductionVars = [
    ...requiredClientVars,
    'VITE_RAZORPAY_KEY_ID',
  ] as const
  const requiredVars = isProduction ? requiredProductionVars : requiredClientVars
  const missing = requiredVars.filter((key) => !env[key]?.trim())

  if (missing.length) {
    throw new Error(`Invalid frontend environment configuration.\nMissing: ${missing.join(', ')}`)
  }

  if (isProduction) {
    const productionUrlVars = ['VITE_API_BASE_URL', 'VITE_SOCKET_URL'] as const
    const localhost = productionUrlVars.filter((key) => /localhost|127\.0\.0\.1/i.test(env[key] ?? ''))

    if (localhost.length) {
      throw new Error(
        [
          'Invalid production environment configuration.',
          localhost.length ? `Production URLs cannot point to localhost: ${localhost.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
      )
    }
  }

  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    build: {
      minify: isProduction,
      sourcemap: !isProduction,
      assetsInlineLimit: 4096,
    },
    server: {
      host: 'localhost',
      port: Number(env.VITE_DEV_PORT ?? 5173),
      strictPort: true,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
