import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('firebase')) return 'firebase'
          if (id.includes('element-plus')) return 'element-plus'
          if (id.includes('@element-plus/icons-vue')) return 'element-plus-icons'
          if (
            id.includes('/vue/') ||
            id.includes('/pinia/') ||
            id.includes('/vue-router/')
          ) {
            return 'vue-core'
          }
          if (id.includes('sortablejs')) return 'sortable'
        },
      },
    },
  },
})
