/// <reference types="vite/client" />

interface Window {
  readonly knightSim?: {
    readonly platform: string;
    readonly versions: { readonly electron: string };
  };
}
