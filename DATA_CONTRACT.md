# Contrato de carga de capas

Este archivo define cómo incorporar información real sin cambiar la interfaz del visor.

## Archivos por capa

- Publicación web: `public/data/<id-capa>.geojson` en `EPSG:4326`.
- Descargas: `public/downloads/<id-capa>.{shp.zip,csv,gpkg}`.
- Registro: completar `public/catalog/layers.json` y reemplazar cada URL nula.

Las cuatro coberturas base requeridas son: límite comunal, territorios, barrios y manzanas. Deben publicarse como geometrías oficiales validadas y mantenerse separadas de las representaciones piloto de la interfaz.

## Campos mínimos

- Identificador único de la entidad.
- Campo territorial para vinculación, preferentemente `COD_MZN`.
- Campos de categoría, estado, fuente y fecha de actualización.
- Geometría válida y sin objetos vacíos.

`COD_MZN` se debe cargar y exportar siempre como texto para conservar ceros iniciales. No debe convertirse a número en CSV, hojas de cálculo, bases de datos ni código.

## Reglas de publicación

1. Validar nombres, tipos, duplicados, nulos y geometrías.
2. Mantener `dataUrl` y descargas en `null` mientras la capa esté en revisión.
3. Cambiar `status` a `publicado` únicamente después de la aprobación responsable.
4. Registrar fuente, año o fecha de actualización y cobertura.
5. Usar valores nulos reales; no reemplazarlos por cero o texto ambiguo.

## Desagregación por campo

Cada capa debe declarar en `disaggregateFields` los campos categóricos que pueden controlar la simbología, leyenda, tabla, resumen, gráficos y descarga filtrada. Ejemplos: dependencia público/privado, tipo, estado, organismo responsable, año, barrio y territorio.

## Registro y análisis espacial

- Capas de puntos: cantidad, densidad, proximidad, agrupación visual, calor y celdas hexagonales.
- Capas de polígonos: cantidad, superficie intersectada y porcentaje de cobertura.
- El clúster agrupa por cercanía en pantalla y nivel de zoom; no debe describirse como DBSCAN.
- El mapa de calor expresa densidad visual y requiere calibrar radio y peso con los datos reales.
- Toda desagregación debe conservar sus categorías en mapa, leyenda, tabla y resultados.

## Integración esperada

El visor leerá el catálogo, cargará el GeoJSON indicado, generará simbología y filtros desde los campos declarados, y habilitará las descargas existentes. La tabla de atributos compartirá la selección territorial con el mapa.


## Conectores de fuentes oficiales

Las fuentes oficiales externas se integran al mismo catálogo de coberturas y deben declarar, cuando corresponda:

- `fuenteInstitucional`: organismo responsable del dato.
- `fuenteUrl`: URL oficial de consulta o descarga.
- `fuenteAnio`: año de referencia del dato.
- `tipoOrigen`: municipal, fuente oficial externa, histórico u otro.
- `tipoConexion`: API, ArcGIS REST, WMS/WFS, CSV, XLSX, CKAN/datos.gob.cl, GeoJSON u otro.
- `frecuenciaActualizacion`: periodicidad conocida o regla de revisión.
- `ultimaActualizacion`: fecha de última revisión/sincronización por GIS STGO.
- `estadoConexion`: disponible, pendiente de validación, sin cambios, fuente modificada o fuente caída.

Un conector registrado no equivale a una capa publicada. Antes de modificar el GeoPackage maestro se debe conservar una copia RAW de la fuente, filtrar a la comuna de Santiago cuando corresponda, comparar altas/bajas/cambios con la cobertura vigente y validar geometría, campos clave, CRS y consistencia territorial.

Los conectores se registran en `public/catalog/conectores_fuentes_oficiales.json` y el glosario asociado en `public/catalog/glosario_fuentes.json`. El Índice y el buscador de Biblioteca Digital consumen estos registros junto al catálogo existente.
