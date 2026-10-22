/* Vico del Carmine — sito
   Poche cose: la testata che si riempie scorrendo, "aperto ora" con l'ora di Firenze,
   e la riga di oggi evidenziata negli orari. Dati e parole arrivano da window.SITO. */
(function () {
  "use strict";
  const S = window.SITO || {};

  // ---- testata: trasparente sopra la foto, piena quando si scorre
  const testa = document.getElementById("testa");
  const aggiornaTesta = function () { testa.classList.toggle("piena", window.scrollY > 20); };
  aggiornaTesta();
  window.addEventListener("scroll", aggiornaTesta, { passive: true });

  // ---- ora di Firenze, anche se chi guarda è all'estero
  function adessoFirenze() {
    const parti = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).forEach(function (p) { parti[p.type] = p.value; });
    const giorno = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parti.weekday);
    return { giorno: giorno, minuti: Number(parti.hour) * 60 + Number(parti.minute) };
  }
  function minuti(hhmm) { const p = hhmm.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function fasce(g) { return (S.orari && S.orari[String((g + 7) % 7)]) || []; }
  // una fascia che chiude dopo mezzanotte (es. 19:00–00:30) finisce il giorno dopo
  function fine(f) { const a = minuti(f[0]), c = minuti(f[1]); return c <= a ? c + 1440 : c; }
  function riempi(testo, valori) {
    return testo.replace(/\{(\w+)\}/g, function (_, k) { return valori[k] != null ? valori[k] : ""; });
  }

  function stato() {
    const t = S.testi || {}, ora = adessoFirenze();
    // aperto adesso? (fasce di oggi, o di ieri che vanno oltre la mezzanotte)
    for (const f of fasce(ora.giorno)) {
      if (ora.minuti >= minuti(f[0]) && ora.minuti < fine(f)) return { aperto: true, testo: riempi(t.stato_aperto, { ora: f[1] }) };
    }
    for (const f of fasce(ora.giorno - 1)) {
      if (fine(f) > 1440 && ora.minuti < fine(f) - 1440) return { aperto: true, testo: riempi(t.stato_aperto, { ora: f[1] }) };
    }
    // altrimenti: quando riapriamo
    for (const f of fasce(ora.giorno)) {
      if (minuti(f[0]) > ora.minuti) return { aperto: false, testo: riempi(t.stato_apre_oggi, { ora: f[0] }) };
    }
    for (let i = 1; i <= 7; i++) {
      const f = fasce(ora.giorno + i)[0];
      if (f) {
        const giorno = i === 1 ? t.domani : S.giorni[(ora.giorno + i) % 7];
        return { aperto: false, testo: riempi(t.stato_apre, { giorno: giorno, ora: f[0] }) };
      }
    }
    return { aperto: false, testo: t.stato_chiuso };
  }

  const box = document.getElementById("stato");
  function mostraStato() {
    const s = stato();
    document.getElementById("stato-testo").textContent = s.testo;
    box.classList.toggle("aperto", s.aperto);
    box.hidden = false;
  }
  if (box && S.orari) {
    mostraStato();
    setInterval(mostraStato, 60000);
  }

  // ---- negli orari, la riga di oggi
  const oggi = adessoFirenze().giorno;
  document.querySelectorAll('.orari tr[data-g="' + oggi + '"]').forEach(function (r) { r.classList.add("oggi"); });
})();
