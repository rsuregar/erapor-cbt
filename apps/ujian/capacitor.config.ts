import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'sch.alakhyar.ujian',
    appName: 'Ujian Al Akhyar',
    webDir: 'dist',
    android: {
        // Layar ujian tidak boleh direkam/ditangkap (FLAG_SECURE dipasang di
        // MainActivity saat proyek android ditambahkan).
        allowMixedContent: false,
    },
}

export default config
