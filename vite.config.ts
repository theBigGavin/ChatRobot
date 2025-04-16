import { defineConfig, loadEnv } from 'vite' // Import loadEnv
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => { // Use function form to access mode
  // Load .env file based on the mode to access VITE_LLM_API_URL
  // process.cwd() gives the project root directory
  const env = loadEnv(mode, process.cwd(), '');

  const llmApiUrl = env.VITE_LLM_API_URL; // Get the target URL

  if (!llmApiUrl) {
    console.warn('VITE_LLM_API_URL is not defined in .env file. Proxy for /api will not be configured.');
  }

  return {
    base: '/ChatRobot/', // Set base path for GitHub Pages deployment
    plugins: [react()],
    server: {
      proxy: llmApiUrl ? { // Only configure proxy if URL is defined
        // Proxy requests starting with /api directly to the remote LLM service URL
        '/api': {
          target: llmApiUrl, // Use the URL from .env
          changeOrigin: true, // Needed for virtual hosted sites
          secure: false, // Often needed for self-signed certs or specific proxy setups, but use with caution. Can be true if target has valid cert.
          // Rewrite the path: replace /api/chat with the target path *relative* to the target URL
          // Since target already includes /v1, we only need /chat/completions here.
          rewrite: (path) => path.replace(/^\/api\/chat$/, '/chat/completions'),
          // Add the Authorization header using the API key from .env
          // Even though VITE_LLM_AUTH_SCHEMA was None, the error indicates the target needs it.
          // We assume 'Bearer' schema as it's most common for OpenAI compatible APIs.
          headers: {
            'Authorization': `Bearer ${env.VITE_LLM_API_KEY}`
          }
        }
      } : undefined // Set proxy to undefined if URL is missing
    },
    build: { // Add build configuration
      chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Separate vendor libraries into chunks
            if (id.includes('node_modules')) {
              // Extract package name more robustly
              const packageNameMatch = id.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
              if (packageNameMatch) {
                const packageName = packageNameMatch[1];
                // Group common large libraries or frameworks
                // Adjusted list based on potential project dependencies
                if (['react', 'react-dom', 'react-router-dom', '@emotion', 'three', 'zustand'].some(lib => packageName === lib || packageName.startsWith(lib + '/'))) {
                  // Create chunks like vendor-react, vendor-emotion, etc.
                  return `vendor-${packageName.split('/')[0]}`;
                }
                // Put other node_modules into a general vendor chunk
                return 'vendor-others';
              }
            }
            // Example: Separate large components if needed and if dynamic import is used
            // if (id.includes(path.resolve(__dirname, 'src/components/MyLargeComponent'))) {
            //   return 'my-large-component';
            // }
          }
        }
      }
    }
  }
})
