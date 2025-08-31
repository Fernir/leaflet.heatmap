import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.js',
            name: 'LeafletGLHeatmap',
            fileName: 'index',
            formats: ['es', 'cjs', 'umd']
        },
        rollupOptions: {
            external: ['leaflet'],
            output: {
                globals: {
                    leaflet: 'L'
                }
            }
        }
    }
});
