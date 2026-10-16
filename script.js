/* ========================================================= EcoErgo - application logic (script.js) Needs data.js (content) to be loaded first. Data is stored in the browser only (localStorage). ========================================================= */
(function () {
  "use strict";

  var D = window.ECOERGO_DATA;
  if (!D) {
    console.error("EcoErgo: data.js did not load.");
    return;
  }

  var STORAGE_KEY = "ecoergo-data-v2";
  var $ = function (id) {
    return document.getElementById(id);
  };

  /* ==================== pure helpers (easy to test) ==================== */

  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function dateKey(d) {
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }

  function keyOffset(daysAgo) {
    var d = new Date();
    d.setHours(12, 0, 0, 0); // noon avoids daylight-saving edge cases
    d.setDate(d.getDate() - daysAgo);
    return dateKey(d);
  }
  function lastDays(n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(keyOffset(i));
    return out;
  }
  function keyToDate(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
  }
  function dayLabel(key) {
    try {
      return keyToDate(key).toLocaleDateString(undefined, { weekday: "short" });
    } catch (e) {
      return key.slice(5);
    }
  }
  function num(v) {
    v = Number(v);
    return isFinite(v) && v > 0 ? v : 0;
  }
  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function emptyDay() {
    return {
      breaks: 0,
      pages: 0,
      trips: 0,
      km: 0,
      mode: "car",
      co2: 0,
      clinic: 0,
      checks: 0,
      checkPct: 0,
      pain: [],
    };
  }
  function cleanDay(raw) {
    var d = emptyDay();
    if (!raw || typeof raw !== "object") return d;
    d.breaks = Math.floor(num(raw.breaks));
    d.pages = Math.floor(num(raw.pages));
    d.trips = Math.floor(num(raw.trips));
    d.km = num(raw.km);
    d.mode = D.factors.kgCO2ePerKm[raw.mode] !== undefined ? raw.mode : "car";
    d.co2 = num(raw.co2);
    d.clinic = raw.clinic ? 1 : 0;
    d.checks = Math.floor(num(raw.checks));
    d.checkPct = Math.min(100, num(raw.checkPct));
    d.pain = Array.isArray(raw.pain)
      ? raw.pain.slice(0, 50).map(function (p) {
          return {
            before: Math.min(10, num(p && p.before)),
            after: Math.min(10, num(p && p.after)),
          };
        })
      : [];
    return d;
  }

  /* CO2e = pages * pageFactor + trips * distance * modeFactor (illustrative factors) */
  function computeCo2(pages, trips, km, mode) {
    var f = D.factors;
    var modeFactor =
      f.kgCO2ePerKm[mode] !== undefined
        ? f.kgCO2ePerKm[mode]
        : f.kgCO2ePerKm.car;
    var paper = num(pages) * f.kgCO2ePerPage;
    var travel = num(trips) * num(km) * modeFactor;
    return { paper: paper, travel: travel, total: paper + travel };
  }

  function weekTotals(days) {
    var t = { breaks: 0, pages: 0, trips: 0, co2: 0, clinic: 0, checkDays: 0 };
    lastDays(7).forEach(function (k) {
      var d = days[k];
      if (!d) return;
      t.breaks += d.breaks;
      t.pages += d.pages;
      t.trips += d.trips;
      t.co2 += d.co2;
      t.clinic += d.clinic;
      if (d.checks > 0) t.checkDays += 1;
    });
    return t;
  }

  /* Green Score: each part = min(value / target, 1) * max points. Total is 0-100. */
  function computeScore(t) {
    var cfg = D.score;
    var parts = [
      { key: "breaks", value: t.breaks },
      { key: "paper", value: t.pages },
      { key: "travel", value: t.trips },
      { key: "posture", value: t.checkDays },
    ].map(function (p) {
      var c = cfg[p.key];
      var points = Math.min(p.value / c.target, 1) * c.max;
      return {
        key: p.key,
        label: c.label,
        short: c.short || c.label,
        value: p.value,
        target: c.target,
        max: c.max,
        points: points,
      };
    });
    var total = parts.reduce(function (s, p) {
      return s + p.points;
    }, 0);
    return { total: Math.round(total), parts: parts };
  }

  function currentStreak(days) {
    var i = 0;
    if (!days[keyOffset(0)] || days[keyOffset(0)].breaks === 0) i = 1; // today may still be empty
    var n = 0;
    while (i < 400) {
      var d = days[keyOffset(i)];
      if (d && d.breaks > 0) {
        n++;
        i++;
      } else break;
    }
    return n;
  }
  function longestStreak(days) {
    var keys = Object.keys(days)
      .filter(function (k) {
        return days[k].breaks > 0;
      })
      .sort();
    var best = 0,
      run = 0,
      prev = null;
    keys.forEach(function (k) {
      var t = keyToDate(k).getTime();
      if (prev !== null && Math.round((t - prev) / 86400000) === 1) run++;
      else run = 1;
      if (run > best) best = run;
      prev = t;
    });
    return best;
  }

  function earnedBadges(days) {
    var keys = Object.keys(days);
    var sum = function (f) {
      return keys.reduce(function (s, k) {
        return s + days[k][f];
      }, 0);
    };
    var w = weekTotals(days);
    return {
      first: sum("breaks") > 0,
      goal: keys.some(function (k) {
        return days[k].breaks >= D.dailyBreakGoal;
      }),
      streak: longestStreak(days) >= 3,
      week: w.breaks >= 20,
      paper: sum("pages") >= 50,
      travel: sum("trips") >= 3,
      posture: keys.some(function (k) {
        return days[k].checkPct >= 80;
      }),
    };
  }

  function badgeProgress(days) {
    var keys = Object.keys(days);
    var sum = function (f) {
      return keys.reduce(function (s, k) {
        return s + days[k][f];
      }, 0);
    };
    var maxDay = function (f) {
      return keys.reduce(function (m, k) {
        return Math.max(m, days[k][f]);
      }, 0);
    };
    var w = weekTotals(days);
    return {
      first: { value: sum("breaks"), target: 1 },
      goal: { value: maxDay("breaks"), target: D.dailyBreakGoal },
      streak: { value: longestStreak(days), target: 3 },
      week: { value: w.breaks, target: 20 },
      paper: { value: sum("pages"), target: 50 },
      travel: { value: sum("trips"), target: 3 },
      posture: { value: maxDay("checkPct"), target: 80 },
    };
  }

  function demoDays() {
    var keys = lastDays(7);
    var breaks = [3, 4, 2, 5, 4, 3, 2];
    var pages = [12, 0, 25, 8, 15, 10, 6];
    var trips = [0, 1, 0, 1, 0, 1, 1];
    var checkP = [0, 75, 0, 88, 0, 100, 0];
    var out = {};
    keys.forEach(function (k, i) {
      var d = emptyDay();
      d.breaks = breaks[i];
      d.pages = pages[i];
      d.trips = trips[i];
      d.km = trips[i] ? 12 : 0;
      d.mode = "car";
      d.co2 = computeCo2(d.pages, d.trips, d.km, d.mode).total;
      d.clinic = i === 3 ? 1 : 0;
      d.checks = checkP[i] ? 1 : 0;
      d.checkPct = checkP[i];
      d.pain = [{ before: 4 + (i % 3), after: 2 + (i % 2) }];
      out[k] = d;
    });
    return out;
  }

  /* ==================== state & storage ==================== */

  var state = loadState();
  var memoryOnly = false;

  function loadState() {
    var s = {
      days: {},
      settings: { theme: null, interval: 30, favorites: [] },
      demo: false,
    };
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && typeof raw === "object") {
        Object.keys(raw.days || {}).forEach(function (k) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k)) s.days[k] = cleanDay(raw.days[k]);
        });
        if (raw.settings) {
          s.settings.theme =
            raw.settings.theme === "dark" || raw.settings.theme === "light"
              ? raw.settings.theme
              : null;
          s.settings.interval =
            [1, 30, 45, 60].indexOf(Number(raw.settings.interval)) >= 0
              ? Number(raw.settings.interval)
              : 30;
          if (Array.isArray(raw.settings.favorites)) {
            s.settings.favorites = raw.settings.favorites
              .filter(function (id, i, a) {
                return (
                  a.indexOf(id) === i &&
                  D.exercises.some(function (e) {
                    return e.id === id;
                  })
                );
              })
              .slice(0, 12);
          }
        }
        s.demo = !!raw.demo;
      }
    } catch (e) {
      /* first visit or storage blocked */
    }
    return s;
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (!memoryOnly) {
        memoryOnly = true;
        toast(
          "Your browser blocked saving. Progress will be lost when you close this page."
        );
      }
    }
  }
  function today() {
    var k = keyOffset(0);
    if (!state.days[k]) state.days[k] = emptyDay();
    return state.days[k];
  }

  /* ==================== tiny DOM helpers ==================== */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function btn(label, cls, onClick) {
    var b = el("button", cls || "btn", label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function reducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }
  function scrollToId(id) {
    var t = $(id);
    if (!t) return;
    try {
      t.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    } catch (e) {
      t.scrollIntoView();
    }
  }
  function dayFull(key) {
    try {
      return keyToDate(key).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch (e) {
      return key;
    }
  }
  function makeTable(headers, rows) {
    var wrap = el("div", "table-wrap");
    var t = el("table");
    var tr = el("tr");
    headers.forEach(function (h) {
      tr.appendChild(el("th", null, h));
    });
    t.appendChild(el("thead")).appendChild(tr);
    var tb = el("tbody");
    rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (c) {
        row.appendChild(el("td", null, String(c)));
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }
  function barRow(label, right, pct) {
    var row = el("div", "bar-row");
    var top = el("div", "bar-top");
    top.appendChild(el("span", null, label));
    top.appendChild(el("strong", null, right));
    row.appendChild(top);
    var bar = el("div", "progress");
    var fill = el("div", "progress-bar");
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    bar.appendChild(fill);
    row.appendChild(bar);
    return row;
  }

  /* ==================== modal ==================== */

  var modalKind = null,
    modalArg = null,
    lastFocus = null;

  function openModal(node, kind, arg) {
    var body = $("modalBody");
    body.textContent = "";
    body.appendChild(node);
    modalKind = kind || null;
    modalArg = arg || null;
    if ($("modal").hidden) lastFocus = document.activeElement;
    $("modal").hidden = false;
    document.body.classList.add("modal-open");
    $("modalCard").scrollTop = 0;
    try {
      $("modalCard").focus();
    } catch (e) {
      /* optional */
    }
  }
  function closeModal() {
    if ($("modal").hidden) return;
    $("modal").hidden = true;
    document.body.classList.remove("modal-open");
    modalKind = null;
    modalArg = null;
    try {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    } catch (e) {
      /* optional */
    }
  }
  function modalHead(icon, title, sub) {
    var h = el("div", "m-head");
    h.appendChild(el("div", "m-icon", icon));
    var t = el("div");
    var h3 = el("h3", null, title);
    h3.id = "modalTitleAnchor";
    t.appendChild(h3);
    if (sub) t.appendChild(el("span", "chip", sub));
    h.appendChild(t);
    return h;
  }
  function goButton(label, id) {
    return btn(label, "btn", function () {
      closeModal();
      scrollToId(id);
    });
  }

  /* ---- exercise detail ---- */
  function openExercise(id) {
    var ex = exById[id];
    if (!ex) return;
    var fav = state.settings.favorites.indexOf(id) >= 0;
    var box = el("div");
    var c = el("div", "m-center");
    c.appendChild(
      el("div", "exercise-icon anim-" + ex.anim + " playing", ex.icon)
    );
    box.appendChild(c);
    var h = el("h3", null, ex.title);
    h.id = "modalTitleAnchor";
    h.style.margin = "0 0 6px";
    h.style.color = "var(--dark-green)";
    h.style.textAlign = "center";
    box.appendChild(h);
    var chips = el("div", "m-center");
    chips.appendChild(
      el("span", "chip", ex.area + " · " + ex.seconds + " seconds")
    );
    box.appendChild(chips);
    var ol = el("ol", "m-list");
    ex.steps.forEach(function (s) {
      ol.appendChild(el("li", null, s));
    });
    box.appendChild(ol);
    box.appendChild(el("p", "caution", "⚠ " + ex.caution));
    var acts = el("div", "m-actions");
    acts.appendChild(
      btn("▶ Start now", "btn", function () {
        startSingle(id);
      })
    );
    acts.appendChild(
      btn(
        fav ? "★ In My Routine" : "☆ Add to My Routine",
        "btn btn-light",
        function () {
          toggleFav(id);
        }
      )
    );
    acts.appendChild(btn("Close", "btn btn-light", closeModal));
    box.appendChild(acts);
    openModal(box, "exercise", id);
  }

  /* ---- badge detail ---- */
  var badgeUnits = {
    first: "breaks logged",
    goal: "breaks in one day",
    streak: "days in a row",
    week: "breaks in the last 7 days",
    paper: "pages tracked",
    travel: "trips tracked",
    posture: "% best posture check",
  };
  var badgeGoto = {
    first: "exercises",
    goal: "exercises",
    streak: "exercises",
    week: "exercises",
    paper: "carbon",
    travel: "carbon",
    posture: "posture",
  };
  var badgeTips = {
    first: "Run any routine to the end, or tap + Log a break on the dashboard.",
    goal: "Complete your daily break goal in one day.",
    streak: "Log at least one break on 3 days in a row.",
    week: "Spread 20 breaks across the last 7 days.",
    paper: "Add the pages you avoided printing in the Carbon tracker.",
    travel: "Record trips you avoided, for example by joining online meetings.",
    posture:
      "Tick your posture self-check items and save a score of 80% or more.",
  };

  function openBadge(id) {
    var b = null;
    D.badges.forEach(function (x) {
      if (x.id === id) b = x;
    });
    if (!b) return;
    var earned = earnedBadges(state.days)[id];
    var pr = badgeProgress(state.days)[id];
    var shown = Math.min(pr.value, pr.target);
    var box = el("div");
    box.appendChild(
      modalHead(b.icon, b.title, earned ? "Earned" : "Not yet earned")
    );
    box.appendChild(el("p", null, b.desc));
    box.appendChild(
      barRow(
        "Progress",
        round2(shown) + " / " + pr.target + " " + badgeUnits[id],
        (pr.value / pr.target) * 100
      )
    );
    box.appendChild(
      el(
        "p",
        "note",
        earned
          ? "Nice work. Badges are worked out from your saved log, so they update if you change or clear your data."
          : "How to earn it: " + badgeTips[id]
      )
    );
    var acts = el("div", "m-actions");
    if (!earned) acts.appendChild(goButton("Take me there", badgeGoto[id]));
    acts.appendChild(btn("Close", "btn btn-light", closeModal));
    box.appendChild(acts);
    openModal(box, "badge", id);
  }

  /* ---- dashboard detail views ---- */
  var advice = {
    breaks: "Do one more 3-minute routine each work block.",
    paper: "Share files digitally and add the pages you avoided printing.",
    travel: "Choose an online meeting for one short trip and record it.",
    posture: "Save a posture self-check on more days.",
  };
  var adviceGoto = {
    breaks: "exercises",
    paper: "carbon",
    travel: "carbon",
    posture: "posture",
  };

  function openDetail(kind) {
    var keys = lastDays(7).slice().reverse();
    var wk = weekTotals(state.days);
    var box = el("div");
    var goto = null,
      gotoLabel = "";

    if (kind === "breaks" || kind === "pages") {
      var isB = kind === "breaks";
      box.appendChild(
        modalHead(
          isB ? "🧘" : "📄",
          isB ? "Breaks, last 7 days" : "Pages avoided, last 7 days",
          isB ? "Goal: " + D.dailyBreakGoal + " per day" : null
        )
      );
      var rows = keys.map(function (k) {
        var d = state.days[k] || emptyDay();
        return isB
          ? [
              dayFull(k),
              d.breaks,
              d.breaks >= D.dailyBreakGoal ? "Goal met" : "-",
            ]
          : [
              dayFull(k),
              d.pages,
              d.pages
                ? round2(d.pages * D.factors.kgCO2ePerPage).toFixed(2) + " kg"
                : "-",
            ];
      });
      box.appendChild(
        makeTable(
          isB ? ["Day", "Breaks", "Goal"] : ["Day", "Pages", "Paper CO₂e"],
          rows
        )
      );
      var daysGoal = keys.filter(function (k) {
        return state.days[k] && state.days[k].breaks >= D.dailyBreakGoal;
      }).length;
      box.appendChild(
        el(
          "p",
          "muted",
          isB
            ? "Total " +
                wk.breaks +
                " breaks, average " +
                round2(wk.breaks / 7).toFixed(1) +
                " per day, goal met on " +
                daysGoal +
                " of 7 days."
            : "Total " + wk.pages + " pages avoided this week."
        )
      );
      goto = isB ? "exercises" : "carbon";
      gotoLabel = isB ? "Do a break now" : "Open carbon tracker";
    } else if (kind === "co2") {
      box.appendChild(
        modalHead("🌿", "Estimated CO₂e, last 7 days", "Illustrative")
      );
      var crow = keys.map(function (k) {
        var d = state.days[k] || emptyDay();
        var p = computeCo2(d.pages, d.trips, d.km, d.mode);
        return [
          dayFull(k),
          p.paper.toFixed(2),
          p.travel.toFixed(2),
          d.co2.toFixed(2),
        ];
      });
      box.appendChild(
        makeTable(["Day", "Paper kg", "Travel kg", "Total kg"], crow)
      );
      box.appendChild(
        el(
          "p",
          "muted",
          "Week total: " + round2(wk.co2).toFixed(2) + " kg CO₂e."
        )
      );
      box.appendChild(
        el(
          "p",
          "note",
          "Estimates use illustrative emission factors and self-reported inputs. Clinic visits are never converted into carbon savings."
        )
      );
      goto = "carbon";
      gotoLabel = "Open carbon tracker";
    } else if (kind === "streak") {
      box.appendChild(modalHead("🔥", "Day streak", null));
      box.appendChild(
        barRow(
          "Current streak",
          currentStreak(state.days) + " day(s)",
          (currentStreak(state.days) / 7) * 100
        )
      );
      box.appendChild(
        barRow(
          "Best streak",
          longestStreak(state.days) + " day(s)",
          (longestStreak(state.days) / 7) * 100
        )
      );
      box.appendChild(
        el(
          "p",
          "note",
          "A streak counts consecutive days with at least one logged break. If today has no break yet, yesterday's streak is kept until the day ends."
        )
      );
      goto = "exercises";
      gotoLabel = "Do a break now";
    } else if (kind === "score") {
      var sc = computeScore(wk);
      box.appendChild(
        modalHead(
          "⭐",
          "Weekly Green Score: " + sc.total + " / 100",
          "Last 7 days"
        )
      );
      sc.parts.forEach(function (p) {
        box.appendChild(
          barRow(
            p.short + ": " + p.value + " of " + p.target,
            round2(p.points).toFixed(1) + " / " + p.max + " pts",
            (p.points / p.max) * 100
          )
        );
      });
      var weakest = sc.parts.slice().sort(function (a, b) {
        return b.max - b.points - (a.max - a.points);
      })[0];
      if (weakest && weakest.max - weakest.points > 0.05) {
        box.appendChild(
          el("p", "note", "Biggest gain: " + advice[weakest.key])
        );
        goto = adviceGoto[weakest.key];
        gotoLabel = "Take me there";
      } else {
        box.appendChild(el("p", "note", "Full marks this week. Keep it up!"));
      }
      box.appendChild(
        el(
          "p",
          "muted small",
          "Each part earns min(value / target, 1) × its maximum points. The four parts add up to 100."
        )
      );
    } else {
      return;
    }
    var acts = el("div", "m-actions");
    if (goto) acts.appendChild(goButton(gotoLabel, goto));
    acts.appendChild(btn("Close", "btn btn-light", closeModal));
    box.appendChild(acts);
    openModal(box, "detail", kind);
  }

  function openMethod(key) {
    var m = D.methodDetails && D.methodDetails[key];
    if (!m) return;
    var box = el("div");
    box.appendChild(modalHead(m.icon, m.title, null));
    var ul = el("ul", "m-list");
    m.points.forEach(function (p) {
      ul.appendChild(el("li", null, p));
    });
    box.appendChild(ul);
    var acts = el("div", "m-actions");
    acts.appendChild(btn("Close", "btn btn-light", closeModal));
    box.appendChild(acts);
    openModal(box, "method", key);
  }

  /* ---- day log ---- */
  function ensureDay(key) {
    if (!state.days[key]) state.days[key] = emptyDay();
    return state.days[key];
  }

  function renderLog() {
    var body = $("logBody");
    if (!body) return;
    body.textContent = "";
    lastDays(7)
      .slice()
      .reverse()
      .forEach(function (k, i) {
        var d = state.days[k] || emptyDay();
        var tr = el("tr", "row-click" + (i === 0 ? " row-today" : ""));
        var first = el("td");
        var b = btn(
          dayFull(k) + (i === 0 ? " (today)" : ""),
          "text-btn",
          function (ev) {
            ev.stopPropagation();
            openDay(k);
          }
        );
        b.style.padding = "0";
        first.appendChild(b);
        tr.appendChild(first);
        [d.breaks, d.pages, d.trips, round2(d.co2).toFixed(2)].forEach(
          function (v) {
            tr.appendChild(el("td", null, String(v)));
          }
        );
        tr.addEventListener("click", function () {
          openDay(k);
        });
        body.appendChild(tr);
      });
  }

  function openDay(key) {
    var d = ensureDay(key);
    var box = el("div");
    box.appendChild(
      modalHead("📅", dayFull(key), key === keyOffset(0) ? "Today" : null)
    );
    var step = el("div", "stepper");
    var count = el("strong", null, String(d.breaks));
    var minus = btn("−", "btn btn-light", function () {
      var x = ensureDay(key);
      if (x.breaks > 0) {
        x.breaks--;
        count.textContent = String(x.breaks);
        saveState();
        render();
      }
    });
    minus.setAttribute("aria-label", "Remove one break");
    var plus = btn("+", "btn", function () {
      var x = ensureDay(key);
      if (x.breaks < 50) {
        x.breaks++;
        count.textContent = String(x.breaks);
        saveState();
        render();
      }
    });
    plus.setAttribute("aria-label", "Add one break");
    step.appendChild(el("span", null, "Breaks"));
    step.appendChild(minus);
    step.appendChild(count);
    step.appendChild(plus);
    box.appendChild(step);
    var parts = computeCo2(d.pages, d.trips, d.km, d.mode);
    box.appendChild(
      makeTable(
        ["Item", "Value"],
        [
          ["Pages avoided", d.pages],
          ["Trips avoided", d.trips + (d.trips ? " × " + d.km + " km" : "")],
          ["Estimated CO₂e", round2(d.co2).toFixed(2) + " kg"],
          ["Posture check", d.checks ? d.checkPct + "%" : "-"],
          ["Clinic visit (potential only)", d.clinic ? "Yes" : "No"],
        ]
      )
    );
    box.appendChild(
      el(
        "p",
        "muted small",
        parts.total > 0
          ? "Pages, trips and posture are edited from the Carbon and Posture sections (today only)."
          : "Use the Carbon tracker to add pages and trips for today."
      )
    );
    var acts = el("div", "m-actions");
    var clear = btn("Clear this day", "btn btn-light", null);
    var armed = false;
    clear.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        clear.textContent = "Tap again to confirm";
        return;
      }
      delete state.days[key];
      saveState();
      if (key === keyOffset(0)) syncForm();
      render();
      closeModal();
      toast("Day cleared.");
    });
    acts.appendChild(clear);
    acts.appendChild(btn("Close", "btn btn-light", closeModal));
    box.appendChild(acts);
    openModal(box, "day", key);
  }

  /* ---- insights ---- */
  function computeInsights(days) {
    var keys = lastDays(7);
    var prevKeys = [];
    for (var i = 13; i >= 7; i--) prevKeys.push(keyOffset(i));
    var sum = function (ks, f) {
      return ks.reduce(function (s, k) {
        return s + (days[k] ? days[k][f] : 0);
      }, 0);
    };
    var thisB = sum(keys, "breaks"),
      prevB = sum(prevKeys, "breaks");
    var out = [];

    var cmp;
    if (prevB > 0) {
      var ch = Math.round(((thisB - prevB) / prevB) * 100);
      cmp =
        ch === 0
          ? "Same as the previous 7 days."
          : (ch > 0 ? "Up " : "Down ") +
            Math.abs(ch) +
            "% from the previous 7 days (" +
            prevB +
            ").";
    } else {
      cmp = "No data for the previous 7 days to compare.";
    }
    out.push({
      icon: "📈",
      title: thisB + " breaks this week",
      text: "Average " + round2(thisB / 7).toFixed(1) + " per day. " + cmp,
      goto: "exercises",
      label: "Do a break",
    });

    var goalDays = keys.filter(function (k) {
      return days[k] && days[k].breaks >= D.dailyBreakGoal;
    }).length;
    var best = null;
    keys.forEach(function (k) {
      if (
        days[k] &&
        days[k].breaks > 0 &&
        (!best || days[k].breaks > days[best].breaks)
      )
        best = k;
    });
    out.push({
      icon: "🎯",
      title: "Daily goal met on " + goalDays + " of 7 days",
      text: best
        ? "Best day: " +
          dayFull(best) +
          " with " +
          days[best].breaks +
          " breaks."
        : "No breaks logged yet this week.",
    });

    out.push({
      icon: "🔥",
      title: "Streak: " + currentStreak(days) + " day(s)",
      text: "Your best streak so far is " + longestStreak(days) + " day(s).",
    });

    var co2 = sum(keys, "co2");
    out.push({
      icon: "🌿",
      title: round2(co2).toFixed(2) + " kg CO₂e estimated",
      text:
        sum(keys, "pages") +
        " pages and " +
        sum(keys, "trips") +
        " trips avoided this week (illustrative factors).",
      goto: "carbon",
      label: "Open tracker",
    });

    var n = 0,
      sb = 0,
      sa = 0;
    Object.keys(days).forEach(function (k) {
      days[k].pain.forEach(function (p) {
        n++;
        sb += p.before;
        sa += p.after;
      });
    });
    if (n) {
      var db = round2(sb / n),
        da = round2(sa / n);
      out.push({
        icon: "🩺",
        title:
          "Self-rated discomfort: " + db.toFixed(1) + " → " + da.toFixed(1),
        text:
          "Average before and after " +
          n +
          " rated session" +
          (n === 1 ? "" : "s") +
          ". This is a personal rating, not a medical measurement.",
      });
    } else {
      out.push({
        icon: "🩺",
        title: "No discomfort ratings yet",
        text: "Move the discomfort sliders next to the timer before and after a routine to build your own before/after data.",
      });
    }

    var sc = computeScore(weekTotals(days));
    var weakest = sc.parts.slice().sort(function (a, b) {
      return b.max - b.points - (a.max - a.points);
    })[0];
    if (weakest && weakest.max - weakest.points > 0.05) {
      out.push({
        icon: "💡",
        title: "Next best action",
        text:
          advice[weakest.key] +
          " (+" +
          round2(weakest.max - weakest.points).toFixed(0) +
          " pts possible)",
        goto: adviceGoto[weakest.key],
        label: "Take me there",
      });
    } else {
      out.push({
        icon: "🏆",
        title: "Full Green Score",
        text: "You reached every weekly target. Keep the habit going.",
      });
    }
    return out;
  }

  function renderInsights() {
    var wrap = $("insights");
    if (!wrap) return;
    wrap.textContent = "";
    computeInsights(state.days).forEach(function (it) {
      var c = el("div", "insight");
      c.appendChild(el("div", "i-icon", it.icon));
      c.appendChild(el("h4", null, it.title));
      c.appendChild(el("p", null, it.text));
      if (it.goto)
        c.appendChild(
          btn(it.label + " →", "text-btn", function () {
            scrollToId(it.goto);
          })
        );
      wrap.appendChild(c);
    });
  }

  /* ---- one click handler for links and "open detail" attributes ---- */
  function onDocumentClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href^="#"]');
    if (a) {
      var id = a.getAttribute("href").slice(1);
      if (id && $(id)) {
        ev.preventDefault();
        scrollToId(id);
      }
      return;
    }
    var m = t.closest("[data-method]");
    if (m) {
      openMethod(m.getAttribute("data-method"));
      return;
    }
    var dt = t.closest("[data-detail]");
    if (dt) {
      var isButton = dt.tagName === "BUTTON";
      if (!isButton && t.closest("button, a, input, select, textarea")) return; // let inner controls do their own job
      openDetail(dt.getAttribute("data-detail"));
    }
  }

  function onModalKey(ev) {
    if ($("modal").hidden) return;
    if (ev.key === "Escape") {
      closeModal();
      return;
    }
    if (ev.key !== "Tab") return;
    var f = $("modalCard").querySelectorAll(
      "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (!f.length) return;
    var first = f[0],
      last = f[f.length - 1];
    if (
      ev.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === $("modalCard"))
    ) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  /* ==================== toast, sound ==================== */

  function toast(message, actions, ms) {
    var area = $("toastArea");
    if (!area) return;
    while (area.children.length >= 3) area.removeChild(area.firstChild);
    var el = document.createElement("div");
    el.className = "toast";
    var span = document.createElement("span");
    span.textContent = message;
    el.appendChild(span);
    (actions || []).forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      b.addEventListener("click", function () {
        a.onClick();
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      el.appendChild(b);
    });
    area.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, ms || 5000);
  }

  var audioCtx = null;
  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = audioCtx || new AC();
        var o = audioCtx.createOscillator(),
          g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.frequency.value = 660;
        g.gain.value = 0.05;
        o.start();
        o.stop(audioCtx.currentTime + 0.18);
      }
    } catch (e) {
      /* sound is optional */
    }
    try {
      if (navigator.vibrate) navigator.vibrate(150);
    } catch (e2) {
      /* optional */
    }
  }

  /* ==================== banner & theme ==================== */

  function renderBanner() {
    var b = $("demoBanner"),
      t = $("demoBannerText");
    if (!b || !t) return;
    b.classList.toggle("is-demo", !!state.demo);
    t.textContent = state.demo
      ? "DEMO MODE: the data shown is simulated sample data, not real staff, institutional or measured data. Use Reset All Progress to clear it."
      : "All carbon figures are illustrative estimates, not verified measurements.";
  }

  function systemPrefersDark() {
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (e) {
      return false;
    }
  }
  function effectiveTheme() {
    var a = document.documentElement.getAttribute("data-theme");
    if (a === "dark" || a === "light") return a;
    return systemPrefersDark() ? "dark" : "light";
  }
  function applyTheme() {
    if (
      state.settings.theme &&
      document.documentElement.getAttribute("data-theme") !==
        state.settings.theme
    ) {
      document.documentElement.setAttribute("data-theme", state.settings.theme);
    }
    var btn = $("themeBtn");
    if (btn) btn.textContent = effectiveTheme() === "dark" ? "☀️" : "🌙";
  }
  function onThemeChanged() {
    applyTheme();
    destroyCharts();
    render();
  }

  /* ==================== exercise runner ==================== */

  var exById = {};
  D.exercises.forEach(function (e) {
    exById[e.id] = e;
  });

  var runner = {
    routineId: null,
    seq: [],
    idx: 0,
    total: 45,
    secondsLeft: 45,
    timer: null,
    finished: false,
    painTouched: false,
  };

  function fmt(sec) {
    sec = Math.max(0, sec);
    return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
  }
  function runnerMsg(t) {
    var m = $("timerMessage");
    if (m) m.textContent = t;
  }

  function durationText(items) {
    var total = items.reduce(function (s, id) {
      return s + exById[id].seconds;
    }, 0);
    var m = Math.floor(total / 60),
      sec = total % 60;
    return m === 0 ? sec + " s" : m + " min" + (sec ? " " + sec + " s" : "");
  }

  function allRoutines() {
    var list = D.routines.slice();
    var f = state.settings.favorites;
    if (f.length) {
      list.push({
        id: "mine",
        title: "My Routine ⭐",
        blurb: f.length + " starred exercise" + (f.length === 1 ? "" : "s"),
        items: f.slice(),
      });
    }
    return list;
  }

  function renderTabs() {
    var wrap = $("routineTabs");
    wrap.textContent = "";
    allRoutines().forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.className =
        "routine-tab" + (runner.routineId === r.id ? " active" : "");
      b.setAttribute("role", "tab");
      b.setAttribute(
        "aria-selected",
        runner.routineId === r.id ? "true" : "false"
      );
      var s1 = document.createElement("strong");
      s1.textContent = r.title;
      var s2 = document.createElement("span");
      s2.textContent = r.blurb + " · " + durationText(r.items);
      b.appendChild(s1);
      b.appendChild(s2);
      b.addEventListener("click", function () {
        setSequence(r.items, r.id);
        runnerMsg("Ready when you are.");
      });
      wrap.appendChild(b);
    });
  }

  function setSequence(ids, routineId) {
    pauseRunner();
    runner.routineId = routineId;
    runner.seq = ids.slice();
    runner.idx = 0;
    runner.finished = false;
    loadExercise();
    renderTabs();
  }

  function loadExercise() {
    var ex = exById[runner.seq[runner.idx]];
    runner.total = ex.seconds;
    runner.secondsLeft = ex.seconds;
    renderRunner();
  }

  function renderRunner() {
    var ex = exById[runner.seq[runner.idx]];
    if (!ex) return;
    var running = !!runner.timer;

    var icon = $("exerciseIcon");
    icon.textContent = ex.icon;
    icon.className =
      "exercise-icon anim-" + ex.anim + (running ? " playing" : "");
    $("exerciseArea").textContent = ex.area;
    $("exerciseTitle").textContent = ex.title;
    $("seqInfo").textContent =
      runner.seq.length > 1
        ? "Exercise " + (runner.idx + 1) + " of " + runner.seq.length
        : "Single exercise";

    var dots = $("seqDots");
    dots.textContent = "";
    if (runner.seq.length > 1) {
      runner.seq.forEach(function (_, i) {
        var s = document.createElement("button");
        s.type = "button";
        if (i < runner.idx || (runner.finished && i <= runner.idx))
          s.className = "done";
        else if (i === runner.idx) s.className = "now";
        s.setAttribute(
          "aria-label",
          "Go to exercise " + (i + 1) + ": " + exById[runner.seq[i]].title
        );
        s.addEventListener("click", function () {
          jumpRunner(i);
        });
        dots.appendChild(s);
      });
    }

    var ol = $("exerciseSteps");
    ol.textContent = "";
    ex.steps.forEach(function (st) {
      var li = document.createElement("li");
      li.textContent = st;
      ol.appendChild(li);
    });
    $("exerciseCaution").textContent = "⚠ " + ex.caution;

    updateTimerUi();
    var start = $("startTimer");
    start.textContent = running
      ? "Pause"
      : runner.finished
      ? "Restart"
      : runner.secondsLeft < runner.total
      ? "Resume"
      : "Start";
    $("prevExercise").disabled = runner.idx === 0;
    $("nextExercise").disabled = runner.idx >= runner.seq.length - 1;
  }

  function updateTimerUi() {
    $("timer").textContent = fmt(runner.secondsLeft);
    var pct = runner.total ? (1 - runner.secondsLeft / runner.total) * 100 : 0;
    $("timerBar").style.width = Math.min(100, Math.max(0, pct)) + "%";
  }

  function pauseRunner() {
    if (runner.timer) {
      clearInterval(runner.timer);
      runner.timer = null;
    }
    if (runner.seq.length) renderRunner();
  }

  function startRunner() {
    if (runner.timer) {
      pauseRunner();
      runnerMsg("Paused.");
      return;
    }
    if (runner.finished) {
      runner.idx = 0;
      runner.finished = false;
      loadExercise();
    }
    runner.endAt = Date.now() + runner.secondsLeft * 1000; // real clock, so a throttled tab stays accurate
    runner.timer = setInterval(tickRunner, 250);
    runnerMsg("Move gently and breathe normally.");
    renderRunner();
  }

  function tickRunner() {
    runner.secondsLeft = Math.max(
      0,
      Math.ceil((runner.endAt - Date.now()) / 1000)
    );
    if (runner.secondsLeft > 0) {
      updateTimerUi();
      return;
    }
    beep();
    if (runner.idx < runner.seq.length - 1) {
      runner.idx++;
      loadExercise();
      runner.endAt = Date.now() + runner.secondsLeft * 1000;
      runnerMsg("Next: " + exById[runner.seq[runner.idx]].title);
    } else {
      finishRunner();
    }
  }

  function finishRunner() {
    clearInterval(runner.timer);
    runner.timer = null;
    runner.finished = true;
    runner.secondsLeft = 0;
    if (runner.painTouched) {
      today().pain.push({
        before: Number($("painBefore").value),
        after: Number($("painAfter").value),
      });
      runner.painTouched = false;
    }
    if (runner.seq.length > 1) {
      today().breaks++;
      saveState();
      render();
      runnerMsg("Routine complete! Break logged. Well done.");
      toast("🎉 Routine complete. Break logged!");
    } else {
      saveState();
      render();
      runnerMsg(
        "Exercise complete. Use '+ Log a break' if you want to count it."
      );
    }
    renderRunner();
  }

  function stepRunner(delta) {
    var next = runner.idx + delta;
    if (next < 0 || next >= runner.seq.length) return;
    pauseRunner();
    runner.idx = next;
    runner.finished = false;
    loadExercise();
    runnerMsg("Ready when you are.");
  }

  function jumpRunner(i) {
    if (i < 0 || i >= runner.seq.length) return;
    pauseRunner();
    runner.idx = i;
    runner.finished = false;
    loadExercise();
    runnerMsg("Ready when you are.");
  }

  function resetRunner() {
    pauseRunner();
    runner.finished = false;
    loadExercise();
    runnerMsg("Timer reset.");
  }

  /* ---------- library ---------- */
  var libFilter = "All";
  var libQuery = "";

  function renderFilters() {
    var areas = ["All"];
    D.exercises.forEach(function (e) {
      if (areas.indexOf(e.area) < 0) areas.push(e.area);
    });
    var wrap = $("filters");
    wrap.textContent = "";
    areas.forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "filter-btn" + (a === libFilter ? " active" : "");
      b.textContent = a;
      b.setAttribute("aria-pressed", a === libFilter ? "true" : "false");
      b.addEventListener("click", function () {
        libFilter = a;
        renderFilters();
        renderLibrary();
      });
      wrap.appendChild(b);
    });
  }

  function matchesQuery(e) {
    if (!libQuery) return true;
    var hay = (e.title + " " + e.area + " " + e.steps.join(" ")).toLowerCase();
    return libQuery
      .toLowerCase()
      .split(/\s+/)
      .every(function (w) {
        return hay.indexOf(w) >= 0;
      });
  }

  function renderLibrary() {
    var grid = $("libGrid");
    grid.textContent = "";
    var list = D.exercises.filter(function (e) {
      return (libFilter === "All" || e.area === libFilter) && matchesQuery(e);
    });
    $("libCount").textContent =
      "Showing " +
      list.length +
      " of " +
      D.exercises.length +
      " exercises. Tap a card to open it.";
    if (!list.length)
      grid.appendChild(
        el("p", "muted", "No exercises match. Try another word or choose All.")
      );
    list.forEach(function (e) {
      var fav = state.settings.favorites.indexOf(e.id) >= 0;
      var card = el("div", "lib-card");
      var open = el("button", "lib-open");
      open.type = "button";
      open.setAttribute("aria-label", "Open " + e.title);
      open.appendChild(el("div", "lib-icon", e.icon));
      open.appendChild(el("h4", null, e.title));
      open.appendChild(el("span", "chip", e.area));
      open.appendChild(el("p", null, e.steps[0]));
      open.addEventListener("click", function () {
        openExercise(e.id);
      });
      var foot = el("div", "lib-foot");
      foot.appendChild(
        btn("Start now (" + e.seconds + "s)", "btn", function () {
          startSingle(e.id);
        })
      );
      var star = el("button", "star-btn" + (fav ? " on" : ""), fav ? "★" : "☆");
      star.type = "button";
      star.setAttribute("aria-pressed", fav ? "true" : "false");
      star.setAttribute(
        "aria-label",
        (fav ? "Remove " : "Add ") +
          e.title +
          (fav ? " from" : " to") +
          " My Routine"
      );
      star.title = fav ? "Remove from My Routine" : "Add to My Routine";
      star.addEventListener("click", function () {
        toggleFav(e.id);
      });
      foot.appendChild(star);
      card.appendChild(open);
      card.appendChild(foot);
      grid.appendChild(card);
    });
  }

  function startSingle(id) {
    closeModal();
    setSequence([id], null);
    scrollToId("exercises");
    startRunner();
  }

  function toggleFav(id) {
    var f = state.settings.favorites;
    var i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1);
    else f.push(id);
    saveState();
    renderLibrary();
    if (runner.routineId === "mine") {
      if (f.length) setSequence(f.slice(), "mine");
      else setSequence(D.routines[0].items, D.routines[0].id);
    } else {
      renderTabs();
    }
    toast(
      i >= 0
        ? "Removed from My Routine."
        : "Added to My Routine. Find it in the routine tabs."
    );
    if (!$("modal").hidden && modalKind === "exercise" && modalArg === id)
      openExercise(id);
  }

  /* ==================== posture ==================== */

  function showSpot(name) {
    var s = D.postureSpots[name];
    if (!s) return;
    $("spotTitle").textContent = s.title;
    $("spotText").textContent = s.text;
    document.querySelectorAll(".spot").forEach(function (g) {
      g.classList.toggle("active", g.getAttribute("data-spot") === name);
    });
  }

  function initPosture() {
    document.querySelectorAll(".spot").forEach(function (g) {
      var name = g.getAttribute("data-spot");
      g.addEventListener("click", function () {
        showSpot(name);
      });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          showSpot(name);
        }
      });
    });
    showSpot("monitor");

    var box = $("checklist");
    D.postureChecklist.forEach(function (text, i) {
      var label = document.createElement("label");
      label.className = "check-item";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "chk" + i;
      cb.addEventListener("change", updateCheck);
      var span = document.createElement("span");
      span.textContent = text;
      label.appendChild(cb);
      label.appendChild(span);
      box.appendChild(label);
    });
    $("saveCheck").addEventListener("click", saveCheck);
  }

  function checkPercent() {
    var boxes = document.querySelectorAll("#checklist input");
    var n = 0;
    boxes.forEach(function (b) {
      if (b.checked) n++;
    });
    return boxes.length ? Math.round((n / boxes.length) * 100) : 0;
  }
  function updateCheck() {
    var pct = checkPercent();
    $("checkScore").textContent = pct + "%";
    $("checkBar").style.width = pct + "%";
    $("checkMsg").textContent =
      pct >= 80
        ? "Great set-up!"
        : pct >= 50
        ? "Good start. Fix a few more items."
        : "Try adjusting your workstation using the guide.";
  }
  function saveCheck() {
    var d = today();
    d.checks++;
    d.checkPct = checkPercent();
    saveState();
    render();
    toast("Posture check saved (" + d.checkPct + "%).");
  }

  /* ==================== reminders ==================== */

  var rem = { on: false, nextAt: 0, timer: null };

  function remMinutes() {
    return Number($("reminderInterval").value) || 30;
  }
  function remStatus(t) {
    $("reminderStatus").textContent = t;
  }

  function renderCountdown() {
    if (!rem.on) {
      $("countdown").textContent = "--:--";
      return;
    }
    var left = Math.max(0, Math.round((rem.nextAt - Date.now()) / 1000));
    $("countdown").textContent = fmt(left);
  }

  function remTick() {
    if (Date.now() >= rem.nextAt) {
      fireReminder();
      rem.nextAt = Date.now() + remMinutes() * 60000;
    }
    renderCountdown();
  }

  function fireReminder() {
    var msg =
      "Time for a gentle movement break. Stand up, stretch, and rest your eyes.";
    beep();
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("EcoErgo reminder", { body: msg });
      }
    } catch (e) {
      /* notifications are optional */
    }
    toast(
      "⏰ " + msg,
      [
        {
          label: "Start",
          onClick: function () {
            scrollToId("exercises");
          },
        },
        {
          label: "Snooze 5 min",
          onClick: function () {
            if (rem.on) rem.nextAt = Date.now() + 5 * 60000;
          },
        },
      ],
      20000
    );
  }

  function enableReminder() {
    var go = function () {
      rem.on = true;
      rem.nextAt = Date.now() + remMinutes() * 60000;
      if (rem.timer) clearInterval(rem.timer);
      rem.timer = setInterval(remTick, 1000);
      remStatus(
        "Reminder on: every " +
          remMinutes() +
          " minute" +
          (remMinutes() === 1 ? "" : "s") +
          " while this page stays open."
      );
      renderCountdown();
    };
    try {
      if ("Notification" in window && Notification.permission === "default") {
        var p = Notification.requestPermission();
        if (p && p.then) {
          p.then(go, go);
          return;
        }
      }
    } catch (e) {
      /* fall through */
    }
    go();
  }

  function disableReminder() {
    rem.on = false;
    if (rem.timer) clearInterval(rem.timer);
    rem.timer = null;
    remStatus("Reminders are off.");
    renderCountdown();
  }

  var tipIdx = { posture: 0, eco: 0 };
  function renderTips() {
    $("postureTip").textContent =
      D.postureTips[tipIdx.posture % D.postureTips.length];
    $("ecoTip").textContent = D.ecoTips[tipIdx.eco % D.ecoTips.length];
  }

  /* ==================== carbon form ==================== */

  function syncForm() {
    var d = today();
    $("pages").value = d.pages;
    $("trips").value = d.trips;
    $("distance").value = d.km;
    $("mode").value = d.mode;
    $("clinic").checked = !!d.clinic;
  }

  function submitCarbon(ev) {
    ev.preventDefault();
    var err = $("carbonError");
    err.textContent = "";
    var fields = [
      ["pages", 10000],
      ["trips", 100],
      ["distance", 500],
    ];
    for (var i = 0; i < fields.length; i++) {
      var raw = $(fields[i][0]).value;
      var v = Number(raw);
      if (raw === "" || !isFinite(v) || v < 0) {
        err.textContent =
          "Please enter zero or a positive number in every field.";
        return;
      }
      if (v > fields[i][1]) {
        err.textContent =
          "That value looks too large. Maximum allowed is " +
          fields[i][1] +
          ".";
        return;
      }
    }
    var pages = Math.floor(Number($("pages").value));
    var trips = Math.floor(Number($("trips").value));
    var km = Number($("distance").value);
    if (trips > 0 && km === 0) {
      err.textContent =
        "Enter the distance per trip so travel can be estimated.";
      return;
    }

    var d = today();
    d.pages = pages;
    d.trips = trips;
    d.km = trips > 0 ? km : 0;
    d.mode = $("mode").value;
    d.clinic = $("clinic").checked ? 1 : 0;
    d.co2 = computeCo2(d.pages, d.trips, d.km, d.mode).total;
    saveState();
    syncForm();
    render();
    toast("Saved to today's log.");
  }

  function clearToday() {
    state.days[keyOffset(0)] = emptyDay();
    saveState();
    syncForm();
    $("carbonError").textContent = "";
    render();
    toast("Today's entry cleared.");
  }

  /* ==================== charts ==================== */

  var charts = {};

  function colors() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n, fb) {
      return (cs.getPropertyValue(n) || "").trim() || fb;
    };
    return {
      text: g("--muted", "#555"),
      grid: g("--border", "#ddd"),
      green: g("--green", "#246b45"),
      accent: g("--accent", "#79a86d"),
      dark: g("--dark-green", "#17452f"),
    };
  }

  function fallbackBars(canvas, labels, values, color, textColor) {
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    var parent = canvas.parentNode;
    var w = parent.clientWidth || 300,
      h = parent.clientHeight || 200;
    var ratio = window.devicePixelRatio || 1;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var max = Math.max.apply(null, [1].concat(values));
    var padd = 30,
      bw = (w - padd * 2) / values.length;
    canvas._layout = { pad: padd, bw: bw, n: values.length };
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    values.forEach(function (v, i) {
      var bh = (h - padd * 2) * (v / max);
      var x = padd + i * bw + bw * 0.15;
      ctx.fillStyle = color;
      ctx.fillRect(x, h - padd - bh, bw * 0.7, bh);
      ctx.fillStyle = textColor;
      ctx.fillText(labels[i], x + bw * 0.35, h - 10);
      ctx.fillText(String(round2(v)), x + bw * 0.35, h - padd - bh - 6);
    });
  }

  function drawChart(id, type, labels, values, datasetLabel) {
    var canvas = $(id);
    if (!canvas) return;
    var c = colors();
    if (typeof window.Chart === "undefined") {
      fallbackBars(canvas, labels, values, c.green, c.text);
      return;
    }
    try {
      if (charts[id]) {
        charts[id].data.labels = labels;
        charts[id].data.datasets[0].data = values;
        charts[id].update();
        return;
      }
      var isDonut = type === "doughnut";
      var dataset = { label: datasetLabel, data: values };
      if (isDonut) {
        dataset.backgroundColor = [c.green, c.accent, "#d9a441", "#4f8fb8"];
        dataset.borderColor = "transparent";
      } else if (type === "line") {
        dataset.borderColor = c.green;
        dataset.backgroundColor = c.accent;
        dataset.tension = 0.3;
        dataset.fill = false;
        dataset.pointRadius = 4;
      } else {
        dataset.backgroundColor = c.green;
        dataset.borderRadius = 6;
      }
      var cfg = {
        type: type,
        data: { labels: labels, datasets: [dataset] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: isDonut,
              position: "bottom",
              labels: { color: c.text },
            },
          },
        },
      };
      if (!isDonut) {
        cfg.options.scales = {
          y: {
            beginAtZero: true,
            ticks: { color: c.text, precision: 0 },
            grid: { color: c.grid },
          },
          x: { ticks: { color: c.text }, grid: { display: false } },
        };
        if (id === "chartCo2") cfg.options.scales.y.ticks = { color: c.text };
      }
      charts[id] = new window.Chart(canvas, cfg);
    } catch (e) {
      console.warn("Chart.js failed, using fallback chart.", e);
      charts[id] = null;
      fallbackBars(canvas, labels, values, c.green, c.text);
    }
  }

  function chartIndexAt(id, ev) {
    var c = $(id),
      ch = charts[id];
    if (ch && ch.getElementsAtEventForMode) {
      var els = ch.getElementsAtEventForMode(
        ev,
        "nearest",
        { intersect: false, axis: "x" },
        true
      );
      return els.length ? els[0].index : -1;
    }
    var m = c._layout;
    if (!m) return -1;
    var x = ev.clientX - c.getBoundingClientRect().left;
    var i = Math.floor((x - m.pad) / m.bw);
    return i >= 0 && i < m.n ? i : -1;
  }
  function onChartClick(id, kind, ev) {
    if (id === "chartScore") {
      openDetail("score");
      return;
    }
    var i = chartIndexAt(id, ev);
    if (i >= 0) openDay(lastDays(7)[i]);
    else openDetail(kind);
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) {
      try {
        if (charts[k]) charts[k].destroy();
      } catch (e) {
        /* ignore */
      }
    });
    charts = {};
  }

  /* ==================== render ==================== */

  function renderBadges() {
    var earned = earnedBadges(state.days);
    var prog = badgeProgress(state.days);
    var wrap = $("badges");
    wrap.textContent = "";
    D.badges.forEach(function (b) {
      var pr = prog[b.id];
      var pct = Math.min(100, Math.round((pr.value / pr.target) * 100));
      var node = el("button", "badge" + (earned[b.id] ? " earned" : ""));
      node.type = "button";
      node.setAttribute("data-badge", b.id);
      node.setAttribute(
        "aria-label",
        b.title + ": " + (earned[b.id] ? "earned" : pct + " percent")
      );
      node.appendChild(el("div", "b-icon", b.icon));
      node.appendChild(el("strong", null, b.title));
      node.appendChild(el("small", null, earned[b.id] ? "Earned!" : b.desc));
      var bar = el("div", "progress mini");
      var fill = el("div", "progress-bar");
      fill.style.width = (earned[b.id] ? 100 : pct) + "%";
      bar.appendChild(fill);
      node.appendChild(bar);
      node.addEventListener("click", function () {
        openBadge(b.id);
      });
      wrap.appendChild(node);
    });
  }

  function render() {
    var d = today();
    var goal = D.dailyBreakGoal;
    var wk = weekTotals(state.days);
    var sc = computeScore(wk);

    // hero
    $("ringCount").textContent = d.breaks + "/" + goal;
    $("ringFg").style.strokeDashoffset = String(
      326.7 * (1 - Math.min(d.breaks / goal, 1))
    );
    $("heroScore").textContent = sc.total;
    $("heroStreak").textContent = currentStreak(state.days);
    $("heroCo2").textContent = round2(wk.co2).toFixed(2);
    $("heroMessage").textContent =
      d.breaks === 0
        ? "Small breaks can help build healthier work habits."
        : d.breaks >= goal
        ? "Daily goal reached. Great job! 🎉"
        : "Nice! " +
          (goal - d.breaks) +
          " more break" +
          (goal - d.breaks === 1 ? "" : "s") +
          " to reach today's goal.";

    // dashboard cards
    $("breakCount").textContent = d.breaks;
    $("pageCount").textContent = wk.pages;
    $("progressCarbon").textContent = round2(wk.co2).toFixed(2);
    $("scoreBig").textContent = sc.total;
    $("scoreLabel").textContent =
      sc.total < 25
        ? "Just getting started"
        : sc.total < 50
        ? "Building momentum"
        : sc.total < 75
        ? "Great progress"
        : "Excellent!";

    // carbon card
    var parts = computeCo2(d.pages, d.trips, d.km, d.mode);
    $("carbonResult").textContent = round2(d.co2).toFixed(2);
    $("carbonDetails").textContent =
      d.co2 > 0
        ? "Paper: " +
          round2(parts.paper).toFixed(2) +
          " kg CO₂e. Travel: " +
          round2(parts.travel).toFixed(2) +
          " kg CO₂e."
        : "Enter your activities to calculate an estimate.";
    $("weekCo2").textContent = round2(wk.co2).toFixed(2);
    $("weekPages").textContent = wk.pages;
    $("weekTrips").textContent = wk.trips;
    $("weekClinic").textContent = wk.clinic;

    // charts
    var keys = lastDays(7);
    var labels = keys.map(dayLabel);
    drawChart(
      "chartBreaks",
      "bar",
      labels,
      keys.map(function (k) {
        return state.days[k] ? state.days[k].breaks : 0;
      }),
      "Breaks"
    );
    drawChart(
      "chartCo2",
      "line",
      labels,
      keys.map(function (k) {
        return state.days[k] ? round2(state.days[k].co2) : 0;
      }),
      "kg CO2e"
    );
    drawChart(
      "chartScore",
      "doughnut",
      sc.parts.map(function (p) {
        return p.short;
      }),
      sc.parts.map(function (p) {
        return round2(p.points);
      }),
      "Points"
    );

    renderBadges();
    renderInsights();
    renderLog();
    renderBanner();
  }

  /* ==================== data tools ==================== */

  function askConfirm(message, onYes) {
    toast(
      message,
      [
        { label: "Yes", onClick: onYes },
        { label: "Cancel", onClick: function () {} },
      ],
      12000
    );
  }

  function loadDemo() {
    var hasData = Object.keys(state.days).some(function (k) {
      var x = state.days[k];
      return x.breaks || x.pages || x.trips;
    });
    if (hasData && !state.demo) {
      askConfirm(
        "Replace your saved progress with simulated demo data?",
        doLoadDemo
      );
      return;
    }
    doLoadDemo();
  }

  function doLoadDemo() {
    state.days = demoDays();
    state.demo = true;
    saveState();
    syncForm();
    render();
    $("progressMessage").textContent =
      "Demo data loaded. These numbers are simulated for demonstration only.";
  }

  function resetAll() {
    askConfirm("Reset all EcoErgo progress saved in this browser?", doReset);
  }

  function doReset() {
    state.days = {};
    state.demo = false;
    saveState();
    syncForm();
    $("carbonError").textContent = "";
    render();
    $("progressMessage").textContent = "Your local progress has been reset.";
  }

  function exportCsv() {
    var rows = [
      [
        "date",
        "breaks",
        "pages_avoided",
        "trips_avoided",
        "km_per_trip",
        "mode",
        "co2e_kg_estimate",
        "clinic_visit_potential",
        "posture_checks",
        "posture_pct",
        "discomfort_before_avg",
        "discomfort_after_avg",
        "data_source",
      ],
    ];
    Object.keys(state.days)
      .sort()
      .forEach(function (k) {
        var d = state.days[k];
        var avg = function (f) {
          return d.pain.length
            ? round2(
                d.pain.reduce(function (s, p) {
                  return s + p[f];
                }, 0) / d.pain.length
              )
            : "";
        };
        rows.push([
          k,
          d.breaks,
          d.pages,
          d.trips,
          d.km,
          d.mode,
          round2(d.co2),
          d.clinic,
          d.checks,
          d.checkPct,
          avg("before"),
          avg("after"),
          state.demo ? "demo-simulated" : "user-entered",
        ]);
      });
    var csv = rows
      .map(function (r) {
        return r.join(",");
      })
      .join("\n");
    $("csvText").value = csv;
    $("csvBox").hidden = false;
    try {
      var blob = new Blob([csv], { type: "text/csv" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "ecoergo-progress.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
      $("progressMessage").textContent =
        "CSV ready below. Copy it, or use the downloaded file if your browser saved one.";
    } catch (e) {
      $("progressMessage").textContent = "CSV ready below. Use Copy CSV.";
    }
  }

  /* ==================== init ==================== */

  function init() {
    applyTheme();

    // static text
    $("year").textContent = new Date().getFullYear();
    var f = D.factors;
    $("factorNote").textContent =
      f.note +
      " Currently used: " +
      f.kgCO2ePerPage +
      " kg CO₂e per page; car " +
      f.kgCO2ePerKm.car +
      ", two-wheeler " +
      f.kgCO2ePerKm.twoWheeler +
      ", bus " +
      f.kgCO2ePerKm.bus +
      " kg CO₂e per km.";
    var rules = $("scoreRules");
    Object.keys(D.score).forEach(function (k) {
      var li = document.createElement("li");
      li.textContent =
        D.score[k].label +
        ": up to " +
        D.score[k].max +
        " points (full marks at " +
        D.score[k].target +
        " per week)";
      rules.appendChild(li);
    });
    var dayIdx = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    );
    tipIdx.posture = dayIdx % D.postureTips.length;
    tipIdx.eco = dayIdx % D.ecoTips.length;
    $("todayTip").textContent =
      "💡 Tip of the day: " + D.postureTips[tipIdx.posture];

    // navigation
    var nav = $("navigation");
    $("menuBtn").addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        $("menuBtn").setAttribute("aria-expanded", "false");
      });
    });
    $("themeBtn").addEventListener("click", function () {
      state.settings.theme = effectiveTheme() === "dark" ? "light" : "dark";
      saveState();
      onThemeChanged();
    });
    if ("IntersectionObserver" in window) {
      var links = {};
      nav.querySelectorAll("a").forEach(function (a) {
        links[a.getAttribute("href").slice(1)] = a;
      });
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting && links[en.target.id]) {
              Object.keys(links).forEach(function (k) {
                links[k].classList.remove("active");
              });
              links[en.target.id].classList.add("active");
            }
          });
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      Object.keys(links).forEach(function (id) {
        var s = $(id);
        if (s) io.observe(s);
      });
    }

    // exercises
    renderFilters();
    renderLibrary();
    setSequence(D.routines[0].items, D.routines[0].id);
    $("startTimer").addEventListener("click", startRunner);
    $("resetTimer").addEventListener("click", resetRunner);
    $("nextExercise").addEventListener("click", function () {
      stepRunner(1);
    });
    $("prevExercise").addEventListener("click", function () {
      stepRunner(-1);
    });
    ["painBefore", "painAfter"].forEach(function (id) {
      $(id).addEventListener("input", function () {
        $(id + "Val").textContent = $(id).value;
        runner.painTouched = true;
      });
    });

    // posture
    initPosture();

    // reminders
    $("reminderInterval").value = String(state.settings.interval);
    $("enableReminder").addEventListener("click", enableReminder);
    $("disableReminder").addEventListener("click", disableReminder);
    $("testReminder").addEventListener("click", fireReminder);
    $("reminderInterval").addEventListener("change", function () {
      state.settings.interval = remMinutes();
      saveState();
      if (rem.on) {
        rem.nextAt = Date.now() + remMinutes() * 60000;
        remStatus(
          "Interval updated to " +
            remMinutes() +
            " minute" +
            (remMinutes() === 1 ? "" : "s") +
            "."
        );
        renderCountdown();
      }
    });
    $("newPostureTip").addEventListener("click", function () {
      tipIdx.posture++;
      renderTips();
    });
    $("newEcoTip").addEventListener("click", function () {
      tipIdx.eco++;
      renderTips();
    });
    renderTips();
    renderCountdown();

    // carbon
    $("carbonForm").addEventListener("submit", submitCarbon);
    $("clearToday").addEventListener("click", clearToday);
    syncForm();

    // dashboard
    $("logBreak").addEventListener("click", function () {
      today().breaks++;
      saveState();
      render();
      $("progressMessage").textContent = "Movement break logged. Well done!";
    });
    $("logPages").addEventListener("click", function () {
      var d = today();
      d.pages += 10;
      d.co2 = computeCo2(d.pages, d.trips, d.km, d.mode).total;
      saveState();
      syncForm();
      render();
      $("progressMessage").textContent = "Added 10 pages to today's log.";
    });
    $("loadDemo").addEventListener("click", loadDemo);
    $("exportCsv").addEventListener("click", exportCsv);
    $("copyCsv").addEventListener("click", function () {
      var ta = $("csvText");
      var fallback = function () {
        ta.focus();
        ta.select();
        $("progressMessage").textContent =
          "Text selected. Press copy on your keyboard.";
      };
      try {
        navigator.clipboard.writeText(ta.value).then(function () {
          toast("CSV copied.");
        }, fallback);
      } catch (e) {
        fallback();
      }
    });
    try {
      new MutationObserver(function () {
        onThemeChanged();
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    } catch (e) {
      /* optional */
    }
    $("resetProgress").addEventListener("click", resetAll);

    // tap a chart bar or point to open that day (score chart opens the score breakdown)
    [
      ["chartBreaks", "breaks"],
      ["chartCo2", "co2"],
      ["chartScore", "score"],
    ].forEach(function (p) {
      var cv = $(p[0]);
      if (cv) {
        cv.addEventListener("click", function (ev) {
          onChartClick(p[0], p[1], ev);
        });
        cv.title = "Tap to open details";
      }
    });

    // library search, hero tip, modal, document-level clicks
    $("libSearch").addEventListener("input", function () {
      libQuery = $("libSearch").value.trim();
      renderLibrary();
    });
    $("heroTipBtn").addEventListener("click", function () {
      tipIdx.posture++;
      $("todayTip").textContent =
        "💡 Tip: " + D.postureTips[tipIdx.posture % D.postureTips.length];
    });
    $("modalClose").addEventListener("click", closeModal);
    $("modalBackdrop").addEventListener("click", closeModal);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onModalKey);

    render();
  }

  // expose a few functions so the logic can be tested from the console
  window.EcoErgo = {
    computeCo2: computeCo2,
    computeScore: computeScore,
    weekTotals: weekTotals,
    earnedBadges: earnedBadges,
    badgeProgress: badgeProgress,
    computeInsights: computeInsights,
    currentStreak: currentStreak,
    demoDays: demoDays,
    getState: function () {
      return state;
    },
    render: render,
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
