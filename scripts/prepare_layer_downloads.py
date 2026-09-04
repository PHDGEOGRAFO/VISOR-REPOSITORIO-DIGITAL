from pathlib import Path
import json, re, shutil, subprocess, tempfile, zipfile

ROOT = Path('.')
PUBLIC = ROOT / 'public'
CAT = PUBLIC / 'catalog' / 'index_coberturas.json'
PAGE = ROOT / 'app' / 'page.tsx'
OUT_GPKG = PUBLIC / 'downloads' / 'gpkg'
OUT_SHP = PUBLIC / 'downloads' / 'shp'


def safe_id(v):
    s = re.sub(r'[^A-Za-z0-9_-]+', '-', str(v or '')).strip('-_')
    return s or 'cobertura'


def run(cmd):
    print('+', ' '.join(map(str, cmd)))
    subprocess.run([str(x) for x in cmd], check=True)


def layer_source(item):
    cont = str(item.get('contenedor') or '')
    sub = str(item.get('subcapa') or '')
    if cont.lower().endswith('.gpkg') and sub:
        p = PUBLIC / 'data' / 'gpkg' / cont
        if p.exists():
            return ('gpkg', p, sub)
    dl = str(item.get('download') or '')
    if dl.startswith('/data/') and dl.lower().endswith('.geojson'):
        p = PUBLIC / dl.lstrip('/')
        if p.exists():
            return ('geojson', p, '')
    return None


def make_one(item):
    src = layer_source(item)
    if not src:
        return False
    sid = safe_id(item.get('id') or item.get('subcapa') or item.get('nombre'))
    subname = str(item.get('subcapa') or item.get('nombre') or sid)
    gpkg_out = OUT_GPKG / f'{sid}.gpkg'
    shp_zip = OUT_SHP / f'{sid}.zip'
    gpkg_out.unlink(missing_ok=True)
    shp_zip.unlink(missing_ok=True)

    kind, path, layer = src
    if kind == 'gpkg':
        run(['ogr2ogr', '-f', 'GPKG', gpkg_out, path, layer, '-nln', subname])
    else:
        run(['ogr2ogr', '-f', 'GPKG', gpkg_out, path, '-nln', subname])

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        shp_name = safe_id(subname)[:48]
        if kind == 'gpkg':
            run(['ogr2ogr', '-f', 'ESRI Shapefile', td, path, layer, '-nln', shp_name, '-lco', 'ENCODING=UTF-8'])
        else:
            run(['ogr2ogr', '-f', 'ESRI Shapefile', td, path, '-nln', shp_name, '-lco', 'ENCODING=UTF-8'])
        # Asegura CPG UTF-8 si GDAL no lo creó.
        cpg = td / f'{shp_name}.cpg'
        if not cpg.exists():
            cpg.write_text('UTF-8', encoding='ascii')
        with zipfile.ZipFile(shp_zip, 'w', zipfile.ZIP_DEFLATED) as z:
            for f in sorted(td.iterdir()):
                if f.is_file():
                    z.write(f, f.name)
    return gpkg_out.exists() and shp_zip.exists()


def patch_page():
    s = PAGE.read_text(encoding='utf-8')
    old_fun = '''function gpkgDownload(i:IndexItem){\n const c=String(i.contenedor||\"\");\n if(c.toLowerCase().endsWith(\"_vf.gpkg\"))return `/data/gpkg/${c}`;\n const d=normFieldName(`${itemDimension(i)} ${i.tema||\"\"} ${i.carpeta||\"\"}`);\n if(d.includes(\"ambiental\")||d.includes(\"amb\"))return \"/data/gpkg/02_DIM_AMBIENTAL_VF.gpkg\";\n if(d.includes(\"sociocultural\")||d.includes(\"soc\"))return \"/data/gpkg/03_DIM_SOCIOCULTURAL_VF.gpkg\";\n if(d.includes(\"economica\")||d.includes(\"eco\"))return \"/data/gpkg/04_DIM_ECONOMICA_VF.gpkg\";\n return \"\"\n}'''
    new_fun = '''function layerDownloadId(i:IndexItem){return String(i.id||i.subcapa||i.nombre||\"cobertura\").replace(/[^A-Za-z0-9_-]+/g,\"-\").replace(/^[-_]+|[-_]+$/g,\"\")||\"cobertura\"}\nfunction gpkgDownload(i:IndexItem){return i.download||i.subcapa?`/downloads/gpkg/${layerDownloadId(i)}.gpkg`:\"\"}\nfunction shpDownload(i:IndexItem){return i.download||i.subcapa?`/downloads/shp/${layerDownloadId(i)}.zip`:\"\"}'''
    if old_fun in s:
        s = s.replace(old_fun, new_fun)
    elif 'function shpDownload(i:IndexItem)' not in s:
        raise RuntimeError('No se encontró gpkgDownload original para reemplazar')

    old_actions = '''{i.download?<button className=\"downloadAction\" onClick={()=>requestDownload(i.download,\"GeoJSON\")}>GeoJSON</button>:null}{gpkgDownload(i)&&<button className=\"downloadAction\" onClick={()=>requestDownload(gpkgDownload(i),\"GeoPackage\")}>GeoPackage</button>}{!i.download&&!gpkgDownload(i)&&<span className=\"catalogOnly\">Catálogo</span>}'''
    new_actions = '''{i.download?<button className=\"downloadAction\" onClick={()=>requestDownload(i.download,\"GeoJSON · cobertura seleccionada\")}>GeoJSON</button>:null}{gpkgDownload(i)&&<button className=\"downloadAction\" onClick={()=>requestDownload(gpkgDownload(i),\"GeoPackage · cobertura seleccionada\")}>GeoPackage capa</button>}{shpDownload(i)&&<button className=\"downloadAction\" onClick={()=>requestDownload(shpDownload(i),\"Shapefile · cobertura seleccionada\")}>Shapefile capa</button>}{!i.download&&!gpkgDownload(i)&&!shpDownload(i)&&<span className=\"catalogOnly\">Catálogo</span>}'''
    if old_actions in s:
        s = s.replace(old_actions, new_actions)
    elif 'Shapefile capa' not in s:
        raise RuntimeError('No se encontró bloque de acciones de descarga original')
    PAGE.write_text(s, encoding='utf-8')


def main():
    OUT_GPKG.mkdir(parents=True, exist_ok=True)
    OUT_SHP.mkdir(parents=True, exist_ok=True)
    # Se regeneran para evitar residuos de capas eliminadas/renombradas.
    for d in (OUT_GPKG, OUT_SHP):
        for p in d.iterdir():
            if p.is_file(): p.unlink()
            elif p.is_dir(): shutil.rmtree(p)

    cat = json.loads(CAT.read_text(encoding='utf-8'))
    items = [i for i in cat.get('items', []) if i.get('verEnMapa') or i.get('download')]
    ok = 0
    skipped = []
    for i in items:
        try:
            if make_one(i): ok += 1
            else: skipped.append(i.get('id'))
        except subprocess.CalledProcessError:
            skipped.append(i.get('id'))
    patch_page()
    print(f'Descargas individuales generadas: {ok}; omitidas: {len(skipped)}')
    if skipped:
        print('Omitidas:', ', '.join(map(str, skipped[:30])))
    if ok == 0:
        raise SystemExit('No se generó ninguna descarga individual')


if __name__ == '__main__':
    main()
