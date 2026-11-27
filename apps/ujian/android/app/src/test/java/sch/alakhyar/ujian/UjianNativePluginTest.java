package sch.alakhyar.ujian;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import java.io.File;
import org.junit.Test;

public class UjianNativePluginTest {

    @Test
    public void apakahLayarMati_menghormatiStatusDanReset() {
        assertTrue(UjianNativePlugin.apakahLayarMati(false, false, false, 0L, 0L, 12_000L));
        assertTrue(UjianNativePlugin.apakahLayarMati(true, false, false, 0L, 10_000L, 12_000L));
        assertFalse(UjianNativePlugin.apakahLayarMati(true, false, false, 0L, 0L, 12_000L));
        assertFalse(UjianNativePlugin.apakahLayarMati(true, false, false, 1_000L, 5_000L, 12_000L));
    }

    @Test
    public void namaBerkasSementara_unikDanBerakhiranUnduh() {
        File a = UjianNativePlugin.namaBerkasSementara("/tmp/a.png", 1L);
        File b = UjianNativePlugin.namaBerkasSementara("/tmp/a.png", 2L);
        assertNotEquals(a.getPath(), b.getPath());
        assertTrue(a.getName().endsWith(".1.unduh"));
        assertTrue(b.getName().endsWith(".2.unduh"));
    }

    @Test
    public void namaBerkasMedia_konsistenDenganEkstensiValid() throws Exception {
        String valid = UjianNativePlugin.namaBerkasMedia("https://erapor.test/soal/A.PNG");
        assertTrue(valid.endsWith(".png"));
        assertEquals(68, valid.length());

        String invalidExt = UjianNativePlugin.namaBerkasMedia("https://erapor.test/soal/tanpa_ext");
        assertEquals(64, invalidExt.length());
    }
}
