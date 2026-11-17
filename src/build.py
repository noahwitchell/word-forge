# Builds app.html (claude.ai artifact) and docs/ (home-screen web app) from src/ + _lists/.
#   _lists/enable1.txt  ENABLE word list (public domain) -> every word the game accepts
#   _lists/en_50k.txt   OpenSubtitles frequency list -> which accepted words are "common" (the bank)
import os, json, hashlib, random
from collections import Counter
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')

MINLEN, MAXLEN = 3, 7
BANK_TOP = 35000      # frequency rank cutoff for bank words
SEED_TOP = 22000      # 7-letter seed words must be at least this common
BANK_MIN, BANK_MAX = 14, 70

enable = {w.strip() for w in open('_lists/enable1.txt') if w.strip().isalpha()}
freq = [l.split()[0] for l in open('_lists/en_50k.txt')]
rank = {}
for i, w in enumerate(freq):
    rank.setdefault(w, i)
words_in = lambda f: {w for l in open(f) if not l.startswith('#') for w in l.split()}
block = words_in('src/blocklist.txt')
notbank = words_in('src/notbank.txt')

full = sorted(w for w in enable if MINLEN <= len(w) <= MAXLEN and w not in block)
common = sorted(w for w in full if rank.get(w, 1e9) < BANK_TOP and w not in notbank)
commonset = set(common)
counts = {w: Counter(w) for w in common}

def fits(word, pool):
    return all(pool[c] >= n for c, n in counts[word].items())

seeds = []
for w in common:
    if len(w) != 7 or rank[w] >= SEED_TOP: continue
    pool = Counter(w)
    bank = [x for x in common if fits(x, pool)]
    if BANK_MIN <= len(bank) <= BANK_MAX:
        seeds.append(''.join(sorted(w)))
seeds = sorted(set(seeds))            # anagram seeds collapse to one puzzle
random.Random(7).shuffle(seeds)        # fixed order: puzzle #n is stable across builds

extra = [w for w in full if w not in commonset]
data = {'common': ' '.join(common), 'extra': ' '.join(extra), 'seeds': ' '.join(seeds)}

head = open('src/head.html', encoding='utf-8').read()
js = open('src/app.js', encoding='utf-8').read().replace('/*@DATA@*/null', json.dumps(data, separators=(',', ':')))
out0 = head + '\n<script>\n' + js + '\n</script>\n'
icons = b''.join(open('docs/' + f, 'rb').read() for f in ('icon-192.png', 'icon-512.png', 'apple-touch-icon.png') if os.path.exists('docs/' + f))
build = hashlib.sha1(out0.encode() + icons).hexdigest()[:7]   # icon changes also bump the offline cache
out = out0.replace('__BUILD__', build)
open('app.html', 'w', encoding='utf-8').write(out)
open('_test.html', 'w', encoding='utf-8').write('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + out)
print('built app.html %d bytes | %d accepted, %d bank words, %d puzzles | build %s' % (len(out), len(full), len(common), len(seeds), build))

# ---- home-screen web app (serve /docs from any static host) ----
os.makedirs('docs', exist_ok=True)
page = '''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#f6f1e8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Word Forge">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
''' + out.replace('<div id="app"></div>', '</head><body>\n<div id="app"></div>', 1) + '''
<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
</body></html>
'''
open('docs/index.html', 'w', encoding='utf-8').write(page)
json.dump({"name": "Word Forge", "short_name": "Word Forge", "start_url": ".", "scope": ".", "display": "standalone",
           "orientation": "portrait", "background_color": "#f6f1e8", "theme_color": "#f6f1e8",
           "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]},
          open('docs/manifest.webmanifest', 'w'), indent=1)
open('docs/sw.js', 'w').write('''const CACHE='wf-%s';
const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('index.html',cp));return r;}).catch(()=>caches.match('index.html')));return;}
 e.respondWith(caches.match(e.request).then(hit=>{const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r;}).catch(()=>hit);return hit||net;}));});
''' % build)
print('web app built in docs/')
