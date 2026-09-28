"use strict";

const API = "https://api.frankfurter.dev/v2";
const POPULAR = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "AED", "SAR", "QAR"];
const TICKER = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "AED", "SAR", "QAR", "KWD", "SGD", "HKD", "ZAR", "TRY", "BRL", "MXN"];

const EVENTS = [
  { date: "1967-11-18", short: "£ devalued", title: "Sterling devalued by 14%" },
  { date: "1971-08-15", short: "Nixon shock", title: "Nixon ends dollar–gold link" },
  { date: "1985-09-22", short: "Plaza Accord", title: "Plaza Accord weakens the dollar" },
  { date: "1992-09-16", short: "Black Wednesday", title: "Black Wednesday: UK exits ERM" },
  { date: "1997-07-02", short: "Asian crisis", title: "Asian financial crisis begins" },
  { date: "2001-09-11", short: "9/11", title: "September 11 attacks" },
  { date: "2002-01-01", short: "Euro cash", title: "Euro notes and coins launch" },
  { date: "2008-09-15", short: "Lehman", title: "Lehman collapse, 2008 crash" },
  { date: "2010-05-02", short: "Greek bailout", title: "First Greek bailout" },
  { date: "2012-07-26", short: "“Whatever it takes”", title: "Draghi: “whatever it takes”" },
  { date: "2016-06-23", short: "Brexit vote", title: "UK votes to leave the EU" },
  { date: "2020-01-31", short: "Brexit day", title: "UK leaves the EU" },
  { date: "2020-03-11", short: "COVID-19", title: "COVID-19 pandemic declared" },
  { date: "2022-02-24", short: "Ukraine", title: "Russia invades Ukraine" },
  { date: "2022-09-23", short: "Mini-budget", title: "UK mini-budget gilt crisis" },
];

