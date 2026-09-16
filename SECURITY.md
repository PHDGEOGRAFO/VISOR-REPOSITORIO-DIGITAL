# Seguridad GIS STGO

Este repositorio publica únicamente código y datos web autorizados. La BBDD Maestra, cálculos, respaldos, archivos GIS de trabajo y credenciales permanecen fuera de GitHub, en la Unidad Compartida privada.

## Reglas
- No subir BBDD maestras ni respaldos.
- No subir archivos de trabajo GIS/Excel/SQLite directamente.
- No subir claves, tokens, contraseñas, certificados ni archivos `.env`.
- Publicar únicamente versiones derivadas y sanitizadas en `data-web/` o rutas web autorizadas.
- Todo dato enviado al navegador debe considerarse técnicamente descargable.
- Los cambios en `main` deben pasar las validaciones automáticas de publicación segura.

## Datos territoriales comunes
Comuna, territorios PLADECO, barrios y Manzana Censal 2024 (`COD_MZN`) forman el estándar territorial común de GIS STGO.

## Incidente
Si una credencial o archivo privado llega a publicarse, retirarlo del repositorio no basta: debe revocarse o rotarse la credencial y revisarse el historial de Git.
