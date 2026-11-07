"""Verify actual Pages artifact, pinned snapshot and permission boundaries."""
import hashlib,json,re
from pathlib import Path
from build_site import build
root=build();html=(root/'index.html').read_text()
for path in re.findall(r'(?:src|href)="([^"#]+)"',html):
    if '://' not in path:assert (root/path.split('?')[0]).is_file(),path
for name in ['engine.js','providers.js','strategy_engine.js','db.js','app.js']:
    assert not re.search(r'src="'+re.escape(name)+'[?\"]',html),name
assert html.count('src="cine-v4.js')==1
assert html.count('src="public-publication.js')==1
assert 'cine-scene' in html
ui=json.loads((root/'ui-version.json').read_text())
for name,digest in ui['sourceAssets'].items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
manifest=json.loads((root/'data/current.json').read_text());version=manifest['snapshotVersion']
for name,ref in manifest['files'].items():
    raw=(root/ref['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==ref['sha256']
    assert json.loads(raw)['snapshotVersion']==version
s=json.loads((root/manifest['files']['snapshot.json']['path']).read_text())
assert s['schemaVersion']=='asrulai-public-2'
assert not any(k in s for k in ['watchlist','settings','credentials'])
for module,field in [('dailyBars','bars'),('quotes','quotes'),('heatmaps','heatmaps'),('metals','metals')]:
    if s['permissions'][module]=='RESTRICTED':assert not s[field],module
if s['permissions']['strategyResults']=='RESTRICTED':assert all(not x['picks'] and x['count'] is None for x in s['strategies'])
for p in root.rglob('*'):
    if p.suffix in ('.json','.js','.html','.css'):
        text=p.read_text();assert not re.search(r'gh[pousr]_[A-Za-z0-9]{20}|github_pat_|/Users/|127\.0\.0\.1|localhost|postgres(?:ql)?://',text),p
print(json.dumps({'snapshotVersion':version,'marketDate':s['marketDate'],'sourceReportDate':s['source']['reportMarketDate'],'strategies':len(s['strategies']),'restrictedModules':s['completeness']['restrictedModules'],'artifactGate':'PASS'}))
