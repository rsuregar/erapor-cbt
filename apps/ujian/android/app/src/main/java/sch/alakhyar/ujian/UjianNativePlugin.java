package sch.alakhyar.ujian;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
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
import java.util.Arrays;

/**
 * Kemampuan native app ujian (story 7.7) yang tidak bisa dilakukan web:
 * - kunci layar: startLockTask() — tanpa device owner, Android memakai
 *   "sematkan aplikasi" (murid tidak bisa keluar tanpa melepas sematan);
 * - lokasi dengan tanda lokasi palsu (Location.isMock / isFromMockProvider)
 *   untuk field `palsu` di kontrak § Lokasi ujian;
 * - pembaruan app: unduh APK rilis dengan progres lalu buka pemasang sistem.
 */
@CapacitorPlugin(
    name = "UjianNative",
    permissions = {
        @Permission(alias = "lokasi", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION })
    }
)
public class UjianNativePlugin extends Plugin {

    // ——— Kunci layar ————————————————————————————————————————————————

    @PluginMethod
    public void kunciLayar(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startLockTask();
                call.resolve(statusKunci());
            } catch (Exception e) {
                call.reject("Kunci layar gagal: " + e.getMessage(), "KUNCI_GAGAL");
            }
        });
    }

    @PluginMethod
    public void lepasKunci(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().stopLockTask();
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
        int mode = am.getLockTaskModeState();
        JSObject o = new JSObject();
        o.put("aktif", mode != ActivityManager.LOCK_TASK_MODE_NONE);
        o.put("mode", mode == ActivityManager.LOCK_TASK_MODE_LOCKED ? "kios" : mode == ActivityManager.LOCK_TASK_MODE_PINNED ? "sematan" : "tidak");
        return o;
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
        long maksUmurMs = call.getLong("maksUmurMs", 0L);
        long batasMs = call.getLong("batasMs", 20000L);

        String penyedia = pilihPenyedia(lm);
        if (penyedia == null) {
            call.reject("Layanan lokasi (GPS) mati.", "TIDAK_ADA");
            return;
        }

        // Posisi terakhir yang masih segar dipakai langsung (hemat baterai).
        if (maksUmurMs > 0) {
            Location terakhir = lm.getLastKnownLocation(penyedia);
            if (terakhir != null && umurMs(terakhir) <= maksUmurMs) {
                call.resolve(keJs(terakhir));
                return;
            }
        }

        Handler h = new Handler(Looper.getMainLooper());
        final boolean[] selesai = { false };
        LocationListener pendengar = new LocationListener() {
            @Override
            public void onLocationChanged(Location loc) {
                if (selesai[0]) return;
                selesai[0] = true;
                lm.removeUpdates(this);
                call.resolve(keJs(loc));
            }
        };
        h.post(() -> lm.requestLocationUpdates(penyedia, 0L, 0f, pendengar, Looper.getMainLooper()));
        h.postDelayed(() -> {
            if (selesai[0]) return;
            selesai[0] = true;
            lm.removeUpdates(pendengar);
            call.reject("Posisi belum didapat.", "WAKTU_HABIS");
        }, batasMs);
    }

    private String pilihPenyedia(LocationManager lm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.hasProvider(LocationManager.FUSED_PROVIDER) && lm.isProviderEnabled(LocationManager.FUSED_PROVIDER)) {
            return LocationManager.FUSED_PROVIDER;
        }
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) return LocationManager.GPS_PROVIDER;
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) return LocationManager.NETWORK_PROVIDER;
        return null;
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
            Intent setelan = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            setelan.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(setelan);
            call.reject("Izinkan app ini memasang pembaruan, lalu coba lagi.", "IZIN_PASANG");
            return;
        }

        new Thread(() -> {
            try {
                File apk = unduhApk(url);
                periksaApk(apk);
                kirimProgres("memasang", null);
                bukaPemasang(apk);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Pembaruan gagal.", "PEMBARUAN_GAGAL");
            }
        }).start();
    }

    private File unduhApk(String url) throws Exception {
        File folder = new File(getContext().getCacheDir(), "pembaruan");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("Tidak bisa membuat folder unduhan.");
        File apk = new File(folder, "pembaruan.apk");

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(30000);
        try {
            int status = conn.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new Exception("Unduhan gagal (HTTP " + status + ").");
            long total = conn.getContentLengthLong();

            JSObject mulai = new JSObject();
            mulai.put("total", total > 0 ? total : null);
            kirimProgres("mulai", mulai);

            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
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
        } finally {
            conn.disconnect();
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

    private void bukaPemasang(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent pasang = new Intent(Intent.ACTION_VIEW);
        pasang.setDataAndType(uri, MIME_APK);
        pasang.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().runOnUiThread(() -> {
            // Sematan layar menghalangi pemasang sistem tampil.
            try {
                getActivity().stopLockTask();
            } catch (Exception ignored) {
                // Tidak sedang disematkan.
            }
            getContext().startActivity(pasang);
        });
    }

    private void kirimProgres(String jenis, JSObject data) {
        JSObject o = data != null ? data : new JSObject();
        o.put("jenis", jenis);
        notifyListeners(EVENT_PROGRES, o);
    }
}
