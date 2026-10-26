/* Kassomi: Menü, Gebührenrechner, Formular. Formel identisch mit build/generate.py (kosten). */
(function () {
  "use strict";
  if (/[?&]tweak\b/.test(location.search)) {
    var tw = document.createElement("script"); tw.src="/kassomi-test-pages/tweak/tweak.js"; document.head.appendChild(tw);
  }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Menü ---------- */
  var knopf = document.querySelector(".menu-knopf");
  var nav = document.getElementById("hauptmenu");
  if (knopf && nav) {
    knopf.addEventListener("click", function () {
      var offen = knopf.getAttribute("aria-expanded") === "true";
      knopf.setAttribute("aria-expanded", String(!offen));
      nav.classList.toggle("offen", !offen);
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && nav.classList.contains("offen")) {
        knopf.setAttribute("aria-expanded", "false"); nav.classList.remove("offen"); knopf.focus();
      }
    });
  }

  /* ---------- Zahlen ---------- */
  function zahl(x, dec) {
    return x.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function euro(x) { return zahl(x, 2) + "\u00a0€"; }

  function kosten(t, umsatz, zahlungen, gc, andere, geraet) {
    var ewr = Math.max(0, 1 - gc - andere);
    if (zahlungen < 1) zahlungen = 1;
    var bon = umsatz / zahlungen, variabel = 0;
    [[gc, t.gc], [ewr, t.ewr], [andere, t.andere]].forEach(function (p) {
      var je = bon * p[1] / 100;
      if (t.min) je = Math.max(t.min, je);
      variabel += p[0] * zahlungen * je;
    });
    var mindest = umsatz < (t.mindest_umsatz || 0) ? (t.mindest_gebuehr || 0) : 0;
    var g = geraet && t.geraet_preis ? t.geraet_preis / 24 : 0;
    var k = t.grund + variabel + zahlungen * t.fix + mindest + g;
    return umsatz === 0 ? t.grund + mindest + g : Math.round(k * 100) / 100;
  }

  /* ---------- Rechner ---------- */
  var rechner = document.querySelectorAll("[data-rechner]");
  if (!rechner.length || !window.fetch) return initFormular();

  fetch("/kassomi-test-pages/assets/js/tarife.json").then(function (r) { return r.json(); }).then(function (daten) {
    rechner.forEach(function (el) { initRechner(el, daten); });
  }).catch(function () { /* statische Rangliste bleibt stehen */ });
  initFormular();

  function initRechner(el, daten) {
    var q = function (n) { return el.querySelector('[data-r="' + n + '"]'); };
    var regler = q("umsatz"), wert = q("wert"), liste = q("liste"), kipp = q("kipp"),
        marken = q("marken"), annahme = q("annahme"), mehr = q("mehr");
    var fBon = q("bon"), fGc = q("gc"), fAndere = q("andere"), fGeraet = q("geraet");
    var max = parseInt(el.getAttribute("data-max"), 10) || 99;
    var bonStandard = parseFloat(el.getAttribute("data-bon")) || 8;
    var tarife = daten.tarife;

    var params = new URLSearchParams(location.search);
    if (params.get("umsatz") && !el.classList.contains("rechner-kompakt")) {
      regler.value = Math.min(20000, Math.max(0, parseInt(params.get("umsatz"), 10) || 6000));
    }

    function eingaben() {
      var bon = fBon ? parseFloat(String(fBon.value).replace(",", ".")) : bonStandard;
      if (!(bon > 0)) bon = bonStandard;
      var gc = fGc ? Math.min(100, Math.max(0, parseFloat(fGc.value) || 0)) / 100 : 0;
      var andere = fAndere ? Math.min(100, Math.max(0, parseFloat(fAndere.value) || 0)) / 100 : 0;
      if (gc + andere > 1) andere = 1 - gc;
      return { umsatz: parseInt(regler.value, 10), bon: bon, gc: gc, andere: andere, geraet: fGeraet ? fGeraet.checked : false };
    }

    function rangliste(e, umsatz) {
      var n = Math.max(1, Math.round(umsatz / e.bon));
      return tarife.map(function (t) { return { t: t, k: kosten(t, umsatz, n, e.gc, e.andere, e.geraet) }; })
        .sort(function (a, b) { return a.k - b.k; });
    }

    function kipppunkte(e) {
      var punkte = [], vorher = null;
      for (var u = 100; u <= 20000; u += 50) {
        var best = rangliste(e, u)[0].t;
        if (vorher && best.id !== vorher.id) punkte.push({ u: u, von: vorher, zu: best });
        vorher = best;
      }
      return punkte;
    }

    var letzteKipp = "";
    function zeichneMarken(e) {
      var punkte = kipppunkte(e);
      marken.innerHTML = punkte.map(function (p) {
        return '<i style="left:' + (p.u / 200) + '%"><b>ab ' + zahl(p.u, 0) + '\u00a0€</b></i>';
      }).join("");
      return punkte;
    }

    var punkte = [];
    function render(neueMarken) {
      var e = eingaben();
      if (neueMarken) punkte = zeichneMarken(e);
      var u = e.umsatz, n = Math.max(1, Math.round(u / e.bon));
      wert.innerHTML = zahl(u, 0) + " <span>€</span>";
      regler.style.setProperty("--p", (u / 200) + "%");
      regler.setAttribute("aria-valuetext", zahl(u, 0) + " Euro Kartenumsatz im Monat");
      var rows = rangliste(e, u).slice(0, max);
      var teuer = rows[rows.length - 1].k || 1;

      var vorher = {};
      if (!reduce) liste.querySelectorAll(".zeile").forEach(function (li) { vorher[li.dataset.id] = li.getBoundingClientRect().top; });
      liste.innerHTML = rows.map(function (r, i) {
        var t = r.t;
        return '<li class="zeile' + (i === 0 ? " best" : "") + '" data-id="' + t.id + '">' +
          '<span class="z-name">' + t.kurz + "<small>" + t.satz + " · " + t.quelle_kurz + "</small></span>" +
          '<span class="z-balken" aria-hidden="true"><i style="width:' + Math.max(6, Math.round(r.k / teuer * 100)) + '%"></i></span>' +
          '<span class="z-betrag">' + euro(r.k) + "</span></li>";
      }).join("");
      if (!reduce) liste.querySelectorAll(".zeile").forEach(function (li) {
        var alt = vorher[li.dataset.id];
        if (alt === undefined) return;
        var d = alt - li.getBoundingClientRect().top;
        if (!d) return;
        li.animate([{ transform: "translateY(" + d + "px)" }, { transform: "none" }], { duration: 220, easing: "ease-out" });
      });

      // Kipppunkt-Satz: der nächste Wechsel oberhalb oder der zuletzt überquerte
      var satz = "";
      var naechster = punkte.filter(function (p) { return p.u > u; })[0];
      var letzter = punkte.filter(function (p) { return p.u <= u; }).pop();
      if (letzter) satz = "Rote Markierung = Kipppunkt: Ab " + zahl(letzter.u, 0) + "\u00a0€ Kartenumsatz ist " + letzter.zu.kurz + " günstiger als " + letzter.von.kurz + ".";
      else if (naechster) satz = "Rote Markierung = Kipppunkt: Ab " + zahl(naechster.u, 0) + "\u00a0€ Kartenumsatz wird " + naechster.zu.kurz + " günstiger als " + naechster.von.kurz + ".";
      else satz = "Bei diesen Annahmen ist " + rows[0].t.kurz + " über den ganzen Bereich am günstigsten.";
      if (satz !== letzteKipp) { kipp.textContent = satz; letzteKipp = satz; }

      var karten = e.gc || e.andere ? "Girocard " + zahl(e.gc * 100, 0) + " %, Firmenkarten/Amex/Nicht-EWR " + zahl(e.andere * 100, 0) + " %, Rest EWR-Verbraucherkarten" : "Girocard und EWR-Verbraucherkarten";
      annahme.textContent = "Annahme: " + karten + ", " + zahl(n, 0) + " Zahlungen (Bon " + zahl(e.bon, 2).replace(",00", "") + " €), " +
        (e.geraet ? "Gerät auf 24 Monate verteilt" : "ohne Gerät") + ". Preise geprüft am " + daten.geprueft + ".";
      if (mehr) mehr.href="/kassomi-test-pages/gebuehrenrechner/?umsatz=" + u;
    }

    regler.addEventListener("input", function () { render(false); });
    [fBon, fGc, fAndere, fGeraet].forEach(function (f) { if (f) f.addEventListener("input", function () { render(true); }); });
    el.querySelectorAll(".chip").forEach(function (c) {
      c.addEventListener("click", function () {
        el.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        c.setAttribute("aria-pressed", "true");
        regler.value = c.getAttribute("data-umsatz");
        if (fBon) fBon.value = c.getAttribute("data-bon");
        render(true);
      });
    });
    render(true);
  }

  /* ---------- Formular ---------- */
  function initFormular() {
    var form = document.querySelector("[data-formular]");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var ok = true;
      function pruefe(feld, fehlerId, gueltig) {
        var f = document.getElementById(fehlerId);
        feld.setAttribute("aria-invalid", gueltig ? "false" : "true");
        f.hidden = gueltig;
        if (!gueltig && ok) { feld.focus(); ok = false; }
      }
      var nachricht = form.querySelector("#f-nachricht"), mail = form.querySelector("#f-mail"), einw = form.querySelector("#f-ok");
      pruefe(nachricht, "f-nachricht-f", nachricht.value.trim().length > 0);
      pruefe(mail, "f-mail-f", !mail.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim()));
      pruefe(einw, "f-ok-f", einw.checked);
      if (!ok) return;
      // Ziel (Webhook oder Formulardienst) wird in Phase 7 eingetragen.
      var ziel = form.getAttribute("data-ziel");
      var knopfS = form.querySelector("button[type=submit]");
      var fehlerS = form.querySelector("[data-sendefehler]");
      var fertig = function () { form.querySelector(".bestaetigung").hidden = false; knopfS.disabled = true; if (fehlerS) fehlerS.hidden = true; };
      var fehlgeschlagen = function () { if (fehlerS) fehlerS.hidden = false; knopfS.disabled = false; };
      if (ziel && location.protocol === "https:") {
        knopfS.disabled = true;
        var daten = {};
        new FormData(form).forEach(function (v, k) { daten[k] = v; });
        fetch(ziel, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(daten) })
          .then(function (r) { if (r.ok) fertig(); else fehlgeschlagen(); }).catch(fehlgeschlagen);
      } else {
        fertig(); // lokal ohne PHP: nur Prüfung und Bestätigung zeigen
      }
    });
  }
})();
