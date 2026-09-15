# Límites Oficiales GIS STGO

El Visor Territorial / Biblioteca Digital adopta una única referencia territorial común para GIS STGO.

Fuente canónica de publicación:
- Comuna: `PHDGEOGRAFO/GEOINDICADORES/data/comuna.geojson`
- Barrios: `PHDGEOGRAFO/GEOINDICADORES/data/barrios.geojson`
- Territorios PLADECO: `PHDGEOGRAFO/GEOINDICADORES/data/limite_territorios_pladeco.geojson`

CRS web: EPSG:4326.

Las coberturas temáticas pueden intersectar o relacionarse con estas unidades, pero no deben redefinir sus geometrías. Si un límite cambia, la corrección se realiza en la fuente canónica y luego se replica o consume en los visores.

Las capas maestras de edición permanecen en la Unidad Compartida; GitHub Pages usa únicamente las copias web de referencia territorial.
