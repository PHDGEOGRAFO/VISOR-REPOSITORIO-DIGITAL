# Validación Santi_A

Casos a comprobar antes de publicar:

- `mostrar grifos` activa `grifos`.
- `activar líneas oficiales` activa exclusivamente `prc_expropiacion_lineas.geojson`.
- `mapa de calor` cambia a modo `heat`.
- `clúster` cambia a modo `cluster`.
- `dibujar polígono` cambia a modo `draw`.
- `total población n_per` usa siempre la capa `manzana` y no la capa seleccionada.
- `¿qué existe en este polígono?` consulta todas las capas precargadas, incluso si están apagadas, e informa población `n_per` para manzanas intersectadas.
