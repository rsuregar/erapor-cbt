/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    /** Repo GitHub publik tempat rilis diterbitkan (`owner/repo`); cek pembaruan membaca dari sini. */
    readonly VITE_UPDATE_REPO?: string
    /** `ios_pwa` = mode deploy web_ios_only: web hanya untuk PWA terpasang di iPhone/iPad. */
    readonly VITE_AKSES_WEB?: string
}

declare const __VERSI_APP__: string
