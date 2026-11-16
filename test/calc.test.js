"use strict";
// Tests des calculs d'Azur : node test/calc.test.js
const assert = require("assert");
const C = require("../src/renderer/calc.js");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

t("période du 1er au dernier jour du mois", () => {
  const p = C.period(0, 1, new Date(2026, 10, 9));
  assert.strictEqual(p.start, "2026-11-01"); assert.strictEqual(p.end, "2026-11-30"); assert.strictEqual(p.days, 30);
});
t("période qui commence le 25 (jour de salaire)", () => {
  assert.deepStrictEqual([C.period(0, 25, new Date(2026, 10, 9)).start, C.period(0, 25, new Date(2026, 10, 9)).end], ["2026-10-25", "2026-11-24"]);
  assert.deepStrictEqual([C.period(0, 25, new Date(2026, 10, 26)).start, C.period(0, 25, new Date(2026, 10, 26)).end], ["2026-11-25", "2026-12-24"]);
});
t("passage d'année et mois précédent", () => {
  const p = C.period(-1, 1, new Date(2027, 0, 15));
  assert.strictEqual(p.start, "2026-12-01"); assert.strictEqual(p.end, "2026-12-31");
  const f = C.period(-1, 1, new Date(2026, 2, 10));
  assert.strictEqual(f.end, "2026-02-28");
});
t("totaux : entrées, sorties, disponible", () => {
  const s = C.sums([{ type: "in", amount: 320000 }, { type: "out", amount: 75000 }, { type: "save", amount: 20000 }, { type: "gift", amount: 32000 }, { type: "other", amount: 5000 }]);
  assert.strictEqual(s.outflow, 132000); assert.strictEqual(s.net, 188000);
});
t("totaux par catégorie", () => {
  assert.deepStrictEqual(C.byCat([{ type: "out", cat: "alim", amount: 1000 }, { type: "out", cat: "alim", amount: 500 }, { type: "in", cat: "alim", amount: 9 }], "out"), { alim: 1500 });
});

const loyer = { id: "L1", type: "out", amount: 75000, cat: "loyer", date: "2026-10-03", rec: true };
const nov = C.period(0, 1, new Date(2026, 10, 9));
t("copie mensuelle créée une seule fois, à la même date", () => {
  const plan = C.recurringPlan([loyer], nov, 1);
  assert.strictEqual(plan.length, 1); assert.strictEqual(plan[0].date, "2026-11-03"); assert.strictEqual(plan[0].recId, "L1");
  assert.strictEqual(C.recurringPlan([loyer, ...plan], nov, 2).length, 0);
});
t("deux appareils créent la même copie (même identifiant)", () => {
  const a = C.recurringPlan([loyer], nov, 1), b = C.recurringPlan([loyer], nov, 999);
  assert.strictEqual(a[0].id, b[0].id);
});
t("le 31 devient le dernier jour d'un mois court", () => {
  const s = { ...loyer, id: "S1", date: "2026-10-31" };
  assert.strictEqual(C.recurringPlan([s], nov, 1)[0].date, "2026-11-30");
});
t("une série arrêtée ne se répète plus", () => {
  const copy = { ...loyer, id: "x", recId: "L1", date: "2026-10-20", rec: false };
  assert.strictEqual(C.recurringPlan([loyer, copy], nov, 1).length, 0);
});
t("doublons existants repérés, la copie à identifiant fixe est gardée", () => {
  const d1 = { id: "aaa", recId: "L1", date: "2026-11-03", auto: true, created: 1 };
  const d2 = { id: "rec-L1-2026-11-01", recId: "L1", date: "2026-11-03", auto: true, created: 2 };
  const d3 = { id: "bbb", recId: "L1", date: "2026-11-03", auto: true, created: 3 };
  assert.deepStrictEqual(C.duplicateRecurring([d1, d2, d3]).sort(), ["aaa", "bbb"]);
  assert.deepStrictEqual(C.duplicateRecurring([d1]), []);
});

