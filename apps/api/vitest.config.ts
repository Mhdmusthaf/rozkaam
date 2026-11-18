import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { ADMIN_PHONES: '9847000001', UPLOAD_DIR: '.data/test-uploads', SMS_PROVIDER: 'sandbox', SANDBOX_OTP: '123456' },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
