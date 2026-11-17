/*
 * Azur — calculs purs (sans affichage), partagés par l'application et les tests automatiques.
 * Dans le navigateur : window.AzurCalc. Dans Node : require("./calc.js").
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AzurCalc = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /** Période budgétaire contenant « today », décalée de « offset » mois. startDay : 1 à 28. */
  function period(offset, startDay, today) {
    const sd = Math.min(28, Math.max(1, +startDay || 1));
    const t = today ? new Date(today) : new Date();
    const y = t.getFullYear();
    let m = t.getMonth();
    if (t.getDate() < sd) m--;
    m += offset || 0;
    const start = new Date(y, m, sd), end = new Date(y, m + 1, sd - 1);
    return { start: iso(start), end: iso(end), startD: start, endD: end, days: Math.round((end - start) / 864e5) + 1 };
  }
  const inRange = (list, p) => list.filter(t => t.date >= p.start && t.date <= p.end);

  /** Totaux par type. outflow = toutes les sorties ; net = entrées − sorties. */
  function sums(list) {
    const s = { in: 0, out: 0, save: 0, gift: 0, other: 0 };
    list.forEach(t => { s[t.type] = (s[t.type] || 0) + (+t.amount || 0); });
    s.outflow = s.out + s.save + s.gift + s.other;
    s.net = s.in - s.outflow;
    return s;
  }
  function byCat(list, type) {
    const m = {};
    list.filter(t => t.type === type).forEach(t => { m[t.cat] = (m[t.cat] || 0) + (+t.amount || 0); });
    return m;
  }

  /** Identifiant fixe d'une copie mensuelle : deux appareils créent la même, jamais deux. */
  const recurringId = (seriesId, p) => `rec-${seriesId}-${p.start}`;
  const seriesOf = t => t.recId || (t.rec ? t.id : null);

  /** Copies mensuelles à créer pour la période p (opérations « Répéter chaque mois »). */
  function recurringPlan(all, p, now) {
    const latest = {};
    all.forEach(t => { const k = seriesOf(t); if (!k) return; if (!latest[k] || t.date > latest[k].date) latest[k] = t; });
    const ids = new Set(all.map(t => t.id));
    const out = [];
    Object.entries(latest).forEach(([k, t]) => {
      if (!t.rec || t.date >= p.start) return;
      const id = recurringId(k, p);
      if (ids.has(id)) return;
      if (all.some(x => seriesOf(x) === k && x.date >= p.start && x.date <= p.end)) return;
      const day = +t.date.slice(8);
      const cand = [p.startD, p.endD].map(d => {
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return new Date(d.getFullYear(), d.getMonth(), Math.min(day, dim));
      }).find(d => iso(d) >= p.start && iso(d) <= p.end);
      if (!cand) return;
      out.push({ ...t, id, recId: k, date: iso(cand), created: now || Date.now(), auto: true });
    });
    return out;
  }

  /** Copies mensuelles en double (même série, même date) : identifiants à supprimer. */
  function duplicateRecurring(all) {
    const groups = {};
    all.forEach(t => { if (!t.auto || !t.recId) return; const k = t.recId + "|" + t.date; (groups[k] = groups[k] || []).push(t); });
    const remove = [];
    Object.values(groups).forEach(g => {
      if (g.length < 2) return;
      const keep = g.find(t => String(t.id).startsWith("rec-")) || g.slice().sort((a, b) => (a.created || 0) - (b.created || 0))[0];
      g.forEach(t => { if (t !== keep) remove.push(t.id); });
    });
    return remove;
  }

  /**
   * Répartition d'une entrée : dîme (pourcentage) puis ce qui reste à verser sur les budgets
   * de semences et d'épargne, en tenant compte de ce qui a déjà été réparti pour cette entrée.
   * budgets : [{type, cat, amount}] dans l'ordre d'affichage.
   */
  function splitPlan({ entry, all, p, tithe, splitOn, budgets }) {
    const tc = tithe || { on: true, rate: 10 };
    const rate = +tc.rate || 10;
    const already = all.filter(t => t.from === entry.id);
    const alreadyByCat = byCat(already, "gift");
    Object.assign(alreadyByCat, ...["save", "other", "out"].map(ty => byCat(already, ty)));
    const alreadyTotal = already.reduce((a, t) => a + (+t.amount || 0), 0);
    const periodTx = inRange(all, p).filter(t => t.id !== entry.id);
    const lines = [];
    let left = entry.amount - alreadyTotal;
    if (tc.on !== false) {
      const due = Math.round(entry.amount * rate / 100) - (alreadyByCat.dime || 0);
      if (due > 0 && left > 0) { const a = Math.min(due, left); lines.push({ type: "gift", cat: "dime", amount: a, kind: "dime", rate }); left -= a; }
    }
    if (splitOn !== false) {
      const spent = { gift: byCat(periodTx, "gift"), save: byCat(periodTx, "save") };
      (budgets || []).forEach(b => {
        if (b.cat === "dime" && tc.on !== false) return;
        const rem = b.amount - ((spent[b.type] || {})[b.cat] || 0);
        if (rem <= 0 || left <= 0) return;
        const a = Math.min(rem, left);
        left -= a;
        lines.push({ type: b.type, cat: b.cat, amount: a, kind: "budget", remaining: rem });
      });
    }
    return { lines, alreadyTotal, alreadyCount: already.length };
  }

  /** Arrondi « agréable » vers le haut pour les plafonds suggérés. */
  function niceUp(v, decimals) {
    if (decimals) return Math.ceil(v / 10) * 10;
    return v < 5000 ? Math.ceil(v / 500) * 500 : Math.ceil(v / 1000) * 1000;
  }

  /** Simulateur d'épargne (même méthode que le classeur Budget DS) : chaque année, les 12 versements
   *  s'ajoutent au capital, puis l'ensemble rapporte le rendement annuel. Taux en décimal (0.04 = 4 %). */
  function simulate({ monthly = 0, initial = 0, rate = 0, inflation = 0, years = 30 }) {
    const rows = []; let value = initial, paid = initial;
    for (let y = 1; y <= years; y++) {
      value = (12 * monthly + value) * (1 + rate);
      paid += 12 * monthly;
      rows.push({ year: y, paid, value, gain: value - paid, today: value / Math.pow(1 + inflation, y) });
    }
    return rows;
  }
  /** Nombre d'années pour atteindre un objectif (null si plus de `max` ans). */
  function yearsToTarget(o, target, max = 30) {
    if (!(target > 0)) return null;
    if ((o.initial || 0) >= target) return 0;
    const r = simulate({ ...o, years: max }).find(x => x.value >= target);
    return r ? r.year : null;
  }
  /** Épargne mensuelle nécessaire pour atteindre `target` en `years` ans. */
  function monthlyNeeded({ target, initial = 0, rate = 0, years }) {
    if (!(target > 0) || !(years > 0)) return 0;
    const v = rate === 0 ? (target - initial) / (12 * years)
      : (target - initial * Math.pow(1 + rate, years)) / (12 * (1 + rate) * (Math.pow(1 + rate, years) - 1) / rate);
    return Math.max(0, v);
  }
  /** Voyants du classeur : solde, endettement et épargne rapportés aux revenus. */
  function signals({ income, net, debt, core }) {
    if (!(income > 0)) return null;
    const solde = net / income, dette = debt / income, epargne = core / income;
    return {
      solde: { v: solde, level: solde >= 0.10 ? "good" : solde >= 0 ? "warn" : "bad" },
      dette: { v: dette, level: dette < 0.15 ? "good" : dette <= 0.33 ? "warn" : "bad" },
      epargne: { v: epargne, level: epargne >= 0.10 ? "good" : epargne >= 0.05 ? "warn" : "bad" }
    };
  }
  /** Part de l'entrée qui dépasse le revenu de base, à verser au réservoir. */
  function reservoirShare({ entryAmount, monthIncome, base, alreadyDeposited }) {
    if (!(base > 0)) return 0;
    const surplus = Math.max(0, monthIncome - base) - (alreadyDeposited || 0);
    return Math.max(0, Math.min(entryAmount, surplus));
  }
  /** Rentabilité d'un bien (classeur ImmoView). */
  function propertyStats({ cost = 0, cash0 = 0, moves = [], since = "", nonOperating = [] }) {
    let tin = 0, tout = 0, rents = 0, charges = 0;
    moves.forEach(m => {
      const a = +m.amount || 0;
      if (m.dir === "in") tin += a; else tout += a;
      if (since && m.date < since) return;
      if (m.dir === "in" && m.poste === "loyers") rents += a;
      if (m.dir === "out" && !nonOperating.includes(m.poste)) charges += a;
    });
    const netYear = rents - charges;
    return {
      cash: cash0 + tin - tout, totalIn: tin, totalOut: tout, rents, charges,
      gross: cost > 0 ? rents / cost : null, net: cost > 0 ? netYear / cost : null,
      payback: cost > 0 && netYear > 0 ? cost / netYear : null
    };
  }

  /** Enveloppes de la méthode Budget DS : catégorie de dépense → enveloppe par défaut. */
  const ENVS = [["dieu", "Dieu", 10], ["noyau", "Le noyau", 10], ["essentiels", "Les essentiels", 50], ["dettes", "Les dettes", 20], ["famille", "La famille", 5], ["vie", "La vie", 5]];
  const ENV_OUT = { loyer: "essentiels", alim: "essentiels", transport: "essentiels", energie: "essentiels", gaz: "essentiels", telecom: "essentiels", sante: "essentiels", mutuelle: "essentiels", scolarite: "essentiels", cantine: "essentiels", entretien: "essentiels", personnel: "essentiels", frais: "essentiels", pro: "essentiels", dette: "dettes", famille: "famille", parents: "famille", ceremonies: "famille", depannage: "famille", pret: "famille", cotisation: "famille" };
  const defEnv = (type, cat) => (type === "in" ? null : type === "gift" ? "dieu" : type === "save" ? "noyau" : ENV_OUT[cat] || "vie");
  const envOf = (type, cat, envMap) => (type === "in" ? null : (envMap || {})[cat] || defEnv(type, cat));
  function envTotals(list, envMap) { const o = {}; ENVS.forEach(([id]) => (o[id] = 0)); list.forEach(t => { if (t.type === "in") return; const e = envOf(t.type, t.cat, envMap); o[e] = (o[e] || 0) + (+t.amount || 0); }); return o; }

  return { ENVS, ENV_OUT, defEnv, envOf, envTotals, pad, iso, period, inRange, sums, byCat, recurringId, recurringPlan, duplicateRecurring, splitPlan, niceUp, simulate, yearsToTarget, monthlyNeeded, signals, reservoirShare, propertyStats };
});
