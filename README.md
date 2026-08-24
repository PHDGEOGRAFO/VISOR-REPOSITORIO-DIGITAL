# Visor Repositorio Digital

Repositorio independiente para respaldar, desarrollar y publicar el **Visor Repositorio Digital de la comuna de Santiago**.

## Objetivo

Organizar y visualizar coberturas cartográficas municipales mediante una interfaz KISS, con:

- catálogo de capas;
- mapa base y límites de comuna, territorios, barrios y manzanas;
- desagregación según los campos disponibles en cada cobertura;
- filtros y selección espacial;
- visualización de puntos, polígonos, clusters y mapas de calor;
- análisis de cantidad, superficie y porcentaje de cobertura;
- herramientas de dibujo y selección mediante polígono;
- descargas en GeoJSON, Shapefile, GeoPackage y CSV;
- fichas de metadatos y reportes.

## Regla de datos

El visor debe utilizar únicamente capas definitivas, vigentes y validadas trasladadas al **Repositorio Visor Digital**.

Los archivos originales de la **Biblioteca Digital / SIG base repositorio** permanecen como fuentes de trabajo. No deben modificarse desde este repositorio.

Cuando existan varias versiones de una cobertura, el visor publicará la más actualizada, por ejemplo: Grifos 2025 o Áreas Verdes 2026.

## Estructura prevista

- `src/`: interfaz, mapa, análisis y reportes.
- `public/data/`: GeoJSON optimizados para visualización.
- `public/downloads/`: SHP, GPKG y CSV descargables.
- `public/catalog/layers.json`: catálogo y configuración de las capas.
- `docs/`: metodología, manuales y control de cambios.

## Estado del respaldo

Repositorio creado el 24 de agosto de 2026.

Este primer respaldo conserva la identidad, objetivos, reglas y arquitectura prevista. El código completo del visor se incorporará mediante actualizaciones verificables.

## Publicación

La versión web se publicará mediante GitHub Pages. También se mantendrá una salida HTML ejecutable/local utilizando el mismo código y datos.
