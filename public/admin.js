/* 社保码 · 管理后台 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const PRESETS = window.SHEBAO_PRESETS;

  let state = { profile: null, color: 'green', dirtyColor: false };

  const F = {
    statusTitle: $('#statusTitle'),
    statusDesc: $('#statusDesc'),
    reasons: $('#reasons'),
    reasonsLabel: $('#reasonsLabel'),
    footerNote: $('#footerNote'),
    name: $('#name'),
    idNumber: $('#idNumber'),
    maskId: $('#maskId'),
    qrText: $('#qrText'),
    insurerStatus: $('#insurerStatus'),
    insuranceType: $('#insuranceType'),
    paidYears: $('#paidYears'),
    updatedAt: $('#updatedAt'),
    serviceRecord: $('#serviceRecord'),
  };

  /* ---------- 通用 ---------- */

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
    return data;
  }

  function showPanel(authed) {
    $('#login-panel').classList.toggle('hidden', authed);
    $('#panel').classList.toggle('hidden', !authed);
  }

  /* ---------- 表单 ---------- */

  function fillForm(p) {
    state.profile = p;
    state.color = p.codeColor || 'green';
    F.statusTitle.value = p.statusTitle || '';
    F.statusDesc.value = p.statusDesc || '';
    F.reasons.value = (p.reasons || []).join('\n');
    F.reasonsLabel.value = p.reasonsLabel || '';
    F.footerNote.value = p.footerNote || '';
    F.name.value = p.name || '';
    F.idNumber.value = p.idNumber || '';
    F.maskId.checked = p.maskId !== false;
    F.qrText.value = p.qrText || '';
    F.insurerStatus.value = p.insurerStatus || '';
    F.insuranceType.value = p.insuranceType || '';
    F.paidYears.value = p.paidYears || '';
    F.updatedAt.value = p.updatedAt || '';
    F.serviceRecord.value = (p.serviceRecord || [])
      .map((r) => [r.date, r.text, r.amount].filter(Boolean).join(' | '))
      .join('\n');
    paintSwatches();
    paintAvatar(p.avatarUrl);
  }

  function paintSwatches() {
    document.querySelectorAll('.swatch').forEach((el) => el.classList.toggle('on', el.dataset.c === state.color));
  }

  function paintAvatar(url) {
    const box = $('#avatar-preview');
    box.innerHTML = '';
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      box.appendChild(img);
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '/icons.svg#ic-person');
      svg.appendChild(use);
      box.appendChild(svg);
    }
  }

  function applyPreset(key) {
    const c = PRESETS[key];
    state.color = key;
    F.statusTitle.value = c.state;
    F.statusDesc.value = c.desc;
    F.reasonsLabel.value = c.reasonsLabel;
    F.reasons.value = c.reasons.join('\n');
    F.footerNote.value = c.footerNote;
    paintSwatches();
  }

  function collect() {
    const record = F.serviceRecord.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [date = '', text = '', amount = ''] = line.split('|').map((s) => s.trim());
        return { date, text, amount };
      });

    return {
      name: F.name.value.trim(),
      idNumber: F.idNumber.value.trim(),
      maskId: F.maskId.checked,
      avatarUrl: (state.profile && state.profile.avatarUrl) || '',
      qrText: F.qrText.value.trim(),
      codeColor: state.color,
      statusTitle: F.statusTitle.value.trim(),
      statusDesc: F.statusDesc.value.trim(),
      reasonsLabel: F.reasonsLabel.value.trim(),
      reasons: F.reasons.value.split('\n').map((s) => s.trim()).filter(Boolean),
      footerNote: F.footerNote.value.trim(),
      insurerStatus: F.insurerStatus.value.trim(),
      insuranceType: F.insuranceType.value.trim(),
      paidYears: F.paidYears.value.trim(),
      updatedAt: F.updatedAt.value.trim(),
      serviceRecord: record,
    };
  }

  /* ---------- 事件 ---------- */

  $('#login-btn').addEventListener('click', login);
  $('#password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });

  async function login() {
    const btn = $('#login-btn');
    btn.disabled = true;
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: $('#password').value }),
      });
      $('#password').value = '';
      toast('登录成功');
      await boot();
    } catch (err) {
      toast(err.message || '登录失败', true);
    } finally {
      btn.disabled = false;
    }
  }

  $('#logout-btn').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch {}
    showPanel(false);
    toast('已退出登录');
  });

  document.querySelectorAll('.swatch').forEach((el) => {
    el.addEventListener('click', () => applyPreset(el.dataset.c));
  });

  $('#save-btn').addEventListener('click', async () => {
    const btn = $('#save-btn');
    btn.disabled = true;
    try {
      const data = await api('/api/admin/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: collect() }),
      });
      state.profile = data.profile;
      fillForm(data.profile);
      toast('已保存并生效');
    } catch (err) {
      toast(err.message || '保存失败', true);
    } finally {
      btn.disabled = false;
    }
  });

  $('#reload-btn').addEventListener('click', async () => {
    try {
      const data = await api('/api/admin/profile');
      fillForm(data.profile);
      toast('已还原为线上配置');
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#reset-btn').addEventListener('click', async () => {
    if (!confirm('恢复为默认演示数据？当前配置会被覆盖。')) return;
    try {
      const data = await api('/api/admin/reset', { method: 'POST' });
      fillForm(data.profile);
      toast('已恢复默认');
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#avatar-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast('头像请小于 512KB', true);
      e.target.value = '';
      return;
    }
    try {
      const res = await fetch('/api/admin/avatar', {
        method: 'POST',
        headers: { 'content-type': file.type || 'image/png' },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      state.profile.avatarUrl = data.avatarUrl;
      paintAvatar(data.avatarUrl);
      toast('头像已更新');
    } catch (err) {
      toast(err.message, true);
    } finally {
      e.target.value = '';
    }
  });

  $('#avatar-clear').addEventListener('click', async () => {
    try {
      await api('/api/admin/avatar', { method: 'DELETE' });
      if (state.profile) state.profile.avatarUrl = '';
      paintAvatar('');
      toast('头像已移除');
    } catch (err) {
      toast(err.message, true);
    }
  });

  /* ---------- 启动 ---------- */

  async function boot() {
    try {
      const s = await api('/api/session');
      if (!s.authed) {
        showPanel(false);
        if (!s.hasPassword) toast('站点尚未配置管理员口令', true);
        return;
      }
      const data = await api('/api/admin/profile');
      fillForm(data.profile);
      showPanel(true);
    } catch (err) {
      showPanel(false);
      toast(err.message || '加载失败', true);
    }
  }

  boot();
})();
