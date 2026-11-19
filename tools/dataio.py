"""Lettura/scrittura dei file dati della piattaforma (data/NAME.js = window.NAME={json};)."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')

def load(name):
    p = os.path.join(DATA, name + '.js')
    if not os.path.exists(p):
        return None
    s = open(p, encoding='utf-8').read().strip()
    s = re.sub(r'^window\.\w+\s*=\s*', '', s).rstrip(';').strip()
    return json.loads(s)

def _rnd(x):
    if isinstance(x, float):
        if x != x or x in (float('inf'), float('-inf')):
            return None
        a = abs(x)
        if a >= 1000: return round(x, 2)
        if a >= 1: return round(x, 4)
        return round(x, 6)
    return x

def _clean(o):
    if isinstance(o, dict): return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list): return [_rnd(v) if not isinstance(v, (dict, list)) else _clean(v) for v in o]
    return _rnd(o)

def save(name, obj):
    p = os.path.join(DATA, name + '.js')
    txt = 'window.%s=' % name + json.dumps(_clean(obj), ensure_ascii=False, separators=(',', ':')) + ';\n'
    tmp = p + '.tmp'
    open(tmp, 'w', encoding='utf-8').write(txt)
    os.replace(tmp, p)
