/**
 * src/test/setup.ts
 *
 * Global test setup — runs before every test file.
 * Extends vitest's expect with jest-dom matchers (toBeInTheDocument, etc.)
 */
import '@testing-library/jest-dom';

// jsdom does not define URL.createObjectURL / revokeObjectURL — define stubs so
// vi.spyOn() can replace them in individual tests.
if (typeof URL.createObjectURL === 'undefined') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:stub',
    writable: true,
    configurable: true,
  });
}
if (typeof URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
}


