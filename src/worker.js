/**
 * 社保码 demo — 全量运行在 Cloudflare Workers
 * 静态页面走 Assets，接口 + 配置数据走 KV。
 * 单用户登录：/admin 输入管理员口令，签发 HMAC 签名的会话 Cookie。
 */

const KV_PROFILE = 'profile';
const KV_AVATAR = 'avatar';
const COOKIE_NAME = 'sb_session';
const SESSION_TTL = 60 * 60 * 12; // 12 小时
const MAX_AVATAR = 512 * 1024;

const DEFAULT_PROFILE = {
  name: '张三',
  idNumber: '430101199001011234',
  maskId: true,
  avatarUrl: '',
  qrText: '',
  codeColor: 'green',
  statusTitle: '正常',
  statusDesc: '您的社保状态正常，可通行',
  insurerStatus: '正常',
  insuranceType: '职工基本养老保险',
  paidYears: '12年3个月',
  updatedAt: '',
  reasonsLabel: '',
  reasons: ['按时缴纳社保', '账户状态正常', '享受各项社保待遇'],
  footerNote: '',
  serviceRecord: [
    { date: '2026-10', text: '养老保险 · 个人缴费 已到账', amount: '¥ 1,028.40' },
    { date: '2026-09', text: '医疗保险 · 个人缴费 已到账', amount: '¥ 256.80' },
    { date: '2026-09', text: '养老保险 · 单位缴费 已到账', amount: '¥ 2,467.20' },
  ],
};

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------- 小工具 ---------- */

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

function b64url(bytes) {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

const authSecret = (env) => env.SESSION_SECRET || env.ADMIN_PASSWORD || 'shebao-dev-secret';

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function isAuthed(request, env) {
  const raw = getCookie(request, COOKIE_NAME);
  if (!raw) return false;
  const idx = raw.lastIndexOf('.');
  if (idx < 1) return false;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expect = await hmac(authSecret(env), payload);
  if (!timingSafeEqual(sig, expect)) return false;
  try {
    const data = JSON.parse(dec.decode(unb64url(payload)));
    return typeof data.exp === 'number' && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function issueSession(env) {
  const payload = b64url(
    enc.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL, sub: 'admin' })),
  );
  const sig = await hmac(authSecret(env), payload);
  return `${payload}.${sig}`;
}

const sessionCookie = (token, maxAge = SESSION_TTL) =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/* ---------- 数据读写 ---------- */

function normalizeProfile(input = {}) {
  const p = { ...DEFAULT_PROFILE, ...(input || {}) };
  p.name = String(p.name || '').slice(0, 40) || DEFAULT_PROFILE.name;
  p.idNumber = String(p.idNumber || '').slice(0, 32);
  p.maskId = p.maskId !== false;
  p.avatarUrl = String(p.avatarUrl || '').slice(0, 500);
  p.qrText = String(p.qrText || '').slice(0, 500);
  p.codeColor = ['green', 'yellow', 'red'].includes(p.codeColor) ? p.codeColor : 'green';
  p.statusTitle = String(p.statusTitle || '').slice(0, 20);
  p.statusDesc = String(p.statusDesc || '').slice(0, 120);
  p.insurerStatus = String(p.insurerStatus || '').slice(0, 40);
  p.insuranceType = String(p.insuranceType || '').slice(0, 60);
  p.paidYears = String(p.paidYears || '').slice(0, 40);
  p.updatedAt = String(p.updatedAt || '').slice(0, 40);
  p.reasonsLabel = String(p.reasonsLabel || '').slice(0, 20);
  p.reasons = Array.isArray(p.reasons)
    ? p.reasons.map((r) => String(r).slice(0, 120)).filter(Boolean).slice(0, 6)
    : [];
  p.footerNote = String(p.footerNote || '').slice(0, 80);
  p.serviceRecord = Array.isArray(p.serviceRecord)
    ? p.serviceRecord
        .slice(0, 20)
        .map((r) => ({
          date: String(r?.date || '').slice(0, 20),
          text: String(r?.text || '').slice(0, 80),
          amount: String(r?.amount || '').slice(0, 24),
        }))
    : [];
  return p;
}