const HS_PRESETS = [
  { label: "2008 crash", date: "2008-09-15" },
  { label: "Brexit vote", date: "2016-06-23" },
  { label: "COVID", date: "2020-03-11" },
  { label: "5Y ago", years: 5 },
  { label: "1Y ago", years: 1 },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ───────────── Frankfurter v2 API (cached) ───────────── */
const cache = new Map();
function api(path) {
  if (!cache.has(path)) {
    const p = fetch(API + path).then(async (r) => {
      if (!r.ok) {
        const err = new Error((await r.json().catch(() => ({}))).message || `Request failed (${r.status})`);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

async function getLatest(base) {
  const rows = await api(`/rates?base=${base}`);
  const rates = { [base]: 1 };
  let date = "";
  for (const r of rows) {
    rates[r.quote] = r.rate;
    if (r.date > date) date = r.date;
  }
  return { rates, date };
}
const getRate = (base, quote, date) => api(`/rate/${base}/${quote}${date ? `?date=${date}` : ""}`);
async function getSeries(base, quote, from, to, group) {
  let q = `/rates?base=${base}&quotes=${quote}&from=${from}`;
  if (to) q += `&to=${to}`;
  if (group) q += `&group=${group}`;
  const rows = await api(q);
  return rows
    .filter((r) => r.quote === quote && r.rate != null)
    .map((r) => ({ d: r.date, t: parseDate(r.date).getTime(), v: r.rate }))
    .sort((a, b) => a.t - b.t);
}

/* ───────────── Formatting ───────────── */
const locale = navigator.language || "en-GB";
function fmtMoney(v, code) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(v);
  } catch {
    return `${v.toFixed(2)} ${code}`;
  }
}
function fmtRate(r) {
  const d = r >= 100 ? 2 : r >= 1 ? 4 : r >= 0.01 ? 5 : 7;
  return r.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtAxis(v, dec) {
  if (Math.abs(v) >= 1e4) return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(v);
  return v.toFixed(Math.min(dec, 7));
}
function fmtPct(p, signed = true) {
  const s = (Math.abs(p) * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  if (!signed) return s;
  return (p > 0 ? "+" : p < 0 ? "−" : "") + s;
}
const parseDate = (s) => new Date(s + "T00:00:00Z");
function fmtDate(s, style = "medium") {
  const o = {
    long: { day: "numeric", month: "long", year: "numeric" },
    medium: { day: "numeric", month: "short", year: "numeric" },
    tiny: { day: "numeric", month: "short", year: "2-digit" },
    month: { month: "short", year: "numeric" },
  }[style];
  return parseDate(s).toLocaleDateString(locale, { ...o, timeZone: "UTC" });
}
function parseAmount(str) {
  const n = parseFloat(String(str).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function formatAmountInput(el) {
  const n = parseAmount(el.value);
  if (Number.isFinite(n)) el.value = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
const isoToday = () => new Date().toISOString().slice(0, 10);
function addDays(iso, days) {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function shiftYears(iso, years) {
  const d = parseDate(iso);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => (parseDate(b) - parseDate(a)) / 864e5;

/* ───────────── Currencies ───────────── */
const currencies = {}; // code -> { name, start }

// Searchable currency dropdown (160+ codes is too many for a native select)
const pickers = [];
class Picker {
  constructor(el, onChange) {
    this.el = el;
    this.onChange = onChange;
    this._value = el.dataset.default;
    el.innerHTML = `
      <button type="button" class="picker-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(el.dataset.label)}">
        <span class="code"></span>
        <svg class="chev" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="picker-pop" hidden>
        <input type="search" placeholder="Search currency or country" aria-label="Search currencies" autocomplete="off" spellcheck="false">
        <ul class="picker-list" role="listbox"></ul>
      </div>`;
    this.btn = el.querySelector(".picker-btn");
    this.pop = el.querySelector(".picker-pop");
    this.input = el.querySelector("input");
    this.list = el.querySelector(".picker-list");

    this.btn.addEventListener("click", () => (this.pop.hidden ? this.open() : this.close()));
    this.input.addEventListener("input", () => this.render());
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    this.list.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-code]");
      if (li) this.pick(li.dataset.code);
    });
    this.list.addEventListener("pointermove", (e) => {
      const li = e.target.closest("li[data-code]");
      if (li) this.setActive(this.items.indexOf(li.dataset.code), false);
    });
    document.addEventListener("pointerdown", (e) => {
      if (!this.pop.hidden && !el.contains(e.target)) this.close(false);
    });
    pickers.push(this);
    this.sync();
  }
  get value() { return this._value; }
  set value(v) { this._value = v; this.sync(); }
  sync() {
    this.btn.querySelector(".code").textContent = this._value;
    this.btn.title = currencies[this._value]?.name || this._value;
  }
  open() {
    pickers.forEach((p) => p !== this && p.close(false));
    const r = this.el.getBoundingClientRect();
    this.el.classList.toggle("right", r.left + 320 > window.innerWidth - 16);
    this.pop.hidden = false;
    this.btn.setAttribute("aria-expanded", "true");
    this.input.value = "";
    this.render();
    this.input.focus();
  }
  close(refocus = true) {
    if (this.pop.hidden) return;
    this.pop.hidden = true;
    this.btn.setAttribute("aria-expanded", "false");
    if (refocus) this.btn.focus();
  }
  render() {
    const q = this.input.value.trim().toLowerCase();
    const all = Object.keys(currencies).sort();
    let groups;
    if (!q) {
      const pop = POPULAR.filter((c) => currencies[c]);
      groups = [pop, all.filter((c) => !pop.includes(c))];
    } else {
      const score = (c) => {
        const code = c.toLowerCase(), name = currencies[c].name.toLowerCase();
        if (code === q) return 0;
        if (code.startsWith(q)) return 1;
        if (name.split(/\s+/).some((w) => w.startsWith(q))) return 2;
        if (name.includes(q)) return 3;
        return -1;
      };
      groups = [all.map((c) => [c, score(c)]).filter(([, s]) => s >= 0).sort((a, b) => a[1] - b[1]).map(([c]) => c)];
    }
    this.items = groups.flat();
    const row = (c) => `<li role="option" data-code="${c}" aria-selected="${c === this._value}"><span class="c">${c}</span><span class="n">${esc(currencies[c].name)}</span></li>`;
    this.list.innerHTML = this.items.length
      ? groups.map((g) => g.map(row).join("")).join(`<li class="sep" role="presentation"></li>`)
      : `<li class="none">No matches</li>`;
    const i = this.items.indexOf(this._value);
    this.setActive(q ? 0 : Math.max(0, i));
  }
  setActive(i, scroll = true) {
    if (i < 0 || !this.items.length) return;
    this.active = Math.min(i, this.items.length - 1);
    this.list.querySelectorAll("li[data-code]").forEach((li) => li.classList.toggle("active", li.dataset.code === this.items[this.active]));
    if (scroll) this.list.querySelector("li.active")?.scrollIntoView({ block: "nearest" });
  }
  onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); this.setActive(this.active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.setActive(Math.max(0, this.active - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (this.items.length) this.pick(this.items[this.active]); }
    else if (e.key === "Escape") { e.preventDefault(); this.close(); }
    else if (e.key === "Tab") this.close(false);
  }
  pick(code) {
    this.close();
    if (code !== this._value) {
      this.value = code;
      this.onChange();
    }
  }
}

async function initCurrencies() {
  const list = await api("/currencies");
  for (const c of list) currencies[c.iso_code] = { name: c.name, start: c.start_date };
}

/* ───────────── Shared currency pair ───────────── */
const conv = { amount: $("cAmount"), result: $("cResult"), meta: $("cMeta") };
const pair = () => ({ from: conv.from.value, to: conv.to.value });
// Earliest date both currencies have data for
const pairStart = () => {
  const { from, to } = pair();
  return [currencies[from]?.start, currencies[to]?.start, "1949-01-01"].filter(Boolean).sort().pop();
};

function onPairChange() {
  const { from, to } = pair();
  $("hCode").textContent = from;
  $("tPair").textContent = `${from}/${to}`;
  hs.date.min = pairStart();
  renderPresets();
  runConverter();
  runHindsight();
  loadSeries();
  loadTicker();
}

/* ═════════════ Ticker ═════════════ */
let tickerSeq = 0;
async function loadTicker() {
  const seq = ++tickerSeq;
  const { from, to } = pair();
  const symbols = TICKER.filter((c) => c !== from && currencies[c]);
  try {
    // A short time series gives today's rate and the previous day's for the change
    const rows = await api(`/rates?base=${from}&quotes=${symbols.join(",")}&from=${addDays(isoToday(), -7)}`);
    if (seq !== tickerSeq) return;
    const byQuote = {};
    for (const r of rows) (byQuote[r.quote] ||= []).push(r);
    const items = symbols.filter((c) => byQuote[c]?.length).map((c) => {
      const s = byQuote[c].sort((a, b) => (a.date < b.date ? -1 : 1));
      const last = s[s.length - 1].rate, prev = (s[s.length - 2] || s[s.length - 1]).rate;
      const ch = (last - prev) / prev;
      const cls = ch > 0 ? "gain" : ch < 0 ? "loss" : "muted";
      const arrow = ch > 0 ? "▲" : ch < 0 ? "▼" : "•";
      return `<button class="ticker-item${c === to ? " on" : ""}" data-code="${c}" title="Convert ${from} to ${esc(currencies[c].name)}">
        <span class="t-code">${c}</span><span>${fmtRate(last)}</span><span class="t-ch ${cls}">${arrow}${fmtPct(Math.abs(ch), false)}</span></button>`;
    }).join("");
    // Two copies so the CSS marquee loops seamlessly
    $("tickerTrack").innerHTML = items + items.replace(/<button /g, '<button tabindex="-1" aria-hidden="true" ');
  } catch {
    if (seq === tickerSeq) $("tickerTrack").innerHTML = "";
  }
}

function initTicker() {
  $("tickerTrack").addEventListener("click", (e) => {
    const b = e.target.closest(".ticker-item");
    if (!b) return;
    conv.to.value = b.dataset.code;
    onPairChange();
  });
}

/* ═════════════ Converter ═════════════ */
async function runConverter() {
  const amt = parseAmount(conv.amount.value);
  const { from, to } = pair();
  if (!Number.isFinite(amt)) {
    conv.result.textContent = "—";
    conv.meta.textContent = "Enter an amount";
    return;
  }
  try {
    const { rates, date } = await getLatest(from);
    if (from !== conv.from.value || to !== conv.to.value) return; // stale
    const rate = rates[to];
    if (rate == null) throw new Error(`No current rate for ${from}/${to}`);
    $("updated").textContent = `Updated ${fmtDate(date)}`;
    conv.result.textContent = fmtMoney(amt * rate, to);
    conv.meta.innerHTML = `<strong>1 ${from} = ${fmtRate(rate)} ${to}</strong> · 1 ${to} = ${fmtRate(1 / rate)} ${from}`;
  } catch (e) {
    conv.result.textContent = "—";
    conv.meta.innerHTML = `<span class="error">${esc(e.message)}</span>`;
  }
}

function initConverter() {
  conv.from = new Picker($("cFrom"), onPairChange);
  conv.to = new Picker($("cTo"), onPairChange);
  conv.amount.addEventListener("input", runConverter);
  conv.amount.addEventListener("blur", () => formatAmountInput(conv.amount));
  $("cSwap").addEventListener("click", () => {
    [conv.from.value, conv.to.value] = [conv.to.value, conv.from.value];
    onPairChange();
  });
}

/* ═════════════ Hindsight ═════════════ */
const hs = { amount: $("hAmount"), date: $("hDate"), out: $("hOut"), presets: $("hPresets") };

function renderPresets() {
  const today = isoToday(), min = pairStart();
  hs.presets.innerHTML = HS_PRESETS
    .map((p) => ({ ...p, date: p.date || shiftYears(today, p.years) }))
    .filter((p) => p.date >= min)
    .map((p) => `<button type="button" data-date="${p.date}" class="${p.date === hs.date.value ? "active" : ""}">${esc(p.label)}</button>`)
    .join("");
}

let hsSeq = 0;
async function runHindsight() {
  const seq = ++hsSeq;
  const amt = parseAmount(hs.amount.value);
  const { from, to } = pair();
  const date = hs.date.value;
  hs.presets.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.date === date));

  const fail = (msg, cls = "muted") => {
    hs.out.innerHTML = `<p class="meta ${cls}">${msg}</p>`;
    setMark(null);
  };
  if (!Number.isFinite(amt) || !date) return fail("Enter an amount and a date");
  if (date < pairStart() || date > isoToday()) return fail(`Pick a date from ${fmtDate(pairStart())} to today`, "error");
  if (from === to) return fail("Pick two different currencies");

  try {
    // The historical endpoint gives the "then" rate in a single call; "now" is the latest rate.
    const [then, now] = await Promise.all([getRate(from, to, date), getRate(from, to)]);
    if (seq !== hsSeq) return;

    const vThen = amt * then.rate, vNow = amt * now.rate;
    const diff = vThen - vNow, pct = diff / vNow;
    const flat = Math.abs(pct) < 0.0005;
    const cls = flat ? "" : diff > 0 ? "gain" : "loss";
    const big = flat ? "±0" : `${diff > 0 ? "+" : "−"}${fmtMoney(Math.abs(diff), to)}`;
    const note = flat ? "Same as converting today"
      : `vs converting today · ${fmtPct(Math.abs(pct), false)} ${diff > 0 ? "better" : "worse"}`;
    const used = then.date !== date ? ` · nearest rate ${fmtDate(then.date, "tiny")}` : "";

    hs.out.innerHTML = `
      <div class="rise">
        <div class="hs-big ${cls}">${big}</div>
        <p class="meta">${note}${used}</p>
        <div class="hs-split">
          <div><div class="k">Then</div><div class="v">${fmtMoney(vThen, to)}</div><div class="s">${fmtRate(then.rate)} · ${fmtDate(then.date, "tiny")}</div></div>
          <div><div class="k">Today</div><div class="v">${fmtMoney(vNow, to)}</div><div class="s">${fmtRate(now.rate)} · ${fmtDate(now.date, "tiny")}</div></div>
        </div>
        <button class="link-btn" id="hToChart">Chart since then ↓</button>
      </div>`;
    $("hToChart").addEventListener("click", () => {
      setRange({ start: then.date });
      $("trends").scrollIntoView({ behavior: "smooth" });
    });
    setMark(then.date);
  } catch (e) {
    if (seq !== hsSeq) return;
    fail(e.status === 404 ? "No rate for that date — try a later one" : esc(e.message), "error");
  }
}

function initHindsight() {
  hs.date.max = isoToday();
  hs.presets.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    hs.date.value = b.dataset.date;
    runHindsight();
  });
  hs.amount.addEventListener("input", runHindsight);
  hs.amount.addEventListener("blur", () => formatAmountInput(hs.amount));
  hs.date.addEventListener("change", runHindsight);
}

/* ═════════════ Trends chart ═════════════ */
const trend = {
  range: $("tRange"), events: $("tEvents"), chart: $("chart"), status: $("chartStatus"),
  stats: $("tStats"), list: $("tEventList"),
  state: { range: "1Y", start: null },
  view: null,   // points for the current pair and range: [{d, t, v}]
  group: null,  // null (daily), "week" or "month"
  mark: null,   // hindsight date, drawn on the chart
};
const tooltip = $("tooltip");
const RANGE_YEARS = { "1Y": 1, "5Y": 5, "10Y": 10, "20Y": 20 };

function setMark(date) {
  if (trend.mark === date) return;
  trend.mark = date;
  if (trend.view) renderChart();
}

function rangeStart() {
  const min = pairStart();
  const s = trend.state.start || (trend.state.range === "MAX" ? min : shiftYears(isoToday(), RANGE_YEARS[trend.state.range] || 1));
  return s < min ? min : s;
}

let trendSeq = 0;
async function loadSeries() {
  const seq = ++trendSeq;
  const { from, to } = pair();
  if (from === to) {
    trend.view = null;
    renderChart();
    return;
  }
  const start = rangeStart();
  // Long ranges are downsampled server-side to keep requests fast
  const span = daysBetween(start, isoToday());
  const group = span <= 800 ? null : span <= 2600 ? "week" : "month";
  trend.status.textContent = "Loading…";
  trend.status.hidden = false;
  trend.chart.classList.add("loading");
  try {
    const [series, latest] = await Promise.all([getSeries(from, to, start, null, group), getRate(from, to)]);
    if (seq !== trendSeq) return;
    // Grouped points are period averages, so finish the line on today's actual rate
    if (series.length && latest.date > series[series.length - 1].d) {
      series.push({ d: latest.date, t: parseDate(latest.date).getTime(), v: latest.rate });
    }
    trend.view = series;
    trend.group = group;
    trend.chart.classList.remove("loading");
    renderChart();
  } catch (e) {
    if (seq !== trendSeq) return;
    trend.view = null;
    trend.chart.classList.remove("loading");
    clearSvg();
    trend.status.textContent = `Couldn’t load history: ${e.message}`;
    trend.status.hidden = false;
  }
}

function setRange({ range = null, start = null }) {
  trend.state = { range, start };
  trend.range.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.range === range);
    b.setAttribute("aria-selected", b.dataset.range === range);
  });
  loadSeries();
}

function clearSvg() {
  trend.chart.querySelector("svg")?.remove();
}

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

function nearestIndex(arr, t) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t < t) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(arr[lo - 1].t - t) < Math.abs(arr[lo].t - t)) lo--;
  return lo;
}

