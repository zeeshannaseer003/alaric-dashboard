'use strict';
/* =====================================================================
   Alaric dashboard  -  app.js  (clean build)
   Needs in index.html: supabase-js v2 loaded BEFORE this file, and the
   same element IDs as before (authScreen, app, side, c, loginId, ...).
   ===================================================================== */

/* ---------- Config ---------- */
const SUPABASE_URL = 'https://kucenxfhkiqfxqrytbye.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_alyK2HPCzMysVlSaHgKmrg_KBBnp_6K'; // publishable key: OK in frontend
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAILS = ['zeeshannaseer003@gmail.com'];

/* ---------- Tiny helpers ---------- */
const $ = (id) => document.getElementById(id);
const isAdminEmail = (email) => ADMIN_EMAILS.indexOf(String(email || '').toLowerCase().trim()) >= 0;
const uid = () => 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmtDate = (s) => String(s || '').slice(0, 10);
const byCreated = (a, b) => String(a.created || '').localeCompare(String(b.created || ''));
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

function toast(msg, type) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = (type === 'error' ? '⚠ ' : '✓ ') + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 4500 : 2800);
}

/* ---------- Password helpers ---------- */
const isStrongPassword = (pw) => pw.length >= 8 && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

function updatePwStrength(pw) {
  const bar = $('pwBar'), hint = $('pwHint');
  if (!bar) return;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  bar.style.width = (s / 4) * 100 + '%';
  bar.style.background = s < 2 ? '#ef4444' : s < 3 ? '#f59e0b' : '#22c55e';
  if (hint) hint.textContent = s < 2 ? 'Weak' : s < 3 ? 'Medium' : 'Strong';
}

/* ---------- Auth messages ---------- */
function hideAuthMsg() {
  $('authError').classList.remove('show');
  $('authSuccess').classList.remove('show');
}
function showAuthMsg(kind, msg) {
  hideAuthMsg();
  const e = $(kind === 'error' ? 'authError' : 'authSuccess');
  e.textContent = msg;
  e.classList.add('show');
}
const showAuthError = (m) => showAuthMsg('error', m);
const showAuthSuccess = (m) => showAuthMsg('success', m);

function friendlyAuthError(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.indexOf('rate limit') > -1) return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.indexOf('not confirmed') > -1) return 'Email not confirmed yet. Check your inbox for the confirmation link.';
  if (m.indexOf('invalid login') > -1 || m.indexOf('invalid credentials') > -1) return 'Wrong email or password.';
  if (m.indexOf('already registered') > -1 || m.indexOf('already been registered') > -1) return 'Email already registered. Login or use Forgot password.';
  return msg || 'Something went wrong.';
}

function showAuthPanel(mode) {
  $('loginForm').style.display = mode === 'login' ? '' : 'none';
  $('signupForm').style.display = mode === 'signup' ? '' : 'none';
  $('forgotForm').style.display = mode === 'forgot' ? '' : 'none';
  $('authTabs').style.display = mode === 'forgot' ? 'none' : '';
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === mode));
  hideAuthMsg();
}

/* run a button action with a busy label */
async function withBusy(btn, busyText, idleText, fn) {
  btn.disabled = true;
  btn.textContent = busyText;
  try { await fn(); }
  catch (err) { showAuthError(friendlyAuthError(err.message)); }
  finally { btn.disabled = false; btn.textContent = idleText; }
}

async function doLogin() {
  hideAuthMsg();
  const email = $('loginId').value.trim(), pw = $('loginPw').value;
  if (!email || !pw) return showAuthError('Enter email and password.');
  await withBusy($('loginBtn'), 'Signing in...', 'Login', async () => {
    const res = await sb.auth.signInWithPassword({ email, password: pw });
    if (res.error) return showAuthError(friendlyAuthError(res.error.message));
    await enterApp(res.data.user);
  });
}

async function doSignup() {
  hideAuthMsg();
  const first = $('suFirst').value.trim(), last = $('suLast').value.trim();
  const email = $('suId').value.trim(), pw = $('suPw').value, spec = $('suSpec').value;
  if (!first || !last) return showAuthError('First and last name required.');
  if (!email) return showAuthError('Email required.');
  if (!isStrongPassword(pw)) return showAuthError('Password: 8+ chars, a number and a symbol.');
  if (!spec) return showAuthError('Select a specialty.');
  await withBusy($('signupBtn'), 'Creating...', 'Create Account', async () => {
    const res = await sb.auth.signUp({
      email, password: pw,
      options: { data: { first_name: first, last_name: last, specialty: spec, role: 'member' } }
    });
    if (res.error) return showAuthError(friendlyAuthError(res.error.message));
    if (res.data.user && res.data.session) {
      // profile row is created inside enterApp()
      showAuthSuccess('Account created!');
      setTimeout(() => enterApp(res.data.user), 500);
    } else {
      showAuthSuccess('Account created. Confirm your email if asked, then login.');
      setTimeout(() => { showAuthPanel('login'); $('loginId').value = email; }, 1800);
    }
  });
}

async function doForgot() {
  hideAuthMsg();
  const email = $('fpId').value.trim();
  if (!email) return showAuthError('Enter email.');
  await withBusy($('resetBtn'), 'Sending...', 'Send Reset Link', async () => {
    const res = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + (window.location.pathname || '/')
    });
    if (res.error) return showAuthError(friendlyAuthError(res.error.message));
    showAuthSuccess('If this email exists, a reset link was sent.');
  });
}

/* ---------- Data layer (cloud = Supabase, otherwise localStorage) ---------- */
let useCloud = false;
const cache = { profiles: [], posts: [], comments: [], likes: [], chat: [], requests: [] };
let requestsTable = true; // false when the service_requests table does not exist yet
const lsKey = (k) => 'alaric_v2_' + k;
const saveLocal = (k) => localStorage.setItem(lsKey(k), JSON.stringify(cache[k]));

const TABLES = {
  profiles: {
    table: 'profiles',
    // photo is NOT selected here on purpose (big base64); own photo is loaded separately
    cols: 'id,email,first_name,last_name,specialty,role,status,created_at',
    from: (p) => ({ id: p.id, email: p.email, first: p.first_name, last: p.last_name, specialty: p.specialty, role: p.role || 'member', status: p.status || 'pending', photo: p.photo || '', created: p.created_at })
  },
  posts: {
    table: 'posts', order: ['created_at', false],
    from: (p) => ({ id: p.id, user_id: p.user_id, title: p.title, body: p.body, visibility: p.visibility || 'members', created: p.created_at }),
    to: (p) => ({ user_id: p.user_id, title: p.title, body: p.body, visibility: p.visibility || 'members' })
  },
  comments: {
    table: 'comments', order: ['created_at', true],
    from: (c) => ({ id: c.id, post_id: c.post_id, user_id: c.user_id, body: c.body, created: c.created_at }),
    to: (c) => ({ post_id: c.post_id, user_id: c.user_id, body: c.body })
  },
  likes: {
    table: 'likes',
    from: (l) => ({ post_id: l.post_id, user_id: l.user_id })
  },
  chat: {
    table: 'chat_messages', order: ['created_at', true],
    from: (m) => ({ id: m.id, user_id: m.user_id, body: m.body, created: m.created_at }),
    to: (m) => ({ user_id: m.user_id, body: m.body })
  },
  requests: {
    table: 'service_requests', order: ['created_at', false],
    from: (r) => ({ id: r.id, user_id: r.user_id, name: r.name, email: r.email, service: r.service, specialty: r.specialty || '', issues: r.issues || '', needs: r.needs || '', phone: r.phone || '', tz: r.tz || '', slot1: r.slot1, slot2: r.slot2, status: r.status || 'new', acceptedSlot: r.accepted_slot, adminNote: r.admin_note || '', created: r.created_at }),
    to: (r) => ({ user_id: r.user_id, name: r.name, email: r.email, service: r.service, specialty: r.specialty, issues: r.issues, needs: r.needs, phone: r.phone, tz: r.tz, slot1: r.slot1, slot2: r.slot2 })
  }
};

async function detectCloud() {
  try { const r = await sb.from('profiles').select('id').limit(1); useCloud = !r.error; }
  catch (e) { useCloud = false; }
  return useCloud;
}

