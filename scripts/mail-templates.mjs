// Modèles des e-mails d'Azur : même charte que le logiciel (bleu nuit, bleu ciel, Clash Display et Outfit),
// écrits en tableaux et styles en ligne pour s'afficher correctement dans Gmail, Outlook et sur téléphone.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../src/renderer/calc.js");

const LOGO = "https://narcisseetsinyo-cmd.github.io/azur/assets/mark@2x.png";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const CUR = { FCFA: ["FCFA", 0], EUR: ["€", 2], USD: ["$", 2], GHS: ["GH₵", 2], NGN: ["₦", 0] };
const COL = { in: "#0E9C8B", out: "#E0435C", save: "#5B5FE0", gift: "#C98A06", other: "#64748B", accent: "#2E6FD8", night: "#0A1630", sky: "#7CC4F5" };
const ENV_COL = { dieu: "#C98A06", noyau: "#5B5FE0", essentiels: "#2E6FD8", dettes: "#E0435C", famille: "#DB2777", vie: "#0EA5E9" };
const FONT = "'Outfit','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "'Clash Display','Outfit','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function money(v, cur = "FCFA", signed = false) {
  const [sym, dec] = CUR[cur] || CUR.FCFA;
  const n = Math.abs(v).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/\s/g, " ");
  return `${v < 0 ? "−" : signed && v > 0 ? "+" : ""}${n} ${sym}`;
}
export const monthLabel = p => { const d = p.startD.getDate() === 1 ? p.startD : p.endD; return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const dateFr = d => `${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function layout({ preheader, title, body, cta, url, foot }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#EEF5FC;font-family:${FONT};color:#0A1630">
<span style="display:none!important;opacity:0;color:transparent;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF5FC"><tr><td align="center" style="padding:16px 6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #DCE8F5">
<tr><td bgcolor="#0A1630" style="background:#0A1630;background-image:linear-gradient(135deg,#050B1A 0%,#0A1630 40%,#1E3A7B 100%);padding:24px 22px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle"><img src="${LOGO}" width="30" height="30" alt="" style="border-radius:9px;vertical-align:middle;border:0"><span style="font-family:${DISPLAY};font-weight:600;font-size:18px;color:#FFFFFF;vertical-align:middle;margin-left:8px">Azur</span></td>
  </tr></table>
  <h1 style="margin:18px 0 0;font-family:${DISPLAY};font-weight:600;font-size:26px;line-height:1.15;color:#FFFFFF">${title}</h1>
</td></tr>
<tr><td style="padding:22px 22px 8px;font-size:15px;line-height:1.55;color:#0A1630">${body}</td></tr>
${cta ? `<tr><td align="center" style="padding:10px 28px 26px"><a href="${esc(url)}" style="display:inline-block;background:#2E6FD8;background-image:linear-gradient(135deg,#2E6FD8,#4FA3E8);color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:14px">${esc(cta)}</a></td></tr>` : ""}
<tr><td style="padding:16px 28px 22px;border-top:1px solid #DCE8F5;font-size:12px;line-height:1.5;color:#5E6D88"><b style="color:#0A1630;font-family:${DISPLAY}">Azur</b> · Ton budget, clair comme le ciel.${foot ? `<br>${foot}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

export function requestMail({ name, ident, kind, url }) {
  return layout({
    preheader: `${name || "Quelqu'un"} demande l'accès à Azur.`,
    title: `Nouvelle demande <span style="color:${COL.sky}">d'accès</span>`,
    body: `<p style="margin:0 0 14px"><strong>${esc(name || "Sans nom")}</strong> vient de créer son compte et demande l'accès à Azur.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#F4FAFF;border-radius:14px;width:100%"><tr><td style="padding:14px 16px;font-size:14px">${kind === "phone" ? "Téléphone" : "Adresse Gmail"} : <strong>${esc(ident || "")}</strong></td></tr></table>
<p style="margin:16px 0 0">Pour lui donner accès, ouvre Azur avec ton compte, puis <strong>Paramètres › Accès à Azur › Valider</strong>. ${kind === "phone" ? "C'est un compte téléphone : envoie-lui le code par WhatsApp." : "Le code lui sera aussi envoyé par e-mail."}</p>`,
    cta: "Ouvrir Azur", url,
    foot: "Tu reçois cet e-mail parce que tu es l'administratrice d'Azur."
  });
}

export function codeMail({ name, code, expires, url }) {
  const pretty = String(code).replace(/^(.{4})(.{4})$/, "$1-$2");
  return layout({
    preheader: `Ton code d'accès à Azur : ${pretty}`,
    title: `Ton accès à Azur <span style="color:${COL.sky}">est validé</span>`,
    body: `<p style="margin:0 0 14px">Bonjour ${esc((name || "").split(" ")[0])},</p>
<p style="margin:0 0 16px">L'administratrice a validé ta demande. Voici ton code d'accès personnel :</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#F4FAFF;border:1px dashed #C3D7EE;border-radius:16px;padding:18px;font-family:${DISPLAY};font-weight:600;font-size:32px;letter-spacing:4px;color:#0A1630">${esc(pretty)}</td></tr></table>
<p style="margin:16px 0 0">Ouvre Azur, connecte-toi avec ton compte, puis saisis ce code dans <strong>Code reçu</strong>.</p>
<p style="margin:10px 0 0;font-size:13px;color:#4A5D80">Il ne fonctionne qu'avec ton compte, une seule fois${expires ? `, jusqu'au ${dateFr(expires)}` : ""}. Ne le transmets à personne.</p>`,
    cta: "Ouvrir Azur", url,
    foot: "Tu reçois cet e-mail parce que tu as demandé l'accès à Azur."
  });
}

/* ---------- Bilan du mois ---------- */
const pct = v => `${Math.round(v * 100)} %`;
function delta(cur, prev, upGood) {
  if (!prev) return `<span style="color:#5E6D88">—</span>`;
  const d = (cur - prev) / prev, good = upGood ? d >= 0 : d <= 0;
  return `<span style="color:${Math.abs(d) < 0.005 ? "#5E6D88" : good ? COL.in : COL.out}">${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d * 100))} %</span>`;
}
const bar = (p, color) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px"><tr><td style="background:#E9F4FD;border-radius:6px;height:7px;font-size:0;line-height:0"><table role="presentation" cellpadding="0" cellspacing="0" width="${Math.max(1, Math.min(100, Math.round(p)))}%"><tr><td style="background:${color};border-radius:6px;height:7px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr></table>`;
const h2 = t => `<h2 style="margin:24px 0 10px;font-family:${DISPLAY};font-weight:600;font-size:17px;color:#0A1630">${t}</h2>`;

export function bilanData({ L, P, cfg }) {
  const s = C.sums(L), prev = C.sums(P);
  const env = C.envTotals(L, cfg.envMap);
  const sig = C.signals({ income: s.in, net: s.net, debt: env.dettes, core: env.noyau });
  const targets = {}; C.ENVS.forEach(([id, , t]) => (targets[id] = +((cfg.envTargets || {})[id] ?? t)));
  const debtsLeft = (cfg.debts || []).some(d => +d.total > 0);
  if (!debtsLeft && targets.dettes) { targets.noyau += targets.dettes; targets.dettes = 0; }
  const outBy = {}; L.filter(t => t.type === "out").forEach(t => { const k = t.catLabel || t.cat || "Sans catégorie"; outBy[k] = (outBy[k] || 0) + (+t.amount || 0); });
  const top = Object.entries(outBy).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const spent = {}; L.forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + (+t.amount || 0); });
  const labels = {}; L.forEach(t => { if (t.catLabel) labels[t.cat] = t.catLabel; });
  const over = Object.entries(cfg.budgets || {}).filter(([k, b]) => b > 0 && (spent[k] || 0) > b && L.some(t => t.cat === k && t.type === "out")).map(([k, b]) => ({ label: labels[k] || k, over: spent[k] - b }));
  return { s, prev, env, sig, targets, top, over };
}

