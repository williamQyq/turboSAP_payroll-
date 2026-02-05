interface ImportMetaEnv {
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
  readonly VITE_OPENCODE_SERVER_PREFIX: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
