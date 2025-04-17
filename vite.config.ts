import { defineConfig, loadEnv } from 'vite' // Import loadEnv
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => { // Use function form to access mode
  // Load .env file based on the mode to access VITE_LLM_API_URL
  // process.cwd() gives the project root directory
  const env = loadEnv(mode, process.cwd(), '');

  // Get backend port, default to 3001
  const backendPort = env.BACKEND_PORT || '3001';
  const backendTarget = `http://localhost:${backendPort}`;

  // We still need llmApiUrl and key for the backend, but proxy targets the local backend
  const llmApiUrl = env.VITE_LLM_API_URL;
  if (!llmApiUrl) {
    console.warn('VITE_LLM_API_URL is not defined in .env file. Backend might not be able to reach AI service.');
  }

  return {
    // base: '/ChatRobot/', // Commented out for local development. Re-enable or adjust for deployment.
    plugins: [react()],
    server: {
      proxy: {
        // Proxy requests starting with /api to the local backend server
        '/api': {
          target: backendTarget, // Target the local backend
          changeOrigin: true, // Recommended for avoiding CORS issues in some cases
          secure: false, // Assuming local backend is http
          // No rewrite needed, send /api/chat as is to the backend
          // No headers needed here, backend handles auth with external service
        }
      }
    },
    build: { // Add build configuration
      // minify: false, // Re-enable default minification
      chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB
      rollupOptions: {
        output: {
          manualChunks(id: string) { // Restore manualChunks
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
