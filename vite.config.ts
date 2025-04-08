import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      external: [
        // Ignorar arquivos em netlify/functions
        /^netlify\/functions\/.*/
      ],
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom'
          ],
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage'
          ]
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-highlight',
      '@tiptap/extension-typography',
      '@tiptap/extension-text-align',
      '@tiptap/extension-task-list',
      '@tiptap/extension-task-item',
      '@tiptap/extension-table',
      '@tiptap/extension-table-row',
      '@tiptap/extension-table-cell',
      '@tiptap/extension-table-header',
      'prosemirror-commands',
      'prosemirror-keymap',
      'prosemirror-model',
      'prosemirror-schema-basic',
      'prosemirror-state',
      'prosemirror-transform',
      'prosemirror-view'
    ],
    exclude: ['lucide-react', 'netlify/functions']
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  }
});