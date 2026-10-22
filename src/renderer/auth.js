/* Azur — écran de connexion : chaque personne ouvre son compte (Gmail ou téléphone + mot de passe) */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ms = n => `<span class="ms" aria-hidden="true">${n}</span>`;
  const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  const firstName = n => String(n || "").trim().split(/\s+/)[0] || "";
  const COUNTRIES = [["+228", "Togo"], ["+229", "Bénin"], ["+225", "Côte d'Ivoire"], ["+233", "Ghana"], ["+226", "Burkina Faso"], ["+227", "Niger"], ["+234", "Nigeria"], ["+221", "Sénégal"], ["+223", "Mali"], ["+237", "Cameroun"], ["+241", "Gabon"], ["+242", "Congo"], ["+243", "RD Congo"], ["+33", "France"], ["+32", "Belgique"], ["+41", "Suisse"], ["+1", "Canada / États-Unis"]];

  const root = $("#auth");
  const st = { view: "pick", kind: "email", cc: "+228", accounts: [], picked: null, user: null, code: null, codeTitle: "", msg: "", lockUntil: 0 };
  let lockTimer = null;

  root.innerHTML = `<section class="auth-art" aria-hidden="true"><div class="glow"></div>
      <div class="art-brand"><img src="assets/mark@2x.png" alt="">Azur</div>
      <div class="art-main"><h1>Ton budget, <em>clair</em> comme le ciel.</h1>
        <p>Entrées, dépenses, semences et épargnes : ton budget est protégé par ton mot de passe et synchronisé sur tous tes appareils.</p>
        <div class="art-points"><div>${ms("lock")}Un compte par personne, chacun ne voit que ses chiffres</div><div>${ms("sync")}Synchronisé entre Mac, Windows et le web, même hors ligne</div><div>${ms("insights")}Plafonds, objectifs et bilan chaque mois</div></div></div>
      <div class="art-foot">Azur · synchronisation sécurisée</div></section>
    <div class="auth-side"><div class="auth-card" id="auth-card"></div></div>`;
  const card = $("#auth-card");

  /* ---------- Morceaux d'interface ---------- */
  const logo = `<div class="auth-logo"><img src="assets/mark@2x.png" alt="">Azur</div>`;
  const notice = () => st.msg ? `<div class="notice">${ms("info")}<span>${esc(st.msg)}</span></div>` : "";
  const tabs = () => `<div class="auth-tabs" role="group" aria-label="Type d'identifiant">
      <button type="button" data-a="kind" data-k="email" aria-pressed="${st.kind === "email"}">${ms("alternate_email")}Gmail</button>
      <button type="button" data-a="kind" data-k="phone" aria-pressed="${st.kind === "phone"}">${ms("smartphone")}Téléphone</button></div>`;
  const phoneNote = () => st.view === "register" && st.kind === "phone" ? `<div class="notice" style="margin-top:10px">${ms("info")}<span>Avec un numéro, le mot de passe ne pourra pas être réinitialisé par e-mail en cas d'oubli. Avec une adresse Gmail, tu pourras recevoir un lien de réinitialisation.</span></div>` : "";
  const identFields = () => (st.kind === "email"
    ? `<label class="field"><span>Adresse Gmail</span><input class="input" id="x-email" type="email" autocomplete="email" placeholder="prenom.nom@gmail.com" spellcheck="false"></label>`
    : `<div class="field"><span>Numéro de téléphone</span><div class="phone-row"><label><span class="sr">Indicatif du pays</span><select class="input" id="x-cc">${COUNTRIES.map(([c, n]) => `<option value="${c}" ${c === st.cc ? "selected" : ""}>${n} ${c}</option>`).join("")}</select></label><label><span class="sr">Numéro</span><input class="input" id="x-phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="90 12 34 56"></label></div></div>`) + phoneNote();
  const pwField = (id, label, ac, meter) => `<label class="field"><span>${label}</span><div class="pw-wrap"><input class="input" id="${id}" type="password" autocomplete="${ac}"><button class="icon-btn" type="button" data-a="eye" data-for="${id}" aria-label="Afficher le mot de passe">${ms("visibility")}</button></div>${meter ? `<div class="strength" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="strength-label" id="${id}-meter">Au moins 8 caractères, avec une lettre et un chiffre</div>` : ""}</label>`;
  const err = `<p class="err" id="x-err" role="alert"></p>`;

  const views = {
    pick: () => `${logo}${notice()}<div><h2>Bon retour</h2><p class="lead">Choisis ton compte pour ouvrir ton budget.</p></div>
      <div class="accounts">${st.accounts.map(a => `<button class="acc" type="button" data-a="pick" data-id="${esc(a.id)}"><span class="avatar">${esc(initials(a.displayName))}</span><div><strong>${esc(a.displayName)}</strong><small>${a.kind === "email" ? "Gmail" : "Téléphone"} · ${esc(a.masked)}</small></div>${ms("chevron_right")}</button>`).join("")}</div>
      <button class="btn block" type="button" data-a="go" data-v="login">${ms("login")}Utiliser un autre compte</button>
      <p class="auth-switch">Nouveau sur cet ordinateur ? <button class="link" type="button" data-a="go" data-v="register">Créer un compte</button></p>`,
    login: () => st.picked
      ? `${logo}${notice()}<div><h2>Bonjour ${esc(firstName(st.picked.displayName))}</h2><p class="lead">Entre ton mot de passe pour continuer.</p></div>
        <div class="picked"><span class="avatar">${esc(initials(st.picked.displayName))}</span><div><strong>${esc(st.picked.displayName)}</strong><small>${esc(st.picked.masked)}</small></div><button class="link" type="button" data-a="go" data-v="pick">Changer</button></div>
        <form class="auth-form" data-f="login" novalidate>${pwField("x-pw", "Mot de passe", "current-password")}${err}<button class="btn primary lg block" type="submit">${ms("lock_open")}Se connecter</button></form>
        <p class="auth-switch"><button class="link" type="button" data-a="go" data-v="forgot">Mot de passe oublié ?</button></p>`
      : `${logo}${notice()}<div><h2>Se connecter</h2><p class="lead">Avec l'adresse Gmail ou le numéro utilisé à la création du compte, sur n'importe quel appareil.</p></div>
        <form class="auth-form" data-f="login" novalidate>${tabs()}<div id="ident">${identFields()}</div>${pwField("x-pw", "Mot de passe", "current-password")}${err}<button class="btn primary lg block" type="submit">${ms("lock_open")}Se connecter</button></form>
        <p class="auth-switch"><button class="link" type="button" data-a="go" data-v="forgot">Mot de passe oublié ?</button></p>
        <p class="auth-switch">${st.accounts.length ? `<button class="link" type="button" data-a="go" data-v="pick">Voir les comptes de cet ordinateur</button> · ` : ""}<button class="link" type="button" data-a="go" data-v="register">Créer un compte</button></p>`,
    register: () => `${logo}${notice()}<div><h2>${st.accounts.length ? "Créer un compte" : "Bienvenue dans Azur"}</h2><p class="lead">${st.accounts.length ? "Chaque personne a son propre compte et ne voit que ses chiffres." : "Crée ton compte pour commencer. Tes données seront synchronisées sur tous tes appareils."}</p></div>
      <form class="auth-form" data-f="register" novalidate>
        <label class="field"><span>Prénom et nom</span><input class="input" id="x-name" maxlength="40" autocomplete="name" placeholder="Ama Mensah"></label>
        ${tabs()}<div id="ident">${identFields()}</div>
        ${pwField("x-pw", "Mot de passe", "new-password", true)}${pwField("x-pw2", "Confirme le mot de passe", "new-password")}
        ${err}<button class="btn primary lg block" type="submit">${ms("person_add")}Créer mon compte</button></form>
      ${st.accounts.length ? `<p class="auth-switch">Déjà un compte ? <button class="link" type="button" data-a="go" data-v="pick">Se connecter</button></p>` : `<p class="auth-switch">Tu as déjà un compte Azur ? <button class="link" type="button" data-a="go" data-v="login">Se connecter</button></p>`}`,
    forgot: () => `${logo}${notice()}<div><h2>Mot de passe oublié</h2><p class="lead">Pour un compte Gmail, Azur t'envoie un lien pour choisir un nouveau mot de passe.</p></div>
      <form class="auth-form" data-f="forgot" novalidate>${tabs()}<div id="ident">${identFields()}</div>
        ${err}<button class="btn primary lg block" type="submit">${ms("mail")}Recevoir le lien par e-mail</button></form>
      <div class="notice">${ms("smartphone")}<span>Les comptes créés avec un numéro de téléphone ne peuvent pas recevoir de lien. Si tu as oublié ce mot de passe, crée un nouveau compte avec ton adresse Gmail.</span></div>
      <p class="auth-switch"><button class="link" type="button" data-a="go" data-v="${st.accounts.length ? "pick" : "login"}">Retour à la connexion</button></p>`,
    setup: () => `${logo}<div><h2>Azur n'est pas encore relié</h2><p class="lead">Cette version attend la configuration Firebase du projet. Ajoute-la dans <code>src/renderer/firebase-config.js</code>, puis relance l'application.</p></div>`,
    code: () => `${logo}<div class="notice ok">${ms("check_circle")}<span>${esc(st.codeTitle)}</span></div>
      <div><h2>Ton code de secours</h2><p class="lead">Si tu oublies ton mot de passe, ce code te permettra d'en choisir un nouveau. Note-le sur papier et garde-le en lieu sûr : il ne sera plus affiché.</p></div>
      <div class="code-box" id="x-codebox">${esc(st.code)}</div>
      <button class="btn block" type="button" data-a="copy">${ms("content_copy")}Copier le code</button>
      <label class="check"><input type="checkbox" id="x-saved"><span>J'ai noté mon code de secours en lieu sûr</span></label>
      ${err}<button class="btn primary lg block" type="button" data-a="enter">${ms("arrow_forward")}Accéder à Azur</button>`
  };

  function render(focus = true) {
    card.innerHTML = views[st.view]();
    card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
    if (focus) setTimeout(() => { const f = card.querySelector("form input:not([type=checkbox]), #x-saved"); if (f) f.focus(); }, 30);
    tickLock();
  }
  function setErr(m) { const e = $("#x-err"); if (e) e.textContent = m || ""; }
  const val = id => (($("#" + id) || {}).value || "").trim();
  function identifier() {
    if (st.kind === "email") return val("x-email");
    st.cc = val("x-cc") || st.cc;
    const n = val("x-phone");
    return n ? (n.startsWith("+") || n.startsWith("00") ? n : st.cc + " " + n) : "";
  }
  function busy(form, on, label) {
    const b = form.querySelector("button[type=submit]");
    if (!b) return;
    if (on) { b.dataset.html = b.innerHTML; b.disabled = true; b.innerHTML = `${ms("progress_activity")}${label || "Un instant…"}`; }
    else { b.disabled = false; if (b.dataset.html) b.innerHTML = b.dataset.html; }
  }
  function tickLock() {
    clearInterval(lockTimer);
    const b = card.querySelector("form[data-f=login] button[type=submit]");
    if (!b || st.lockUntil <= Date.now()) return;
    const upd = () => {
      const s = Math.ceil((st.lockUntil - Date.now()) / 1000);
      if (s <= 0) { clearInterval(lockTimer); b.disabled = false; b.innerHTML = `${ms("lock_open")}Se connecter`; setErr(""); return; }
      b.disabled = true; b.innerHTML = `${ms("timer")}Réessaie dans ${s} s`;
    };
    upd(); lockTimer = setInterval(upd, 1000);
  }
  function scorePw(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[a-zà-ÿ]/.test(p) && /[A-ZÀ-Ý]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-zÀ-ÿ0-9]/.test(p)) s++;
    if (p.length < 8 || !/\d/.test(p) || !/[A-Za-zÀ-ÿ]/.test(p)) s = Math.min(s, 1);
    return p ? Math.max(1, s) : 0;
  }
  function enter(user) {
    st.msg = ""; st.code = null; clearInterval(lockTimer);
    root.hidden = true; card.innerHTML = "";
    window.AzurApp.start(user);
  }

  /* ---------- Actions ---------- */
  root.addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "go") { st.view = b.dataset.v; if (st.view !== "login") st.picked = null; if (st.view === "pick" && !st.accounts.length) st.view = "login"; st.msg = ""; render(); }
    else if (a === "pick") { st.picked = st.accounts.find(x => x.id === b.dataset.id) || null; st.view = "login"; st.msg = ""; render(); }
    else if (a === "kind") {
      st.kind = b.dataset.k;
      card.querySelectorAll("[data-a=kind]").forEach(x => x.setAttribute("aria-pressed", x.dataset.k === st.kind));
      $("#ident").innerHTML = identFields(); setErr("");
      const f = $("#ident input"); if (f) f.focus();
    }
    else if (a === "eye") {
      const i = $("#" + b.dataset.for); const show = i.type === "password";
      i.type = show ? "text" : "password"; b.innerHTML = ms(show ? "visibility_off" : "visibility");
      b.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    }
    else if (a === "copy") { try { await navigator.clipboard.writeText(st.code); b.innerHTML = `${ms("check")}Code copié`; } catch (x) { setErr("Copie impossible : note le code à la main."); } }
    else if (a === "enter") { if (!$("#x-saved").checked) { setErr("Coche la case pour confirmer que tu as noté ton code."); return; } enter(st.user); }
  });

  root.addEventListener("input", e => {
    if (e.target.id === "x-pw" && $("#x-pw-meter")) {
      const s = scorePw(e.target.value);
      const cols = ["", "var(--out)", "var(--gift)", "var(--accent)", "var(--in)"];
      card.querySelectorAll(".strength i").forEach((el, i) => { el.style.background = i < s ? cols[s] : ""; });
      $("#x-pw-meter").textContent = e.target.value ? ["", "Trop faible", "Correct", "Bon mot de passe", "Excellent mot de passe"][s] : "Au moins 8 caractères, avec une lettre et un chiffre";
    }
    if (e.target.closest("form")) setErr("");
  });

  root.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target, f = form.dataset.f;
    setErr("");
    if (f === "login") {
      const password = $("#x-pw").value;
      const payload = st.picked ? { id: st.picked.id, password } : { kind: st.kind, identifier: identifier(), password };
      if (!st.picked && !payload.identifier) return setErr(st.kind === "email" ? "Saisis ton adresse Gmail." : "Saisis ton numéro de téléphone.");
      if (!password) return setErr("Saisis ton mot de passe.");
      busy(form, true, "Connexion…");
      const r = await window.azur.auth.login(payload);
      busy(form, false);
      if (r.ok) return enter(r.data);
      setErr(r.error.message);
      if (r.error.retryIn) { st.lockUntil = Date.now() + r.error.retryIn * 1000; tickLock(); }
      $("#x-pw").select();
    }
    else if (f === "register") {
      const displayName = val("x-name"), ident = identifier(), pw = $("#x-pw").value, pw2 = $("#x-pw2").value;
      if (!displayName) return setErr("Indique ton prénom et ton nom.");
      if (!ident) return setErr(st.kind === "email" ? "Saisis ton adresse Gmail." : "Saisis ton numéro de téléphone.");
      if (pw !== pw2) return setErr("Les deux mots de passe ne sont pas identiques.");
      busy(form, true, "Création du compte…");
      const r = await window.azur.auth.register({ kind: st.kind, identifier: ident, displayName, password: pw });
      busy(form, false);
      if (!r.ok) return setErr(r.error.message);
      return enter(r.data.user);
    }
    else if (f === "forgot") {
      if (st.kind !== "email") return setErr("Choisis Gmail : seuls les comptes Gmail peuvent recevoir un lien.");
      const ident = identifier();
      if (!ident) return setErr("Saisis ton adresse Gmail.");
      busy(form, true, "Envoi…");
      const r = await window.azur.auth.reset({ kind: "email", identifier: ident });
      busy(form, false);
      if (!r.ok) return setErr(r.error.message);
      st.msg = `Si un compte existe pour ${r.data.email}, un e-mail vient d'être envoyé. Ouvre le lien, choisis un nouveau mot de passe, puis reviens te connecter. Pense à regarder dans les courriers indésirables.`;
      st.view = st.accounts.length ? "pick" : "login"; st.picked = null; render();
    }
  });

  root.addEventListener("pointermove", e => {
    const art = e.target.closest(".auth-art"); if (!art) return;
    const r = art.getBoundingClientRect();
    art.style.setProperty("--mx", (e.clientX - r.left) + "px"); art.style.setProperty("--my", (e.clientY - r.top) + "px");
  });

  /* ---------- Affichage ---------- */
  async function show(msg) {
    const r = await window.azur.auth.list();
    st.accounts = r.ok ? r.data : [];
    st.picked = null; st.code = null; st.msg = msg || "";
    st.view = st.accounts.length ? "pick" : "register";
    root.hidden = false; render();
  }
  window.AzurAuth = { show };

  (async () => {
    if (!window.azur.configured) { st.view = "setup"; root.hidden = false; render(false); return; }
    const s = await window.azur.auth.session();
    if (s.ok && s.data) { root.hidden = true; window.AzurApp.start(s.data); }
    else show();
  })();
})();
