#!/usr/bin/env python3
"""Costruisce il sito dai file in sorgente/.

    python3 strumenti/genera.py

Legge sorgente/dati.json (il ristorante), sorgente/testi.json (le parole, una
sezione per lingua) e sorgente/pagina.html (lo stampo), e scrive:
index.html (italiano), en/index.html (inglese), sitemap.xml, robots.txt, CNAME
e gli indirizzi corti per volantini e social: club/index.html e, se c'è l'asporto,
asporto/index.html, prenota/index.html. In più privacy/index.html e regalo/index.html (le campagne).
Per il sito di un altro locale basta cambiare dati.json e testi.json.
"""
import hashlib, html, json, os, re, shutil

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINGUE = ["it", "en"]                       # la prima è quella principale (alla radice)
LOCALE_OG = {"it": "it_IT", "en": "en_GB"}
GIORNI_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
ORDINE_GIORNI = [1, 2, 3, 4, 5, 6, 0]       # la tabella degli orari parte dal lunedì

def svg(corpo):
    return ('<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + corpo + '</svg>')

ICONE = {
    "telefono": svg('<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>'),
    "luogo": svg('<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>'),
    "libro": svg('<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>'),
    "calendario": svg('<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/>'),
    "pizza": svg('<path d="M12 21.5c-3.04 0 -5.952 -.714 -8.5 -1.983l8.5 -16.517l8.5 16.517a19.09 19.09 0 0 1 -8.5 1.983z"/><path d="M5.38 15.866a14.94 14.94 0 0 0 6.815 1.634a14.944 14.944 0 0 0 6.502 -1.479"/><path d="M13 11.01v-.01"/><path d="M11 14v-.01"/>'),
    "pesce": svg('<path d="M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571"/><path d="M2 9.504c7.715 8.647 14.75 10.265 20 2.498c-5.25 -7.761 -12.285 -6.142 -20 2.504"/><path d="M18 11v.01"/><path d="M11.5 10.5c-.667 1 -.667 2 0 3"/>'),
    "mondo": svg('<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/>'),
    "regalo": svg('<path d="M3 9a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M12 8l0 13"/><path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5"/>'),
    "orologio": svg('<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>'),
    "freccia": svg('<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>'),
    "whatsapp": svg('<path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"/><path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"/>'),
    "instagram": svg('<path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M16.5 7.5v.01"/>'),
    "facebook": svg('<path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3"/>'),
    "borsa": svg('<path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304z"/><path d="M9 11v-5a3 3 0 0 1 6 0v5"/>'),
    "tiktok": svg('<path d="M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z"/>'),
}

def esc(s):
    return html.escape(str(s), quote=True)

def impronta(percorso):
    with open(os.path.join(RADICE, percorso), "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:8]

def orari_jsonld(orari):
    """Raggruppa i giorni con le stesse fasce, come vuole Google."""
    gruppi = {}
    for g in ORDINE_GIORNI:
        for apre, chiude in orari.get(str(g), []):
            gruppi.setdefault((apre, chiude), []).append(GIORNI_EN[g])
    return [{"@type": "OpeningHoursSpecification", "dayOfWeek": giorni, "opens": a, "closes": c}
            for (a, c), giorni in gruppi.items()]

def costruisci(d, t, lingua):
    principale = lingua == LINGUE[0]
    url_it = "https://" + d["dominio"] + "/"
    url_lingua = {l: url_it if l == LINGUE[0] else url_it + l + "/" for l in LINGUE}
    altra = LINGUE[1] if principale else LINGUE[0]
    base = "" if principale else "../"

    v = {k: (val if k.endswith("_html") else esc(val)) for k, val in t.items() if isinstance(val, str)}
    v.update({
        "LANG": lingua, "BASE": base, "NOME": esc(d["nome"]),
        "CANONICO": url_lingua[lingua], "URL_IT": url_lingua["it"], "URL_EN": url_lingua["en"],
        "OG_LOCALE": LOCALE_OG[lingua],
        "ALTRA_URL": ("en/" if principale else "../"), "ALTRA_LANG": altra, "ALTRA_SIGLA": altra.upper(),
        "MENU": esc(d["menu"]), "MAPPA": esc(d["mappa"]),
        "TEL": esc(d["telefono"]), "TEL_VISTO": esc(d["telefono_visto"]),
        "CHIAMA": esc(t["chiama"].replace("{tel}", d["telefono_visto"])),
        "INDIRIZZO": esc(d["indirizzo"]), "CAP": esc(d["cap"]), "CITTA": esc(d["citta"]),
        "ANNO": str(d["anno"]),
        "PIVA": (" · " + esc(t["piede_piva"]) + " " + esc(d["partita_iva"])) if d.get("partita_iva") else "",
        "CREDITO": "",
        "V_FONT": impronta("assets/css/font.css"), "V_CSS": impronta("assets/css/sito.css"),
        "V_JS": impronta("assets/js/sito.js"),
    })
    for nome, codice in ICONE.items():
        v["I_" + nome] = codice

    v["WHATSAPP"] = ""
    if d.get("whatsapp"):
        numero = re.sub(r"\D", "", d["whatsapp"])
        v["WHATSAPP"] = ('<a class="btn btn-vuoto-chiaro" href="https://wa.me/%s" target="_blank" rel="noopener">%s%s</a>'
                         % (numero, ICONE["whatsapp"], esc(t["whatsapp"])))

    v["VENTAGLIO"] = "".join(
        '<img class="carta c%d" src="%sassets/img/piatti/%s.jpg" alt="" width="720" height="900">' % (i + 1, base, f)
        for i, f in enumerate(d["foto_ventaglio"][:3]))

    def piatto(p):
        return ('<article class="piatto"><img src="%sassets/img/piatti/%s.jpg" alt="%s" width="720" height="900" loading="lazy">'
                '<div><h4>%s</h4><p>%s</p></div></article>'
                % (base, p["foto"], esc(p["nome"]), esc(p["nome"]), esc(p.get(lingua) or p.get("it", ""))))
    v["SPECIALITA"] = "".join(
        '<div class="gruppo"><h3 class="gruppo-titolo">%s</h3><div class="coppia">%s</div></div>'
        % (esc(t[g["titolo"]]), "".join(piatto(p) for p in g["piatti"]))
        for g in d["specialita"])

    righe = []
    for g in ORDINE_GIORNI:
        fasce = d["orari"].get(str(g), [])
        quando = " · ".join("%s – %s" % (a, c) for a, c in fasce) if fasce else esc(t["chiuso"])
        righe.append('<tr data-g="%d"%s><th scope="row">%s</th><td>%s</td></tr>'
                     % (g, "" if fasce else ' class="chiuso"', esc(t["giorni"][g]), quando))
    v["ORARI_RIGHE"] = "".join(righe)

    social = []
    for rete in ["instagram", "facebook", "tiktok"]:
        link = d.get("social", {}).get(rete)
        if link:
            social.append('<a href="%s" target="_blank" rel="noopener" aria-label="%s">%s</a>'
                          % (esc(link), rete.capitalize(), ICONE[rete]))
    v["SOCIAL"] = "".join(social)

    cr = d.get("credito") or {}
    if cr.get("nome"):
        chi = ('<a href="%s" target="_blank" rel="noopener">%s</a>' % (esc(cr["url"]), esc(cr["nome"]))
               if cr.get("url") else esc(cr["nome"]))
        v["CREDITO"] = '<p class="piccolo credito">%s %s%s%s</p>' % (
            esc(t["piede_credito"]), chi,
            (" · " + esc(cr["ditta"])) if cr.get("ditta") else "",
            (" · " + esc(t["piede_piva"]) + " " + esc(cr["partita_iva"])) if cr.get("partita_iva") else "")

    # asporto: una sezione con il tasto che apre il menu in modalità asporto
    v["ASPORTO"] = v["NAV_ASPORTO"] = ""
    if d.get("asporto"):
        v["NAV_ASPORTO"] = '<a href="#asporto">%s</a>' % v["nav_asporto"]
        v["ASPORTO"] = ('<section class="sezione asporto" id="asporto"><div class="contenitore"><div class="asporto-riquadro">'
                        '<div><p class="occhiello">%s</p><h2>%s</h2><p class="testo">%s</p></div>'
                        '<a class="btn" href="%s?asporto=1">%s%s</a></div></div></section>'
                        % (v["asp_occhiello"], t["asp_titolo_html"], v["asp_testo"], esc(d["menu"]), ICONE["borsa"], v["asp_bottone"]))

    vic = d.get("vicolo") or {}
    v["VICOLO"] = ""
    if vic.get("nome"):
        dove = ""
        if vic.get("indirizzo"):
            dove = '<p class="vicolo-dove">%s%s</p>' % (ICONE["luogo"], esc(vic["indirizzo"]))
            if vic.get("mappa"):
                dove = '<p class="vicolo-dove"><a href="%s" target="_blank" rel="noopener">%s%s</a></p>' % (
                    esc(vic["mappa"]), ICONE["luogo"], esc(vic["indirizzo"]))
        v["VICOLO"] = ('<section class="sezione vicolo"><div class="contenitore"><div class="vicolo-riquadro">'
                       '<p class="occhiello">%s</p><h2>%s</h2><p class="testo">%s</p>%s</div></div></section>'
                       % (v["vicolo_occhiello"], t["vicolo_titolo_html"], v["vicolo_testo"], dove))

    jsonld = {
        "@context": "https://schema.org", "@type": "Restaurant",
        "name": d["nome"], "url": url_it, "image": url_it + "assets/img/og.jpg",
        "logo": url_it + "assets/img/mascotte.png", "telephone": d["telefono"],
        "address": {"@type": "PostalAddress", "streetAddress": d["indirizzo"], "postalCode": d["cap"],
                    "addressLocality": d["citta"], "addressRegion": "FI", "addressCountry": "IT"},
        "servesCuisine": d["cucina"], "priceRange": d["fascia_prezzo"],
        "hasMenu": d["menu"], "acceptsReservations": True,
        "openingHoursSpecification": orari_jsonld(d["orari"]),
        "sameAs": [l for l in d.get("social", {}).values() if l],
    }
    v["JSONLD"] = json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")

    sito = {
        "orari": d["orari"],
        "giorni": t["giorni"],
        "testi": {k: t[k] for k in ["stato_aperto", "stato_apre_oggi", "stato_apre", "stato_chiuso", "domani"]},
    }
    # prenotazioni dal sito: senza la sezione "prenotazioni" in dati.json resta solo il tasto per chiamare
    v["PRENOTA_JS"] = ""
    if (d.get("prenotazioni") or {}).get("url"):
        sito.update({"lingua": lingua, "nome": d["nome"], "indirizzo": d["indirizzo"] + ", " + d["citta"],
                     "telefono": d["telefono"], "telefonoVisto": d["telefono_visto"],
                     "prenota": d["prenotazioni"], "pren": t["pren"]})
        v["PRENOTA_JS"] = '<script src="%sassets/js/prenota.js?v=%s" defer></script>' % (base, impronta("assets/js/prenota.js"))
    v["SITO_JSON"] = json.dumps(sito, ensure_ascii=False).replace("</", "<\\/")

    with open(os.path.join(RADICE, "sorgente", "pagina.html"), encoding="utf-8") as f:
        pagina = f.read()
    mancanti = set()
    def sostituisci(m):
        chiave = m.group(1)
        if chiave not in v:
            mancanti.add(chiave)
            return ""
        return v[chiave]
    pagina = re.sub(r"\{\{(\w+)\}\}", sostituisci, pagina)
    if mancanti:
        raise SystemExit("Testi mancanti per '%s': %s" % (lingua, ", ".join(sorted(mancanti))))
    return pagina, url_lingua[lingua]

# indirizzi corti (dominio/asporto, dominio/club): rimandano subito al menu, in modalità
# asporto o con l'iscrizione al Club aperta. Si stampano su volantini, bio dei social e
# scheda Google; gli eventuali ?parametri (es. ?fonte=sacchetto) passano al menu.
# Se la destinazione ha un'ancora (#prenota) non passano: finirebbero dopo l'ancora.
def pagina_rimando(d, titolo, testo, dest):
    vai = json.dumps(dest) if "#" in dest else json.dumps(dest) + ' + (location.search ? "&" + location.search.slice(1) : "")'
    return """<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>%(titolo)s · %(nome)s</title>
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=%(dest)s">
  <link rel="canonical" href="%(dest)s">
  <script>location.replace(%(vai)s);</script>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#1a1210;color:#f3e9dc;font:16px/1.5 system-ui,sans-serif">
  <p><a href="%(dest)s" style="color:#e2b45a">%(testo)s · %(nome)s</a></p>
</body>
</html>
""" % {"nome": esc(d["nome"]), "titolo": esc(titolo), "testo": esc(testo), "dest": esc(dest), "vai": vai}

def scrivi_rimando(nome, pagina):
    cartella = os.path.join(RADICE, nome)
    if pagina is None:
        if os.path.isdir(cartella):
            shutil.rmtree(cartella)         # spento nei dati: niente indirizzo corto
        return
    os.makedirs(cartella, exist_ok=True)
    with open(os.path.join(cartella, "index.html"), "w", encoding="utf-8") as f:
        f.write(pagina)
    print("scritto %s/index.html" % nome)

# dominio/privacy: l'informativa (italiano e inglese) in una pagina sua, da linkare dove serve
# (Meta la chiede per l'app di WhatsApp; i testi sono quelli del modulo di prenotazione)
def pagina_privacy(d, testi):
    blocchi = "".join('<section lang="%s"><h1>%s</h1>%s</section>' % (l, esc(testi[l]["pren"]["privacy_titolo"]), testi[l]["pren"]["privacy_testo"])
                      for l in LINGUE)
    return """<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy · %(nome)s</title>
  <link rel="canonical" href="https://%(dominio)s/privacy/">
</head>
<body style="margin:0;background:#1a1210;color:#f7efe2;font:16px/1.6 system-ui,sans-serif">
  <main style="max-width:720px;margin:0 auto;padding:32px 20px 60px">
    <p><a href="/" style="color:#e6b24a">← %(nome)s</a></p>
    %(blocchi)s
  </main>
  <style>h1{font-size:1.5rem;margin:28px 0 8px;color:#edcf94} p{margin:10px 0} section+section{margin-top:40px;border-top:1px solid #3a2a24;padding-top:8px}</style>
</body>
</html>
""" % {"nome": esc(d["nome"]), "dominio": d["dominio"], "blocchi": blocchi}

# dominio/regalo/?c=CODICE: la pagina del regalo a sorpresa delle campagne (solo italiano).
# Il codice personale arriva per email o WhatsApp; la pagina fa entrare nel Club, svela il
# premio (assets/js/regalo.js) e sotto ha il modulo di prenotazione del sito (prenota.js).
# Il codice sta nell'indirizzo: niente indicizzazione e niente referrer verso altri siti.
def pagina_regalo(d, testi):
    t = testi["it"]
    r = t["regalo"]
    sito = {"lingua": "it", "nome": d["nome"], "indirizzo": d["indirizzo"] + ", " + d["citta"],
            "telefono": d["telefono"], "telefonoVisto": d["telefono_visto"], "giorni": t["giorni"],
            "prenota": d["prenotazioni"], "pren": t["pren"], "regalo": r}
    return """<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>%(titolo)s · %(nome)s</title>
  <meta name="robots" content="noindex">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#1a1210">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
  <link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png">
  <link rel="preload" href="../assets/fonts/oswald.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/font.css?v=%(v_font)s">
  <link rel="stylesheet" href="../assets/css/sito.css?v=%(v_css)s">
</head>
<body class="pagina-regalo">
<header class="reg-testa">
  <a class="marchio" href="../">
    <img src="../assets/img/mascotte-240.png" alt="" width="172" height="240">
    <span>%(nome)s</span>
  </a>
</header>
<main>
  <section class="sezione regalo"><div class="contenitore"><div id="reg-app" class="reg-app"><p class="reg-piccolo">%(attendi)s</p></div></div></section>
  <section class="sezione prenota" id="prenota" hidden>
    <div class="contenitore"><div class="riquadro">
      <p class="occhiello">%(pren_occhiello)s</p>
      <h2>%(pren_titolo)s</h2>
      <p class="testo" id="reg-prenota-testo"></p>
      <div id="pren-app"></div>
      <div class="azioni pren-chiama"><a class="btn btn-chiaro" href="tel:%(tel)s">%(ico_tel)s%(chiama)s</a></div>
    </div></div>
  </section>
</main>
<footer class="reg-piede">
  <p>%(nome)s · %(indirizzo)s, %(citta)s · <a href="tel:%(tel)s">%(tel_visto)s</a> · <a href="../privacy/">Privacy</a></p>
</footer>
<script>window.SITO = %(sito)s;</script>
<script src="../assets/js/regalo.js?v=%(v_regalo)s" defer></script>
<script src="../assets/js/prenota.js?v=%(v_prenota)s" defer></script>
</body>
</html>
""" % {"nome": esc(d["nome"]), "titolo": esc(r["titolo_pagina"]), "attendi": esc(t["pren"]["invio"]),
       "pren_occhiello": esc(t["prenota"]), "pren_titolo": r["prenota_titolo_html"],
       "tel": esc(d["telefono"]), "tel_visto": esc(d["telefono_visto"]), "ico_tel": ICONE["telefono"],
       "chiama": esc(t["chiama"].replace("{tel}", d["telefono_visto"])),
       "indirizzo": esc(d["indirizzo"]), "citta": esc(d["citta"]),
       "sito": json.dumps(sito, ensure_ascii=False).replace("</", "<\\/"),
       "v_font": impronta("assets/css/font.css"), "v_css": impronta("assets/css/sito.css"),
       "v_regalo": impronta("assets/js/regalo.js"), "v_prenota": impronta("assets/js/prenota.js")}

def main():
    with open(os.path.join(RADICE, "sorgente", "dati.json"), encoding="utf-8") as f:
        d = json.load(f)
    with open(os.path.join(RADICE, "sorgente", "testi.json"), encoding="utf-8") as f:
        testi = json.load(f)
    indirizzi = []
    for lingua in LINGUE:
        pagina, url = costruisci(d, testi[lingua], lingua)
        cartella = RADICE if lingua == LINGUE[0] else os.path.join(RADICE, lingua)
        os.makedirs(cartella, exist_ok=True)
        with open(os.path.join(cartella, "index.html"), "w", encoding="utf-8") as f:
            f.write(pagina)
        indirizzi.append(url)
        print("scritto", os.path.relpath(os.path.join(cartella, "index.html"), RADICE))
    with open(os.path.join(RADICE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in indirizzi:
            f.write("  <url><loc>%s</loc></url>\n" % u)
        f.write("</urlset>\n")
    with open(os.path.join(RADICE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: https://%s/sitemap.xml\n" % d["dominio"])
    with open(os.path.join(RADICE, "CNAME"), "w", encoding="utf-8") as f:
        f.write(d["dominio"])               # senza a capo, come lo scrive GitHub
    print("scritti sitemap.xml, robots.txt, CNAME (%s)" % d["dominio"])
    scrivi_rimando("asporto", pagina_rimando(d, "Asporto", "Ordina da asporto", d["menu"] + "?asporto=1")
                   if d.get("asporto") else None)
    scrivi_rimando("club", pagina_rimando(d, "Club", "Entra nel Club", d["menu"] + "?club=apri"))
    scrivi_rimando("privacy", pagina_privacy(d, testi))
    scrivi_rimando("regalo", pagina_regalo(d, testi) if (d.get("prenotazioni") or {}).get("url") else None)
    # dominio/prenota: il link corto della bio di Instagram (conta come canale instagram)
    scrivi_rimando("prenota", pagina_rimando(d, "Prenota", "Prenota un tavolo", "/?ref=instagram#prenota")
                   if (d.get("prenotazioni") or {}).get("url") else None)

if __name__ == "__main__":
    main()
