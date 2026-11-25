package sch.alakhyar.ujian;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.WindowManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private volatile boolean proteksiKontenAktif = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UjianNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Layar ujian tidak bisa ditangkap/direkam, dan pratinjaunya di daftar
        // aplikasi terbaru dikosongkan (PRD: soal sulit dibocorkan).
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (proteksiKontenAktif) {
            bersihkanPapanKlip();
        }
    }

    public void setProteksiKontenAktif(boolean aktif) {
        proteksiKontenAktif = aktif;
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView wv = getBridge().getWebView();
                wv.setLongClickable(!aktif);
                wv.setOnLongClickListener(aktif ? v -> true : null);
                wv.setHapticFeedbackEnabled(!aktif);
            }
        });
        if (aktif) {
            bersihkanPapanKlip();
        }
    }

    public void setTetapMenyala(boolean aktif) {
        runOnUiThread(() -> {
            if (aktif) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
    }

    public void bersihkanPapanKlip() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                cm.clearPrimaryClip();
            } else {
                cm.setPrimaryClip(ClipData.newPlainText("", ""));
            }
        } catch (Exception ignored) {
            // Sebagian OEM membatasi akses clipboard di kondisi tertentu; abaikan.
        }
    }

    @Override
    public void onActionModeStarted(ActionMode mode) {
        if (proteksiKontenAktif && mode != null) {
            Menu menu = mode.getMenu();
            if (menu != null) {
                for (int i = menu.size() - 1; i >= 0; i--) {
                    MenuItem item = menu.getItem(i);
                    int id = item.getItemId();
                    String judul = item.getTitle() != null ? item.getTitle().toString().toLowerCase(Locale.ROOT) : "";
                    boolean terlarang =
                        id == android.R.id.copy ||
                        id == android.R.id.cut ||
                        id == android.R.id.paste ||
                        id == android.R.id.pasteAsPlainText ||
                        id == android.R.id.shareText ||
                        id == android.R.id.autofill ||
                        id == android.R.id.selectAll ||
                        judul.contains("copy") ||
                        judul.contains("salin") ||
                        judul.contains("cut") ||
                        judul.contains("potong") ||
                        judul.contains("paste") ||
                        judul.contains("tempel") ||
                        judul.contains("share") ||
                        judul.contains("bagikan") ||
                        judul.contains("clipboard") ||
                        judul.contains("papan klip") ||
                        judul.contains("search") ||
                        judul.contains("cari") ||
                        judul.contains("translate") ||
                        judul.contains("terjemah") ||
                        judul.contains("web");
                    if (terlarang) {
                        menu.removeItem(id);
                    }
                }
                if (menu.size() == 0) {
                    mode.finish();
                }
            }
        }
        super.onActionModeStarted(mode);
    }
}