async function loadAllData(selfId) {
  const kinds = Object.keys(TABLES);
  if (!useCloud) {
    kinds.forEach((k) => {
      try { cache[k] = JSON.parse(localStorage.getItem(lsKey(k)) || '[]'); } catch (e) { cache[k] = []; }
    });
    return;
  }
  await Promise.all(kinds.map(async (k) => {
    const t = TABLES[k];
    let q = sb.from(t.table).select(t.cols || '*');
    if (t.order) q = q.order(t.order[0], { ascending: t.order[1] });
    const r = await q;
    if (r.error) { console.error('load ' + k, r.error); if (k === 'requests') requestsTable = false; return; } // keep old cache on error
    cache[k] = (r.data || []).map(t.from);
    if (k === 'requests') requestsTable = true;
  }));
  // load only my own photo
  if (selfId) {
    const r = await sb.from('profiles').select('photo').eq('id', selfId).maybeSingle();
    const me = getProfile(selfId);
    if (me && r.data) me.photo = r.data.photo || '';
  }
}

const getProfiles = () => cache.profiles;
const getProfile = (id) => cache.profiles.find((x) => x.id === id);
const getPosts = () => cache.posts;
const getComments = () => cache.comments;
const getLikes = () => cache.likes;
const getChat = () => cache.chat;

/* profile save: sends ONLY the fields you pass; rolls back cache if the DB refuses */
const PROFILE_COLS = { email: 'email', first: 'first_name', last: 'last_name', specialty: 'specialty', role: 'role', status: 'status', photo: 'photo' };

async function saveProfile(patch, opts) {
  opts = opts || {};
  if (!patch || !patch.id) return false;
  const prev = getProfile(patch.id);
  const snapshot = prev ? Object.assign({}, prev) : null;
  const isNew = !prev;
  const merged = Object.assign({ role: 'member', status: 'pending' }, prev || {}, patch);
  const i = cache.profiles.findIndex((x) => x.id === patch.id);
  if (i >= 0) cache.profiles[i] = merged; else cache.profiles.push(merged);

  if (!useCloud) { saveLocal('profiles'); return true; }

  const row = { id: patch.id };
  Object.keys(PROFILE_COLS).forEach((k) => { if (k in patch) row[PROFILE_COLS[k]] = patch[k] || null; });
  if (isNew) { row.role = merged.role || 'member'; row.status = merged.status || 'pending'; }

  const r = await sb.from('profiles').upsert(row, { onConflict: 'id', ignoreDuplicates: !!opts.createOnly });
  if (r.error) {
    // roll back the optimistic change
    if (snapshot) cache.profiles[i >= 0 ? i : cache.profiles.length - 1] = snapshot;
    else cache.profiles = cache.profiles.filter((x) => x.id !== patch.id);
    toast(r.error.message, 'error');
    return false;
  }
  return true;
}

async function addRecord(kind, row) {
  const t = TABLES[kind];
  if (useCloud) {
    const r = await sb.from(t.table).insert(t.to(row)).select().single();
    if (r.error) { toast(r.error.message, 'error'); return null; }
    row = t.from(r.data);
  } else {
    row = Object.assign({}, row, { id: uid(), created: new Date().toISOString() });
  }
  if (kind === 'posts') cache.posts.unshift(row); else cache[kind].push(row);
  if (!useCloud) saveLocal(kind);
  return row;
}

async function deletePost(pid) {
  if (useCloud) {
    for (const tbl of ['likes', 'comments']) {
      const r = await sb.from(tbl).delete().eq('post_id', pid);
      if (r.error) { toast(r.error.message, 'error'); return false; }
    }
    const r = await sb.from('posts').delete().eq('id', pid);
    if (r.error) { toast(r.error.message, 'error'); return false; }
  }
  cache.posts = cache.posts.filter((p) => p.id !== pid);
  cache.comments = cache.comments.filter((c) => c.post_id !== pid);
  cache.likes = cache.likes.filter((l) => l.post_id !== pid);
  if (!useCloud) ['posts', 'comments', 'likes'].forEach(saveLocal);
  return true;
}

async function toggleLike(postId, userId) {
  const i = cache.likes.findIndex((l) => l.post_id === postId && l.user_id === userId);
  const had = i >= 0;
  if (had) cache.likes.splice(i, 1); else cache.likes.push({ post_id: postId, user_id: userId });
  if (!useCloud) return saveLocal('likes');
  const q = sb.from('likes');
  const r = had ? await q.delete().eq('post_id', postId).eq('user_id', userId) : await q.insert({ post_id: postId, user_id: userId });
  if (r.error) { // undo
    if (had) cache.likes.push({ post_id: postId, user_id: userId });
    else cache.likes = cache.likes.filter((l) => !(l.post_id === postId && l.user_id === userId));
    toast(r.error.message, 'error');
  }
}

/* ---------- Session / roles ---------- */
let currentUser = null, role = 'member', status = 'pending', entering = false;

const isAdmin = () => role === 'admin';
const isOfficial = () => role === 'admin' || role === 'staff' || role === 'official';
const isApproved = () => status === 'approved' || isAdmin();

function userFromSession(user) {
  const m = user.user_metadata || {}, local = getProfile(user.id) || {}, em = user.email || '';
  let r = 'member';
  if (isAdminEmail(em)) r = 'admin';
  else if (local.role === 'admin' || local.role === 'official' || local.role === 'staff') r = local.role;
  let st = local.status;
  if (!st) st = (r === 'admin' || r === 'official') ? 'approved' : 'pending';
  return {
    id: user.id, email: em,
    first: m.first_name || local.first || (em ? em.split('@')[0] : 'User'),
    last: m.last_name || local.last || '',
    specialty: m.specialty || local.specialty || '',
    role: r, status: st
  };
}

async function enterApp(user) {
  if (entering) return;
  entering = true;
  try {
    await detectCloud();
    await loadAllData(user.id);
    currentUser = userFromSession(user);
    if (isAdminEmail(currentUser.email)) { currentUser.role = 'admin'; currentUser.status = 'approved'; }
    role = currentUser.role; status = currentUser.status;

    const existing = getProfile(currentUser.id);
    if (!existing) {
      // first login: create row (never overwrites an existing one)
      await saveProfile({ id: currentUser.id, email: currentUser.email, first: currentUser.first, last: currentUser.last, specialty: currentUser.specialty, role, status }, { createOnly: true });
    } else if (isAdminEmail(currentUser.email) && (existing.role !== 'admin' || existing.status !== 'approved')) {
      await saveProfile({ id: currentUser.id, role: 'admin', status: 'approved' });
    }

    page = null;
    $('authScreen').style.display = 'none';
    $('app').classList.add('show');
    render({ keepScroll: false });
    toast('Welcome, ' + currentUser.first + (isAdmin() ? (useCloud ? ' · live shared mode' : ' · local mode (run supabase-setup.sql)') : '') + '!');
  } finally { entering = false; }
}

function resetSession() {
  currentUser = null; role = 'member'; status = 'pending'; page = null;
  Object.keys(cache).forEach((k) => { cache[k] = []; });
  $('app').classList.remove('show');
  $('authScreen').style.display = '';
  hideAuthMsg();
}
async function logout() { await sb.auth.signOut(); resetSession(); }

/* ---------- Display helpers ---------- */
function roleBadge(p) {
  if (!p) return '<span class="badge-role member">Member</span>';
  if (p.role === 'admin') return '<span class="badge-role admin">Admin</span>';
  if (p.role === 'official' || p.role === 'staff') return '<span class="badge-role official">Official</span>';
  if (p.status === 'approved') return '<span class="badge-role verified">Verified</span>';
  if (p.status === 'pending') return '<span class="badge-role pending">Pending</span>';
  if (p.status === 'rejected') return '<span class="badge-role pending">Rejected</span>';
  return '<span class="badge-role member">Member</span>';
}
function publicName(userId) {
  const p = getProfile(userId);
  if (!p) return 'Member';
  return (p.first || 'Member') + (p.last ? ' ' + p.last.charAt(0) + '.' : '');
}
const publicSpec = (userId) => (getProfile(userId) || {}).specialty || '';
const authorRole = (userId) => (getProfile(userId) || {}).role || 'member';
const fullName = (p) => ((p.first || '') + ' ' + (p.last || '')).trim();
const pendingList = () => getProfiles().filter((p) => p.status === 'pending' && !isAdminEmail(p.email));

function accessBanner() {
  if (isApproved()) return '';
  if (status === 'rejected') return '<div class="pending-banner"><b>Not approved.</b> Your account was not approved. Please contact the admin.</div>';
  return '<div class="pending-banner"><b>Approval pending.</b> Admin approve karega. Uske baad aap question post kar sakte ho — woh aapko, doosre members ko, aur admin ko dikhegi.</div>';
}

function canSeePost(post) {
  if (isAdmin()) return true;
  if (post.user_id === currentUser.id) return true;
  if (post.visibility === 'private') return false;
  if (!isApproved()) return false;
  if (post.visibility === 'official') return isOfficial();
  return authorRole(post.user_id) === 'member';
}

