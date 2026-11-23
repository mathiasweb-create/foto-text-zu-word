"""Baut die fertige, offline lauffähige Datei Foto-Text-zu-Word.html.

Benötigt die npm-Pakete im Ordner node_modules (Pfad als Argument):
  npm i tesseract.js@5.1.1 tesseract.js-core@5.1.1 docx@8.5.0 @tesseract.js-data/deu @tesseract.js-data/eng
Aufruf: python build.py <node_modules> <ausgabe.html>

Wortliste woerter-de_AT.txt.gz: aus dem Hunspell-Wörterbuch de_AT (igerman98, GPL) mit
  unmunch de_AT.dic de_AT.aff  erzeugt, Zeilen mit Restflags entfernt, sortiert, gzip.
"""
import base64, gzip, json, os, sys

nm, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))

def gz(path):
    with open(os.path.join(nm, path), 'rb') as f:
        return base64.b64encode(gzip.compress(f.read(), 9)).decode()

def patched_worker():
    # Fehler in tesseract.js 5.1.1: eingebettete Sprachdaten werden beim Start mit .data statt .code benannt
    js = open(os.path.join(nm, 'tesseract.js/dist/worker.min.js'), encoding='utf-8').read()
    old = 'return"string"==typeof t?t:t.data})).join("+")'
    assert js.count(old) == 1, 'Worker-Patch passt nicht mehr'
    js = js.replace(old, 'return"string"==typeof t?t:t.code})).join("+")')
    return base64.b64encode(gzip.compress(js.encode(), 9)).decode()

def raw(path):
    with open(os.path.join(nm, path), 'rb') as f:
        return base64.b64encode(f.read()).decode()

assets = {
    'tesseract': gz('tesseract.js/dist/tesseract.min.js'),
    'worker': patched_worker(),
    'core': gz('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
    'docx': gz('docx/build/index.umd.js'),
    'words': base64.b64encode(open(os.path.join(here, 'woerter-de_AT.txt.gz'), 'rb').read()).decode(),
    'lang': {
        'deu': raw('@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz'),
        'eng': raw('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
    },
}
src = open(os.path.join(here, 'app.src.html'), encoding='utf-8').read()
korr = open(os.path.join(here, 'korrektur.js'), encoding='utf-8').read()
assert '</script' not in korr
html = src.replace('/*__ASSETS__*/', 'window.__ASSETS__ = ' + json.dumps(assets) + ';').replace('/*__KORREKTUR__*/', korr)
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html) / 1e6, 1), 'MB')

# Optional: Web-App-Ordner für iPhone/iPad (offline über Service Worker)
#   python build.py <node_modules> <ausgabe.html> <web-ordner>
if len(sys.argv) > 3:
    import hashlib
    web = sys.argv[3]
    os.makedirs(web, exist_ok=True)
    head = ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="apple-touch-icon" href="icon-180.png">\n'
            '<link rel="icon" type="image/png" href="icon-192.png">')
    page = html.replace('<!--__PWA_HEAD__-->', head)
    open(os.path.join(web, 'index.html'), 'w', encoding='utf-8').write(page)
    version = hashlib.sha256(page.encode()).hexdigest()[:12]
    files = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png']
    open(os.path.join(web, 'sw.js'), 'w', encoding='utf-8').write(f"""// Hält die App für die Nutzung ohne Internet bereit.
const CACHE = 'foto-text-{version}';
const FILES = {json.dumps(files)};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then(r => r || fetch(e.request).catch(() => caches.match('index.html'))));
}});
""")
    json.dump({
        'name': 'Foto-Text zu Word', 'short_name': 'Foto-Text', 'lang': 'de',
        'start_url': './', 'scope': './', 'display': 'standalone',
        'background_color': '#f6f5f2', 'theme_color': '#1f5fbf',
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}],
    }, open(os.path.join(web, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    from PIL import Image, ImageDraw
    for size in (180, 192, 512):
        k = size / 512
        im = Image.new('RGB', (size, size), (31, 95, 191)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([140*k, 90*k, 372*k, 422*k], radius=18*k, fill='white')
        for i, wdt in enumerate([170, 190, 150, 185, 120]):
            y = (150 + i * 50) * k
            d.rounded_rectangle([170*k, y, (170 + wdt)*k, y + 18*k], radius=9*k, fill=(31, 95, 191))
        im.save(os.path.join(web, f'icon-{size}.png'))
    print(web, 'fertig')
