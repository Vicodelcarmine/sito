/* Vico del Carmine — prenotazioni dal sito.
   Parla con il database del Vico (funzioni pren_* in vico-agenti/supabase/10-prenotazioni.sql):
   posti liberi, prenota, le mie prenotazioni, annulla. Per prenotare bastano nome e telefono
   (15-prenota-facile.sql); chi ha un numero già nel Club viene riconosciuto. Il cliente nuovo
   ha il prosecco di benvenuto; con le conferme WhatsApp accese il premio arriva nel messaggio.
   Dopo la prenotazione il Club è facoltativo: un riquadro chiede solo la data di nascita.
   Questo browser ricorda solo i "segreti" delle sue prenotazioni (per vederle e annullarle)
   e, se è entrato nel Club, la chiave della tessera.
   ?demo=1 → server finto nel browser, per provare senza toccare i dati veri (?demo=0 per uscire). */
(function () {
  "use strict";
  const S = window.SITO || {};
  const P = S.pren || {};
  const CFG = S.prenota || {};
  const app = document.getElementById("pren-app");
  if (!app || !CFG.url) return;

  const DEMO = (function () {
    try {
      if (/[?&]demo=1/.test(location.search)) sessionStorage.setItem("vdc_sito_demo", "1");
      if (/[?&]demo=0/.test(location.search)) sessionStorage.removeItem("vdc_sito_demo");
      return sessionStorage.getItem("vdc_sito_demo") === "1";
    } catch (e) { return false; }
  })();

  /* ---------- memoria di questo browser ---------- */
  function leggi(k, d) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  }
  function scrivi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const K_SOCIO = DEMO ? "vdc_sito_socio_demo" : "vdc_sito_socio";   // { chiave, nome }
  const K_MIE = DEMO ? "vdc_sito_pren_demo" : "vdc_sito_pren";       // [segreti]
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
  function persone(n) { return n + " " + (n === 1 ? P.una_persona : P.piu_persone); }
  function telLink() { return '<a href="tel:' + esc(S.telefono) + '">' + esc(S.telefonoVisto) + "</a>"; }

  /* ---------- date (giorni di calendario a Firenze, "2026-10-24") ---------- */
  function parti(s) { return s.split("-").map(Number); }
  function giornoSett(s) { const p = parti(s); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function oggiFirenze() {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
    return f.format(new Date());
  }
  function piuGiorni(s, n) {
    const p = parti(s), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  // "sab 24 ott" — con "oggi" e "domani" quando servono
  function giornoBreve(s) {
    const p = parti(s), o = oggiFirenze();
    const nome = s === o ? P.oggi : s === piuGiorni(o, 1) ? P.domani : S.giorni[giornoSett(s)];
    return nome + " " + p[2] + " " + P.mesi[p[1] - 1];
  }
  // l'istante in cui a Firenze l'orologio segna quel giorno e quell'ora (per il calendario)
  function daFirenze(s, ora) {
    const p = parti(s), h = ora.split(":").map(Number);
    const ipotesi = Date.UTC(p[0], p[1] - 1, p[2], h[0], h[1]);
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const v = {};
    f.formatToParts(new Date(ipotesi)).forEach(function (x) { v[x.type] = +x.value; });
    return new Date(ipotesi - (Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute) - ipotesi));
  }

  /* ---------- server ---------- */
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
    // le funzioni pren_* mettono il loro codice nel campo "hint"
    if (!r.ok) throw errore((d && d.hint) || "server", (d && d.message) || P.e_server);
    return d;
  }
  // avvisa subito il titolare (se non parte, ci pensa il giro dei 5 minuti)
  function avvisaTitolare() {
    if (DEMO) return;
    fetch(CFG.url + "/functions/v1/pren-avvisa", {
      method: "POST", keepalive: true,
      headers: { apikey: CFG.chiave, "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "invia" }),
    }).catch(function () {});
  }

  // il WhatsApp di conferma parte subito (se non parte, ci pensa il giro dei 2 minuti)
  function mandaWhatsapp() {
    if (DEMO || !disp || !disp.whatsapp) return;
    fetch(CFG.url + "/functions/v1/whatsapp-invia", {
      method: "POST", keepalive: true,
      headers: { apikey: CFG.chiave, "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "invia" }),
    }).catch(function () {});
  }

  const server = DEMO ? serverFinto() : {
    disponibilita: function () { return rpc("pren_disponibilita"); },
    prenota: function (d) {
      return rpc("pren_prenota", {
        p_sera: d.sera, p_turno: d.turno, p_persone: d.persone, p_nota: d.nota, p_chiave: d.chiave || "",
        p_nome: d.nome || "", p_email: d.email || "", p_telefono: d.telefono || "", p_nascita: d.nascita || "",
        p_promo: !!d.promo, p_lingua: S.lingua || "it", p_dispositivo: dispositivo(),
      });
    },
    mie: function (segreti) { return rpc("pren_mie", { p_segreti: segreti }); },
    annulla: function (segreto) { return rpc("pren_annulla", { p_segreto: segreto }); },
    club: function (d) {
      return rpc("club_iscriviti", { p_nome: d.nome, p_email: d.email || "", p_telefono: d.telefono, p_nascita: d.nascita,
        p_promo: !!d.promo, p_lingua: S.lingua || "it", p_dispositivo: dispositivo() });
    },
    collega: function (segreto, chiave) { return rpc("pren_collega_club", { p_segreto: segreto, p_chiave: chiave }); },
  };

  // il server finto della demo: stesse risposte, dati nella memoria del browser
  function serverFinto() {
    const K = "vdc_sito_demo_db";
    function db() { return leggi(K, { prenotazioni: [] }); }
    function attesa(fn) {
      return new Promise(function (ok, ko) { setTimeout(function () { try { ok(fn()); } catch (e) { ko(e); } }, 350); });
    }
    function caso(n) { let s = ""; while (s.length < n) s += "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]; return s; }
    function occupati(d, s, t) {
      return d.prenotazioni.filter(function (p) { return p.sera === s && p.turno === t && p.stato === "confermata"; })
        .reduce(function (n, p) { return n + p.persone; }, 0);
    }
    return {
      disponibilita: function () {
        return attesa(function () {
          const d = db(), o = oggiFirenze(), giorni = [];
          for (let i = 0; i <= 30; i++) {
            const s = piuGiorni(o, i), chiuso = giornoSett(s) === 1;   // nella demo il lunedì è chiuso
            const orari = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"];
            giorni.push({ sera: s, chiuso: chiuso, turni: orari.map(function (t) {
              const k = t < "21:00" ? 1 : 2;
              const pieno = (i === 1 && k === 2) || chiuso;               // domani il secondo turno è pieno
              const passato = i === 0 && daFirenze(s, t).getTime() - 2 * 3600e3 < Date.now();
              const presi = orari.filter(function (o) { return (o < "21:00" ? 1 : 2) === k; })
                .reduce(function (n, o) { return n + occupati(d, s, o); }, 0);
              return { ora: t, fascia: k, liberi: pieno || passato ? 0 : Math.max(0, Math.min(8, 40 - presi - (i === 2 ? 36 : 0))) };
            }) });
          }
          return { attive: true, maxPersone: 8, giorni: giorni, whatsapp: false, benvenutoMax: 4 };
        });
      },
      prenota: function (x) {
        return attesa(function () {
          const d = db();
          const tel = x.chiave ? "socio" : String(x.telefono || "").replace(/\D/g, "");
          if (d.prenotazioni.some(function (p) { return p.tel === tel && p.sera === x.sera && p.stato === "confermata"; })) throw errore("doppia", P.e_doppia);
          const visto = d.prenotazioni.some(function (p) { return p.tel === tel && p.stato !== "annullata"; });
          const p = { codice: caso(6), segreto: caso(24), sera: x.sera, turno: x.turno, persone: x.persone, tel: tel,
            nome: x.nome || (leggi(K_SOCIO, {}).nome) || "Demo", nota: x.nota || "", stato: "confermata",
            benvenuto: x.chiave || visto ? 0 : Math.min(4, x.persone), whatsapp: null };
          d.prenotazioni.push(p);
          scrivi(K, d);
          return Object.assign({}, p, { socio: !!x.chiave, nuovo: false, chiave: null });
        });
      },
      mie: function (segreti) {
        return attesa(function () {
          return db().prenotazioni.filter(function (p) { return segreti.indexOf(p.segreto) >= 0 && p.sera >= piuGiorni(oggiFirenze(), -1); });
        });
      },
      club: function (x) {
        return attesa(function () {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(x.nascita || "")) throw errore("nascita", P.e_nascita);
          return { chiave: caso(24), nome: x.nome };
        });
      },
      collega: function () { return attesa(function () { return true; }); },
      annulla: function (segreto) {
        return attesa(function () {
          const d = db(), p = d.prenotazioni.find(function (x) { return x.segreto === segreto; });
          if (!p) throw errore("nonc", P.e_server);
          p.stato = "annullata";
          scrivi(K, d);
          return p;
        });
      },
    };
  }

  /* ---------- stato del modulo ---------- */
  let disp = null;          // risposta di pren_disponibilita
  let sera = null, turno = null, quante = 2;
  let inviando = false;

  function giornoScelto() { return disp && disp.giorni.find(function (g) { return g.sera === sera; }); }
  function turnoScelto() {
    const g = giornoScelto();
    return g && g.turni.find(function (t) { return t.ora === turno; });
  }
  function prenotabile(g) { return !g.chiuso && g.turni.some(function (t) { return t.liberi > 0; }); }

  // la prima sera con posto, se quella scelta non va più bene; l'ora di arrivo la sceglie il cliente
  function scegliPrimi() {
    const g = giornoScelto();
    if (!g || !prenotabile(g)) {
      const primo = disp.giorni.find(prenotabile);
      sera = primo ? primo.sera : null;
      turno = null;
    }
    const t = turnoScelto();
    if (t && t.liberi < 1) turno = null;
    quante = Math.max(1, Math.min(quante, maxQuante()));
  }
  // quante persone si possono ancora prenotare: per l'ora scelta, o per la migliore della sera
  function maxQuante() {
    const t = turnoScelto(), g = giornoScelto();
    if (t) return t.liberi;
    return g ? Math.max.apply(null, g.turni.map(function (x) { return x.liberi; }).concat(0)) : 0;
  }

  /* ---------- disegno ---------- */
  function disegna() {
    if (!disp) return;
    if (!disp.attive) { app.innerHTML = '<p class="pren-nota">' + riempi(P.spente, { tel: telLink() }) + "</p>"; return; }
    scegliPrimi();
    if (!sera) { app.innerHTML = '<p class="pren-nota">' + riempi(P.nessuna, { tel: telLink() }) + "</p>"; return; }
    const socio = leggi(K_SOCIO, null);
    const max = maxQuante();
    app.innerHTML =
      '<div class="pren-mie" id="pren-mie" hidden></div>' +
      '<form class="pren" id="pren" novalidate>' +
      '<p class="pren-passo">' + esc(P.sera) + "</p>" +
      '<div class="pren-giorni" role="group" aria-label="' + esc(P.sera) + '">' + disp.giorni.map(function (g) {
        const p = parti(g.sera), ok = prenotabile(g);
        const nome = g.sera === oggiFirenze() ? P.oggi : g.sera === piuGiorni(oggiFirenze(), 1) ? P.domani : S.giorni[giornoSett(g.sera)].slice(0, 3);
        return '<button type="button" class="pren-giorno' + (g.sera === sera ? " on" : "") + '" data-sera="' + g.sera + '"' +
          (ok ? "" : " disabled") + ' aria-pressed="' + (g.sera === sera) + '">' +
          "<span>" + esc(nome) + "</span><b>" + p[2] + "</b><span>" + esc(ok ? P.mesi[p[1] - 1] : g.chiuso ? P.chiuso : g.sera === oggiFirenze() ? P.solo_telefono : P.pieno) + "</span></button>";
      }).join("") + "</div>" +
      '<p class="pren-passo">' + esc(P.turno) + "</p>" +
      '<div class="pren-turni">' + giornoScelto().turni.map(function (x, i, tutti) {
        // oggi un orario senza posti online di solito è solo "troppo tardi": al telefono si può ancora
        const stato = x.liberi < 1 ? (giornoScelto().chiuso ? P.chiuso : sera === oggiFirenze() ? P.solo_telefono : P.pieno)
          : x.liberi < disp.maxPersone ? P.ultimi : "";
        // ogni turno comincia su una riga nuova: si vede che sono due momenti della sera
        const aCapo = i > 0 && x.fascia !== tutti[i - 1].fascia;
        return '<button type="button" class="pren-turno' + (x.ora === turno ? " on" : "") + (aCapo ? " a-capo" : "") +
          '" data-ora="' + esc(x.ora) + '"' + (x.liberi < 1 ? " disabled" : "") + ' aria-pressed="' + (x.ora === turno) + '">' +
          "<b>" + esc(x.ora) + "</b><span>" + (stato ? esc(stato) : "&nbsp;") + "</span></button>";
      }).join("") + "</div>" +
      '<p class="pren-passo">' + esc(P.persone) + "</p>" +
      '<div class="pren-quante">' +
        '<button type="button" data-d="-1" aria-label="−"' + (quante <= 1 ? " disabled" : "") + ">−</button>" +
        '<output id="pren-quante">' + esc(persone(quante)) + "</output>" +
        '<button type="button" data-d="1" aria-label="+"' + (quante >= max ? " disabled" : "") + ">+</button></div>" +
      (quante >= max && max >= disp.maxPersone ? '<p class="pren-nota">' + riempi(P.gruppo, { n: disp.maxPersone, tel: telLink() }) + "</p>" : "") +
      '<p class="pren-passo">' + esc(P.dati) + "</p>" +
      (socio && socio.chiave
        ? '<p class="pren-socio">' + esc(riempi(P.socio, { nome: socio.nome })) + ' <button type="button" class="pren-link" id="pren-non-io">' + esc(P.non_sei_tu) + "</button></p>"
        : '<div class="pren-campi">' +
            campo("nome", P.nome, "text", "name") +
            '<label class="pren-campo"><span>' + esc(P.telefono) + " <small>· " + esc(disp.whatsapp ? P.tel_aiuto_wa : P.tel_aiuto) +
              '</small></span><input name="telefono" type="tel" autocomplete="tel" inputmode="tel"></label></div>' +
          '<details class="pren-privacy"><summary>' + esc(P.privacy_breve) + " " + esc(P.privacy_titolo) + "</summary>" +
            P.privacy_testo + "</details>") +
      '<label class="pren-campo"><span>' + esc(P.nota) + '</span><textarea name="nota" rows="2" maxlength="300" placeholder="' +
        esc(P.nota_esempio) + '"></textarea></label>' +
      '<p class="pren-errore" id="pren-errore" role="alert" hidden></p>' +
      '<button class="btn btn-chiaro pren-invia" type="submit">' + esc(P.conferma) + "</button>" +
      "</form>";
    legaModulo();
    mostraMie();
  }
  function campo(nome, etichetta, tipo, auto) {
    return '<label class="pren-campo"><span>' + esc(etichetta) + '</span><input name="' + nome + '" type="' + tipo +
      '" autocomplete="' + auto + '"' + (tipo === "tel" ? ' inputmode="tel"' : "") + "></label>";
  }

  // ridisegna senza perdere quello che il cliente ha già scritto
  function ridisegna() {
    const f = document.getElementById("pren"), salvati = {};
    if (f) Array.from(f.elements).forEach(function (el) {
      if (el.name) salvati[el.name] = el.type === "checkbox" ? el.checked : el.value;
    });
    disegna();
    const g = document.getElementById("pren");
    if (g) Array.from(g.elements).forEach(function (el) {
      if (el.name && salvati[el.name] != null) { if (el.type === "checkbox") el.checked = salvati[el.name]; else el.value = salvati[el.name]; }
    });
  }

  function legaModulo() {
    const f = document.getElementById("pren");
    f.addEventListener("click", function (e) {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.sera) { sera = b.dataset.sera; turno = null; ridisegna(); }
      else if (b.dataset.ora) { turno = b.dataset.ora; ridisegna(); }
      else if (b.dataset.d) { quante += Number(b.dataset.d); ridisegna(); }
      else if (b.id === "pren-non-io") { try { localStorage.removeItem(K_SOCIO); } catch (er) {} ridisegna(); }
    });
    f.addEventListener("submit", invia);
    // la sera scelta resta in vista nella fila dei giorni
    const on = f.querySelector(".pren-giorno.on");
    if (on && on.scrollIntoView && on.parentNode.scrollLeft === 0 && on.offsetLeft > on.parentNode.clientWidth) {
      on.parentNode.scrollLeft = on.offsetLeft - 16;
    }
  }

  function sbaglio(testo, campoNome) {
    const box = document.getElementById("pren-errore");
    box.innerHTML = testo;
    box.hidden = false;
    const f = document.getElementById("pren");
    const c = campoNome && f.elements[campoNome];
    if (c && c.focus) c.focus(); else box.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function invia(e) {
    e.preventDefault();
    if (inviando) return;
    const f = e.target, socio = leggi(K_SOCIO, null);
    document.getElementById("pren-errore").hidden = true;
    if (!sera || !turno) return sbaglio(esc(P.e_scegli));
    const dati = { sera: sera, turno: turno, persone: quante, nota: f.elements.nota.value.trim() };
    if (socio && socio.chiave) {
      dati.chiave = socio.chiave;
    } else {
      dati.nome = f.elements.nome.value.trim();
      dati.telefono = f.elements.telefono.value.trim();
      if (dati.nome.length < 2) return sbaglio(esc(P.e_nome), "nome");
      if (dati.telefono.replace(/\D/g, "").length < 8) return sbaglio(esc(P.e_telefono), "telefono");
    }
    inviando = true;
    const btn = f.querySelector(".pren-invia");
    btn.disabled = true;
    btn.textContent = P.invio;
    try {
      const r = await server.prenota(dati);
      const mie = leggi(K_MIE, []);
      mie.push(r.segreto);
      scrivi(K_MIE, mie.slice(-20));
      if (r.chiave) scrivi(K_SOCIO, { chiave: r.chiave, nome: String(r.nome || dati.nome || "").split(/\s+/)[0] });
      avvisaTitolare();
      mandaWhatsapp();
      fatto(r, dati);
      aggiornaDisponibilita();
    } catch (er) {
      inviando = false;
      btn.disabled = false;
      btn.textContent = P.conferma;
      // la chiave salvata non è più valida (es. uscito dal Club): si torna al modulo completo
      if (er.codice === "telefono" && dati.chiave) {
        try { localStorage.removeItem(K_SOCIO); } catch (x) {}
        ridisegna();
        return sbaglio(esc(P.e_nome), "nome");
      }
      const testo = esc(P["e_" + er.codice] || er.message || P.e_server);
      const campi = { nome: "nome", telefono: "telefono" };
      if (er.codice === "pieno" || er.codice === "tardi" || er.codice === "sera") aggiornaDisponibilita(testo);
      else sbaglio(er.codice === "gruppo" || er.codice === "troppe" || er.codice === "tante" || er.codice === "rete" || er.codice === "chiuse"
        ? testo + " " + telLink() : testo, campi[er.codice]);
    }
  }

  function fatto(r, dati) {
    inviando = false;
    const socio = leggi(K_SOCIO, null);
    const inizio = daFirenze(r.sera, r.turno);
    app.innerHTML =
      '<div class="pren-fatto" id="pren-fatto" tabindex="-1">' +
      '<div class="pren-ok" aria-hidden="true">✓</div>' +
      "<h3>" + esc(P.fatto) + "</h3>" +
      "<p>" + esc(riempi(P.fatto_quando, { giorno: giornoBreve(r.sera), ora: r.turno, persone: persone(r.persone) })) + "</p>" +
      '<p class="pren-codice">' + esc(P.codice) + " <b>" + esc(r.codice) + "</b></p>" +
      (r.benvenuto > 0
        ? '<p class="pren-benvenuto">' + esc(riempi(r.whatsapp ? P.benv_wa : P.benv_schermo, { n: persone(r.benvenuto) })) + "</p>"
        : r.whatsapp ? '<p class="pren-club">' + esc(P.conf_wa) + "</p>" : "") +
      '<div class="azioni">' +
        '<a class="btn btn-chiaro" download="vico-del-carmine.ics" href="' + esc(calendario(r, inizio)) + '">📅 ' + esc(P.calendario) + "</a>" +
        (socio && socio.chiave && CFG.tessera
          ? '<a class="btn btn-vuoto-chiaro" href="' + esc(CFG.tessera + socio.chiave) + '">💳 ' + esc(P.tessera) + "</a>" : "") +
      "</div>" +
      '<button type="button" class="pren-link" id="pren-altra">' + esc(P.altra) + "</button></div>" +
      (!r.socio && !(socio && socio.chiave) && dati.telefono ? boxClub() : "");
    legaClub(r, dati);
    const box = document.getElementById("pren-fatto");
    box.focus({ preventScroll: true });
    box.scrollIntoView({ block: "center", behavior: "smooth" });
    document.getElementById("pren-altra").addEventListener("click", function () { disegna(); });
  }

  // dopo la prenotazione, il Club facoltativo: nome e telefono ci sono già, manca la data di nascita
  function boxClub() {
    return '<form class="pren-club-box" id="pren-club" novalidate>' +
      "<h4>" + esc(P.club_tit) + "</h4><p>" + esc(P.club_sotto) + "</p>" +
      '<label class="pren-campo"><span>' + esc(P.nascita) + " <small>· " + esc(P.nascita_perche) + "</small></span>" +
        '<input name="nascita" type="date" autocomplete="bday"></label>' +
      campo("email", P.email_fac, "email", "email") +
      '<label class="pren-spunta"><input type="checkbox" name="privacy"><span>' + esc(P.privacy) + "</span></label>" +
      '<label class="pren-spunta"><input type="checkbox" name="promo"><span>' + esc(P.promo) + "</span></label>" +
      '<p class="pren-errore" role="alert" hidden></p>' +
      '<button class="btn btn-chiaro pren-club-invia" type="submit">' + esc(P.club_entra) + "</button></form>";
  }
  function legaClub(r, dati) {
    const f = document.getElementById("pren-club");
    if (!f) return;
    const errore = f.querySelector(".pren-errore");
    const no = function (testo, campoNome) {
      errore.textContent = testo;
      errore.hidden = false;
      const c = campoNome && f.elements[campoNome];
      if (c && c.focus) c.focus();
    };
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      errore.hidden = true;
      const d = { nome: dati.nome, telefono: dati.telefono, nascita: f.elements.nascita.value,
                  email: f.elements.email.value.trim(), promo: f.elements.promo.checked };
      if (!d.nascita) return no(P.e_nascita, "nascita");
      if (d.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(d.email)) return no(P.e_email, "email");
      if (!f.elements.privacy.checked) return no(P.club_e_privacy, "privacy");
      const b = f.querySelector(".pren-club-invia");
      b.disabled = true;
      b.textContent = P.invio;
      try {
        const c = await server.club(d);
        scrivi(K_SOCIO, { chiave: c.chiave, nome: String(c.nome || d.nome).split(/\s+/)[0] });
        server.collega(r.segreto, c.chiave).catch(function () {});
        f.innerHTML = '<p class="pren-club">' + esc(P.club_ok) + "</p>" +
          (CFG.tessera ? '<a class="btn btn-chiaro" href="' + esc(CFG.tessera + c.chiave) + '">💳 ' + esc(P.tessera) + "</a>" : "");
      } catch (er) {
        b.disabled = false;
        b.textContent = P.club_entra;
        if (er.codice === "gia") { f.innerHTML = '<p class="pren-club">' + esc(P.club_gia) + "</p>"; return; }
        no(P["e_" + er.codice] || er.message || P.e_server, { nascita: "nascita", email: "email" }[er.codice]);
      }
    });
  }

  // il file per il calendario del telefono (due ore a partire dal turno)
  function calendario(r, inizio) {
    const fmt = function (d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    const testo = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//" + S.nome + "//Prenotazioni//IT", "BEGIN:VEVENT",
      "UID:" + r.codice + "@" + location.hostname, "DTSTAMP:" + fmt(new Date()),
      "DTSTART:" + fmt(inizio), "DTEND:" + fmt(new Date(inizio.getTime() + 2 * 3600e3)),
      "SUMMARY:" + S.nome + " · " + persone(r.persone),
      "LOCATION:" + String(S.indirizzo || "").replace(/,/g, "\\,"),
      "DESCRIPTION:" + P.codice + " " + r.codice, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(testo);
  }

  /* ---------- le prenotazioni di questo browser ---------- */
  let avvisoMie = null;   // "prenotazione annullata": si vede una volta, dopo che il modulo si è ridisegnato
  async function mostraMie() {
    const segreti = leggi(K_MIE, []);
    const box = document.getElementById("pren-mie");
    if (!box || (!segreti.length && !avvisoMie)) return;
    let lista = [];
    if (segreti.length) {
      try { lista = (await server.mie(segreti)) || []; } catch (e) { return; }
    }
    const attive = lista.filter(function (p) { return p.stato === "confermata" && p.sera >= oggiFirenze(); });
    // tengo solo i segreti che servono ancora
    scrivi(K_MIE, segreti.filter(function (s) { return lista.some(function (p) { return p.segreto === s; }); }));
    const avviso = avvisoMie;
    avvisoMie = null;
    if ((!attive.length && !avviso) || !document.body.contains(box)) return;
    box.innerHTML = (avviso ? '<p class="pren-club" role="status">' + esc(avviso) + "</p>" : "") +
      (attive.length ? "<h3>" + esc(P.mie) + "</h3><ul>" : "<ul>") + attive.map(function (p) {
      return '<li><span><b>' + esc(giornoBreve(p.sera)) + " · " + esc(p.turno) + "</b> · " + esc(persone(p.persone)) +
        ' <small>' + esc(p.codice) + "</small></span>" +
        '<button type="button" class="pren-link" data-annulla="' + esc(p.segreto) + '" data-sera="' + esc(p.sera) +
        '" data-ora="' + esc(p.turno) + '">' + esc(P.annulla) + "</button></li>";
    }).join("") + "</ul>";
    box.hidden = false;
    box.addEventListener("click", async function (e) {
      const b = e.target.closest("[data-annulla]");
      if (!b) return;
      if (!confirm(riempi(P.annulla_chiedi, { giorno: giornoBreve(b.dataset.sera), ora: b.dataset.ora }))) return;
      b.disabled = true;
      try {
        await server.annulla(b.dataset.annulla);
        avvisaTitolare();
        avvisoMie = P.annullata;
        aggiornaDisponibilita();
      } catch (er) {
        b.disabled = false;
        alert(P["e_" + er.codice] || er.message || P.e_server);
      }
    });
  }

  /* ---------- avvio ---------- */
  async function aggiornaDisponibilita(messaggio) {
    try {
      disp = await server.disponibilita();
      if (document.getElementById("pren-fatto")) return;   // non tolgo la conferma appena mostrata
      ridisegna();
      if (messaggio) sbaglio(messaggio);
    } catch (e) {
      // senza collegamento resta il tasto per chiamare, che è sempre sotto il modulo
      if (!disp) app.innerHTML = '<p class="pren-nota">' + esc(P.e_rete) + "</p>";
    }
  }
  if (DEMO) app.insertAdjacentHTML("beforebegin", '<p class="pren-demo">DEMO · niente di vero</p>');
  aggiornaDisponibilita();
})();
