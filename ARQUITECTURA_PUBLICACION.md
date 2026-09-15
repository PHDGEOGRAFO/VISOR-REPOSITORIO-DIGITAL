# Arquitectura de publicación de datos

## Regla general
La BBDD Maestra, cálculos, respaldos y archivos de revisión se mantienen fuera del repositorio público, en la Unidad Compartida/Drive institucional.

El visor público solo debe consumir una copia web derivada, preparada específicamente para visualización.

## Flujo estándar
1. BBDD Maestra privada en Unidad Compartida.
2. Proceso de publicación que selecciona únicamente campos autorizados.
3. Sanitización y simplificación de geometrías/atributos.
4. Generación de archivos web.
5. GitHub/GitHub Pages publica código y datos mínimos de visualización.

## No publicar
- BBDD maestras completas.
- Excel de cálculo o revisión.
- GeoPackage originales.
- Shapefiles originales.
- CSV completos de trabajo.
- Respaldos o archivos intermedios.
- Campos internos no visibles en el visor.

## Sí se puede publicar
- Geometría necesaria para visualización.
- Identificadores públicos.
- Nombre/categoría/año visibles.
- Atributos estrictamente necesarios para filtros, simbología o fichas públicas.
- Copias web sanitizadas y simplificadas.

## Descargas
Si una cobertura se ofrece para descarga, debe corresponder a una copia expresamente autorizada para distribución. La BBDD Maestra no se utiliza como archivo de descarga.

## Regla de seguridad
Todo archivo que recibe el navegador debe considerarse técnicamente descargable. Un formulario, clave o botón de autorización no protege un archivo estático que ya esté publicado en GitHub Pages. Por tanto, los archivos públicos deben ser seguros aun si un tercero los descarga directamente.

## Visor Territorial / Biblioteca Digital
Cada cobertura debe tener una separación explícita entre origen maestro privado y versión web/publicable. Los GeoPackage completos y archivos fuente deben permanecer en la Unidad Compartida salvo que hayan sido expresamente aprobados como producto de descarga pública.
