/* 社保码 · 前台渲染 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const PRESETS = window.SHEBAO_PRESETS;

  function maskId(id) {
    if (!id) return '';
    if (id.length <= 7) return id;
    return id.slice(0, 3) + '********' + id.slice(-4);
  }

  function renderQR(el, text, cellSize) {
    if (!el) return;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text || 'shebao-code');
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: cellSize || 4, margin: cellSize ? cellSize * 2 : 8, scalable: true });
      const svg = el.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
      }
    } catch (e) {
      el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#93a1b3;font-size:12px">二维码生成失败</div>';
    }
  }

  function avatarNode(p) {
    if (p.avatarUrl) {
      const img = document.createElement('img');
      img.alt = p.name || '头像';
      img.src = p.avatarUrl;
      img.onerror = () => {
        img.replaceWith(useIcon('ic-person'));
      };
      return img;
    }
    return useIcon('ic-person');
  }

  function useIcon(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '/icons.svg#' + id);
    svg.appendChild(use);
    return svg;
  }

  function renderProfile(p, serverTime) {
    const preset = PRESETS[p.codeColor] || PRESETS.green;
    document.body.dataset.code = p.codeColor || 'green';

    const name = p.name || '张三';
    const idText = p.maskId === false ? p.idNumber : maskId(p.idNumber);

    ['#avatar', '#avatar-2'].forEach((sel) => {
      const box = $(sel);
      if (!box) return;
      box.innerHTML = '';
      box.appendChild(avatarNode(p));
    });

    $('#p-name').textContent = name;
    $('#p-name-2').textContent = name;
    $('#p-id').textContent = '身份证号 ' + idText;
    $('#p-id-2').textContent = idText;

    $('#tick').textContent = preset.icon;
    $('#status-word').textContent = p.statusTitle || preset.state;
    $('#status-desc').textContent = p.statusDesc || preset.desc;

    $('#m-status').textContent = p.insurerStatus || '正常';
    $('#m-type').textContent = p.insuranceType || '职工基本养老保险';
    $('#m-years').textContent = p.paidYears || '12年3个月';
    $('#m-type-2').textContent = p.insuranceType || '职工基本养老保险';
    $('#m-years-2').textContent = p.paidYears || '12年3个月';

    const reasonsWrap = $('#reasons');
    const list = (p.reasons || []).filter(Boolean);
    if (list.length) {
      reasonsWrap.classList.remove('hidden');
      $('#reasons-label').textContent = p.reasonsLabel || preset.reasonsLabel || '';
      $('#reasons-label').style.display = p.reasonsLabel || preset.reasonsLabel ? '' : 'none';
      $('#reasons-list').innerHTML = list.map((r) => '<li>' + escapeHtml(r) + '</li>').join('');
    } else {
      reasonsWrap.classList.add('hidden');
    }

    const note = $('#footer-note');
    if (p.footerNote) {
      note.classList.remove('hidden');
      note.textContent = p.footerNote;
    } else {
      note.classList.add('hidden');
    }

    $('#updated').textContent = '更新时间 ' + (p.updatedAt || serverTime || '');

    renderQR($('#qr'), p.qrText || p.idNumber || 'shebao-code', 4);

    const rec = $('#records');
    if (rec) {
      const rows = (p.serviceRecord || []).filter((r) => r && r.text);
      rec.innerHTML = rows.length
        ? rows
            .map(
              (r) =>
                '<div class="entry-row"><div class="ico"><svg><use href="/icons.svg#ic-card"></use></svg></div>' +
                '<div class="txt">' + escapeHtml(r.text) + '<small>' + escapeHtml(r.date) + '</small></div>' +
                '<span class="amt">' + escapeHtml(r.amount || '') + '</span></div>',
            )
            .join('')
        : '<div class="entry-row"><div class="txt">暂无缴费记录</div></div>';
    }

    renderColorCards(p.codeColor);
  }

  function renderColorCards(current) {
    const box = $('#color-cards');
    if (!box) return;
    const order = ['green', 'yellow', 'red'];
    box.innerHTML = order
      .map((key) => {
        const c = PRESETS[key];
        const hex = { green: '#12994c', yellow: '#eda016', red: '#e2494b' }[key];
        return (
          '<div class="color-card' + (key === current ? ' current' : '') + '" data-c="' + key + '" style="--c:' + hex + '">' +
          '<div class="cc-head">' + c.label + '<em>' + c.tag + '</em></div>' +
          '<div class="cc-body">' +
          '<div class="cc-qr" data-qr="' + key + '"></div>' +
          '<div class="cc-state">' + c.icon + ' ' + c.state + '</div>' +
          '<p class="cc-desc">' + c.desc + '</p>' +
          (c.reasons.length ? '<ul>' + c.reasons.map((r) => '<li>' + r + '</li>').join('') + '</ul>' : '') +
          (c.footerNote ? '<div class="cc-note">' + c.footerNote + '</div>' : '') +
          '</div></div>'
        );
      })
      .join('');
    order.forEach((key) => renderQR(box.querySelector('[data-qr="' + key + '"]'), 'SHEBAO-' + key.toUpperCase(), 2));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* tab 切换 */
  const tabbar = $('#tabbar');
  if (tabbar) {
    tabbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      const view = btn.dataset.view;
      tabbar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      ['home', 'service', 'me'].forEach((v) => {
        const el = document.getElementById('view-' + v);
        if (el) el.classList.toggle('hidden', v !== view);
      });
      const screen = document.querySelector('.phone-screen');
      if (screen) screen.scrollTop = 0;
    });
  }

  /* 拉取配置 */
  fetch('/api/profile')
    .then((r) => r.json())
    .then((data) => {
      if (data && data.ok && data.profile) renderProfile(data.profile, data.serverTime);
      else renderColorCards('green');
    })
    .catch(() => renderColorCards('green'));
})();
