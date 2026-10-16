package sch.alakhyar.ujian;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import android.content.ContentValues;
import android.database.Cursor;
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

/**
 * Kemampuan native app ujian (story 7.7) yang tidak bisa dilakukan web:
 * - kunci layar: startLockTask() — tanpa device owner, Android memakai
 *   "sematkan aplikasi" (murid tidak bisa keluar tanpa melepas sematan);
 * - lokasi dengan tanda lokasi palsu (Location.isMock / isFromMockProvider)
 *   untuk field `palsu` di kontrak § Lokasi ujian.
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
}

