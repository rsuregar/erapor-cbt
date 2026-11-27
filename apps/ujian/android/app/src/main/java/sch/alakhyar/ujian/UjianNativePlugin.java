package sch.alakhyar.ujian;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.provider.Settings;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.CursorWindow;
import android.database.sqlite.SQLiteCursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONArray;

/**
 * Kemampuan native app ujian (story 7.7) yang tidak bisa dilakukan web:
 * - kunci layar: startLockTask() — tanpa device owner, Android memakai
 *   "sematkan aplikasi" (murid tidak bisa keluar tanpa melepas sematan);
 * - lokasi dengan tanda lokasi palsu (Location.isMock / isFromMockProvider)
 *   untuk field `palsu` di kontrak § Lokasi ujian;
 * - pembaruan app: unduh APK rilis dengan progres lalu buka pemasang sistem;
 * - media soal sebagai berkas di penyimpanan internal app (tampil saat offline).
 */
@CapacitorPlugin(
    name = "UjianNative",
    permissions = {
        @Permission(alias = "lokasi", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION })
    }
)
public class UjianNativePlugin extends Plugin {

    private volatile boolean layarMati = false;
    private volatile boolean pernahLayarMati = false;
    private volatile long layarMatiTerakhirMs = 0L;
    private volatile long layarNyalaTerakhirMs = 0L;
    private BroadcastReceiver penerimaLayar;
    private final Set<Runnable> pembersihLokasiAktif = Collections.synchronizedSet(new HashSet<>());
    private final AtomicBoolean sedangPasangApk = new AtomicBoolean(false);
    private static final AtomicLong URUTAN_UNDUH = new AtomicLong(0);
    private static final String USER_AGENT = "AlAkhyarCBT/1.0 (+https://erapor.alakhyar.sch.id)";

    private Activity aktivitasAman() {
        Activity a = getActivity();
        if (a == null || a.isFinishing() || a.isDestroyed()) return null;
        return a;
    }

    @Override
    public void load() {
        super.load();
        if (penerimaLayar != null) return;
        penerimaLayar = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                String aksi = intent.getAction();
                if (Intent.ACTION_SCREEN_OFF.equals(aksi)) {
                    layarMati = true;
                    pernahLayarMati = true;
                    layarMatiTerakhirMs = SystemClock.elapsedRealtime();
                    JSObject o = new JSObject();
                    o.put("interaktif", false);
                    o.put("aksi", aksi);
                    notifyListeners("statusLayar", o);
                } else if (Intent.ACTION_SCREEN_ON.equals(aksi) || Intent.ACTION_USER_PRESENT.equals(aksi)) {
                    layarMati = false;
                    layarNyalaTerakhirMs = SystemClock.elapsedRealtime();
                    JSObject o = new JSObject();
                    o.put("interaktif", true);
                    o.put("aksi", aksi);
                    notifyListeners("statusLayar", o);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(penerimaLayar, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(penerimaLayar, filter);
            }
        } catch (Exception ignored) {
            // Abaikan jika OS membatasi pendaftaran broadcast receiver.
        }
    }

    @Override
    protected void handleOnDestroy() {
        List<Runnable> pembersih;
        synchronized (pembersihLokasiAktif) {
            pembersih = new ArrayList<>(pembersihLokasiAktif);
            pembersihLokasiAktif.clear();
        }
        for (Runnable r : pembersih) {
            try {
                r.run();
            } catch (Exception ignored) {
                // Abaikan jika listener sudah terlepas.
            }
        }
        if (penerimaLayar != null) {
            try {
                getContext().unregisterReceiver(penerimaLayar);
            } catch (Exception ignored) {
                // Sudah dilepas.
            }
            penerimaLayar = null;
        }
        synchronized (this) {
            if (dbHelper != null) {
                try {
                    dbHelper.close();
                } catch (Exception ignored) {
                    // Abaikan galat penutupan SQLite.
                }
                dbHelper = null;
            }
        }
        super.handleOnDestroy();
    }

    static boolean apakahLayarMati(
        boolean interaktif,
        boolean layarMati,
        boolean pernahLayarMati,
        long layarMatiTerakhirMs,
        long layarNyalaTerakhirMs,
        long kini
    ) {
        boolean matiBaru = (layarMatiTerakhirMs > 0L && (kini - layarMatiTerakhirMs) < 3000L)
                || (layarNyalaTerakhirMs > 0L && (kini - layarNyalaTerakhirMs) < 5000L);
        return !interaktif || layarMati || pernahLayarMati || matiBaru;
    }