function pointLabel(p) {
  if (trend.group === "month" && p !== trend.view[trend.view.length - 1]) return fmtDate(p.d, "month");
  if (trend.group === "week" && p !== trend.view[trend.view.length - 1]) return `Week of ${fmtDate(p.d)}`;
  return fmtDate(p.d);
}

function renderHead(view) {
  const rate = $("tRate"), change = $("tChange");
  if (!view?.length) {
    rate.textContent = "—";
    change.textContent = "";
    trend.stats.textContent = "";
    return;
  }
  const first = view[0], last = view[view.length - 1];
  let hi = first, lo = first;
  for (const p of view) { if (p.v > hi.v) hi = p; if (p.v < lo.v) lo = p; }
  const ch = (last.v - first.v) / first.v;
  const dstyle = trend.group === "month" ? "month" : "tiny";
  rate.textContent = fmtRate(last.v);
  change.textContent = fmtPct(ch);
  change.className = `trend-change ${ch > 0 ? "gain" : ch < 0 ? "loss" : "muted"}`;
  trend.stats.innerHTML =
    `Since ${fmtDate(first.d, trend.group === "month" ? "month" : "medium")} · High <strong class="mono">${fmtRate(hi.v)}</strong> ${fmtDate(hi.d, dstyle)} · ` +
    `Low <strong class="mono">${fmtRate(lo.v)}</strong> ${fmtDate(lo.d, dstyle)}`;
}