export function buildBilan({ name, p, L, P, cfg, url }) {
  const cur = cfg.currency || "FCFA";
  const D = bilanData({ L, P, cfg });
  const { s, prev, env, sig, targets, top, over } = D;
  const m = monthLabel(p);
  const kpi = (label, val, d, color) => `<td width="50%" style="padding:4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4FAFF;border:1px solid #DCE8F5;border-radius:14px"><tr><td style="padding:11px 12px"><div style="font-size:12px;color:#4A5D80">${label}</div><div style="font-family:${DISPLAY};font-weight:600;font-size:18px;color:${color || "#0A1630"};white-space:nowrap">${val}</div><div style="font-size:12px">${d}</div></td></tr></table></td>`;
  const rate = s.in ? env.noyau / s.in : 0, prate = prev.in ? C.envTotals(P, cfg.envMap).noyau / prev.in : 0;
  const LV = { good: [COL.in, "vert"], warn: ["#D97706", "orange"], bad: [COL.out, "rouge"] };
  const sigRows = sig ? [["solde", "Solde du mois", "vert à 10 % ou plus"], ["dette", "Endettement", "vert sous 15 %, rouge au-delà de 33 %"], ["epargne", "Épargne (le noyau)", "vert à 10 % ou plus"]].map(([k, l, r]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #EEF3F9;width:18px"><span style="display:inline-block;width:12px;height:12px;border-radius:12px;background:${LV[sig[k].level][0]}"></span></td><td style="padding:8px 8px;border-bottom:1px solid #EEF3F9;font-size:14px"><strong>${l}</strong><br><span style="font-size:12px;color:#5E6D88">${r}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #EEF3F9;font-family:${DISPLAY};font-weight:600;font-size:16px;color:${LV[sig[k].level][0]};white-space:nowrap">${pct(sig[k].v)} · ${LV[sig[k].level][1]}</td></tr>`).join("") : "";
  const envRows = C.ENVS.map(([id, label]) => { const part = s.in ? env[id] / s.in * 100 : 0; return `<tr><td style="padding:7px 0;font-size:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:14px"><strong style="color:${ENV_COL[id]}">${label}</strong></td><td align="right" style="font-size:13px;color:#4A5D80;white-space:nowrap">${money(env[id], cur)} · <strong style="color:#0A1630">${Math.round(part)} %</strong> (repère ${targets[id]} %)</td></tr></table>${bar(part, ENV_COL[id])}</td></tr>`; }).join("");
  const tot = top.reduce((a, [, v]) => a + v, 0) || 1;
  const topRows = top.map(([l, v]) => `<tr><td style="padding:6px 0;font-size:14px">${esc(l)}</td><td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap"><strong>${money(v, cur)}</strong> <span style="color:#5E6D88;font-size:12px">${Math.round(v / tot * 100)} %</span></td></tr>`).join("");
  const body = `<p style="margin:0 0 6px">Bonjour ${esc(name || "")},</p>
<p style="margin:0 0 16px">Voici le bilan de ton mois de <strong>${m}</strong>, du ${dateFr(p.startD)} au ${dateFr(p.endD)}. Les évolutions sont comparées au mois précédent.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kpi("Entrées", money(s.in, cur), delta(s.in, prev.in, true))}${kpi("Sorties", money(s.outflow, cur), delta(s.outflow, prev.outflow, false))}</tr>
<tr>${kpi("Solde du mois", money(s.net, cur, true), s.net >= 0 ? `<span style="color:${COL.in}">Positif</span>` : `<span style="color:${COL.out}">Négatif</span>`, s.net < 0 ? COL.out : null)}${kpi("Épargne (le noyau)", pct(rate), prev.in ? `<span style="color:${rate >= prate ? COL.in : COL.out}">${rate >= prate ? "+" : "−"}${Math.abs(Math.round((rate - prate) * 100))} pts</span>` : "—")}</tr></table>
${sig ? h2("Les voyants") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sigRows}</table>` : ""}
${s.in ? h2("Les enveloppes") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${envRows}</table>` : ""}
${top.length ? h2("Où est parti l'argent") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topRows}</table>` : ""}
${over.length ? h2("À surveiller") + `<ul style="margin:0;padding-left:18px;font-size:14px">${over.map(o => `<li style="margin:4px 0"><strong>${esc(o.label)}</strong> : plafond dépassé de ${money(o.over, cur)}</li>`).join("")}</ul>` : ""}
<p style="margin:22px 0 0;font-size:14px;color:#4A5D80">Ouvre Azur pour voir le bilan complet, l'imprimer et préparer ton nouveau mois.</p>`;
  return layout({
    preheader: `${m} : entrées ${money(s.in, cur)}, sorties ${money(s.outflow, cur)}, solde ${money(s.net, cur, true)}.`,
    title: `Ton bilan de <span style="color:${COL.sky}">${MONTHS.includes(m.split(" ")[0]) ? m.split(" ")[0] : m}</span> ${m.split(" ")[1] || ""}`,
    body, cta: "Ouvrir mon bilan dans Azur", url: url + "#bilan",
    foot: "Pour ne plus recevoir ce bilan : Azur › Paramètres › Préférences › Bilan du mois par e-mail."
  });
}
