# Agente Santi_A — prototipo

Santi_A es el asistente territorial del Visor Repositorio Digital. Su objetivo es permitir consultas en lenguaje natural sin obligar al usuario a buscar capa por capa.

## Fuente preliminar

Mientras las coberturas no estén migradas a `3. REPOSITORIO VISOR`, el prototipo usa como fuente maestra preliminar `2. BIBLIOTECA DIGITAL`.

Regla: Santi_A no inventa territorio, barrio, conteos ni estadísticas. Si falta una relación territorial oficial, la respuesta debe declararlo y esperar el cruce con la cartografía oficial.

## Funciones iniciales

- Identificar cobertura desde lenguaje natural.
- Detectar intención de consulta: mayor concentración, menor concentración, cantidad y mostrar.
- Responder con barrio, territorio (cuando exista), cantidad y porcentaje.
- Generar acciones para el visor: `activate_layer`, `zoom_to`, `highlight`.

## Prueba controlada

Pregunta: `¿Dónde hay mayor concentración de museos?`

El motor identifica `museos`, calcula el máximo desde estadísticas agregadas y devuelve acciones de mapa. Las pruebas unitarias del prototipo están en `tests/santi-a.test.mjs`.

## Prueba con fuente real

Se verificó `Museo_Barrio.xlsx` en la Biblioteca Digital. Contiene 40 registros y campo `BARRIO`. En el conjunto inspeccionado, YUNGAY presenta 9 registros, CENTRO HISTORICO 8 y SANTA LUCIA FORESTAL 6. El territorio debe obtenerse desde la cartografía territorial oficial y no inferirse por texto.

## Estado de integración

El prototipo vive en la rama `feature/santi-a-prototype`. No está incorporado a la interfaz pública del visor. La integración se realizará sólo después de validar el contrato de datos y las acciones cartográficas con las capas oficiales.
