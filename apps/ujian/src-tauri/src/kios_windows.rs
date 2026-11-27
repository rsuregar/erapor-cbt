use std::sync::atomic::{AtomicBool, Ordering};

#[cfg_attr(debug_assertions, allow(dead_code))]
static HOOK_AKTIF: AtomicBool = AtomicBool::new(false);

#[cfg(all(target_os = "windows", not(debug_assertions)))]
static HOOK_TERPASANG: std::sync::Once = std::sync::Once::new();

#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
const VK_TAB: u32 = 0x09;
#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
const VK_ESCAPE: u32 = 0x1B;
#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
const VK_SNAPSHOT: u32 = 0x2C;
#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
const VK_LWIN: u32 = 0x5B;
#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
const VK_RWIN: u32 = 0x5C;
#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
const VK_F4: u32 = 0x73;

/// Tentukan apakah tombol/kombinasi tombol harus diblokir saat Exam Browser Windows aktif:
/// - `Win` kiri/kanan (membuka Start Menu, Win+D, Win+E, Win+R, Win+Tab)
/// - `Alt+Tab`, `Alt+Esc`, `Ctrl+Esc` (berpindah jendela / membuka Start Menu)
/// - `Alt+F4` (menutup paksa jendela)
/// - `PrintScreen` (`VK_SNAPSHOT`)
#[cfg_attr(any(debug_assertions, not(target_os = "windows")), allow(dead_code))]
pub fn apakah_tombol_kios_diblokir(vk_code: u32, alt_down: bool, ctrl_down: bool) -> bool {
    if vk_code == VK_LWIN || vk_code == VK_RWIN || vk_code == VK_SNAPSHOT {
        return true;
    }
    if alt_down && (vk_code == VK_TAB || vk_code == VK_ESCAPE || vk_code == VK_F4) {
        return true;
    }
    if ctrl_down && vk_code == VK_ESCAPE {
        return true;
    }
    false
}

#[cfg(all(target_os = "windows", not(debug_assertions)))]
mod win32 {
    use super::{apakah_tombol_kios_diblokir, HOOK_AKTIF};
    use std::ffi::c_void;
    use std::sync::atomic::Ordering;

    const WH_KEYBOARD_LL: i32 = 13;
    const WM_KEYDOWN: usize = 0x0100;
    const WM_SYSKEYDOWN: usize = 0x0104;
    const LLKHF_ALTDOWN: u32 = 0x0000_0020;
    const VK_CONTROL: i32 = 0x11;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct KBDLLHOOKSTRUCT {
        vkCode: u32,
        scanCode: u32,
        flags: u32,
        time: u32,
        dwExtraInfo: usize,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct POINT {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct MSG {
        hwnd: *mut c_void,
        message: u32,
        wParam: usize,
        lParam: isize,
        time: u32,
        pt: POINT,
    }

    type HookProc = unsafe extern "system" fn(i32, usize, isize) -> isize;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn SetWindowsHookExW(
            id_hook: i32,
            lpfn: Option<HookProc>,
            hmod: *mut c_void,
            dw_thread_id: u32,
        ) -> *mut c_void;
        fn CallNextHookEx(
            hhk: *mut c_void,
            n_code: i32,
            w_param: usize,
            l_param: isize,
        ) -> isize;
        fn GetAsyncKeyState(v_key: i32) -> i16;
        fn GetMessageW(
            lp_msg: *mut MSG,
            h_wnd: *mut c_void,
            w_msg_filter_min: u32,
            w_msg_filter_max: u32,
        ) -> i32;
        fn TranslateMessage(lp_msg: *const MSG) -> i32;
        fn DispatchMessageW(lp_msg: *const MSG) -> isize;
    }

    unsafe extern "system" fn ll_keyboard_proc(
        n_code: i32,
        w_param: usize,
        l_param: isize,
    ) -> isize {
        if n_code >= 0
            && HOOK_AKTIF.load(Ordering::Relaxed)
            && (w_param == WM_KEYDOWN || w_param == WM_SYSKEYDOWN)
        {
            let kb = unsafe { &*(l_param as *const KBDLLHOOKSTRUCT) };
            let alt_down = (kb.flags & LLKHF_ALTDOWN) != 0;
            let ctrl_down = (unsafe { GetAsyncKeyState(VK_CONTROL) } as u16 & 0x8000) != 0;
            if apakah_tombol_kios_diblokir(kb.vkCode, alt_down, ctrl_down) {
                return 1;
            }
        }
        unsafe { CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param) }
    }

    pub fn pasang_hook_latar() {
        std::thread::spawn(|| unsafe {
            let hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(ll_keyboard_proc),
                std::ptr::null_mut(),
                0,
            );
            if hook.is_null() {
                return;
            }
            let mut msg = std::mem::zeroed::<MSG>();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        });
    }
}

pub fn atur_aktif(aktif: bool) {
    HOOK_AKTIF.store(aktif, Ordering::SeqCst);
    #[cfg(all(target_os = "windows", not(debug_assertions)))]
    if aktif {
        HOOK_TERPASANG.call_once(win32::pasang_hook_latar);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memblokir_tombol_windows_dan_pintasan_pindah_aplikasi() {
        assert!(apakah_tombol_kios_diblokir(VK_LWIN, false, false));
        assert!(apakah_tombol_kios_diblokir(VK_RWIN, false, false));
        assert!(apakah_tombol_kios_diblokir(VK_SNAPSHOT, false, false));
        assert!(apakah_tombol_kios_diblokir(VK_TAB, true, false));
        assert!(apakah_tombol_kios_diblokir(VK_ESCAPE, true, false));
        assert!(apakah_tombol_kios_diblokir(VK_F4, true, false));
        assert!(apakah_tombol_kios_diblokir(VK_ESCAPE, false, true));
    }

    #[test]
    fn mengizinkan_tombol_ketik_dan_pintasan_pengawas() {
        // Huruf biasa, Tab tanpa Alt, Esc tanpa Alt/Ctrl, Ctrl+Shift+Q/X tetap lolos.
        assert!(!apakah_tombol_kios_diblokir(0x41, false, false));
        assert!(!apakah_tombol_kios_diblokir(VK_TAB, false, false));
        assert!(!apakah_tombol_kios_diblokir(VK_ESCAPE, false, false));
        assert!(!apakah_tombol_kios_diblokir(0x51, false, true));
        assert!(!apakah_tombol_kios_diblokir(VK_F4, false, false));
    }
}
