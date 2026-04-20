/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NVIDIA_API_KEY: string
  readonly VITE_NVIDIA_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