/* ---------- Direct messages (stored in chat table with a @@to:<uuid>@@ prefix) ---------- */
const encodeDM = (to, text) => '@@to:' + to + '@@' + text;
function dmParse(body) {
  const m = /^@@to:([0-9a-fA-F-]{36})@@([\s\S]*)$/.exec(body || '');
  return m ? { to: m[1], text: m[2] } : null;
}
const isAdminProfile = (p) => p.role === 'admin' || isAdminEmail(p.email);
const adminIds = () => new Set(getProfiles().filter(isAdminProfile).map((p) => p.id));
function primaryAdmin() {
  const all = getProfiles().filter(isAdminProfile);
  return all.find((p) => isAdminEmail(p.email)) || all[0] || null;
}
function threadMsgs(memberId) {
  const ids = adminIds();
  return getChat().filter((m) => {
    const d = dmParse(m.body);
    if (!d) return false;
    if (m.user_id === memberId) return ids.has(d.to);
    return d.to === memberId && ids.has(m.user_id);
  }).sort(byCreated);
}
function senderLabel(m) {
  if (m.user_id === currentUser.id) return 'You';
  return adminIds().has(m.user_id) ? 'Admin' : publicName(m.user_id);
}
function chatBubble(m, label) {
  const d = dmParse(m.body), mine = m.user_id === currentUser.id;
  return '<div class="chat-msg" style="' + (mine ? 'margin-left:18%' : 'margin-right:18%') + '"><div class="who">' + esc(label || senderLabel(m)) + '</div><div>' + esc(d ? d.text : '') + '</div></div>';
}

/* ---------- Navigation ---------- */
let page = null;
const PAGES = {
  seeAll:    { label: 'See all',          fn: pageSeeAll },
  approvals: { label: 'Approvals',        fn: pageAdminOverview, pending: true },
  members:   { label: 'Members',          fn: pageAdminMembers,  pending: true },
  home:      { label: 'Home',             fn: pageMemberHome },
  feed:      { label: () => isAdmin() ? 'All Questions' : 'Questions', fn: pageFeed },
  ask:       { label: 'Ask Question',     fn: pageNewPost },
  chat:      { label: () => isAdmin() ? 'Member Chat' : 'Admin Chat', fn: pageChat },
  premium:   { label: 'Premium Services', fn: pagePremiumServices },
  services:  { label: 'Services',         fn: pageAdminServices, reqs: true },
  request:   { label: 'Request',          fn: pageRequest, hidden: true },
  myRequests:{ label: 'My Requests',      fn: pageMyRequests },
  profile:   { label: 'My Profile',       fn: pageProfile }
};
const NAV_ADMIN = [
  ['Control', ['seeAll', 'approvals', 'members', 'services']],
  ['Community', ['feed', 'chat']],
  ['Services', ['premium']],
  ['Account', ['profile']]
];
const NAV_MEMBER = [
  ['Community', ['home', 'feed', 'ask', 'chat']],
  ['Services', ['premium', 'myRequests']],
  ['Account', ['profile']]
];

function render(opts) {
  if (!currentUser) return;
  const keep = !opts || opts.keepScroll !== false;
  const main = $('c'), sy = window.scrollY, st = main.scrollTop;
  const groups = isAdmin() ? NAV_ADMIN : NAV_MEMBER;
  const visible = groups.reduce((a, g) => a.concat(g[1]), []);
  if (visible.indexOf(page) < 0 && !(PAGES[page] && PAGES[page].hidden)) page = visible[0];

  const me = getProfile(currentUser.id) || { role, status };
  const letter = (currentUser.first || '?')[0].toUpperCase();
  const pend = pendingList().length, newReqs = cache.requests.filter((r) => r.status === 'new').length;

  let h = '<div class="logo"><div class="logo-icon">A</div><div><div>Alaric</div><div class="logo-kicker">' + (isAdmin() ? 'Admin panel' : 'Member') + '</div></div></div>';
  h += '<div class="user-info"><div class="av">' + (me.photo ? '<img src="' + esc(me.photo) + '" alt="">' : esc(letter)) + '</div><div><div class="name">' + esc(fullName(currentUser)) + '</div><div style="margin-top:4px">' + roleBadge(me) + (currentUser.specialty ? ' <span style="color:var(--muted);font-size:.75rem">' + esc(currentUser.specialty) + '</span>' : '') + '</div></div></div>';
  groups.forEach((g) => {
    h += '<div class="nav-sec">' + g[0] + '</div>';
    g[1].forEach((key) => {
      const def = PAGES[key];
      const label = typeof def.label === 'function' ? def.label() : def.label;
      h += '<button class="nav' + (key === page ? ' on' : '') + '" data-act="nav" data-id="' + key + '">' + esc(label);
      const n = def.pending ? pend : def.reqs ? newReqs : 0;
      if (n && isAdmin()) h += '<span class="badge">' + n + '</span>';
      h += '</button>';
    });
  });
  h += '<button class="logout-btn" data-act="logout">Logout</button>';

  const side = $('side');
  side.classList.toggle('is-admin', isAdmin());
  side.innerHTML = h;

  const top = isAdmin() ? '<div class="admin-top"><div><b>Admin panel</b><span>Full access · members, questions, private chats</span></div><span class="pill warn">Admin</span></div>' : '';
  main.innerHTML = top + PAGES[page].fn();

  if (keep) { main.scrollTop = st; window.scrollTo(0, sy); }
  const cb = document.querySelector('.chat-box');
  if (cb) cb.scrollTop = cb.scrollHeight;
}
function goTo(key) { page = key; render({ keepScroll: false }); window.scrollTo(0, 0); }

/* ---------- Pages ---------- */
const SERVICES = [
  {
    id: 'billing', icon: '💰', name: 'Medical Billing Package', featured: true,
    blurb: 'Full billing suite under one rate',
    pricing: [
      { amount: '5%', unit: 'of collections', note: 'Everything below is included' },
      { pre: 'or', amount: '$15', unit: '/ hour' }
    ],
    features: ['Medical Billing Services', 'Medical Coding', 'Claim Rejection Handling', 'Accounts Receivable Management', 'Denial Management', 'Payment Posting', 'Patient Billing and Statements', 'EOB and ERA Posting', 'Insurance Verification and Benefits Verification', 'Prior Authorization']
  },
  {
    id: 'cred', icon: '📋', name: 'Medical Credentialing',
    blurb: 'Initial, re-credentialing, enrollment and maintenance',
    pricing: [{ amount: '$150', unit: '/ application', note: 'One-time per application' }],
    features: ['Initial Setup and Document Collection', 'CAQH Profile Management', 'Primary Source Verification', 'Insurance Payer Applications', 'Medicare and Medicaid Enrollment', 'Group Linking and Practice Locations', 'Application Follow Up and Corrections', 'Approval and Enrollment Confirmation', 'Post Enrollment Setup', 'Ongoing Maintenance']
  },
  {
    id: 'va', icon: '🖥️', name: 'Medical Virtual Assistance and Patient Help Desk',
    blurb: 'Full-time dedicated VA for your front desk and patient support',
    pricing: [
      { amount: '$1,500', unit: '/ month flat fee', note: 'Dedicated VA · 5 days/week × 9 hrs/day' },
      { pre: 'or', amount: '$10', unit: '/ hour' }
    ],
    features: [
      'Patient Communication and Call Management',
      'Appointment Scheduling, Confirmation and Follow Up',
      'Patient Registration, Intake and Demographic Updates',
      'Insurance Eligibility, Benefits Verification and Referral Coordination',
      'Patient Help Desk, Inquiries and Complaint Resolution',
      'EHR and EMR Management and Medical Data Entry',
      'Prescription Refill Requests and Lab Test Coordination',
      'Medical Records, Documentation and Patient Portal Support',
      'Billing Inquiries, Payment Support and Claims Follow Up',
      'Telehealth Support, Patient Recall, Escalations and After Hours Assistance'
    ]
  },
  {
    id: 'digital', icon: '🚀', name: 'Digital Marketing, Social Media Marketing and Website Development',
    blurb: 'Your website, search ranking, ads and social media managed by one team',
    pricing: [
      { amount: '$700', unit: 'first month', note: 'Website development and initial setup' },
      { pre: 'then', amount: '$500', unit: '/ month', note: 'Ongoing digital marketing and social media management, starting from the second month' }
    ],
    features: [
      'Website Design, Development and Mobile Responsiveness',
      'Website Maintenance, Speed Optimization and Technical Support',
      'Landing Pages, Contact Forms and Appointment Booking Integration',
      'Search Engine Optimization (SEO) and Google Business Profile Optimization',
      'Google Ads Management and Paid Advertising Campaigns',
      'Social Media Account Setup and Profile Optimization',
      'Facebook, Instagram and LinkedIn Page Management',
      'Social Media Content Creation, Graphic Design and Promotional Posts',
      'Reels, Short Video Content and Content Scheduling',
      'Social Media Advertising, Audience Targeting and Lead Generation',
      'Email Marketing, Healthcare Content Marketing and Online Reputation Management',
      'Marketing Analytics, Performance Tracking and Monthly Reporting'
    ]
  }
];

