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
}
