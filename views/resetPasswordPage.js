// HTML pages for the reset password link in the email.

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

// Stricter page-specific Content-Security-Policy (CSP).
const RESET_PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; " +
  "base-uri 'none'; frame-ancestors 'none'";

const renderPage = (res, status, title, body) =>
  res.status(status).set('Content-Security-Policy', RESET_PAGE_CSP).type('html').send(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - Dentist Booking</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", Tahoma, sans-serif; line-height: 1.6; background: #f4f6f8; margin: 0; padding: 40px 16px; color: #1f2933; }
  main { max-width: 380px; margin: 0 auto; background: #fff; padding: 28px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  h1 { font-size: 1.3rem; margin-top: 0; }
  label { display: block; margin: 14px 0 4px; font-weight: 600; }
  input { width: 100%; box-sizing: border-box; padding: 9px; border: 1px solid #cbd2d9; border-radius: 6px; font-size: 1rem; }
  button { margin-top: 20px; width: 100%; padding: 10px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; font-size: 1rem; cursor: pointer; }
  .error { background: #fde8e8; color: #9b1c1c; padding: 10px; border-radius: 6px; }
  .ok { background: #def7ec; color: #03543f; padding: 10px; border-radius: 6px; }
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1>${body}</main></body>
</html>`);

// Form that POSTs back to the same URL (the token stays in the path).
exports.renderResetForm = (res, status = 200, error) =>
  renderPage(
    res,
    status,
    'ตั้งรหัสผ่านใหม่',
    `${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
<form method="POST">
  <label for="password">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
  <input id="password" name="password" type="password" minlength="6" required autocomplete="new-password">
  <label for="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
  <input id="confirmPassword" name="confirmPassword" type="password" minlength="6" required autocomplete="new-password">
  <button type="submit">บันทึกรหัสผ่านใหม่</button>
</form>`
  );

exports.renderInvalidLink = (res) =>
  renderPage(
    res,
    400,
    'ลิงก์ใช้งานไม่ได้',
    '<p class="error">ลิงก์นี้หมดอายุ ถูกใช้ไปแล้ว หรือไม่ถูกต้อง (ลิงก์ใช้ได้ภายใน 10 นาทีและใช้ได้ครั้งเดียว)</p><p>กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง</p>'
  );

exports.renderResetSuccess = (res) =>
  renderPage(
    res,
    200,
    'ตั้งรหัสผ่านใหม่สำเร็จ',
    '<p class="ok">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที</p>'
  );
