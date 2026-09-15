# Límites Oficiales GIS STGO

El Visor Territorial / Biblioteca Digital adopta una única referencia territorial común para GIS STGO.

Fuente canónica de publicación:
- Comuna: `PHDGEOGRAFO/GEOINDICADORES/data/comuna.geojson`
- Barrios: `PHDGEOGRAFO/GEOINDICADORES/data/barrios.geojson`
- Territorios PLADECO: `PHDGEOGRAFO/GEOINDICADORES/data/limite_territorios_pladeco.geojson`
- Manzana Censal 2024: `PHDGEOGRAFO/GEOINDICADORES/data/manzanas/*.geojson`

CRS web: EPSG:4326.

Jerarquía territorial oficial: `COMUNA → TERRITORIO → BARRIO → MANZANA CENSAL 2024`.

La llave oficial de manzana es `COD_MZN`.

Las coberturas temáticas pueden intersectar o relacionarse con estas unidades, pero no deben redefinir sus geometrías. Si un límite cambia, la corrección se realiza en la fuente canónica y luego se replica o consume en los visores.

Las capas maestras de edición permanecen en la Unidad Compartida; GitHub Pages usa únicamente las copias web de referencia territorial.