/* ---------- Service requests: free 15-minute consultation form ---------- */
const SPECIALTIES = ['Behavioral Health / Psychiatry', 'Family Medicine', 'Internal Medicine', 'Pediatrics', 'Cardiology', 'Dermatology', 'Orthopedics', 'OB/GYN', 'Neurology', 'Gastroenterology', 'Physical Therapy / Rehab', 'Chiropractic', 'Dentistry', 'Urgent Care', 'Other'];
const SVC_SEP = ' | ';
const splitServices = (s) => String(s || '').split(SVC_SEP).map((x) => x.trim()).filter(Boolean);
const pad2 = (n) => String(n).padStart(2, '0');
const dtLocal = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
function localTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }
function fmtInTz(iso, tz) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const o = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
  try { return d.toLocaleString('en-US', tz ? Object.assign({ timeZone: tz }, o) : o) + (tz ? ' (' + tz + ')' : ''); }
  catch (e) { return d.toLocaleString('en-US', o); }
}

/* old-style requests that arrived as chat messages (before the form existed) */
function legacyRequests() {
  return getChat().map((m) => {
    const d = dmParse(m.body);
    if (!d) return null;
    const r = /^Service request: ([^\n]*?) — from ([^\n]*?) \(([^)\n]*)\)/.exec(d.text);
    return r ? { id: m.id, legacy: true, service: r[1], name: r[2], email: r[3], specialty: '', issues: d.text.split('\n').slice(1).join('\n'), created: m.created, status: 'legacy' } : null;
  }).filter(Boolean);
}
const allRequests = () => cache.requests.concat(legacyRequests()).sort((a, b) => byCreated(b, a));

async function updateRequest(id, patch) {
  const r0 = cache.requests.find((x) => x.id === id);
  if (!r0) return false;
  if (useCloud) {
    const row = {};
    if ('status' in patch) row.status = patch.status;
    if ('acceptedSlot' in patch) row.accepted_slot = patch.acceptedSlot;
    if ('adminNote' in patch) row.admin_note = patch.adminNote;
    const r = await sb.from('service_requests').update(row).eq('id', id).select();
    if (r.error) { toast(r.error.message, 'error'); return false; }
    if (!r.data || !r.data.length) { toast('Not allowed. Check the service_requests policies in Supabase.', 'error'); return false; }
  }
  Object.assign(r0, patch);
  if (!useCloud) saveLocal('requests');
  return true;
}