    static File namaBerkasSementara(String pathTujuan, long urutan) {
        return new File(pathTujuan + "." + urutan + ".unduh");
    }

    @PluginMethod
    public void statusLayar(PluginCall call) {
        boolean reset = Boolean.TRUE.equals(call.getBoolean("reset", false));
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean interaktif = pm == null || pm.isInteractive();
        long kini = SystemClock.elapsedRealtime();
        boolean hasilMati = apakahLayarMati(
            interaktif,
            layarMati,
            pernahLayarMati,
            layarMatiTerakhirMs,
            layarNyalaTerakhirMs,
            kini
        );
        if (reset && interaktif && !layarMati) {
            pernahLayarMati = false;
            layarMatiTerakhirMs = 0L;
            layarNyalaTerakhirMs = 0L;
        }
        JSObject o = new JSObject();
        o.put("interaktif", interaktif);
        o.put("layarMati", hasilMati);
        call.resolve(o);
    }

    // ——— Kunci layar ————————————————————————————————————————————————

    @PluginMethod
    public void kunciLayar(PluginCall call) {
        Activity a = aktivitasAman();
        if (a == null) {
            call.reject("Aktivitas layar tidak tersedia.", "AKTIVITAS_TIDAK_ADA");
            return;
        }
        a.runOnUiThread(() -> {
            try {
                a.startLockTask();
                call.resolve(statusKunci());
            } catch (Exception e) {
                call.reject("Kunci layar gagal: " + e.getMessage(), "KUNCI_GAGAL");
            }
        });
    }

    @PluginMethod
    public void lepasKunci(PluginCall call) {
        Activity a = aktivitasAman();
        if (a == null) {
            call.resolve(statusKunci());
            return;
        }
        a.runOnUiThread(() -> {
            try {
                a.stopLockTask();
            } catch (Exception ignored) {
                // Tidak sedang terkunci.
            }
            call.resolve(statusKunci());
        });
    }

    @PluginMethod
    public void statusKunciLayar(PluginCall call) {
        call.resolve(statusKunci());
    }

    private JSObject statusKunci() {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        int mode = am != null ? am.getLockTaskModeState() : ActivityManager.LOCK_TASK_MODE_NONE;
        JSObject o = new JSObject();
        o.put("aktif", mode != ActivityManager.LOCK_TASK_MODE_NONE);
        o.put("mode", mode == ActivityManager.LOCK_TASK_MODE_LOCKED ? "kios" : mode == ActivityManager.LOCK_TASK_MODE_PINNED ? "sematan" : "tidak");
        return o;
    }

