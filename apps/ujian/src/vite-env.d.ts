/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    /** Repo GitHub publik tempat rilis diterbitkan (`owner/repo`); cek pembaruan membaca dari sini. */
    readonly VITE_UPDATE_REPO?: string
}

declare const __VERSI_APP__: string