function eventsInView(view) {
  if (!trend.events.checked || !view || view.length < 2) return [];
  const t0 = view[0].t, t1 = view[view.length - 1].t;
  return EVENTS
    .map((e, i) => ({ ...e, n: i + 1, t: parseDate(e.date).getTime() }))
    .filter((e) => e.t >= t0 && e.t <= t1);
}

// How the pair moved in the 30 days after an event, from a small daily window
async function eventMove(from, to, e) {
  const s = await getSeries(from, to, addDays(e.date, -7), addDays(e.date, 37));
  const before = [...s].reverse().find((p) => p.d < e.date);
  const after = s.find((p) => p.d >= addDays(e.date, 30));
  return before && after ? (after.v - before.v) / before.v : null;
}

let evSeq = 0;
function renderEventList(evs) {
  const seq = ++evSeq;
  if (!evs.length) {
    trend.list.innerHTML = trend.events.checked && trend.view
      ? `<li class="empty">No events in this range — try 10Y or Max</li>`
      : "";
    return;
  }
  trend.list.innerHTML = evs.map((e) =>
    `<li data-ev="${e.n}"><span class="n">${e.n}</span><span class="t">${esc(e.title)}<span class="d">${fmtDate(e.date, "tiny")}</span></span><span class="m" title="Move over the following 30 days"><span class="muted">…</span></span></li>`
  ).join("");
  const { from, to } = pair();
  evs.forEach((e) => {
    eventMove(from, to, e).then((p) => {
      if (seq !== evSeq) return;
      const cell = trend.list.querySelector(`li[data-ev="${e.n}"] .m`);
      if (cell) cell.innerHTML = p == null ? `<span class="muted">—</span>` : `<span class="${p > 0 ? "gain" : p < 0 ? "loss" : ""}">${fmtPct(p)} 30d</span>`;
    }).catch(() => {});
  });
}

