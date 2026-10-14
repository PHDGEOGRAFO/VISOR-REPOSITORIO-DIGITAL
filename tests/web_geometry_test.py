import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from shapely.geometry import shape
from prepare_safe_web_geojson import web_geometry,process
normal={"type":"Polygon","coordinates":[[[-70,-33],[-69.999,-33],[-69.999,-33.001],[-70,-33.001],[-70,-33]]]}
thin={"type":"Polygon","coordinates":[[[-70,-33],[-69.99999999,-33],[-69.99999999,-33.0001],[-70,-33.0001],[-70,-33]]]}
compound={"type":"GeometryCollection","geometries":[normal,{"type":"LineString","coordinates":[[-70,-33],[-70,-33.01]]}]}
bowtie={"type":"Polygon","coordinates":[[[-70,-33],[-69.99,-33.01],[-69.99,-33],[-70,-33.01],[-70,-33]]]}
for raw in [normal,thin,compound,bowtie]:
    geom,_=web_geometry(raw)
    assert shape(geom).is_valid and not shape(geom).is_empty
    assert shape(geom).geom_type in ("Polygon","MultiPolygon")
assert abs(shape(web_geometry(thin)[0]).area-shape(thin).area)/shape(thin).area<=0.01
with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as folder:
    path=Path(folder)/"fixture.geojson"
    features=[{"type":"Feature","id":i,"properties":{"COD_MZN":str(i),"N_MASCOTAS":i*5},"geometry":g} for i,g in enumerate([normal,thin,compound])]
    path.write_text(json.dumps({"type":"FeatureCollection","features":features}),encoding="utf8")
    process(path,"Regression fixture")
    result=json.loads(path.read_text(encoding="utf8"))
    assert len(result["features"])==3
    for before,after in zip(features,result["features"]):
        assert before["id"]==after["id"] and before["properties"]==after["properties"]
print("PASS: composed and narrow geometries, invalid-shape repair, counts, COD_MZN and attribute preservation.")
