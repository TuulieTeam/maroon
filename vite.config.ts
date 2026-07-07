import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Production is served from https://tuulieteam.github.io/maroon/ (GitHub Pages project page);
  // dev stays at / so localhost:3001 and the preview tooling keep working unchanged.
  base: command === 'build' ? '/maroon/' : '/',
  plugins: [react()],
  server: {
    // Honour an externally assigned port (e.g. preview tooling) but default to 3001.
    port: Number(process.env.PORT) || 3001,
    strictPort: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The calibration / causal-chain / color suites are Monte-Carlo: each runs hundreds of full
    // 80-minute match simulations. The Pass-1 kicking game makes every match richer (more kick +
    // outcome events per set), so per-sim cost rose; under parallel load the old 5s default tipped
    // a couple of these heavy statistical tests over. A generous per-test timeout keeps them green
    // without weakening any sample size or assertion.
    testTimeout: 30000,
  },
}))