function renderChart() {
  const view = trend.view;
  renderHead(view);
  const evs = eventsInView(view);
  const evKey = [!!view, trend.events.checked, pair().from, pair().to, ...evs.map((e) => e.n)].join();
  if (evKey !== trend.evKey) { trend.evKey = evKey; renderEventList(evs); }
  clearSvg();

  const { from, to } = pair();
  if (from === to) {
    trend.status.textContent = "Pick two different currencies";
    trend.status.hidden = false;
    return;
  }
  if (!view || view.length < 2) return;
  trend.status.hidden = true;

  const W = trend.chart.clientWidth, H = trend.chart.clientHeight;
  if (W < 120) return; // not laid out yet; the ResizeObserver will redraw
  const narrow = W < 560;

  const padL = 4, padR = 54, padB = 26;
  const t0 = view[0].t, t1 = view[view.length - 1].t;
  const plotW = W - padL - padR;
  const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * plotW;

  // Lay out event badges in up to three rows; where it's crowded, drop a label and keep its number
  const rowEnd = [], rowLast = [];
  evs.forEach((e) => {
    e.x = x(e.t);
    const left = e.x - 11;
    e.showLabel = !narrow;
    let r = [0, 1, 2].find((i) => !(rowEnd[i] >= left));
    if (r === undefined) {
      r = [0, 1, 2].find((i) => rowLast[i].x + 11 < left);
      if (r !== undefined) rowLast[r].showLabel = false;
      else r = rowEnd.indexOf(Math.min(...rowEnd));
    }
    rowEnd[r] = left + (e.showLabel ? 26 + e.short.length * 6.6 : 24);
    rowLast[r] = e;
    e.row = r;
  });
  const padT = evs.length ? 16 + rowEnd.length * 22 : 12;
  const plotH = H - padT - padB;

  let min = Infinity, max = -Infinity;
  for (const p of view) { if (p.v < min) min = p.v; if (p.v > max) max = p.v; }
  const span = max - min || max * 0.01;
  const step = niceStep(span / (narrow ? 4 : 5));
  const yMin = Math.max(0, Math.floor((min - span * 0.04) / step) * step);
  const yMax = Math.ceil((max + span * 0.04) / step) * step;
  const y = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Downsample the path for long series, keeping each bucket's extremes
  const pts = [];
  const bucket = Math.max(1, Math.floor(view.length / (plotW * 1.5)));
  for (let i = 0; i < view.length; i += bucket) {
    const chunk = view.slice(i, i + bucket);
    let a = chunk[0], b = chunk[0];
    for (const p of chunk) { if (p.v < a.v) a = p; if (p.v > b.v) b = p; }
    (a.t <= b.t ? [a, b] : [b, a]).forEach((p) => pts.push(p));
  }
  const last = view[view.length - 1];
  if (pts[pts.length - 1] !== last) pts.push(last);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${x(last.t).toFixed(1)},${padT + plotH}L${padL},${padT + plotH}Z`;

  // Y grid
  let grid = "", axis = "";
  const mant = step / Math.pow(10, Math.floor(Math.log10(step)));
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + (mant === 2.5 ? 1 : 0));
  for (let v = yMin; v <= yMax + step / 2; v += step) {
    const yy = y(v).toFixed(1);
    grid += `<line x1="${padL}" x2="${W - padR + 6}" y1="${yy}" y2="${yy}"/>`;
    axis += `<text x="${W - padR + 12}" y="${yy}" dominant-baseline="middle">${fmtAxis(v, dec)}</text>`;
  }

  // X ticks: pick a month interval that fits
  const months = (t1 - t0) / (30.44 * 864e5);
  const maxTicks = Math.max(2, Math.floor(plotW / (narrow ? 64 : 88)));
  const interval = [1, 2, 3, 6, 12, 24, 36, 60, 120].find((m) => months / m <= maxTicks) || 240;
  const d = new Date(t0);
  d.setUTCDate(1);
  if (interval >= 12) {
    const yrs = interval / 12;
    d.setUTCMonth(0);
    d.setUTCFullYear(Math.ceil(new Date(t0).getUTCFullYear() / yrs) * yrs);
  } else {
    d.setUTCMonth(Math.ceil(d.getUTCMonth() / interval) * interval);
  }
  while (d.getTime() <= t1) {
    const t = d.getTime();
    if (t >= t0) {
      const label = interval >= 12
        ? d.getUTCFullYear()
        : d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" }) + (d.getUTCMonth() === 0 || interval >= 6 ? " " + String(d.getUTCFullYear()).slice(-2) : "");
      axis += `<text x="${x(t).toFixed(1)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
    }
    d.setUTCMonth(d.getUTCMonth() + interval);
  }

  // Events
  const evSvg = evs.map((e) => {
    const p = view[nearestIndex(view, e.t)];
    const by = 11 + e.row * 22;
    const label = !e.showLabel ? "" : `<text class="ev-label" x="${(e.x + 13).toFixed(1)}" y="${by + 4}">${esc(e.short)}</text>`;
    return `<g class="ev" data-ev="${e.n}">
      <line class="ev-line" x1="${e.x.toFixed(1)}" x2="${e.x.toFixed(1)}" y1="${by + 9}" y2="${padT + plotH}"/>
      <circle class="ev-dot" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5"/>
      <g class="ev-badge"><circle cx="${e.x.toFixed(1)}" cy="${by}" r="9"/><text x="${e.x.toFixed(1)}" y="${by + 0.5}">${e.n}</text></g>
      ${label}
    </g>`;
  }).join("");

  // Hindsight date marker
  let markSvg = "";
  if (trend.mark) {
    const mt = parseDate(trend.mark).getTime();
    if (mt >= t0 && mt <= t1) {
      const p = view[nearestIndex(view, mt)];
      const mx = x(mt), right = mx > padL + plotW - 90;
      markSvg = `<g>
        <line class="mark-line" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${padT}" y2="${padT + plotH}"/>
        <circle class="mark-dot" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5"/>
        <text class="mark-label" x="${(mx + (right ? -7 : 7)).toFixed(1)}" y="${padT + plotH - 7}" text-anchor="${right ? "end" : "start"}">your date</text>
      </g>`;
    }
  }

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${from}/${to} exchange rate chart">
    <defs>
      <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style="stop-color:var(--accent);stop-opacity:.18"/>
        <stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
      </linearGradient>
    </defs>
    <g class="grid">${grid}</g>
    <path d="${area}" fill="url(#fill)"/>
    <path class="line" d="${line}"/>
    <g class="axis">${axis}</g>
    ${evSvg}
    ${markSvg}
    <g class="hover" visibility="hidden">
      <line class="cross" y1="${padT}" y2="${padT + plotH}"/>
      <circle class="hover-dot" r="4.5"/>
    </g>
    <rect x="${padL}" y="0" width="${plotW}" height="${H}" fill="transparent"/>
  </svg>`;
  trend.chart.insertAdjacentHTML("beforeend", svg);

  // Hover interaction
  const svgEl = trend.chart.querySelector("svg");
  const hover = svgEl.querySelector(".hover");
  const cross = hover.querySelector(".cross");
  const dot = hover.querySelector(".hover-dot");
  const invX = (px) => t0 + ((px - padL) / plotW) * (t1 - t0);

  const move = (ev) => {
    const rect = svgEl.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const p = view[nearestIndex(view, invX(Math.min(Math.max(px, padL), padL + plotW)))];
    const cx = x(p.t), cy = y(p.v);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx);
    dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
    hover.setAttribute("visibility", "visible");
    const near = evs.find((e) => Math.abs(e.x - cx) < 6);
    tooltip.innerHTML =
      `<div class="tt-d">${pointLabel(p)}</div>` +
      `<div>${fmtRate(p.v)} ${to}</div>` +
      (near ? `<div class="tt-e">${near.n}. ${esc(near.title)}</div>` : "");
    tooltip.hidden = false;
    const tx = rect.left + (cx / W) * rect.width;
    const tw = tooltip.offsetWidth / 2 + 8;
    tooltip.style.left = Math.min(Math.max(tx, tw), window.innerWidth - tw) + "px";
    tooltip.style.top = rect.top + (cy / H) * rect.height + "px";
  };
  const leave = () => { hover.setAttribute("visibility", "hidden"); tooltip.hidden = true; };
  svgEl.addEventListener("pointermove", move);
  svgEl.addEventListener("pointerdown", move);
  svgEl.addEventListener("pointerleave", leave);
}

function highlightEvent(n) {
  trend.chart.classList.toggle("dim", n != null);
  trend.chart.querySelectorAll(".ev").forEach((g) => g.classList.toggle("hot", g.dataset.ev === String(n)));
}

function initTrends() {
  trend.range.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) setRange({ range: b.dataset.range });
  });
  trend.events.addEventListener("change", renderChart);
  trend.list.addEventListener("pointerover", (e) => highlightEvent(e.target.closest("li[data-ev]")?.dataset.ev ?? null));
  trend.list.addEventListener("pointerleave", () => highlightEvent(null));
  window.addEventListener("scroll", () => (tooltip.hidden = true), { passive: true });

  let lastW = 0;
  new ResizeObserver(() => {
    const w = trend.chart.clientWidth;
    if (w !== lastW && trend.view) { lastW = w; renderChart(); }
  }).observe(trend.chart);
}

/* ───────────── Theme ───────────── */
function initTheme() {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("theme");
    if (saved) root.dataset.theme = saved;
  } catch {}
  $("themeToggle").addEventListener("click", () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  });
}

/* ───────────── Boot ───────────── */
(async function boot() {
  initTheme();
  try {
    await initCurrencies();
  } catch (e) {
    conv.meta.innerHTML = `<span class="error">Couldn’t reach the Frankfurter API: ${esc(e.message)}</span>`;
    return;
  }
  initTicker();
  initConverter();
  initHindsight();
  initTrends();
  onPairChange();
})();
