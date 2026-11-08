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
assert not {'watchlist','settings','credentials','personalPatterns'}.intersection(s)
modules={'coverage','dailyBars','heatmaps','leaders','metals','news','quotes','strategyResults'}
assert s['permissions']==dict.fromkeys(modules,'PUBLISHED')
assert s['completeness']['restrictedModules']==[]
assert s['completeness']['sourceStatus']=='PUBLISHED'
pick_fields=set('symbol name change1d stage candidateTier close date qualified score grade industry sector exchange preMarketChange tags metrics rankingBreakdown patterns'.split())
for strategy in s['strategies']:
    assert strategy['sourceStatus']=='PUBLISHED'
    for pick in strategy['picks']:
        assert set(pick)<=pick_fields
        assert set(pick.get('rankingBreakdown',{}))<={'boardTotal','patternTotal'}
        assert all(set(pattern)<={'id','label','signalDate'} for pattern in pick.get('patterns',[]))
for name in ('board.json','klines.json'):
    assert (root/'data'/name).read_bytes()==(root/manifest['files'][name]['path']).read_bytes(),name
board=json.loads((root/'data/board.json').read_text())
assert board['strategies']==s['strategies'] and board['watchlist']==[]
assert len(board['dashboard']['news'])<=8
assert all((root/'radar'/path).is_file() for path in ('index.html','style.css','viewer.js','assets/hero_cine.jpg'))
for p in root.rglob('*'):
    if p.suffix in ('.json','.js','.html','.css'):
        text=p.read_text();assert not re.search(r'gh[pousr]_[A-Za-z0-9]{20}|github_pat_|/Users/|127\.0\.0\.1|localhost|postgres(?:ql)?://',text),p
print(json.dumps({'snapshotVersion':version,'marketDate':s['marketDate'],'sourceReportDate':s['source']['reportMarketDate'],'strategies':len(s['strategies']),'restrictedModules':s['completeness']['restrictedModules'],'artifactGate':'PASS'}))
