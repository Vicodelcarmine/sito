/* Vico del Carmine — la pagina del regalo a sorpresa (vicodelcarmine.it/regalo/?c=CODICE).
   Il codice arriva nel link personale della campagna (email, poi WhatsApp). Parla con il database
   del Vico (vico-agenti/supabase/18-campagna-regalo.sql):
     camp_vista  → chi è (nome, telefono ed email già pronti), i premi in palio, il suo premio se c'è
     club_iscriviti → entra nel Club (manca solo la data di nascita)
     camp_scopri → il premio a sorpresa, che vale solo prenotando dal sito
   Con vista.offerta (29-prenota-diretto.sql) non c'è sorpresa: l'offerta è già decisa, e il modulo
   parte dalla sera e dalle persone della prenotazione che il cliente ha già fatto altrove.
   Sotto c'è il modulo di prenotazione del sito (prenota.js): nome e telefono già scritti,
   e dopo l'iscrizione riconosce il socio dalla tessera salvata in questo browser.
   ?demo=1 → server finto nel browser, per provare senza toccare i dati veri (?demo=0 per uscire). */
(function () {
  "use strict";
  const S = window.SITO || {};
  const R = S.regalo || {};
  const P = S.pren || {};
  const CFG = S.prenota || {};
  const app = document.getElementById("reg-app");
  if (!app || !CFG.url) return;

  const DEMO = (function () {
    try {
      if (/[?&]demo=1/.test(location.search)) sessionStorage.setItem("vdc_sito_demo", "1");
      if (/[?&]demo=0/.test(location.search)) sessionStorage.removeItem("vdc_sito_demo");
      return sessionStorage.getItem("vdc_sito_demo") === "1";
    } catch (e) { return false; }
  })();
  const CODICE = (new URLSearchParams(location.search).get("c") || "").trim().toUpperCase();

  /* ---------- memoria di questo browser (la tessera la legge anche prenota.js) ---------- */
  function leggi(k, d) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  }
  function scrivi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const K_SOCIO = DEMO ? "vdc_sito_socio_demo" : "vdc_sito_socio";   // { chiave, nome }
  function dispositivo() {
    let d = leggi("vdc_sito_disp", "");
    if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); scrivi("vdc_sito_disp", d); }
    return d;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function riempi(testo, valori) {
    return String(testo || "").replace(/\{(\w+)\}/g, function (_, k) { return valori[k] != null ? valori[k] : ""; });
  }
  function primoNome(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  // "+393331234567" → "333 123 4567" per il modulo (il database rimette il prefisso)
  function telVisto(t) {
    const d = String(t || "").replace(/^\+39/, "").replace(/\D/g, "");
    return d.length === 10 ? d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6) : String(t || "");
  }
  function giornoLungo(s) {
    const p = s.split("-").map(Number);
    return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
  }
  function giorniNo(g) {
    const nomi = S.giorni || [];
    return (g || []).filter(function (n, i, a) { return a.indexOf(n) === i; })
      .map(function (n) { return String(nomi[n] || "").toLowerCase(); }).filter(Boolean);
  }

  /* ---------- il server: quello vero (Supabase) o quello finto della demo ---------- */
  function errore(codice, msg) { const e = new Error(msg); e.codice = codice; return e; }
  async function rpc(nome, corpo) {
    let r;
    try {
      r = await fetch(CFG.url + "/rest/v1/rpc/" + nome, {
        method: "POST",
        headers: { apikey: CFG.chiave, "Content-Type": "application/json" },
        body: JSON.stringify(corpo || {}),
      });
    } catch (e) { throw errore("rete", P.e_rete); }
    const testo = await r.text();
    let d = null;
    try { d = testo ? JSON.parse(testo) : null; } catch (e) {}
    // le funzioni camp_* e club_* mettono il loro codice nel campo "hint"
    if (!r.ok) throw errore((d && d.hint) || "server", (d && d.message) || P.e_server);
    return d;
  }
  const vero = {
    vista: function () { return rpc("camp_vista", { p_codice: CODICE }); },
    club: function (d) {
      return rpc("club_iscriviti", { p_nome: d.nome, p_email: d.email || "", p_telefono: d.telefono, p_nascita: d.nascita,
                                     p_promo: !!d.promo, p_lingua: "it", p_dispositivo: dispositivo() });
    },
    scopri: function (chiave) { return rpc("camp_scopri", { p_codice: CODICE, p_chiave: chiave || "" }); },
  };
  function serverFinto() {
    const K = "vdc_regalo_demo";
    const PREMI = [
      { id: "CINQUANTA", emoji: "🎉", nome: { it: "50% di sconto sul conto" }, descr: { it: "Metà conto lo offriamo noi: 50% di sconto sul conto del tavolo, fino a 4 persone." }, persone: 0, peso: 8 },
      { id: "TRENTA", emoji: "🔥", nome: { it: "30% di sconto sul conto" }, descr: { it: "30% di sconto sul conto del tavolo, fino a 4 persone." }, persone: 0, peso: 15 },
      { id: "VENTI", emoji: "⭐", nome: { it: "20% di sconto sul conto" }, descr: { it: "20% di sconto sul conto del tavolo, fino a 4 persone." }, persone: 0, peso: 25 },
      { id: "DIECI", emoji: "🍕", nome: { it: "10% di sconto sul conto" }, descr: { it: "10% di sconto sul conto del tavolo, fino a 4 persone." }, persone: 0, peso: 12 },
      { id: "PROSECCO", emoji: "🥂", nome: { it: "Prosecco di benvenuto per il tavolo" }, descr: { it: "Un calice di prosecco di benvenuto a testa, fino a 4 persone." }, persone: 4, peso: 15 },
      { id: "DOLCE", emoji: "🍰", nome: { it: "Dolce della casa offerto" }, descr: { it: "Un dolce della casa a testa, per 2 persone." }, persone: 2, peso: 15 },
      { id: "SPRITZ", emoji: "🍹", nome: { it: "Spritz offerto" }, descr: { it: "Uno Spritz Aperol o Hugo a testa, per 2 persone." }, persone: 2, peso: 10 },
    ];
    // ?diretto=30 o ?diretto=0: l'offerta già decisa (30% + prosecco, oppure solo prosecco), per la terza sera buona
    const QUALE = new URLSearchParams(location.search).get("diretto");
    const OFFERTA_DEMO = QUALE == null ? null : {
      sera: piuSere(oggi(), 3), persone: 4,
      premio: QUALE === "30"
        ? { emoji: "🥂", nome: { it: "30% sul menù alla carta + prosecco di benvenuto" }, descr: { it: "30% di sconto sul menù alla carta per tutto il tavolo (bevande e menù fissi esclusi) e un calice di prosecco di benvenuto a testa, fino a 4 persone." } }
        : { emoji: "🥂", nome: { it: "Prosecco di benvenuto per il tavolo" }, descr: { it: "Un calice di prosecco di benvenuto a testa, fino a 4 persone." } },
    };
    function attesa(fn, ms) {
      return new Promise(function (ok, ko) { setTimeout(function () { try { ok(fn()); } catch (e) { ko(e); } }, ms || 400); });
    }
    function oggi() {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    }
    // la n-esima sera da s compresa, saltando il sabato (come club_piu_sere)
    function piuSere(s, n) {
      const p = s.split("-").map(Number); let d = new Date(Date.UTC(p[0], p[1] - 1, p[2])), contate = 0;
      for (;;) {
        if (d.getUTCDay() !== 6 && ++contate === n) return d.toISOString().slice(0, 10);
        d = new Date(d.getTime() + 864e5);
      }
    }
    return {
      vista: function () {
        return attesa(function () {
          if (!CODICE) throw errore("codice", R.e_codice);
          const socio = leggi(K_SOCIO, null);
          return { nome: "Giulia Rossi", telefono: "+393331234567", email: "giulia@example.com",
                   socio: !!(socio && socio.chiave), aperta: true, sere: 15, scopriEntro: null, giorniNo: [6],
                   premi: PREMI.map(function (p) { return { emoji: p.emoji, nome: p.nome }; }),
                   offerta: OFFERTA_DEMO, premio: leggi(K, null) };
        });
      },
      club: function (d) {
        return attesa(function () { return { chiave: "DEMO" + Date.now().toString(36).toUpperCase(), nome: d.nome }; });
      },
      scopri: function () {
        return attesa(function () {
          const gia = leggi(K, null);
          if (gia) return { premio: gia, nuovo: false };
          let tot = 0; PREMI.forEach(function (p) { tot += p.peso; });
          let x = Math.random() * tot, pr = PREMI[0];
          for (const p of PREMI) { x -= p.peso; if (x < 0) { pr = p; break; } }
          if (OFFERTA_DEMO) pr = Object.assign({ persone: 4 }, OFFERTA_DEMO.premio);
          const dal = piuSere(oggi(), 1);
          const premio = { codice: "DEMO123", tipo: "regalo", emoji: pr.emoji, nome: pr.nome, descr: pr.descr, persone: pr.persone,
                           dal: dal, al: piuSere(dal, 15), giorniNo: OFFERTA_DEMO ? [] : [6], stato: "valido", soloPrenotati: true };
          scrivi(K, premio);
          return { premio: premio, nuovo: true };
        }, 600);
      },
    };
  }
  const server = DEMO ? serverFinto() : vero;

  /* ---------- disegno ---------- */
  let vista = null;
  const sezPrenota = document.getElementById("prenota");

  function mostraPrenota(premio) {
    if (!sezPrenota) return;
    const off = vista && vista.offerta;
    S.precompila = { nome: vista && vista.nome, telefono: vista && telVisto(vista.telefono),
                     sera: off && off.sera, persone: off && off.persone };
    const t = document.getElementById("reg-prenota-testo");
    if (t && premio) t.textContent = riempi(R.prenota_testo, { data: giornoLungo(premio.al) });
    sezPrenota.hidden = false;
    window.dispatchEvent(new Event("vdc-ridisegna"));
  }

  function chips() {
    // in breve: "50%" per gli sconti, la prima parola per gli altri (Prosecco, Dolce, Spritz)
    return '<ul class="reg-chips" aria-label="' + esc(R.in_palio) + '">' + (vista.premi || []).map(function (p) {
      const n = String(p.nome.it || ""), m = n.match(/^\d+%/);
      return "<li><span aria-hidden=\"true\">" + esc(p.emoji) + "</span>" + esc(m ? m[0] : n.split(" ")[0]) + "</li>";
    }).join("") + "</ul>";
  }

  function testa(titolo) {
    return '<p class="occhiello">' + esc(vista && vista.offerta ? R.d_occhiello : R.occhiello) + "</p>" +
      "<h1>" + titolo + "</h1>";
  }

  function disegnaErrore(testo, conPrenota) {
    app.innerHTML = '<div class="reg-scheda reg-centro">' +
      '<div class="reg-emoji" aria-hidden="true">🤔</div><p>' + testo + "</p>" +
      '<div class="azioni"><a class="btn" href="../#prenota">' + esc(conPrenota ? R.prenota_comunque : R.vai_sito) + "</a></div></div>";
  }

  function disegnaInvito() {
    const socio = leggi(K_SOCIO, null);
    const nome = primoNome(vista.nome);
    const off = vista.offerta;
    const titolo = riempi(off ? R.d_titolo_html : R.titolo_html, { nome: esc(nome) });
    // l'offerta già decisa si dice subito; il regalo a sorpresa mostra cosa c'è in palio
    const intro = off
      ? '<div class="reg-scheda reg-centro"><div class="reg-emoji" aria-hidden="true">' + esc(off.premio.emoji) + "</div>" +
        "<h2 class=\"reg-sotto\">" + esc(off.premio.nome.it) + '</h2><p class="testo">' + esc(off.premio.descr.it) + "</p>" +
        (off.sera ? '<p class="reg-piccolo">' + esc(riempi(R.d_sera, { giorno: giornoLungo(off.sera) })) + "</p>" : "") + "</div>"
      : '<p class="testo">' + esc(R.testo) + "</p>" + chips();
    // già nel Club (su questo telefono, oppure il numero o l'email del link): un tocco e via
    if ((socio && socio.chiave) || vista.socio) {
      app.innerHTML = testa(titolo) + intro +
        '<div class="reg-scheda"><p class="reg-socio">' + esc(riempi(off ? R.d_gia_socio : R.gia_socio, { nome: nome })) + "</p>" +
        '<p class="pren-errore" id="reg-errore" role="alert" hidden></p>' +
        '<button class="btn btn-chiaro reg-grande" id="reg-scopri" type="button">' + (off ? "🥂 " + esc(R.d_attiva) : "🎁 " + esc(R.scopri)) + "</button></div>";
      document.getElementById("reg-scopri").addEventListener("click", function () { scopri(socio && socio.chiave, this); });
      return;
    }
    app.innerHTML = testa(titolo) + intro +
      '<form class="reg-scheda pren" id="reg-club" novalidate>' +
        "<h2 class=\"reg-sotto\">" + esc(off ? R.d_club_titolo : R.club_titolo) + "</h2><p class=\"reg-piccolo\">" + esc(off ? R.d_club_sotto : R.club_sotto) + "</p>" +
        '<div class="pren-campi">' +
          '<label class="pren-campo"><span>' + esc(P.nome) + '</span><input name="nome" type="text" autocomplete="name"></label>' +
          '<label class="pren-campo"><span>' + esc(P.telefono) + '</span><input name="telefono" type="tel" autocomplete="tel" inputmode="tel"></label>' +
          '<label class="pren-campo"><span>' + esc(P.email_fac) + '</span><input name="email" type="email" autocomplete="email"></label>' +
          '<label class="pren-campo"><span>' + esc(P.nascita) + " <small>· " + esc(P.nascita_perche) + "</small></span>" +
            '<input name="nascita" type="date" autocomplete="bday"></label>' +
        "</div>" +
        '<label class="pren-spunta"><input type="checkbox" name="privacy"><span>' + esc(P.privacy) + "</span></label>" +
        '<details class="pren-privacy"><summary>' + esc(P.privacy_titolo) + "</summary>" + (P.privacy_testo || "") + "</details>" +
        '<label class="pren-spunta"><input type="checkbox" name="promo"><span>' + esc(P.promo) + "</span></label>" +
        '<p class="pren-errore" id="reg-errore" role="alert" hidden></p>' +
        '<button class="btn btn-chiaro reg-grande" type="submit">' + (off ? "🥂 " + esc(R.d_entra) : "🎁 " + esc(R.entra)) + "</button>" +
      "</form>";
    const f = document.getElementById("reg-club");
    f.elements.nome.value = vista.nome || "";
    f.elements.telefono.value = telVisto(vista.telefono);
    f.elements.email.value = vista.email || "";
    f.addEventListener("submit", entra);
  }

  function sbaglio(testo, campo) {
    const box = document.getElementById("reg-errore");
    if (!box) return;
    box.textContent = testo;
    box.hidden = false;
    const f = document.getElementById("reg-club");
    const c = campo && f && f.elements[campo];
    if (c && c.focus) c.focus(); else box.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function entra(e) {
    e.preventDefault();
    const f = e.target;
    document.getElementById("reg-errore").hidden = true;
    const d = { nome: f.elements.nome.value.trim(), telefono: f.elements.telefono.value.trim(), email: f.elements.email.value.trim(),
                nascita: f.elements.nascita.value, promo: f.elements.promo.checked };
    if (d.nome.length < 2) return sbaglio(P.e_nome, "nome");
    if (d.telefono.replace(/\D/g, "").length < 8) return sbaglio(P.e_telefono, "telefono");
    if (d.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(d.email)) return sbaglio(P.e_email, "email");
    if (!d.nascita) return sbaglio(P.e_nascita, "nascita");
    if (!f.elements.privacy.checked) return sbaglio(P.club_e_privacy, "privacy");
    const b = f.querySelector("button[type=submit]");
    b.disabled = true;
    b.textContent = P.invio;
    let chiave = "";
    try {
      const c = await server.club(d);
      chiave = c.chiave;
      scrivi(K_SOCIO, { chiave: c.chiave, nome: primoNome(c.nome || d.nome) });
      // da dove è arrivato (il canale della visita lo legge prenota.js; qui di solito è la campagna)
      if (!DEMO) {
        let canale = "campagna:regalo";
        try { canale = sessionStorage.getItem("vdc_canale") || canale; } catch (e) {}
        rpc("club_canale", { p_chiave: c.chiave, p_canale: canale }).catch(function () {});
      }
    } catch (er) {
      // già nel Club con il numero o l'email del link: il premio va lo stesso alla sua tessera
      if (er.codice !== "gia") {
        b.disabled = false;
        b.textContent = vista.offerta ? "🥂 " + R.d_entra : "🎁 " + R.entra;
        return sbaglio(P["e_" + er.codice] || er.message || P.e_server, { nome: "nome", telefono: "telefono", email: "email", nascita: "nascita" }[er.codice]);
      }
    }
    scopri(chiave, b);
  }

  // l'attesa con il conto alla rovescia, poi il premio
  async function scopri(chiave, bottone) {
    if (bottone) { bottone.disabled = true; bottone.textContent = P.invio; }
    const domanda = server.scopri(chiave);
    domanda.catch(function () {});
    // l'offerta non è una sorpresa: niente conto alla rovescia
    const fermo = !!vista.offerta || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!fermo) {
      app.innerHTML = '<div class="reg-attesa" aria-live="polite"><div class="reg-pacco" aria-hidden="true">🎁</div>' +
        '<p class="reg-conta" id="reg-conta">3</p><p class="reg-piccolo">' + esc(R.quasi) + "</p></div>";
      app.scrollIntoView({ block: "start", behavior: "smooth" });
      for (const n of [2, 1]) {
        await new Promise(function (ok) { setTimeout(ok, 900); });
        const c = document.getElementById("reg-conta");
        if (c) { c.textContent = n; c.classList.remove("batti"); void c.offsetWidth; c.classList.add("batti"); }
      }
      await new Promise(function (ok) { setTimeout(ok, 900); });
    }
    try {
      const r = await domanda;
      vista.premio = r.premio;
      disegnaPremio(r.premio, !fermo);
      if (vista.offerta && sezPrenota) sezPrenota.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch (er) {
      if (er.codice === "club") { vista.socio = false; try { localStorage.removeItem(K_SOCIO); } catch (x) {} disegnaInvito(); return sbaglio(R.e_club); }
      disegnaErrore(esc(R["e_" + er.codice] || er.message || P.e_server), er.codice === "finita" || er.codice === "finiti");
    }
  }

  function disegnaPremio(p, festa) {
    if (!p) return disegnaInvito();
    const no = giorniNo(p.giorniNo);
    const socio = leggi(K_SOCIO, null);
    // la descrizione dice già per quante persone; se manca, lo diciamo noi
    const descr = (p.descr && p.descr.it) || (p.persone > 0 ? riempi(R.per_persone, { n: p.persone }) : "");
    app.innerHTML = '<div class="reg-premio' + (festa ? " festa" : "") + '">' +
      // Array.from e non split(""): le emoji sono fatte di due pezzi e split le spezza
      (festa ? '<div class="reg-coriandoli" aria-hidden="true">' + Array.from("🎉✨🎊✨🎉✨🎊✨").map(function (c, i) {
        return '<span style="--i:' + i + '">' + c + "</span>"; }).join("") + "</div>" : "") +
      '<p class="occhiello">' + esc(vista && vista.offerta ? R.d_hai : R.hai_vinto) + "</p>" +
      '<div class="reg-emoji grande" aria-hidden="true">' + esc(p.emoji) + "</div>" +
      "<h1>" + esc(p.nome.it) + "</h1>" +
      '<p class="testo">' + esc(descr) + "</p>" +
      '<p class="reg-valido">' + esc(riempi(R.valido, { data: giornoLungo(p.al) })) +
        (no.length ? " " + esc(riempi(R.giorni_no, { giorni: no.join(" e ") })) : "") + "</p>" +
      '<div class="azioni"><a class="btn btn-chiaro" href="#prenota">📅 ' + esc(R.prenota) + "</a>" +
        (socio && socio.chiave && CFG.tessera && !DEMO
          ? '<a class="btn btn-vuoto-chiaro" href="' + esc(CFG.tessera + socio.chiave) + '">💳 ' + esc(R.tessera) + "</a>" : "") +
      "</div></div>";
    mostraPrenota(p);
  }

  // dopo la prenotazione: il regalo è legato a quella serata (se è nei giorni buoni)
  window.addEventListener("vdc-prenotato", function (e) {
    const p = vista && vista.premio, r = e.detail || {};
    const box = document.getElementById("pren-fatto");
    if (!p || !box) return;
    const dentro = r.sera >= p.dal && r.sera <= p.al && (p.giorniNo || []).indexOf(new Date(r.sera + "T12:00:00Z").getUTCDay()) < 0;
    box.querySelector("h3").insertAdjacentHTML("afterend", '<p class="pren-benvenuto">' +
      esc(p.emoji + " " + (dentro ? (vista.offerta ? R.d_legato : R.legato) : riempi(R.non_legato, { data: giornoLungo(p.al) }))) + "</p>");
    // stessa sera della prenotazione fatta altrove: è il momento di chiedere di annullarla
    if (vista.offerta && vista.offerta.sera === r.sera) {
      box.querySelector(".pren-benvenuto").insertAdjacentHTML("afterend", '<p class="pren-benvenuto">⚠️ ' +
        esc(riempi(R.d_annulla, { giorno: giornoLungo(r.sera) })) + "</p>");
    }
  });

  /* ---------- avvio ---------- */
  async function avvio() {
    if (DEMO) app.insertAdjacentHTML("beforebegin", '<p class="pren-demo">DEMO · niente di vero</p>');
    if (!CODICE) return disegnaErrore(esc(R.e_codice));
    try {
      vista = await server.vista();
    } catch (er) {
      return disegnaErrore(esc(R["e_" + er.codice] || er.message || P.e_server));
    }
    if (vista.premio) return disegnaPremio(vista.premio, false);
    if (!vista.aperta) return disegnaErrore(esc(R.e_finita), true);
    disegnaInvito();
  }
  avvio();
})();
