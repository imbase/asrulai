"""Verify the real custom domain, not a build directory or Pages preview."""
import hashlib,json,re,time,urllib.request,urllib.error
from pathlib import Path
BASE='https://asrulai.com'
def fetch(path):
    with urllib.request.urlopen(urllib.request.Request(BASE+'/'+path,headers={'Cache-Control':'no-cache'}),timeout=30) as r:return r.read()
def verify(expected=None,attempts=30):
    last=None
    for attempt in range(attempts):
        try:
            m=json.loads(fetch('data/current.json?v='+str(int(time.time()))))
            if expected and m['snapshotVersion']!=expected:raise ValueError('Production still has a previous snapshot')
            for ref in m['files'].values():
                raw=fetch(ref['path']);assert hashlib.sha256(raw).hexdigest()==ref['sha256']
                assert json.loads(raw)['snapshotVersion']==m['snapshotVersion']
            html=fetch('').decode();assert 'cine-scene' in html and 'preview-global' in html
            for route in ['intel','leaders','data','results','rules','settings']:assert 'id="view-'+route+'"' in html
            for path in re.findall(r'(?:src|href)="([^"#]+)"',html):
                if '://' not in path:assert len(fetch(path))>0,path
            assert len(fetch('assets/hero_cine.jpg'))>100000
            try:fetch('api/scan');raise AssertionError('Management path unexpectedly public')
            except urllib.error.HTTPError as e:assert e.code in (404,405,410)
            result={'domain':BASE,'snapshotVersion':m['snapshotVersion'],'uiVersion':json.loads(fetch('ui-version.json'))['uiVersion'],'status':'PASS'}
            print(json.dumps(result));return result
        except Exception as e:
            last=e
            if attempt+1<attempts:time.sleep(10)
    raise RuntimeError('Production verification failed: '+str(last))
if __name__=='__main__':
    root=Path(__file__).resolve().parent
    verify(json.loads((root/'data/current.json').read_text())['snapshotVersion'])
