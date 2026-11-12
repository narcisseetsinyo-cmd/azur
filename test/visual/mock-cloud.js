/* Faux module cloud pour les tests visuels : même interface que cloud.js, tout en mémoire, sans Firebase. */
(() => {
  const ok = data => Promise.resolve({ ok: true, data });
  let accounts = [], session = null, state = { config: null, tx: {} }, remote = [], statusCbs = [];
  const mask = (k, id) => (k === "email" ? id.slice(0, 2) + "•••••@" + id.split("@")[1] : id.slice(0, 4) + " •• •• " + id.slice(-4, -2) + " " + id.slice(-2));
  const pub = a => ({ id: a.uid, kind: a.kind, displayName: a.displayName, masked: a.masked, lastLogin: Date.now() });
  window.azur = {
    configured: true,
    auth: {
      list: () => ok(accounts.map(pub)),
      session: () => ok(null),
      register: p => { const ident = p.kind === "phone" ? "+228" + String(p.identifier).replace(/\D/g, "").slice(-8) : String(p.identifier).toLowerCase(); const a = { uid: "u" + (accounts.length + 1), kind: p.kind, identifier: ident, displayName: p.displayName, masked: mask(p.kind, ident) }; accounts.push(a); session = a; return ok({ user: { ...pub(a), verified: a.kind === "email" ? false : null } }); },
      login: p => { const a = p.id ? accounts.find(x => x.uid === p.id) : accounts[0]; if (!a) return Promise.resolve({ ok: false, error: { code: "bad_credentials", message: "Adresse ou mot de passe incorrect." } }); session = a; return ok(pub(a)); },
      reset: p => ok({ sent: true, email: p.identifier }),
      logout: () => { session = null; return ok(true); },
      forget: () => ok(true),
      onLocked: () => {}
    },
    account: { changePassword: () => ok(true), sendReset: () => ok("test@gmail.com"), rename: n => ok({ ...pub(session), displayName: n }), remove: () => ok(true), verification: () => ok({ verified: true }), sendVerification: () => ok("test@gmail.com"), forgetDevice: () => ok(true) },
    data: {
      load: () => ok(JSON.parse(JSON.stringify(state))),
      saveConfig: c => { state.config = JSON.parse(JSON.stringify(c)); return ok(true); },
      replaceMonth: (m, items) => { state.tx[m] = JSON.parse(JSON.stringify(items || [])); return ok(true); },
      replaceAll: s => { state = JSON.parse(JSON.stringify(s)); return ok(true); },
      onRemote: fn => { remote.push(fn); return () => {}; }
    },
    access: {
      status: () => ok({ state: "admin" }), redeem: () => ok(true), isAdmin: () => true,
      overview: () => ok({ requests: [{ uid: "r1", name: "Kodjo Amegah", ident: "kodjo.amegah@gmail.com", kind: "email", at: Date.now() - 864e5, invite: null }, { uid: "r2", name: "Abla Dossou", ident: "+228 90 11 22 33", kind: "phone", at: Date.now() - 3 * 864e5, invite: { code: "K7QM4XPA", expired: false } }], granted: [{ uid: "g1", name: "Yao Mensah", ident: "yao.mensah@gmail.com", kind: "email", at: Date.now() - 20 * 864e5 }] }),
      approve: () => ok({ code: "H3TR9WQE", pretty: "H3TR-9WQE", name: "Kodjo Amegah" }), cancelInvite: () => ok(true), decline: () => ok(true), revoke: () => ok(true),
      onRequests: fn => { fn(1); return () => {}; }
    },
    sync: { status: () => ({ state: "synced", pending: false }), onStatus: fn => { statusCbs.push(fn); fn({ state: "synced", pending: false }); return () => {}; } },
    file: { save: () => ok({ saved: true }) },
    app: { info: () => ok({ version: "test", platform: "web" }), native: false },
    legacy: null
  };
})();