async function readProfile(env) {
  const raw = await env.SB_KV.get(KV_PROFILE, 'json');
  return normalizeProfile(raw || {});
}

async function writeProfile(env, profile) {
  await env.SB_KV.put(KV_PROFILE, JSON.stringify(profile));
  return profile;
}

function stamp() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/* ---------- 路由 ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path.startsWith('/api/')) return await handleApi(request, env, path);
      if (path === '/avatar') return await handleAvatar(request, env);
      if (env.ASSETS) return await env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (err) {
      return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
    }
  },
};

async function handleApi(request, env, path) {
  const method = request.method.toUpperCase();

  /* --- 公开：前台展示数据 --- */
  if (path === '/api/profile' && method === 'GET') {
    const profile = await readProfile(env);
    return json({ ok: true, profile, serverTime: stamp() });
  }

  /* --- 会话 --- */
  if (path === '/api/session' && method === 'GET') {
    return json({ ok: true, authed: await isAuthed(request, env), hasPassword: !!env.ADMIN_PASSWORD });
  }

  if (path === '/api/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) {
      return json({ ok: false, error: '站点未配置管理员口令（ADMIN_PASSWORD）' }, { status: 503 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch {}
    const pass = String(body?.password || '');
    if (!timingSafeEqual(await hmac(authSecret(env), pass), await hmac(authSecret(env), String(env.ADMIN_PASSWORD)))) {
      await new Promise((r) => setTimeout(r, 400));
      return json({ ok: false, error: '口令不正确' }, { status: 401 });
    }
    return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(await issueSession(env)) } });
  }

  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0) } });
  }

  /* --- 以下需要登录 --- */
  if (path.startsWith('/api/admin/')) {
    if (!(await isAuthed(request, env))) {
      return json({ ok: false, error: '未登录或会话已过期' }, { status: 401 });
    }

    if (path === '/api/admin/profile' && method === 'GET') {
      return json({ ok: true, profile: await readProfile(env), serverTime: stamp() });
    }

    if (path === '/api/admin/profile' && method === 'PUT') {
      let body = {};
      try {
        body = await request.json();
      } catch {}
      const incoming = { ...(body?.profile || {}) };
      if (!incoming.updatedAt) incoming.updatedAt = stamp();
      const profile = await writeProfile(env, normalizeProfile(incoming));
      return json({ ok: true, profile });
    }

    if (path === '/api/admin/reset' && method === 'POST') {
      const profile = await writeProfile(env, normalizeProfile({}));
      await env.SB_KV.delete(KV_AVATAR);
      return json({ ok: true, profile });
    }

    if (path === '/api/admin/avatar' && method === 'POST') {
      const type = request.headers.get('content-type') || 'image/png';
      if (!type.startsWith('image/')) return json({ ok: false, error: '只支持图片' }, { status: 400 });
      const buf = await request.arrayBuffer();
      if (!buf.byteLength) return json({ ok: false, error: '空文件' }, { status: 400 });
      if (buf.byteLength > MAX_AVATAR) return json({ ok: false, error: '头像请小于 512KB' }, { status: 413 });
      await env.SB_KV.put(KV_AVATAR, buf, { metadata: { type } });
      const profile = await readProfile(env);
      profile.avatarUrl = `/avatar?v=${Date.now()}`;
      await writeProfile(env, profile);
      return json({ ok: true, avatarUrl: profile.avatarUrl });
    }

    if (path === '/api/admin/avatar' && method === 'DELETE') {
      await env.SB_KV.delete(KV_AVATAR);
      const profile = await readProfile(env);
      profile.avatarUrl = '';
      await writeProfile(env, profile);
      return json({ ok: true });
    }

    return json({ ok: false, error: '未知接口' }, { status: 404 });
  }

  return json({ ok: false, error: '未知接口' }, { status: 404 });
}

async function handleAvatar(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const { value, metadata } = await env.SB_KV.getWithMetadata(KV_AVATAR, 'arrayBuffer');
  if (!value) return new Response('No avatar', { status: 404 });
  return new Response(value, {
    headers: {
      'content-type': metadata?.type || 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