    @PluginMethod
    public void bukaPengaturanWifi(PluginCall call) {
        Activity a = aktivitasAman();
        if (a == null) {
            call.reject("Aktivitas layar tidak tersedia.", "AKTIVITAS_TIDAK_ADA");
            return;
        }
        a.runOnUiThread(() -> {
            try {
                try {
                    a.stopLockTask();
                } catch (Exception ignored) {
                    // Tidak sedang terkunci.
                }
                PackageManager pm = getContext().getPackageManager();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent panel = new Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY);
                    if (panel.resolveActivity(pm) != null) {
                        a.startActivity(panel);
                        JSObject o = new JSObject();
                        o.put("mode", "panel");
                        call.resolve(o);
                        return;
                    }
                }
                Intent wifi = new Intent(Settings.ACTION_WIFI_SETTINGS);
                if (wifi.resolveActivity(pm) == null) {
                    wifi = new Intent(Settings.ACTION_SETTINGS);
                }
                a.startActivity(wifi);
                JSObject o = new JSObject();
                o.put("mode", "pengaturan");
                call.resolve(o);
            } catch (Exception e) {
                call.reject("Gagal membuka pengaturan Wi-Fi: " + e.getMessage(), "WIFI_GAGAL");
            }
        });
    }

    @PluginMethod
    public void aturProteksiKonten(PluginCall call) {
        boolean aktif = Boolean.TRUE.equals(call.getBoolean("aktif", false));
        Activity a = aktivitasAman();
        if (a == null) {
            call.resolve();
            return;
        }
        a.runOnUiThread(() -> {
            if (a instanceof MainActivity) {
                ((MainActivity) a).setProteksiKontenAktif(aktif);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void aturTetapMenyala(PluginCall call) {
        boolean aktif = Boolean.TRUE.equals(call.getBoolean("aktif", false));
        Activity a = aktivitasAman();
        if (a == null) {
            call.resolve();
            return;
        }
        a.runOnUiThread(() -> {
            if (a instanceof MainActivity) {
                ((MainActivity) a).setTetapMenyala(aktif);
            }
            call.resolve();
        });
    }

    // ——— Lokasi ——————————————————————————————————————————————————————

    @PluginMethod
    public void izinLokasi(PluginCall call) {
        JSObject o = new JSObject();
        PermissionState s = getPermissionState("lokasi");
        o.put("izin", s == PermissionState.GRANTED ? "granted" : s == PermissionState.DENIED ? "denied" : "prompt");
        call.resolve(o);
    }

    @PluginMethod
    public void ambilLokasi(PluginCall call) {
        if (getPermissionState("lokasi") != PermissionState.GRANTED) {
            requestPermissionForAlias("lokasi", call, "setelahIzinLokasi");
            return;
        }
        baca(call);
    }

    @PermissionCallback
    private void setelahIzinLokasi(PluginCall call) {
        if (getPermissionState("lokasi") == PermissionState.GRANTED) {
            baca(call);
        } else {
            call.reject("Izin lokasi ditolak.", "DITOLAK");
        }
    }

    @SuppressWarnings({ "MissingPermission", "deprecation" })
    private void baca(PluginCall call) {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            call.reject("Layanan lokasi tidak tersedia.", "TIDAK_ADA");
            return;
        }
        long maksUmurMs = call.getLong("maksUmurMs", 0L);
        long batasMs = call.getLong("batasMs", 20000L);

        List<String> penyediaList = pilihSemuaPenyedia(lm);
        if (penyediaList.isEmpty()) {
            call.reject("Layanan lokasi (GPS) mati.", "TIDAK_ADA");
            return;
        }

        // Posisi terakhir yang masih segar dipakai langsung (hemat baterai).
        if (maksUmurMs > 0) {
            Location terbaik = null;
            for (String p : penyediaList) {
                try {
                    Location terakhir = lm.getLastKnownLocation(p);
                    if (terakhir != null && umurMs(terakhir) <= maksUmurMs) {
                        if (terbaik == null || terakhir.getAccuracy() < terbaik.getAccuracy()) {
                            terbaik = terakhir;
                        }
                    }
                } catch (Exception ignored) {
                    // Abaikan provider bermasalah; coba provider lain.
                }
            }
            if (terbaik != null) {
                call.resolve(keJs(terbaik));
                return;
            }
        }

        Handler h = new Handler(Looper.getMainLooper());
        final boolean[] selesai = { false };
        final Location[] cadangan = { null };
        final boolean adaGanda = penyediaList.size() > 1;
        final Runnable[] pembersihRef = new Runnable[1];
        LocationListener pendengar = new LocationListener() {
            @Override
            public void onLocationChanged(Location loc) {
                if (selesai[0]) return;
                boolean dariNetwork = LocationManager.NETWORK_PROVIDER.equals(loc.getProvider());
                boolean kurangAkurat = loc.hasAccuracy() && loc.getAccuracy() > 100f;
                // Di dalam ruangan Android < 12: simpan fix jaringan kasar sebagai cadangan sambil menunggu GPS sebentar.
                if (adaGanda && dariNetwork && kurangAkurat) {
                    if (cadangan[0] == null || loc.getAccuracy() < cadangan[0].getAccuracy()) {
                        cadangan[0] = loc;
                    }
                    return;
                }
                if (pembersihRef[0] != null) pembersihRef[0].run();
                call.resolve(keJs(loc));
            }
        };
        Runnable bersihkan = () -> {
            selesai[0] = true;
            h.removeCallbacksAndMessages(null);
            try {
                lm.removeUpdates(pendengar);
            } catch (Exception ignored) {
                // Listener mungkin sudah dilepas.
            }
            if (pembersihRef[0] != null) {
                pembersihLokasiAktif.remove(pembersihRef[0]);
            }
        };
        pembersihRef[0] = bersihkan;
        pembersihLokasiAktif.add(bersihkan);

        h.post(() -> {
            if (selesai[0]) return;
            int terdaftar = 0;
            for (String p : penyediaList) {
                try {
                    lm.requestLocationUpdates(p, 0L, 0f, pendengar, Looper.getMainLooper());
                    terdaftar++;
                } catch (Exception ignored) {
                    // Izin dicabut / provider hilang sesaat: lanjut coba provider lain.
                }
            }
            if (terdaftar == 0 && !selesai[0]) {
                bersihkan.run();
                call.reject("Layanan lokasi tidak tersedia.", "TIDAK_ADA");
            }
        });
        if (adaGanda && batasMs > 6000L) {
            h.postDelayed(() -> {
                if (selesai[0] || cadangan[0] == null) return;
                bersihkan.run();
                call.resolve(keJs(cadangan[0]));
            }, 6000L);
        }
        h.postDelayed(() -> {
            if (selesai[0]) return;
            bersihkan.run();
            if (cadangan[0] != null) {
                call.resolve(keJs(cadangan[0]));
            } else {
                call.reject("Posisi belum didapat.", "WAKTU_HABIS");
            }
        }, batasMs);
    }

    private List<String> pilihSemuaPenyedia(LocationManager lm) {
        List<String> hasil = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.hasProvider(LocationManager.FUSED_PROVIDER) && lm.isProviderEnabled(LocationManager.FUSED_PROVIDER)) {
            hasil.add(LocationManager.FUSED_PROVIDER);
        }
        // Jangan early return di FUSED_PROVIDER: perangkat Android 12+ tanpa GMS penuh tetap butuh fallback GPS/Network.
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) && !hasil.contains(LocationManager.GPS_PROVIDER)) {
            hasil.add(LocationManager.GPS_PROVIDER);
        }
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) && !hasil.contains(LocationManager.NETWORK_PROVIDER)) {
            hasil.add(LocationManager.NETWORK_PROVIDER);
        }
        return hasil;
    }

    private static long umurMs(Location loc) {
        return (SystemClock.elapsedRealtimeNanos() - loc.getElapsedRealtimeNanos()) / 1_000_000L;
    }

    @SuppressWarnings("deprecation")
    private static JSObject keJs(Location loc) {
        JSObject o = new JSObject();
        o.put("lat", loc.getLatitude());
        o.put("lng", loc.getLongitude());
        o.put("akurasi_m", Math.round(loc.getAccuracy()));
        o.put("palsu", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? loc.isMock() : loc.isFromMockProvider());
        return o;
    }

    // ——— Penyimpanan SQLite Native (Story 7.7) ———————————————————————

    private DatabaseHelper dbHelper;
    /** Batas satu baris saat dibaca (paket soal terenkripsi bisa beberapa MB). */
    private static final long BATAS_BARIS_BYTE = 32L * 1024 * 1024;

    private synchronized SQLiteDatabase dapatkanDb() {
        if (dbHelper == null) {
            dbHelper = new DatabaseHelper(getContext());
        }
        return dbHelper.getWritableDatabase();
    }

    private static class DatabaseHelper extends SQLiteOpenHelper {
        private static final String DATABASE_NAME = "erapor_cbt.db";
        private static final int DATABASE_VERSION = 1;

        DatabaseHelper(Context context) {
            super(context, DATABASE_NAME, null, DATABASE_VERSION);
        }

        @Override
        public void onConfigure(SQLiteDatabase db) {
            super.onConfigure(db);
            db.enableWriteAheadLogging();
            try (Cursor c = db.rawQuery("PRAGMA busy_timeout = 5000", null)) {
                c.moveToFirst();
            } catch (Exception ignored) {
                // Sebagian device membatasi pragma tertentu; WAL tetap aktif.
            }
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE IF NOT EXISTS erapor_cbt_kv (" +
                    "kunci TEXT PRIMARY KEY NOT NULL, " +
                    "nilai TEXT NOT NULL, " +
                    "diperbarui_pada INTEGER NOT NULL);");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_erapor_cbt_kv_kunci ON erapor_cbt_kv(kunci);");
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        }
    }

    @PluginMethod
    public void sqliteAmbil(PluginCall call) {
        String kunci = call.getString("kunci");
        if (kunci == null) {
            call.reject("Parameter 'kunci' wajib diisi.", "ARGUMEN_INVALID");
            return;
        }

        try {
            SQLiteDatabase db = dapatkanDb();
            try (Cursor cursor = db.rawQuery("SELECT nilai FROM erapor_cbt_kv WHERE kunci = ? LIMIT 1", new String[]{ kunci })) {
                // CursorWindow bawaan Android ±2 MB per baris: paket soal besar akan gagal dibaca.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && cursor instanceof SQLiteCursor) {
                    ((SQLiteCursor) cursor).setWindow(new CursorWindow("erapor_cbt_kv", BATAS_BARIS_BYTE));
                }
                JSObject ret = new JSObject();
                if (cursor.moveToFirst()) {
                    ret.put("ada", true);
                    ret.put("nilai", cursor.getString(0));
                } else {
                    ret.put("ada", false);
                    ret.put("nilai", null);
                }
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Gagal mengambil dari SQLite: " + e.getMessage(), "SQLITE_GAGAL");
        }
    }

    @PluginMethod
    public void sqliteSimpan(PluginCall call) {
        String kunci = call.getString("kunci");
        String nilai = call.getString("nilai");
        if (kunci == null || nilai == null) {
            call.reject("Parameter 'kunci' dan 'nilai' wajib diisi.", "ARGUMEN_INVALID");
            return;
        }

        try {
            SQLiteDatabase db = dapatkanDb();
            ContentValues cv = new ContentValues();
            cv.put("kunci", kunci);
            cv.put("nilai", nilai);
            cv.put("diperbarui_pada", System.currentTimeMillis());
            db.insertWithOnConflict("erapor_cbt_kv", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menyimpan ke SQLite: " + e.getMessage(), "SQLITE_GAGAL");
        }
    }

    @PluginMethod
    public void sqliteHapus(PluginCall call) {
        String kunci = call.getString("kunci");
        if (kunci == null) {
            call.reject("Parameter 'kunci' wajib diisi.", "ARGUMEN_INVALID");
            return;
        }

        try {
            SQLiteDatabase db = dapatkanDb();
            db.delete("erapor_cbt_kv", "kunci = ?", new String[]{ kunci });
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menghapus dari SQLite: " + e.getMessage(), "SQLITE_GAGAL");
        }
    }

    @PluginMethod
    public void sqliteDaftarKunci(PluginCall call) {
        String awalan = call.getString("awalan", "");

        try {
            SQLiteDatabase db = dapatkanDb();
            String query;
            String[] params;
            if (awalan == null || awalan.isEmpty()) {
                query = "SELECT kunci FROM erapor_cbt_kv ORDER BY kunci ASC";
                params = null;
            } else {
                query = "SELECT kunci FROM erapor_cbt_kv WHERE kunci LIKE ? ESCAPE '\\' ORDER BY kunci ASC";
                String escaped = awalan.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                params = new String[]{ escaped + "%" };
            }

            try (Cursor cursor = db.rawQuery(query, params)) {
                JSArray arr = new JSArray();
                while (cursor.moveToNext()) {
                    arr.put(cursor.getString(0));
                }
                JSObject ret = new JSObject();
                ret.put("kunci", arr);
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Gagal membaca daftar kunci dari SQLite: " + e.getMessage(), "SQLITE_GAGAL");
        }
    }

    // ——— Pembaruan APK ————————————————————————————————————————————————

    /** APK hanya boleh diunduh dari GitHub Releases (repo rilis publik). */
    private static final String AWALAN_UNDUHAN = "https://github.com/";
    private static final String MIME_APK = "application/vnd.android.package-archive";
    private static final String EVENT_PROGRES = "progresPembaruan";

    /**
     * Unduh APK dari `url` (event "progresPembaruan": mulai/progres/memasang), pastikan
     * nama paket & sertifikat sama dengan app terpasang, lalu buka pemasang sistem.
     * Resolve saat pemasang dibuka; murid tetap menekan "Pasang" (aturan Android).
     * Reject IZIN_PASANG bila app belum diizinkan memasang app (layar setelan dibuka).
     */
    @PluginMethod
    public void pasangApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith(AWALAN_UNDUHAN)) {
            call.reject("Alamat unduhan pembaruan tidak diizinkan.", "ARGUMEN_INVALID");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Activity act = aktivitasAman();
            if (act != null) {
                act.runOnUiThread(() -> {
                    try {
                        act.stopLockTask();
                    } catch (Exception ignored) {
                        // Tidak sedang disematkan.
                    }
                });
            }
            Intent setelan = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            setelan.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(setelan);
            call.reject("Izinkan app ini memasang pembaruan, lalu coba lagi.", "IZIN_PASANG");
            return;
        }
        if (!sedangPasangApk.compareAndSet(false, true)) {
            call.reject("Pembaruan sedang berlangsung.", "PEMBARUAN_SIBUK");
            return;
        }

        new Thread(() -> {
            File apk = null;
            try {
                apk = unduhApk(url);
                periksaApk(apk);
                kirimProgres("memasang", null);
                bukaPemasang(apk, call);
            } catch (Exception e) {
                if (apk != null && apk.exists()) apk.delete();
                sedangPasangApk.set(false);
                call.reject(e.getMessage() != null ? e.getMessage() : "Pembaruan gagal.", "PEMBARUAN_GAGAL");
            }
        }).start();
    }

    private File unduhApk(String url) throws Exception {
        File folder = new File(getContext().getCacheDir(), "pembaruan");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Tidak bisa membuat folder unduhan.");
        File apk = new File(folder, "pembaruan.apk");
        File sementara = namaBerkasSementara(apk.getPath(), URUTAN_UNDUH.incrementAndGet());

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(30000);
        try {
            int status = conn.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new Exception("Unduhan gagal (HTTP " + status + ").");
            long total = conn.getContentLengthLong();

            JSObject mulai = new JSObject();
            mulai.put("total", total > 0 ? total : null);
            kirimProgres("mulai", mulai);

            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(sementara)) {
                byte[] buf = new byte[64 * 1024];
                long belumDikirim = 0;
                long terakhirKirim = 0;
                int n;
                while ((n = in.read(buf)) != -1) {
                    out.write(buf, 0, n);
                    belumDikirim += n;
                    long sekarang = SystemClock.elapsedRealtime();
                    // Batasi event ke ±5 per detik agar jembatan JS tidak kebanjiran.
                    if (sekarang - terakhirKirim >= 200) {
                        JSObject p = new JSObject();
                        p.put("diterima", belumDikirim);
                        kirimProgres("progres", p);
                        belumDikirim = 0;
                        terakhirKirim = sekarang;
                    }
                }
                if (belumDikirim > 0) {
                    JSObject p = new JSObject();
                    p.put("diterima", belumDikirim);
                    kirimProgres("progres", p);
                }
            }
            if (apk.exists()) apk.delete();
            if (!sementara.renameTo(apk)) throw new Exception("Gagal menyiapkan berkas pembaruan.");
        } finally {
            conn.disconnect();
            if (sementara.exists()) sementara.delete();
        }
        return apk;
    }

    /** Tolak lebih awal (dengan pesan jelas) APK yang pasti ditolak pemasang: paket/tanda tangan beda. */
    private void periksaApk(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo baru = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flagSertifikat());
        if (baru == null) throw new Exception("Berkas pembaruan rusak. Coba unduh ulang.");
        String paket = getContext().getPackageName();
        if (!paket.equals(baru.packageName)) throw new Exception("Berkas pembaruan bukan untuk app ini.");

        PackageInfo terpasang = pm.getPackageInfo(paket, flagSertifikat());
        if (!samaSertifikat(sertifikat(terpasang), sertifikat(baru))) {
            throw new Exception("Tanda tangan pembaruan tidak cocok dengan app terpasang. Pasang ulang manual.");
        }
    }

    @SuppressWarnings("deprecation")
    private static int flagSertifikat() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }

    @SuppressWarnings("deprecation")
    private static Signature[] sertifikat(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : null;
        }
        return info.signatures;
    }

    private static boolean samaSertifikat(Signature[] a, Signature[] b) {
        if (a == null || b == null || a.length == 0 || a.length != b.length) return false;
        String[] sa = new String[a.length];
        String[] sb = new String[b.length];
        for (int i = 0; i < a.length; i++) {
            sa[i] = a[i].toCharsString();
            sb[i] = b[i].toCharsString();
        }
        Arrays.sort(sa);
        Arrays.sort(sb);
        return Arrays.equals(sa, sb);
    }

    private void bukaPemasang(File apk, PluginCall call) {
        Activity a = aktivitasAman();
        if (a == null) {
            sedangPasangApk.set(false);
            call.reject("Aktivitas layar tidak tersedia.", "AKTIVITAS_TIDAK_ADA");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent pasang = new Intent(Intent.ACTION_VIEW);
        pasang.setDataAndType(uri, MIME_APK);
        pasang.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        a.runOnUiThread(() -> {
            try {
                // Sematan layar menghalangi pemasang sistem tampil.
                try {
                    a.stopLockTask();
                } catch (Exception ignored) {
                    // Tidak sedang disematkan.
                }
                getContext().startActivity(pasang);
                call.resolve();
            } catch (Exception e) {
                call.reject("Tidak bisa membuka pemasang pembaruan: " + e.getMessage(), "PEMBARUAN_GAGAL");
            } finally {
                sedangPasangApk.set(false);
            }
        });
    }

    private void kirimProgres(String jenis, JSObject data) {
        JSObject o = data != null ? data : new JSObject();
        o.put("jenis", jenis);
        notifyListeners(EVENT_PROGRES, o);
    }

    // ——— Media soal offline ——————————————————————————————————————————

    /**
     * Unduh media soal ke files/media/<sha256 url>.<ext> bila belum ada; resolve { path }.
     * Berkas yang sudah ada dipakai tanpa jaringan (aman dipanggil ulang saat offline).
     * Web menampilkannya lewat Capacitor.convertFileSrc (apps/ujian/src/lib/native.ts).
     */
    @PluginMethod
    public void unduhMedia(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("Alamat media tidak diizinkan.", "ARGUMEN_INVALID");
            return;
        }
        new Thread(() -> {
            try {
                File tujuan = new File(folderMedia(), namaBerkasMedia(url));
                if (!tujuan.exists() || tujuan.length() == 0) unduhKe(url, tujuan);
                JSObject o = new JSObject();
                o.put("path", tujuan.getAbsolutePath());
                call.resolve(o);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Gagal mengunduh media.", "MEDIA_GAGAL");
            }
        }).start();
    }

    /** Hapus berkas media { path: string[] }; path di luar folder media diabaikan. */
    @PluginMethod
    public void hapusMedia(PluginCall call) {
        JSONArray daftar = call.getArray("path", new JSArray());
        try {
            String folder = folderMedia().getCanonicalPath();
            for (int i = 0; i < daftar.length(); i++) {
                File f = new File(daftar.getString(i)).getCanonicalFile();
                if (f.getParent() != null && f.getParent().equals(folder)) f.delete();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menghapus media: " + e.getMessage(), "MEDIA_GAGAL");
        }
    }

    private File folderMedia() throws Exception {
        File folder = new File(getContext().getFilesDir(), "media");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Tidak bisa membuat folder media.");
        return folder;
    }

    /** Aturan seperti nama_berkas di src-tauri/src/media.rs: sha256(url) + ekstensi alfanumerik ≤ 5. */
    static String namaBerkasMedia(String url) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(url.getBytes("UTF-8"));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));

        String path = new URL(url).getPath();
        String nama = path.substring(path.lastIndexOf('/') + 1);
        int titik = nama.lastIndexOf('.');
        if (titik >= 0) {
            String ext = nama.substring(titik + 1).toLowerCase(Locale.ROOT);
            if (!ext.isEmpty() && ext.length() <= 5 && ext.matches("[a-z0-9]+")) sb.append('.').append(ext);
        }
        return sb.toString();
    }

    private static void unduhKe(String url, File tujuan) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setRequestProperty("Accept", "image/*,*/*;q=0.8");
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(30000);
        // Tulis ke berkas sementara unik lalu ganti nama: aman saat unduhan/retry paralel.
        File sementara = namaBerkasSementara(tujuan.getPath(), URUTAN_UNDUH.incrementAndGet());
        try {
            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) throw new Exception("Gagal mengunduh media (" + status + ").");
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(sementara)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            }
            if (!sementara.renameTo(tujuan) && (!tujuan.exists() || tujuan.length() == 0)) {
                throw new Exception("Gagal menyimpan media.");
            }
        } catch (java.io.IOException e) {
            throw new Exception("Gagal mengunduh media. Periksa internet lalu coba lagi.");
        } finally {
            conn.disconnect();
            if (sementara.exists()) sementara.delete();
        }
    }
}