const entry = { id: "E1", type: "in", amount: 150000, cat: "presta", date: "2026-11-05" };
const budgets = [{ type: "gift", cat: "offrande", amount: 10000 }, { type: "save", cat: "ep1", amount: 20000 }];
t("répartition : dîme 10 % puis budgets", () => {
  const r = C.splitPlan({ entry, all: [entry], p: nov, tithe: { on: true, rate: 10 }, budgets });
  assert.deepStrictEqual(r.lines.map(l => [l.cat, l.amount]), [["dime", 15000], ["offrande", 10000], ["ep1", 20000]]);
});
t("répartition : ce qui est déjà versé ce mois est déduit", () => {
  const paid = { id: "o", type: "gift", cat: "offrande", amount: 6000, date: "2026-11-02" };
  const r = C.splitPlan({ entry, all: [entry, paid], p: nov, tithe: { on: true, rate: 10 }, budgets });
  assert.strictEqual(r.lines.find(l => l.cat === "offrande").amount, 4000);
});
t("une entrée déjà répartie ne compte pas la dîme deux fois", () => {
  const done = [
    { id: "s1", type: "gift", cat: "dime", amount: 15000, date: entry.date, from: "E1" },
    { id: "s2", type: "gift", cat: "offrande", amount: 10000, date: entry.date, from: "E1" },
    { id: "s3", type: "save", cat: "ep1", amount: 20000, date: entry.date, from: "E1" }
  ];
  const r = C.splitPlan({ entry, all: [entry, ...done], p: nov, tithe: { on: true, rate: 10 }, budgets });
  assert.strictEqual(r.lines.length, 0); assert.strictEqual(r.alreadyTotal, 45000);
});
t("une répartition partielle propose seulement le reste", () => {
  const part = [{ id: "s1", type: "gift", cat: "dime", amount: 5000, date: entry.date, from: "E1" }];
  const r = C.splitPlan({ entry, all: [entry, ...part], p: nov, tithe: { on: true, rate: 10 }, budgets });
  assert.strictEqual(r.lines.find(l => l.cat === "dime").amount, 10000);
});
t("la répartition ne dépasse jamais le montant de l'entrée", () => {
  const small = { ...entry, id: "E2", amount: 20000 };
  const r = C.splitPlan({ entry: small, all: [small], p: nov, tithe: { on: true, rate: 10 }, budgets });
  assert.strictEqual(r.lines.reduce((a, l) => a + l.amount, 0), 20000);
});
t("dîme désactivée et répartition désactivée", () => {
  assert.strictEqual(C.splitPlan({ entry, all: [entry], p: nov, tithe: { on: false }, splitOn: false, budgets }).lines.length, 0);
});
t("plafonds suggérés arrondis vers le haut", () => {
  assert.strictEqual(C.niceUp(4210), 4500); assert.strictEqual(C.niceUp(66150), 67000); assert.strictEqual(C.niceUp(12.3, 2), 20);
});
t("simulateur : mêmes valeurs que le classeur (25 000 F/mois à 4 %)", () => {
  const r = C.simulate({ monthly: 25000, initial: 0, rate: 0.04, inflation: 0.02, years: 10 });
  assert.strictEqual(Math.round(r[0].value), 312000);
  assert.strictEqual(Math.round(r[1].value), 636480);
  assert.strictEqual(r[9].paid, 3000000);
  assert.ok(Math.abs(r[9].value - 312000 * (Math.pow(1.04, 10) - 1) / 0.04) < 1e-6, r[9].value);
});
t("simulateur : années pour atteindre l'objectif et épargne nécessaire", () => {
  const o = { monthly: 25000, initial: 0, rate: 0.04 };
  assert.strictEqual(C.yearsToTarget(o, 5000000), 13);
  const m = C.monthlyNeeded({ target: 5000000, initial: 0, rate: 0.04, years: 10 });
  const back = C.simulate({ monthly: m, rate: 0.04, years: 10 })[9].value;
  assert.ok(Math.abs(back - 5000000) < 1, back);
  assert.strictEqual(C.monthlyNeeded({ target: 1200000, rate: 0, years: 2 }), 50000);
  assert.strictEqual(C.yearsToTarget({ monthly: 0, initial: 0, rate: 0 }, 1000), null);
});
t("voyants : seuils du classeur", () => {
  const s = C.signals({ income: 100000, net: 12000, debt: 20000, core: 6000 });
  assert.deepStrictEqual([s.solde.level, s.dette.level, s.epargne.level], ["good", "warn", "warn"]);
  const b = C.signals({ income: 100000, net: -1, debt: 40000, core: 2000 });
  assert.deepStrictEqual([b.solde.level, b.dette.level, b.epargne.level], ["bad", "bad", "bad"]);
  assert.strictEqual(C.signals({ income: 0, net: 0, debt: 0, core: 0 }), null);
});
t("réservoir : seule la part au-delà du revenu de base", () => {
  assert.strictEqual(C.reservoirShare({ entryAmount: 80000, monthIncome: 230000, base: 200000, alreadyDeposited: 0 }), 30000);
  assert.strictEqual(C.reservoirShare({ entryAmount: 80000, monthIncome: 230000, base: 200000, alreadyDeposited: 30000 }), 0);
  assert.strictEqual(C.reservoirShare({ entryAmount: 50000, monthIncome: 150000, base: 200000 }), 0);
  assert.strictEqual(C.reservoirShare({ entryAmount: 50000, monthIncome: 500000, base: 0 }), 0);
});
t("immobilier : trésorerie et rendements", () => {
  const moves = [
    { dir: "in", poste: "loyers", amount: 600000, date: "2026-03-01" },
    { dir: "in", poste: "caution-in", amount: 100000, date: "2026-03-01" },
    { dir: "out", poste: "gardiennage", amount: 120000, date: "2026-04-01" },
    { dir: "out", poste: "credit", amount: 300000, date: "2026-05-01" }
  ];
  const r = C.propertyStats({ cost: 12000000, cash0: 50000, moves, since: "2025-12-01", nonOperating: ["credit", "materiaux", "main", "caution-out"] });
  assert.strictEqual(r.cash, 330000);
  assert.strictEqual(r.rents, 600000); assert.strictEqual(r.charges, 120000);
  assert.strictEqual(r.gross, 0.05); assert.strictEqual(r.net, 0.04); assert.strictEqual(r.payback, 25);
});
console.log(`\n${n} tests réussis`);