/* calendar helpers */
const icsDate = (v) => new Date(v).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function requestDetails(r) {
  return 'Free 15-minute consultation\nMember: ' + r.name + ' (' + r.email + ')' + (r.phone ? '\nPhone: ' + r.phone : '') +
    '\nSpecialty: ' + (r.specialty || '-') + '\nServices: ' + splitServices(r.service).join(', ') +
    '\nIssues: ' + (r.issues || '-') + (r.needs ? '\nNeeds: ' + r.needs : '') + (r.adminNote ? '\nMeeting link / note: ' + r.adminNote : '');
}
function gcalLink(r, withGuest) {
  const start = new Date(r.acceptedSlot || r.slot1), end = new Date(start.getTime() + 15 * 60000);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Alaric consultation — ' + r.name) +
    '&dates=' + icsDate(start) + '/' + icsDate(end) + '&details=' + encodeURIComponent(requestDetails(r)) +
    (withGuest && r.email ? '&add=' + encodeURIComponent(r.email) : '');
}
function downloadIcs(id) {
  const r = cache.requests.find((x) => x.id === id);
  if (!r) return;
  const start = new Date(r.acceptedSlot || r.slot1), end = new Date(start.getTime() + 15 * 60000);
  const t = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alaric Health Services//Consultation//EN', 'BEGIN:VEVENT',
    'UID:' + r.id + '@alaric', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
    'SUMMARY:' + t('Alaric free consultation'), 'DESCRIPTION:' + t(requestDetails(r)), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'alaric-consultation.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function openRequest(name) { window._reqService = name; goTo('request'); }

async function submitRequest(btn) {
  const services = Array.prototype.map.call(document.querySelectorAll('input[name=reqSvc]:checked'), (i) => i.value);
  const specialty = $('reqSpec').value, issues = $('reqIssues').value.trim(), needs = $('reqNeeds').value.trim(), phone = $('reqPhone').value.trim();
  const s1 = $('reqSlot1').value, s2 = $('reqSlot2').value;
  if (!services.length) return toast('Select at least one service', 'error');
  if (!specialty) return toast('Select your specialty', 'error');
  if (!issues) return toast('Tell us what issues you are facing', 'error');
  if (!s1) return toast('Pick a date and time for your free 15-minute call', 'error');
  const d1 = new Date(s1), d2 = s2 ? new Date(s2) : null, now = new Date();
  if (isNaN(d1) || d1 <= now) return toast('Pick a future date and time', 'error');
  if (d2 && (isNaN(d2) || d2 <= now)) return toast('Second choice must be a future date and time', 'error');

  const tz = localTz();
  const row = {
    user_id: currentUser.id, name: fullName(currentUser), email: currentUser.email,
    service: services.join(SVC_SEP), specialty, issues, needs, phone, tz,
    slot1: d1.toISOString(), slot2: d2 ? d2.toISOString() : null, status: 'new'
  };
  btn.disabled = true;
  let ok = false;
  try {
    if (useCloud && !requestsTable) {
      // table not created yet: fall back to a chat message so the request is not lost
      const admin = primaryAdmin();
      if (isAdmin() || !admin) return toast('Requests table missing. Run the service_requests SQL in Supabase.', 'error');
      const text = 'Service request: ' + services.join(', ') + ' — from ' + row.name + ' (' + row.email + ')' +
        '\nSpecialty: ' + specialty + '\nIssues: ' + issues + (needs ? '\nNeeds: ' + needs : '') + (phone ? '\nPhone: ' + phone : '') +
        '\nPreferred call: ' + fmtInTz(row.slot1, tz) + (row.slot2 ? '\nSecond choice: ' + fmtInTz(row.slot2, tz) : '');
      ok = !!(await addRecord('chat', { user_id: currentUser.id, body: encodeDM(admin.id, text) }));
    } else {
      ok = !!(await addRecord('requests', row));
    }
  } finally { btn.disabled = false; }
  if (ok) {
    window._reqService = '';
    toast('Request sent. We will confirm your free 15-minute call soon.');
    goTo(isAdmin() ? 'services' : 'myRequests');
  }
}

async function acceptRequest(id, slot) {
  if (!isAdmin()) return;
  const r = cache.requests.find((x) => x.id === id);
  if (!r) return;
  const when = slot === 2 && r.slot2 ? r.slot2 : r.slot1;
  const note = prompt('Meeting link or note for the member (optional):', '');
  if (note === null) return;
  if (await updateRequest(id, { status: 'accepted', acceptedSlot: when, adminNote: note.trim() })) {
    toast('Accepted. Tap "Add to Google Calendar" to put it on the Alaric calendar.');
    render();
  }
}
async function declineRequest(id) {
  if (!isAdmin()) return;
  const note = prompt('Reason or new suggested time for the member (optional):', '');
  if (note === null) return;
  if (await updateRequest(id, { status: 'declined', adminNote: note.trim() })) { toast('Declined'); render(); }
}

function rqRow(label, val) { return val ? '<div class="rq-row"><b>' + label + '</b><span>' + val + '</span></div>' : ''; }

function requestCard(r, admin) {
  if (r.legacy) {
    return '<div class="card rq-card"><div class="rq-top"><div class="post-title">' + esc(r.name) + '</div><span class="pill">Chat request</span></div>' +
      rqRow('Email', esc(r.email)) + rqRow('Service', esc(r.service)) + rqRow('Details', esc(r.issues).replace(/\n/g, '<br>')) + rqRow('Date', esc(fmtDate(r.created))) + '</div>';
  }
  const pill = r.status === 'accepted' ? 'ok' : r.status === 'declined' ? 'bad' : 'warn';
  const svcs = splitServices(r.service).map(esc).join('<br>');
  let h = '<div class="card rq-card"><div class="rq-top"><div><div class="post-title">' + esc(admin ? r.name : splitServices(r.service).join(' + ')) + '</div>' +
    '<div style="color:var(--muted);font-size:.8rem">Sent ' + esc(fmtDate(r.created)) + '</div></div><span class="pill ' + pill + '">' + esc(r.status) + '</span></div>';
  if (admin) h += rqRow('Email', esc(r.email)) + rqRow('Phone', esc(r.phone));
  h += rqRow('Specialty', esc(r.specialty)) + rqRow('Services', svcs) + rqRow('Issues', esc(r.issues).replace(/\n/g, '<br>')) + rqRow('Needs', esc(r.needs).replace(/\n/g, '<br>'));
  if (r.status === 'accepted') {
    h += rqRow('Confirmed call', '<b style="color:#5eead4">' + esc(fmtInTz(r.acceptedSlot, r.tz)) + '</b>');
    if (admin) h += rqRow('Your time', esc(fmtInTz(r.acceptedSlot)));
  } else {
    h += rqRow('1st choice', esc(fmtInTz(r.slot1, r.tz))) + (r.slot2 ? rqRow('2nd choice', esc(fmtInTz(r.slot2, r.tz))) : '');
    if (admin) h += rqRow('Your time', esc(fmtInTz(r.slot1)) + (r.slot2 ? '<br>' + esc(fmtInTz(r.slot2)) : ''));
  }
  h += rqRow(r.status === 'declined' ? 'Message' : 'Meeting link / note', esc(r.adminNote));
  h += '<div class="rq-actions">';
  if (admin && r.status === 'new') {
    h += '<button class="btn s ok" data-act="reqAccept" data-id="' + esc(r.id) + '" data-slot="1">Accept 1st choice</button>';
    if (r.slot2) h += '<button class="btn s ok" data-act="reqAccept" data-id="' + esc(r.id) + '" data-slot="2">Accept 2nd choice</button>';
    h += '<button class="btn s d" data-act="reqDecline" data-id="' + esc(r.id) + '">Decline</button>';
  }
  if (r.status === 'accepted') {
    h += '<a class="btn s" target="_blank" rel="noopener" href="' + esc(gcalLink(r, admin)) + '">Add to Google Calendar</a>' +
      '<button class="btn s o" data-act="ics" data-id="' + esc(r.id) + '">Download .ics</button>';
  }
  return h + '</div></div>';
}

function pageRequest() {
  const pre = window._reqService || '';
  const spec = currentUser.specialty || '';
  const specs = !spec || SPECIALTIES.indexOf(spec) >= 0 ? SPECIALTIES : [spec].concat(SPECIALTIES);
  const min = dtLocal(new Date(Date.now() + 3600000));
  let h = '<div class="rq-wrap rq-form"><h1>Book your free consultation</h1><p class="sub">Tell us what you need. We will confirm a free 15-minute call on the Alaric calendar.</p>';
  if (isAdmin()) h += '<div class="pending-banner">You are logged in as admin. This will create a test request.</div>';
  h += '<div class="card"><p style="margin:0 0 16px;color:var(--muted);font-size:.9rem">Requesting as <b style="color:inherit">' + esc(fullName(currentUser)) + '</b> · ' + esc(currentUser.email) + '</p>';
  h += '<div class="auth-field"><label>Services you need</label>';
  SERVICES.forEach((s) => { h += '<label class="rq-svc"><input type="checkbox" name="reqSvc" value="' + esc(s.name) + '"' + (s.name === pre ? ' checked' : '') + '><span>' + esc(s.name) + '</span></label>'; });
  h += '</div><div class="auth-field"><label>Your specialty</label><select id="reqSpec"><option value="">Select specialty</option>' +
    specs.map((x) => '<option' + (x === spec ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></div>';
  h += '<div class="auth-field"><label>What issues are you facing right now?</label><textarea id="reqIssues" rows="4" placeholder="Example: many denied claims, slow credentialing, no one answers patient calls..."></textarea></div>';
  h += '<div class="auth-field"><label>Anything specific you need from us? (optional)</label><textarea id="reqNeeds" rows="3"></textarea></div>';
  h += '<div class="auth-field"><label>Phone (optional)</label><input id="reqPhone" type="tel" placeholder="Best number to call"></div>';
  h += '<div class="rq-grid"><div class="auth-field"><label>Free 15-minute call: 1st choice</label><input id="reqSlot1" type="datetime-local" min="' + min + '"></div>' +
    '<div class="auth-field"><label>2nd choice (optional)</label><input id="reqSlot2" type="datetime-local" min="' + min + '"></div></div>';
  h += '<p class="rq-note">Times are in your timezone: <b>' + esc(localTz()) + '</b>. Please do not include patient names or any patient information in this form.</p>';
  h += '<div class="rq-actions"><button class="btn" data-act="reqSubmit">Send request</button><button class="btn s o" data-act="nav" data-id="premium">Cancel</button></div></div></div>';
  return h;
}

function pageMyRequests() {
  const mine = cache.requests.filter((r) => r.user_id === currentUser.id).sort((a, b) => byCreated(b, a));
  let h = '<h1>My Requests</h1><p class="sub">Your consultation requests and their status.</p>';
  if (!mine.length) return h + '<div class="card empty">No requests yet. Pick a service on Premium Services and book your free 15-minute call.<div style="margin-top:14px"><button class="btn" data-act="nav" data-id="premium">View services</button></div></div>';
  return h + mine.map((r) => requestCard(r, false)).join('');
}

function pricingHtml(s) {
  return s.pricing.map((p) => (p.pre ? '<em>' + esc(p.pre) + '</em> ' : '') + '<b>' + esc(p.amount) + '</b> ' + esc(p.unit)).join('<br>');
}

function serviceCard(s) {
  const detId = 'det-' + s.id, main = s.pricing[0], rest = s.pricing.slice(1);
  return '<div class="ps-card' + (s.featured ? ' ps-featured' : '') + '">' +
    '<div class="ps-head"><div class="ps-icon">' + s.icon + '</div><div><div class="ps-name">' + esc(s.name) + '</div><div class="ps-blurb">' + esc(s.blurb) + '</div></div></div>' +
    '<div class="ps-price"><div class="ps-amount">' + esc(main.amount) + '<span>' + esc(main.unit) + '</span></div>' +
    (main.note ? '<div class="ps-note">' + esc(main.note) + '</div>' : '') +
    rest.map((p) => '<div class="ps-alt"><em>' + esc(p.pre || '') + '</em> <b>' + esc(p.amount) + '</b> ' + esc(p.unit) + (p.note ? '<div class="ps-note">' + esc(p.note) + '</div>' : '') + '</div>').join('') + '</div>' +
    '<button class="btn s o" data-act="toggle" data-id="' + detId + '" data-count="' + s.features.length + '">View all ' + s.features.length + ' included ▼</button>' +
    '<ul id="' + detId + '" class="ps-list" style="display:none">' + s.features.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
    '<button class="btn ps-cta" data-act="svc" data-id="' + esc(s.name) + '">Get started</button></div>';
}

function servicesTable(withRequests) {
  const reqs = withRequests ? allRequests() : [];
  const count = (name) => reqs.filter((r) => splitServices(r.service).indexOf(name) >= 0).length;
  let h = '<div class="card"><div class="table-wrap"><table><tr><th>Service</th><th>Pricing</th><th>Included</th>' + (withRequests ? '<th>Requests</th>' : '') + '</tr>';
  SERVICES.forEach((s) => {
    h += '<tr><td><b>' + s.icon + ' ' + esc(s.name) + '</b></td><td class="ps-cell">' + pricingHtml(s) + '</td><td>' + s.features.length + ' services</td>' +
      (withRequests ? '<td><span class="pill ' + (count(s.name) ? 'ok' : '') + '">' + count(s.name) + '</span></td>' : '') + '</tr>';
  });
  return h + '</table></div></div>';
}

function pagePremiumServices() {
  return '<h1>Premium Services</h1><p class="sub">Alaric Health Services — one partner for billing, credentialing, front-desk support and marketing.</p>' +
    '<div class="ps-hero"><b>Alaric Health Services</b><span>Medical Billing · Credentialing · Virtual Assistance · Digital Marketing</span><span>Every request includes a free 15-minute consultation call.</span></div>' +
    '<div class="ps-grid">' + SERVICES.map(serviceCard).join('') + '</div>' +
    '<h2 class="ps-h2">Compare services</h2>' + servicesTable(false) +
    '<div class="card" style="text-align:center;padding:28px"><div style="font-weight:750;font-size:1.15rem;margin-bottom:8px">Not sure which service fits?</div><p class="sub" style="margin-bottom:16px">Tell us what you need and book a free 15-minute consultation call.</p><button class="btn" data-act="svc" data-id="General quote">Book free consultation</button></div>';
}

function pageAdminServices() {
  const reqs = allRequests(), mine = cache.requests;
  let h = '<h1>Services</h1><p class="sub">Consultation requests from members and the price list. To change a price or add a service, edit the SERVICES list in app.js.</p>';
  if (useCloud && !requestsTable) h += '<div class="pending-banner"><b>Requests table missing.</b> Run the service_requests SQL in Supabase. Until then, requests arrive as chat messages and cannot be accepted here.</div>';
  h += '<div class="stats">' + statCard('New requests', mine.filter((r) => r.status === 'new').length) + statCard('Accepted', mine.filter((r) => r.status === 'accepted').length) + statCard('Total requests', reqs.length) + statCard('Services', SERVICES.length) + '</div>';
  h += '<h2 class="ps-h2">Consultation requests</h2>';
  h += reqs.length ? reqs.map((r) => requestCard(r, true)).join('') : '<div class="card empty">No service requests yet.</div>';
  h += '<h2 class="ps-h2">Price list</h2>' + servicesTable(true);
  return h;
}

function statCard(label, value, small) {
  return '<div class="card stat"><div class="l">' + label + '</div><div class="v"' + (small ? ' style="font-size:1.1rem"' : '') + '>' + value + '</div></div>';
}

function pageMemberHome() {
  const mine = getPosts().filter((p) => p.user_id === currentUser.id);
  const st = isApproved() ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending';
  return '<h1>Member Home</h1><p class="sub">Members see and answer member questions only. Admin tools stay hidden.</p>' + accessBanner() +
    '<div class="stats">' + statCard('My questions', mine.length) + statCard('Status', st, true) + '</div>';
}

function pageAdminOverview() {
  const profiles = getProfiles(), waiting = pendingList();
  const approved = profiles.filter((p) => p.status === 'approved').length;
  let h = '<h1>Approve members</h1><p class="sub">Yahan se approval do. Approve ke baad unki questions aapko, unko, aur baaki members ko dikhengi.</p>';
  if (!useCloud) h += '<div class="pending-banner"><b>Shared mode off.</b> Run supabase-setup.sql in the Supabase SQL Editor so members share live data.</div>';
  h += '<div class="stats">' + statCard('Waiting', waiting.length) + statCard('Approved', approved) + statCard('Questions', getPosts().length) + '</div>';
  h += '<div class="card"><h2 style="font-size:1.05rem;margin-bottom:12px">Pending approval</h2>';
  if (!waiting.length) h += '<p class="empty">Koi naya member wait nahi kar raha.</p>';
  waiting.forEach((p) => {
    h += '<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--border)">' +
      '<div><b>' + esc(fullName(p)) + '</b><div style="color:var(--muted);font-size:.85rem">' + esc(p.email || '') + ' · ' + esc(p.specialty || 'No specialty') + '</div></div>' +
      '<div><button class="btn s ok" data-act="approve" data-id="' + esc(p.id) + '">Approve</button> <button class="btn s d" data-act="reject" data-id="' + esc(p.id) + '">Reject</button></div></div>';
  });
  h += '</div><p class="sub">Approved members ki baat <b>All Questions</b> mein aapko dikhegi. Woh khud bhi apni post dekhenge, aur doosre members bhi.</p>';
  return h;
}

function pageAdminMembers() {
  const profiles = getProfiles().slice().sort((a, b) => byCreated(b, a));
  let h = '<h1>Members</h1><p class="sub">Grant Official or Admin. New users = members only.</p>';
  if (!profiles.length) return h + '<div class="card empty">No members yet</div>';
  h += '<div class="card"><div class="table-wrap"><table><tr><th>Name</th><th>Email</th><th>Specialty</th><th>Role</th><th>Status</th><th>Actions</th></tr>';
  profiles.forEach((p) => {
    const owner = isAdminEmail(p.email), self = p.id === currentUser.id, id = esc(p.id);
    const pill = p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'bad' : 'warn';
    h += '<tr><td>' + esc(fullName(p)) + '</td><td>' + esc(p.email || '—') + '</td><td>' + esc(p.specialty || '—') + '</td><td>' + roleBadge(p) + (owner ? ' <span class="pill ok">Owner</span>' : '') + '</td><td><span class="pill ' + pill + '">' + esc(p.status || 'pending') + '</span></td><td style="white-space:nowrap">';
    if (owner) h += '<span style="color:var(--muted);font-size:.8rem">Main admin</span>';
    else if (self) h += '<span style="color:var(--muted);font-size:.8rem">You</span>';
    else {
      if (p.status !== 'approved') h += '<button class="btn s ok" data-act="approve" data-id="' + id + '">Approve</button> ';
      if (p.status !== 'rejected') h += '<button class="btn s d" data-act="reject" data-id="' + id + '">Reject</button> ';
      if (p.role !== 'official') h += '<button class="btn s o" data-act="makeOfficial" data-id="' + id + '">Make Official</button> ';
      if (p.role !== 'admin') h += '<button class="btn s" data-act="makeAdmin" data-id="' + id + '">Make Admin</button> ';
      if (p.role === 'admin' || p.role === 'official') h += '<button class="btn s o" data-act="makeMember" data-id="' + id + '">Make Member</button>';
    }
    h += '</td></tr>';
  });
  return h + '</table></div></div>';
}

/* one post card used by the feed (interactive) and See all (read-only) */
function postCard(p, interactive) {
  const likes = getLikes().filter((l) => l.post_id === p.id);
  const liked = likes.some((l) => l.user_id === currentUser.id);
  const pcs = getComments().filter((c) => c.post_id === p.id);
  const spec = publicSpec(p.user_id);
  let h = '<div class="card"><div class="post-title">' + esc(p.title) + '</div><div class="post-meta"><span>' + esc(publicName(p.user_id)) + '</span> ' + roleBadge(getProfile(p.user_id));
  if (spec) h += '<span>' + esc(spec) + '</span>';
  h += '<span>' + esc(fmtDate(p.created)) + '</span><span class="pill">' + esc(p.visibility || 'members') + '</span>';
  if (!interactive) h += '<span>' + likes.length + ' reactions</span><span>' + pcs.length + ' answers</span>';
  h += '</div><div class="post-body">' + esc(p.body) + '</div>';
  if (interactive) {
    h += '<div class="post-actions"><button class="btn s o" data-act="like" data-id="' + esc(p.id) + '">' + (liked ? '♥' : '♡') + ' ' + likes.length + '</button><span style="color:var(--muted);font-size:.85rem">' + pcs.length + ' comments</span>';
    if (p.user_id === currentUser.id || isAdmin()) h += '<button class="btn s d" data-act="delPost" data-id="' + esc(p.id) + '">Delete</button>';
    h += '</div>';
  }
  pcs.forEach((c) => { h += '<div class="comment"><div class="who">' + esc(publicName(c.user_id)) + ' ' + roleBadge(getProfile(c.user_id)) + '</div><div>' + esc(c.body) + '</div></div>'; });
  if (interactive && isApproved()) {
    h += '<div class="bar" style="margin-top:12px;margin-bottom:0"><input placeholder="Comment..." data-cmt-input="' + esc(p.id) + '"><button class="btn s" data-act="cmtSend" data-id="' + esc(p.id) + '">Comment</button></div>';
  }
  return h + '</div>';
}

function pageFeed() {
  const q = (window._feedQ || '').toLowerCase();
  const posts = getPosts().filter(canSeePost).filter((p) => !q || (p.title || '').toLowerCase().indexOf(q) > -1 || (p.body || '').toLowerCase().indexOf(q) > -1);
  let h = '<h1>' + (isAdmin() ? 'All Questions (admin)' : 'Member Questions') + '</h1><p class="sub">' + (isAdmin() ? 'You see every question, including private and official.' : 'Only questions from members. You can answer them here.') + '</p>' +
    '<div class="bar"><input class="search-bar" id="feedSearch" placeholder="Search..." value="' + esc(window._feedQ || '') + '"><button class="btn s o" data-act="refresh">Refresh</button></div>' + accessBanner();
  if (!posts.length) return h + '<div class="card empty">No questions yet.</div>';
  return h + posts.map((p) => postCard(p, true)).join('');
}

function pageNewPost() {
  if (!isApproved()) return '<h1>Ask a Question</h1>' + accessBanner();
  let vis = '<div class="vis-row"><label><input type="radio" name="vis" value="members" checked> All members</label>';
  if (isOfficial()) vis += '<label><input type="radio" name="vis" value="official"> Official only</label>';
  vis += '<label><input type="radio" name="vis" value="private"> Only me</label></div>';
  return '<h1>Ask a Question</h1><p class="sub">' + (isAdmin() ? 'Admin post — members only see questions from members.' : 'Your question is visible to other members.') + '</p>' +
    '<div class="card"><div class="auth-field"><label>Title</label><input id="npTitle" placeholder="Title"></div><div class="auth-field"><label>Details</label><textarea id="npBody" rows="5"></textarea></div>' + vis + '<button class="btn" data-act="post">Post question</button></div>';
}

function pageSeeAll() {
  const posts = getPosts().slice().sort((a, b) => byCreated(b, a));
  let h = '<h1>See all</h1><p class="sub">Admin only. Har question, answer, reaction, aur har member ki personal chat.</p>';
  h += '<div class="stats">' + statCard('Questions', posts.length) + statCard('Answers', getComments().length) + statCard('Reactions', getLikes().length) + statCard('Messages', getChat().filter((m) => dmParse(m.body)).length) + '</div>';
  h += '<h2 style="font-size:1.05rem;margin:8px 0 10px">All questions</h2>';
  h += posts.length ? posts.map((p) => postCard(p, false)).join('') : '<div class="card empty">Koi question nahi.</div>';
  h += '<h2 style="font-size:1.05rem;margin:8px 0 10px">Personal chats</h2>';
  let any = false;
  getProfiles().filter((p) => !isAdminProfile(p)).forEach((p) => {
    const msgs = threadMsgs(p.id);
    if (!msgs.length) return;
    any = true;
    h += '<div class="card"><b>' + esc(fullName(p)) + '</b> <span style="color:var(--muted);font-size:.85rem">' + esc(p.email || '') + '</span>' + msgs.map((m) => chatBubble(m)).join('') + '</div>';
  });
  return h + (any ? '' : '<div class="card empty">Koi personal message nahi.</div>');
}

function chatInputBar(to, placeholder) {
  return '<div class="bar" style="margin:0"><input id="chatInput" placeholder="' + placeholder + '"><button class="btn" data-act="chatSend" data-id="' + esc(to) + '">Send</button></div>';
}

function pageChat() {
  if (!isApproved()) return '<h1>Admin Chat</h1>' + accessBanner();
  const refresh = '<button class="btn s o" data-act="refresh">Refresh</button>';

  if (!isAdmin()) {
    const admin = primaryAdmin();
    let h = '<h1>Chat with Admin</h1><p class="sub">Sirf admin se. Doosre members se chat nahi.</p><div class="bar">' + refresh + '</div><div class="card"><div class="chat-box">';
    if (!admin) return h + '<div class="empty">Admin abhi available nahi.</div></div></div>';
    const msgs = threadMsgs(currentUser.id);
    h += msgs.length ? msgs.map((m) => chatBubble(m)).join('') : '<div class="empty">Abhi koi message nahi.</div>';
    return h + '</div>' + chatInputBar(admin.id, 'Message admin...') + '</div>';
  }

  // admin view: approved members + anyone who already wrote to us (e.g. service requests)
  const members = getProfiles().filter((p) => !isAdminProfile(p) && (p.status === 'approved' || threadMsgs(p.id).length));
  if (!window._chatWith || !members.some((p) => p.id === window._chatWith)) window._chatWith = members[0] && members[0].id;
  let h = '<h1>Member Chat</h1><p class="sub">Aap kisi bhi member se alag chat kar sakte ho. Members ek doosre se nahi.</p><div class="bar">' + refresh + '</div>';
  h += '<div style="display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:12px" class="chat-grid"><div class="card" style="margin:0;max-height:520px;overflow:auto">';
  if (!members.length) h += '<p class="empty">Koi member nahi.</p>';
  members.forEach((p) => { h += '<button class="nav' + (p.id === window._chatWith ? ' on' : '') + '" data-act="chatPick" data-id="' + esc(p.id) + '" style="margin-bottom:4px">' + esc(fullName(p)) + '</button>'; });
  h += '</div><div class="card" style="margin:0"><div class="chat-box">';
  if (!window._chatWith) h += '<div class="empty">Member select karo.</div>';
  else {
    const msgs = threadMsgs(window._chatWith);
    h += msgs.length ? msgs.map((m) => chatBubble(m)).join('') : '<div class="empty">Is member se abhi koi message nahi.</div>';
  }
  h += '</div>' + (window._chatWith ? chatInputBar(window._chatWith, 'Message member...') : '') + '</div></div>';
  return h;
}

function pageProfile() {
  const p = getProfile(currentUser.id) || {}, letter = (currentUser.first || '?')[0].toUpperCase();
  const field = (label, val) => '<div class="auth-field"><label>' + label + '</label><input value="' + esc(val) + '" disabled style="opacity:.7"></div>';
  return '<h1>My Profile</h1><div class="card" style="max-width:480px">' +
    (p.photo ? '<img class="profile-photo" src="' + esc(p.photo) + '" alt="">' : '<div class="profile-photo-ph">' + esc(letter) + '</div>') +
    '<label class="photo-btn">Change photo<input type="file" id="photoInput" accept="image/*"></label>' +
    '<div style="margin-bottom:12px">' + roleBadge(p.role ? p : { role, status }) + '</div>' +
    field('Name', fullName(currentUser)) + field('Email', currentUser.email) + field('Specialty', currentUser.specialty) + field('Role', role) + '</div>';
}

/* ---------- Actions (one place, used through event delegation) ---------- */
async function changeAccess(id, patch, doneMsg, confirmMsg) {
  if (!isAdmin()) return;
  const p = getProfile(id);
  if (!p) return;
  if (isAdminEmail(p.email)) return toast('The owner account cannot be changed.', 'error');
  if (id === currentUser.id) return toast('You cannot change your own access.', 'error');
  if (confirmMsg && !confirm(confirmMsg)) return;
  if (await saveProfile(Object.assign({ id }, patch))) { toast(doneMsg); render(); }
}

const ACTIONS = {
  nav: (id) => goTo(id),
  logout: () => logout(),
  refresh: async () => { await loadAllData(currentUser.id); toast('Refreshed'); render(); },
  toggle: (id, el) => {
    const d = $(id);
    if (!d) return;
    const open = d.style.display === 'none';
    d.style.display = open ? 'block' : 'none';
    el.textContent = open ? 'Hide list ▲' : 'View all ' + (el.dataset.count || '') + ' included ▼';
  },
  svc: (name) => openRequest(name),
  reqSubmit: (id, btn) => submitRequest(btn),
  reqAccept: (id, el) => acceptRequest(id, +el.dataset.slot),
  reqDecline: (id) => declineRequest(id),
  ics: (id) => downloadIcs(id),

  approve: (id) => changeAccess(id, { status: 'approved' }, 'Approved'),
  reject: (id) => changeAccess(id, { status: 'rejected', role: 'member' }, 'Rejected', 'Reject this member?'),
  makeOfficial: (id) => changeAccess(id, { role: 'official', status: 'approved' }, 'Official granted'),
  makeAdmin: (id) => changeAccess(id, { role: 'admin', status: 'approved' }, 'Admin granted', 'Give FULL admin access to this member? They will see every question and private chat.'),
  makeMember: (id) => changeAccess(id, { role: 'member', status: 'approved' }, 'Set to Member'),

  post: async (id, btn) => {
    const title = ($('npTitle').value || '').trim(), body = ($('npBody').value || '').trim();
    const vis = (document.querySelector('input[name=vis]:checked') || {}).value || 'members';
    if (!title || !body) return toast('Title and details required', 'error');
    btn.disabled = true;
    const r = await addRecord('posts', { user_id: currentUser.id, title, body, visibility: vis });
    btn.disabled = false;
    if (r) { toast('Posted'); goTo('feed'); }
  },
  like: async (id) => { await toggleLike(id, currentUser.id); render(); },
  delPost: async (id) => {
    if (!confirm('Delete this question and all its answers?')) return;
    if (await deletePost(id)) { toast('Deleted'); render(); }
  },
  cmtSend: async (id) => {
    const inp = Array.prototype.find.call(document.querySelectorAll('[data-cmt-input]'), (i) => i.dataset.cmtInput === id);
    const body = ((inp && inp.value) || '').trim();
    if (!body) return;
    if (await addRecord('comments', { post_id: id, user_id: currentUser.id, body })) render();
  },
  chatPick: (id) => { window._chatWith = id; render(); },
  chatSend: async (to) => {
    const inp = $('chatInput'), body = ((inp && inp.value) || '').trim();
    if (!body || !to) return;
    if (await addRecord('chat', { user_id: currentUser.id, body: encodeDM(to, body) })) {
      render();
      const again = $('chatInput');
      if (again) again.focus();
    }
  }
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  try { await fn(el.dataset.id, el); }
  catch (err) { console.error(err); toast(err.message || 'Something went wrong', 'error'); }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const t = e.target;
  if (t.id === 'chatInput') {
    const b = document.querySelector('[data-act=chatSend]');
    if (b) b.click();
  } else if (t.dataset && t.dataset.cmtInput) {
    const b = Array.prototype.find.call(document.querySelectorAll('[data-act=cmtSend]'), (x) => x.dataset.id === t.dataset.cmtInput);
    if (b) b.click();
  } else if (t.id === 'feedSearch') {
    runFeedSearch(t.value);
  }
});

let searchTimer = null;
function runFeedSearch(val) {
  window._feedQ = val;
  render();
  const s = $('feedSearch');
  if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'feedSearch') {
    const v = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runFeedSearch(v), 350);
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'photoInput') return;
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (f.size > 900000) return toast('Image too large (max ~900 KB)', 'error');
  const r = new FileReader();
  r.onload = async () => {
    if (await saveProfile({ id: currentUser.id, photo: r.result })) { toast('Photo updated'); render(); }
  };
  r.readAsDataURL(f);
});

