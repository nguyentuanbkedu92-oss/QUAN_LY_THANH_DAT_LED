/*************************************************************
 * tdl-config.js — CẤU HÌNH DÙNG CHUNG CHO TẤT CẢ TRANG TDL
 * Đặt file này cùng thư mục với các file .html.
 * Mỗi trang chỉ cần thêm 1 dòng trong <head>:
 *     <script src="tdl-config.js"></script>
 *
 * Từ nay ĐỔI URL CHỈ SỬA 1 CHỖ (dòng API bên dưới).
 *************************************************************/
window.TDL = (function () {

  var API_MAC_DINH = 'https://script.google.com/macros/s/AKfycbymFG3K-ypuv475xRs6L_vOLqTfZgJtPsIwNcD10klgP_OXuchYfs7eDGkcxf9he9aHWg/exec';

  // Bảo mật: khi đã đặt TDL2_TOKEN trong Apps Script thì điền đúng chuỗi đó vào đây.
  var TOKEN = '';

  // URL lưu trong localStorage được ưu tiên (để đổi nhanh khi deploy lại)
  var url = localStorage.getItem('tdl_api_url') || API_MAC_DINH;

  function setUrl(v) {
    v = String(v || '').trim();
    if (!v) return;
    url = v;
    localStorage.setItem('tdl_api_url', v);
    // dọn các khóa cũ rải rác ở 3 trang trước đây
    ['tdlcrm_api_url', 'orderpro_api_url', 'gs_url'].forEach(function (k) {
      localStorage.setItem(k, v);
    });
    xoaCache();
  }
  // đồng bộ ngược: nếu trang cũ đã lưu URL riêng thì dùng luôn
  (function () {
    if (localStorage.getItem('tdl_api_url')) return;
    var cu = localStorage.getItem('tdlcrm_api_url') || localStorage.getItem('orderpro_api_url');
    if (cu) setUrl(cu);
  })();

  /* ---------------- gọi API ---------------- */
  async function api(action, data, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000);
    try {
      var body = { action: action, data: Object.assign({}, data || {}) };
      if (TOKEN) body.data.token = TOKEN;
      var resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), signal: ctrl.signal });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } finally { clearTimeout(t); }
  }

  /* ---------------- cache phía máy khách ----------------
   * Vẽ ngay bằng dữ liệu cũ (trang hiện ra tức thì), rồi
   * âm thầm tải bản mới và vẽ lại. Đây là thứ làm cho cảm
   * giác "load nhanh" — Apps Script luôn mất 1-3 giây.
   */
  function key(action, data) { return 'tdl_cache_' + action + '_' + JSON.stringify(data || {}); }

  function docCache(action, data, maxTuoiMs) {
    try {
      var raw = localStorage.getItem(key(action, data));
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (maxTuoiMs && Date.now() - o.t > maxTuoiMs) return null;
      return o;
    } catch (e) { return null; }
  }

  function luuCache(action, data, payload) {
    try {
      localStorage.setItem(key(action, data), JSON.stringify({ t: Date.now(), d: payload }));
    } catch (e) {}
  }

  function xoaCache() {
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf('tdl_cache_') === 0) localStorage.removeItem(k);
    });
  }

  /**
   * Vừa dùng cache vừa làm mới.
   * onData(payload, laCache, tuoiGiay) được gọi 1 hoặc 2 lần.
   * onError(err) chỉ gọi khi KHÔNG có cache để hiển thị.
   */
  async function live(action, data, onData, onError) {
    var c = docCache(action, data);
    if (c) {
      try { onData(c.d, true, Math.round((Date.now() - c.t) / 1000)); } catch (e) {}
    }
    try {
      var res = await api(action, data);
      if (res && res.status === 'ok') {
        luuCache(action, data, res);
        onData(res, false, 0);
      } else {
        throw new Error((res && res.msg) || 'API trả về lỗi');
      }
    } catch (e) {
      if (!c && onError) onError(e);
      else if (c && onError) onError(e, true);   // có cache -> chỉ cảnh báo nhẹ
    }
  }

  /* ---------------- tiện ích dùng chung ---------------- */
  function sdt(s) {
    var v = String(s == null ? '' : s).replace(/[^\d]/g, '');
    if (v.length === 9) v = '0' + v;
    if (v.indexOf('84') === 0 && v.length === 11) v = '0' + v.slice(2);
    return v;
  }
  function hopLeSdt(s) {
    var v = sdt(s);
    return /^0(3|5|7|8|9)\d{8}$/.test(v) || /^0(2)\d{9}$/.test(v); // mobile 10 số / cố định 11 số
  }
  function tien(n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
    return Math.round(n).toLocaleString('vi-VN') + ' đ';
  }
  function ngay(s) {
    if (!s) return '-';
    var d = new Date(s);
    if (isNaN(d)) return String(s);
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  return {
    get url() { return url; },
    setUrl: setUrl, api: api, live: live,
    docCache: docCache, luuCache: luuCache, xoaCache: xoaCache,
    sdt: sdt, hopLeSdt: hopLeSdt, tien: tien, ngay: ngay
  };
})();
