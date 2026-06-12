import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'url'
import path from 'path'

// Plugin to handle Vercel-style api/ routes in Vite dev server
function vercelApiPlugin() {
  return {
    name: 'vercel-api-routes',
    config(_, { mode }) {
      // Load all env vars (including non-VITE_ ones) into process.env for api/ handlers
      const env = loadEnv(mode, process.cwd(), '') // '' = no prefix filter = load all
      Object.assign(process.env, env)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()

        const routeName = url.pathname.replace('/api/', '').split('/')[0] || 'index'
        const handlerPath = path.resolve(process.cwd(), 'api', `${routeName}.js`)

        try {
          const mod = await import(pathToFileURL(handlerPath).href + `?t=${Date.now()}`)
          const handler = mod.default

          // Buffer request body
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const rawBody = Buffer.concat(chunks).toString()

          let body = {}
          try { body = JSON.parse(rawBody) } catch {}

          const query = Object.fromEntries(url.searchParams.entries())

          const shimReq = {
            method: req.method,
            headers: req.headers,
            url: req.url,
            query,
            body,
          }

          const headers = {}
          let statusCode = 200
          const shimRes = {
            setHeader: (k, v) => { headers[k] = v },
            status(code) { statusCode = code; return shimRes },
            json(data) {
              res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers })
              res.end(JSON.stringify(data))
            },
            end() {
              res.writeHead(statusCode, headers)
              res.end()
            },
          }

          await handler(shimReq, shimRes)
        } catch (err) {
          if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
            return next()
          }
          console.error(`[api/${routeName}] Error:`, err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), vercelApiPlugin()],

  server: {
    host: '0.0.0.0',
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase':     ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },

  envPrefix: 'VITE_',
})