/* ---------- Password recovery (reset link opens the app with a recovery session) ---------- */
function showRecoveryModal() {
  if ($('recoveryModal')) return;
  const w = document.createElement('div');
  w.id = 'recoveryModal';
  w.className = 'alaric-modal';
  w.innerHTML = '<div class="alaric-modal-box"><h2>Set a new password</h2><p class="sub">Choose a new password for your account.</p>' +
    '<div class="auth-field"><label>New password</label><input id="newPw" type="password" autocomplete="new-password" placeholder="8+ chars, number & symbol"></div>' +
    '<p id="newPwMsg" class="alaric-modal-msg"></p><button class="btn" id="newPwSave" style="width:100%">Save password</button></div>';
  document.body.appendChild(w);
  const msg = $('newPwMsg');
  $('newPwSave').onclick = async () => {
    const pw = $('newPw').value;
    if (!isStrongPassword(pw)) { msg.textContent = 'Password: 8+ chars, a number and a symbol.'; return; }
    const r = await sb.auth.updateUser({ password: pw });
    if (r.error) { msg.textContent = friendlyAuthError(r.error.message); return; }
    w.remove();
    toast('Password updated');
  };
}

/* ---------- Light visual polish (injected; real styling still lives in your CSS) ---------- */
function injectPolish() {
  if ($('alaric-polish')) return;
  const s = document.createElement('style');
  s.id = 'alaric-polish';
  s.textContent =
    '.btn,.nav,.logout-btn{transition:background-color .15s,border-color .15s,transform .1s}' +
    '.btn:active{transform:translateY(1px)}' +
    '.btn:focus-visible,.nav:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #2dd4bf;outline-offset:2px}' +
    '.btn:disabled{opacity:.6;cursor:not-allowed}' +
    'table{width:100%;border-collapse:collapse}' +
    '.table-wrap{overflow-x:auto}' +
    'tr:hover td{background:rgba(255,255,255,.03)}' +
    '.chat-box{max-height:min(55vh,460px);overflow-y:auto;padding-right:4px}' +
    '.chat-msg{border-radius:12px;padding:8px 12px;margin-bottom:8px;background:rgba(255,255,255,.05);overflow-wrap:anywhere}' +
    '.post-body,.comment{overflow-wrap:anywhere;white-space:pre-wrap}' +
    '.ps-hero{display:flex;flex-direction:column;gap:4px;padding:18px 22px;border:1px solid rgba(45,212,191,.35);background:rgba(45,212,191,.07);border-radius:16px;margin-bottom:22px}' +
    '.ps-hero span{color:var(--muted);font-size:.88rem}' +
    '.ps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:18px;align-items:start;margin-bottom:26px}' +
    '.ps-card{display:flex;flex-direction:column;gap:14px;padding:22px;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:16px;background:var(--card,rgba(255,255,255,.03))}' +
    '.ps-featured{border-color:rgba(45,212,191,.5)}' +
    '.ps-head{display:flex;gap:12px;align-items:flex-start}' +
    '.ps-icon{flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border-radius:12px;background:rgba(45,212,191,.14)}' +
    '.ps-name{font-weight:750;font-size:1.05rem;line-height:1.3}' +
    '.ps-blurb{color:var(--muted);font-size:.85rem;margin-top:3px}' +
    '.ps-price{padding:14px 16px;border-radius:12px;background:rgba(45,212,191,.07)}' +
    '.ps-amount{font-size:2rem;font-weight:800;line-height:1.1}' +
    '.ps-amount span{font-size:.9rem;font-weight:500;color:var(--muted);margin-left:6px}' +
    '.ps-alt{margin-top:10px;padding-top:10px;border-top:1px dashed var(--border,rgba(255,255,255,.15))}' +
    '.ps-alt b{font-size:1.15rem}' +
    '.ps-alt em,.ps-cell em{font-style:normal;color:var(--muted)}' +
    '.ps-note{font-size:.8rem;color:var(--muted);margin-top:4px}' +
    '.ps-list{margin:0;padding:12px 0 0;list-style:none;font-size:.88rem;line-height:1.5;color:#d1d5db;border-top:1px solid var(--border,rgba(255,255,255,.12))}' +
    '.ps-list li{position:relative;padding-left:22px;margin-bottom:8px}' +
    '.ps-list li::before{content:"✓";position:absolute;left:0;color:#5eead4}' +
    '.ps-cta{width:100%}' +
    '.ps-h2{font-size:1.05rem;margin:8px 0 10px}' +
    '.ps-cell{line-height:1.6}' +
    '.rq-wrap{max-width:760px}' +
    '.rq-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
    '.rq-form{color-scheme:dark}' +
    '.rq-form select,.rq-form textarea,.rq-form input[type=datetime-local],.rq-form input[type=tel]{width:100%;box-sizing:border-box;padding:10px 12px;font:inherit;color:inherit;background:rgba(255,255,255,.05);border:1px solid var(--border,rgba(255,255,255,.15));border-radius:10px}' +
    '.rq-form option{background:#0f1a22;color:#e5e7eb}' +
    '.rq-svc{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-bottom:8px;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:10px;cursor:pointer;line-height:1.4}' +
    '.rq-svc input{margin-top:3px;flex:none}' +
    '.rq-note{color:var(--muted);font-size:.82rem;margin:4px 0 16px}' +
    '.rq-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
    '.rq-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px}' +
    '.rq-row{display:flex;gap:10px;font-size:.88rem;margin:5px 0;line-height:1.5}' +
    '.rq-row b{flex:none;min-width:120px;color:var(--muted);font-weight:600}' +
    '.rq-row span{overflow-wrap:anywhere}' +
    'a.btn{text-decoration:none;display:inline-block}' +
    '.toast.error{background:#b42318;color:#fff}' +
    '.alaric-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:16px}' +
    '.alaric-modal-box{width:100%;max-width:400px;background:var(--card,#111827);border:1px solid var(--border,rgba(255,255,255,.15));border-radius:14px;padding:24px}' +
    '.alaric-modal-msg{color:#f87171;font-size:.85rem;min-height:1.2em;margin:8px 0}' +
    '@media(max-width:720px){.rq-grid{grid-template-columns:1fr}.rq-row{flex-direction:column;gap:0}.chat-grid{grid-template-columns:1fr!important}.stats{grid-template-columns:repeat(2,1fr)!important}}' +
    '@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
  document.head.appendChild(s);
}

/* ---------- Wire up the login screen + start ---------- */
document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => showAuthPanel(btn.dataset.tab)));
$('suPw').addEventListener('input', function () { updatePwStrength(this.value); });
document.querySelectorAll('.pw-toggle').forEach((btn) => btn.addEventListener('click', () => {
  const inp = $(btn.getAttribute('data-target'));
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
}));
$('forgotLink').addEventListener('click', () => showAuthPanel('forgot'));
$('backToLogin').addEventListener('click', () => showAuthPanel('login'));
$('loginBtn').addEventListener('click', doLogin);
$('loginPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('signupBtn').addEventListener('click', doSignup);
$('resetBtn').addEventListener('click', doForgot);

(async function init() {
  injectPolish();
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') resetSession();
    if (event === 'PASSWORD_RECOVERY') showRecoveryModal();
  });
  const sess = await sb.auth.getSession();
  if (sess.data && sess.data.session && sess.data.session.user) await enterApp(sess.data.session.user);
})();
