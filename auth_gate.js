/**
 * 朝曦家办 · 客户全流程小助手 —— 访问登录闸门
 *
 * ⚠️ 说明：本站为纯静态托管，源码公开。前端校验只能挡住随手访问的人，
 *    无法阻止有心者直接按 URL 取数据文件。它是「门槛」，不是安全边界。
 *    因此这里的口令不作他用，也不要在别处复用。
 *
 * 规则：邮箱须为 @zxpro.com.cn 域名 + 团队统一口令。
 */
(function () {
  'use strict';

  var EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@zxpro\.com\.cn$/i;
  // SHA-256(团队口令)，避免口令以明文出现在源码里
  var PASSWORD_HASH = '12aa57b609af6038cac54c0c2ef5e0a91c2871df6ca757a65cacefe7ef23a895';
  var STORAGE_KEY = 'zx_auth_session_v1';
  var MAX_AGE_DAYS = 14;

  // ── 会话读写 ────────────────────────────────────────────────
  function readSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.email || !data.at) return null;
      var ageDays = (Date.now() - data.at) / 86400000;
      if (data.persist && ageDays > MAX_AGE_DAYS) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function writeSession(email, persist) {
    var payload = JSON.stringify({ email: email, at: Date.now(), persist: !!persist });
    try {
      (persist ? localStorage : sessionStorage).setItem(STORAGE_KEY, payload);
    } catch (err) { /* 隐私模式下写入失败不阻断使用 */ }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {}
  }

  async function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  // ── 样式 ────────────────────────────────────────────────────
  var STYLE = [
    '#zxAuthGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;',
    'justify-content:center;background:linear-gradient(150deg,#0f2740 0%,#16344f 45%,#1d4260 100%);',
    'font-family:"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif;padding:24px;}',
    '#zxAuthGate[hidden]{display:none;}',
    '.zx-auth-card{width:100%;max-width:392px;background:#fff;border-radius:14px;padding:38px 34px 30px;',
    'box-shadow:0 24px 60px rgba(0,0,0,.32);animation:zxAuthIn .32s ease;}',
    '@keyframes zxAuthIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '.zx-auth-brand{display:flex;align-items:center;gap:10px;margin-bottom:6px;}',
    '.zx-auth-mark{width:5px;height:20px;border-radius:3px;background:#1d4260;}',
    '.zx-auth-title{font-size:18px;font-weight:700;color:#12304d;letter-spacing:.3px;}',
    '.zx-auth-sub{font-size:12.5px;color:#7d8b98;margin:0 0 24px 15px;line-height:1.6;}',
    '.zx-auth-field{margin-bottom:15px;}',
    '.zx-auth-field label{display:block;font-size:12.5px;color:#54636f;margin-bottom:6px;font-weight:600;}',
    '.zx-auth-field input{width:100%;box-sizing:border-box;padding:11px 13px;font-size:14px;',
    'border:1px solid #d8e0e7;border-radius:8px;outline:none;transition:border-color .15s,box-shadow .15s;',
    'font-family:inherit;color:#22313d;background:#fff;}',
    '.zx-auth-field input:focus{border-color:#1d4260;box-shadow:0 0 0 3px rgba(29,66,96,.12);}',
    '.zx-auth-field input.zx-bad{border-color:#d9534f;box-shadow:0 0 0 3px rgba(217,83,79,.12);}',
    '.zx-auth-row{display:flex;align-items:center;gap:7px;margin:4px 0 20px;}',
    '.zx-auth-row input{width:14px;height:14px;accent-color:#1d4260;cursor:pointer;}',
    '.zx-auth-row label{font-size:12.5px;color:#6b7986;cursor:pointer;user-select:none;}',
    '.zx-auth-btn{width:100%;padding:12px;font-size:14.5px;font-weight:600;color:#fff;background:#1d4260;',
    'border:0;border-radius:8px;cursor:pointer;transition:background .15s;font-family:inherit;letter-spacing:.5px;}',
    '.zx-auth-btn:hover{background:#16344f;}',
    '.zx-auth-btn:disabled{background:#9fb0bf;cursor:not-allowed;}',
    '.zx-auth-msg{min-height:17px;margin:11px 0 0;font-size:12.5px;color:#d9534f;text-align:center;line-height:1.5;}',
    '.zx-auth-foot{margin-top:22px;padding-top:15px;border-top:1px solid #eef2f5;',
    'font-size:11.5px;color:#9aa7b2;text-align:center;line-height:1.75;}',
    '.zx-logout{position:fixed;right:14px;bottom:12px;z-index:9998;font-size:11.5px;color:#8b97a2;',
    'background:rgba(255,255,255,.94);border:1px solid #e2e8ed;border-radius:7px;padding:5px 11px;',
    'cursor:pointer;font-family:inherit;transition:color .15s,border-color .15s;}',
    '.zx-logout:hover{color:#1d4260;border-color:#c3ced7;}'
  ].join('');

  var MARKUP = [
    '<div class="zx-auth-card">',
    '  <div class="zx-auth-brand"><span class="zx-auth-mark"></span>',
    '    <span class="zx-auth-title">朝曦家办 · 客户全流程小助手</span></div>',
    '  <p class="zx-auth-sub">请使用公司邮箱登录</p>',
    '  <form id="zxAuthForm" autocomplete="on">',
    '    <div class="zx-auth-field"><label for="zxAuthEmail">公司邮箱</label>',
    '      <input id="zxAuthEmail" type="email" name="username" placeholder="yourname@zxpro.com.cn"',
    '             autocomplete="username" spellcheck="false" required></div>',
    '    <div class="zx-auth-field"><label for="zxAuthPwd">访问口令</label>',
    '      <input id="zxAuthPwd" type="password" name="password" placeholder="请输入团队口令"',
    '             autocomplete="current-password" required></div>',
    '    <div class="zx-auth-row"><input type="checkbox" id="zxAuthRemember" checked>',
    '      <label for="zxAuthRemember">在这台电脑上保持登录（14 天）</label></div>',
    '    <button type="submit" class="zx-auth-btn" id="zxAuthBtn">进入系统</button>',
    '    <p class="zx-auth-msg" id="zxAuthMsg"></p>',
    '  </form>',
    '  <p class="zx-auth-foot">仅限 @zxpro.com.cn 邮箱访问<br>本页内容含客户案例，请勿对外转发</p>',
    '</div>'
  ].join('');

  // ── 闸门 ────────────────────────────────────────────────────
  function mountLogoutButton(email) {
    if (document.getElementById('zxLogoutBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'zxLogoutBtn';
    btn.className = 'zx-logout';
    btn.type = 'button';
    btn.textContent = (email || '已登录') + ' · 退出';
    btn.title = '退出登录';
    btn.addEventListener('click', function () {
      clearSession();
      location.reload();
    });
    document.body.appendChild(btn);
  }

  function showGate() {
    var gate = document.createElement('div');
    gate.id = 'zxAuthGate';
    gate.innerHTML = MARKUP;
    document.body.appendChild(gate);

    var form = gate.querySelector('#zxAuthForm');
    var emailInput = gate.querySelector('#zxAuthEmail');
    var pwdInput = gate.querySelector('#zxAuthPwd');
    var remember = gate.querySelector('#zxAuthRemember');
    var button = gate.querySelector('#zxAuthBtn');
    var message = gate.querySelector('#zxAuthMsg');

    setTimeout(function () { emailInput.focus(); }, 60);

    function fail(text, field) {
      message.textContent = text;
      if (field) { field.classList.add('zx-bad'); field.focus(); }
    }

    [emailInput, pwdInput].forEach(function (el) {
      el.addEventListener('input', function () {
        el.classList.remove('zx-bad');
        message.textContent = '';
      });
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var email = emailInput.value.trim();
      var pwd = pwdInput.value;

      if (!EMAIL_PATTERN.test(email)) {
        fail('请使用 @zxpro.com.cn 公司邮箱登录', emailInput);
        return;
      }
      button.disabled = true;
      button.textContent = '验证中…';
      try {
        var hash = await sha256Hex(pwd);
        if (hash !== PASSWORD_HASH) {
          fail('访问口令不正确，请重试', pwdInput);
          pwdInput.value = '';
          return;
        }
        writeSession(email.toLowerCase(), remember.checked);
        gate.remove();
        mountLogoutButton(email.toLowerCase());
      } catch (err) {
        fail('验证失败：' + err.message);
      } finally {
        button.disabled = false;
        button.textContent = '进入系统';
      }
    });
  }

  function boot() {
    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    var session = readSession();
    if (session) {
      mountLogoutButton(session.email);
    } else {
      showGate();
    }
  }

  // 供主应用取用当前登录人（个人成长看板等）
  window.ZXAuth = {
    currentUser: function () {
      var s = readSession();
      return s ? s.email : null;
    },
    logout: function () { clearSession(); location.reload(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
