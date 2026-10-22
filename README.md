# Sito del Vico del Carmine

Il sito vetrina del ristorante: apertura, il locale, le specialità, prenotazioni, Club, dove siamo, orari.
In italiano (pagina principale) e in inglese (`/en/`).

## Come è fatto

| Cosa | Dove |
|---|---|
| Dati del ristorante (telefono, orari, social, piatti in vetrina, indirizzo del Vicolo) | `sorgente/dati.json` |
| Tutte le frasi, in italiano e in inglese | `sorgente/testi.json` |
| Lo stampo della pagina | `sorgente/pagina.html` |
| Colori e impaginazione | `assets/css/sito.css` |
| "Aperto ora" e la riga di oggi negli orari | `assets/js/sito.js` |
| Foto dei piatti, mascotte, icone, anteprima per i social | `assets/img/` |
| Caratteri (ospitati qui, nessuna chiamata a Google) | `assets/fonts/` |

`index.html`, `en/index.html`, `sitemap.xml`, `robots.txt` e `CNAME` **non si toccano a mano**: li scrive
`python3 strumenti/genera.py` partendo da `sorgente/`. Dopo ogni modifica si rilancia il comando.

Un campo lasciato vuoto in `dati.json` sparisce dal sito (per esempio `whatsapp`, `partita_iva`,
l'indirizzo del Vicolo).

## Per il sito di un altro locale

Si copia la cartella, si cambiano `sorgente/dati.json`, `sorgente/testi.json`, le foto e i colori in cima a
`assets/css/sito.css`, poi si lancia `genera.py`. Così nascerà il sito del Vicolo.

## Pubblicazione

Come i menu: GitHub Desktop → Commit → **Push origin**, e dopo un minuto è online.
Il sito sta su GitHub Pages (repository `Vicodelcarmine/sito`) con il dominio scritto in `CNAME`.
