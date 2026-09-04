#!/usr/bin/env python3
"""Rebuild the Captain Passage Tool seed pack from artifact db JSON docs.
Usage: python3 rebuild_seed.py <dir containing seedfiles/*.json> <output repo dir>"""
import sys, os, json, base64, hashlib, glob
src, dst = sys.argv[1], sys.argv[2]
docs = {}
for f in glob.glob(os.path.join(src, 'seedfiles', '*.json')):
    d = json.load(open(f))
    d = d.get('data', d) if isinstance(d, dict) and 'data' in d and isinstance(d['data'], dict) and 'content' in d['data'] else d
    docs.setdefault(d['id'], {})[int(d['part'])] = d
ok = True
for fid, parts in sorted(docs.items(), key=lambda kv: kv[1][0]['path']):
    meta = parts[0]
    if sorted(parts) != list(range(meta['chunks'])):
        print('MISSING PARTS', meta['path'], sorted(parts)); ok = False; continue
    payload = ''.join(parts[i]['content'] for i in range(meta['chunks']))
    raw = base64.b64decode(payload) if meta['encoding'] == 'base64' else payload.encode('utf-8')
    sha = hashlib.sha256(raw).hexdigest()
    status = 'OK ' if (sha == meta['sha256'] and len(raw) == meta['bytes']) else 'BAD'
    if status == 'BAD': ok = False
    out = os.path.join(dst, meta['path']); os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    open(out, 'wb').write(raw)
    print(status, meta['path'], len(raw), 'bytes')
mig = os.path.join(dst, 'supabase', 'migrations'); os.makedirs(mig, exist_ok=True)
schema = os.path.join(dst, 'docs', 'schema.sql')
if os.path.exists(schema):
    open(os.path.join(mig, '0001_init.sql'), 'wb').write(open(schema, 'rb').read()); print('OK  supabase/migrations/0001_init.sql (copy of docs/schema.sql)')
print('ALL OK' if ok else 'FAILED'); sys.exit(0 if ok else 1)
