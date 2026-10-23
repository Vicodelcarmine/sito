#!/usr/bin/env python3
"""Costruisce il sito dai file in sorgente/.

    python3 strumenti/genera.py

Legge sorgente/dati.json (il ristorante), sorgente/testi.json (le parole, una
sezione per lingua) e sorgente/pagina.html (lo stampo), e scrive:
index.html (italiano), en/index.html (inglese), sitemap.xml, robots.txt, CNAME.
Per il sito di un altro locale basta cambiare dati.json e testi.json.
"""
import hashlib, html, json, os, re

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

if __name__ == "__main__":
    main()
