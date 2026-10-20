/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    /** Repo GitHub publik tempat rilis diterbitkan (`owner/repo`); cek pembaruan membaca dari sini. */
    readonly VITE_UPDATE_REPO?: string
    /** `ios_pwa` = mode deploy web_ios_only: web hanya untuk PWA terpasang di iPhone/iPad. */
    readonly VITE_AKSES_WEB?: string
    /** production (bawaan) | staging — whitelabel & penanda staging. */
    readonly VITE_LINGKUNGAN?: string
    /** Nomor build CI untuk pembaruan staging. */
    readonly VITE_APP_BUILD?: string
}

declare const __VERSI_APP__: string
/** 'production' | 'staging' (VITE_LINGKUNGAN saat build). */
declare const __LINGKUNGAN__: 'production' | 'staging'
/** Nomor build CI; 0 = build lokal. */
declare const __BUILD_APP__: number
