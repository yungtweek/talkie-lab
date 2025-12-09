// vite.config.ts
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next의 "@/..." alias를 Vitest에서도 그대로 쓰기 위해
  // (Blueprint에서 src/ + @ alias 쓰는 거 기준) [oai_citation:0‡Talkie-Lab-Blueprint.md](file-service://file-KSbTNjKhHqYoZjzpRkkath)
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true, // describe/it/expect 전역 사용
    environment: 'node', // 기본은 서버 코드용. 필요하면 파일 단위로 jsdom 지정.
    include: ['**/*.test.ts', '**/*.test.tsx'],
    setupFiles: ['./src/tests/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
});
