import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    define: {
      __LOGGER__: process.env.LOGGER || mode == 'development' ? true : false,
    },
    build: {
      outDir: '../static/dist',
      emptyOutDir: true,
      minify: mode == 'development' ? false : true,
      lib: {
        entry: 'src/index.ts',
        fileName: 'index',
        formats: ['es'],
        name: 'abichinger_pos_stock',
      },
    },
  }
})
