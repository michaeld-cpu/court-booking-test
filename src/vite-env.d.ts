/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_URL?: string;
  readonly VITE_HOME_DEFAULT_VISIBLE_COURTS?: string;
  readonly VITE_MAP_PROVIDER?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly [key: `VITE_${string}`]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
