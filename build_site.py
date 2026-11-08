"""Build Pages from an explicit allowlist. Legacy snapshots never enter _site."""
import base64,hashlib,json,re,shutil,zipfile,io
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def build():
    dest=ROOT/'_site';shutil.rmtree(dest,ignore_errors=True);dest.mkdir()
    html=(ROOT/'index.html').read_text()
    names={'index.html','ui-version.json','CNAME','hero_cine.jpg'}
    for name in re.findall(r'(?:src|href)="([^"#]+)"',html):
        if '://' not in name:names.add(name.split('?')[0])
    names.update(str(p.relative_to(ROOT)) for p in (ROOT/'assets').rglob('*') if p.is_file())
    names.update(str(p.relative_to(ROOT)) for p in (ROOT/'radar').rglob('*') if p.is_file())
    manifest=json.loads((ROOT/'data/current.json').read_text());version=manifest['snapshotVersion']
    names.add('data/current.json');names.update(x['path'] for x in manifest['files'].values())
    for name in names:
        source=ROOT/name;assert source.is_file(),name
        target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    # Backward URLs receive only version-bound, policy-filtered compatibility projections.
    for name,meta in manifest['files'].items():shutil.copyfile(ROOT/meta['path'],dest/'data'/name)
    assert not (dest/'data/bar-chunks').exists()
    (dest/'.nojekyll').write_text('')
    return dest
if __name__=='__main__':print(build())
