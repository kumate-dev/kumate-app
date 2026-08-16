import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Tauri ships a fixed WebView per platform, so there is no reason to down-level.
    // Smaller output, less parsing work at startup.
    target: 'esnext',

    // FOLLOW-UP — manual chunking was dropped in the Vite 8 upgrade.
    //
    // Vite 8 replaced Rollup with Rolldown: `build.rollupOptions` is now
    // `build.rolldownOptions`, and the object form of `output.manualChunks` was
    // removed. We previously split `@xterm/*` and `prismjs`+`yaml` out of the entry
    // chunk, because both are heavy and neither is needed until the user opens a
    // terminal or a YAML tab.
    //
    // The Rolldown equivalent is `output.advancedChunks.groups`, but that API could
    // not be verified here, and a wrong guess fails the build rather than degrading
    // gracefully. Rolldown's default splitting is reasonable, so this is a bundle-size
    // regression, not a correctness one. Re-add it once the shape is confirmed against
    // the installed Rolldown, and check `dist/` chunk sizes before and after.
  },
});
