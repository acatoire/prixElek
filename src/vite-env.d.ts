/// <reference types="vite/client" />

declare module 'virtual:*' {
  const mod: Record<string, unknown>;
  export default mod;
}
