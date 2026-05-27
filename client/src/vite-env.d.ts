/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_SECRET: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
