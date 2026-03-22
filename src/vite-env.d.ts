/// <reference types="vite/client" />

declare module 'virtual:*' {
  const mod: Record<string, any>;
  export default mod;
}
