# Home-screen icon: paper field, one flat letter tile (cream face, ink outline, solid ink side face) with a serif-ish W, drawn at 4x and box-downsampled.
import zlib, struct, os, math
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
PAPER = (246, 241, 232); CARD = (255, 253, 248); INK = (31, 36, 39); GOLD = (239, 180, 63)

def rbox(x, y, x0, y0, x1, y1, r):
    qx = min(max(x, x0 + r), x1 - r); qy = min(max(y, y0 + r), y1 - r)
    return x0 <= x <= x1 and y0 <= y <= y1 and math.hypot(x - qx, y - qy) <= r

def seg(x, y, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay; t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - ax - t * dx, y - ay - t * dy)

W = [(.33, .33), (.41, .66), (.5, .43), (.59, .66), (.67, .33)]
def color(x, y):
    x0, y0, x1, y1, r, o = .2, .17, .8, .74, .09, .055
    if rbox(x, y, x0, y0, x1, y1, r):
        inner = rbox(x, y, x0 + .025, y0 + .025, x1 - .025, y1 - .025, r - .025)
        if not inner: return INK
        d = min(seg(x, y, *W[i], *W[i + 1]) for i in range(4))
        if d < .036: return INK
        return CARD
    if rbox(x, y, x0, y0 + o, x1, y1 + o, r): return INK   # side face
    if .3 <= x <= .7 and .87 <= y <= .9: return GOLD      # bank slot line
    return PAPER

def png(path, S):
    k = 4; raw = b''
    for y in range(S):
        row = bytearray(b'\x00')
        for x in range(S):
            acc = [0, 0, 0]
            for sy in range(k):
                for sx in range(k):
                    c = color((x + (sx + .5) / k) / S, (y + (sy + .5) / k) / S)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            row += bytes(v // (k * k) for v in acc)
        raw += bytes(row)
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))

os.makedirs('docs', exist_ok=True)
png('docs/icon-192.png', 192); png('docs/icon-512.png', 512); png('docs/apple-touch-icon.png', 180)
print('icons written')
