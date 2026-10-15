package sch.alakhyar.ujian;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UjianNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Layar ujian tidak bisa ditangkap/direkam, dan pratinjaunya di daftar
        // aplikasi terbaru dikosongkan (PRD: soal sulit dibocorkan).
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }
}
