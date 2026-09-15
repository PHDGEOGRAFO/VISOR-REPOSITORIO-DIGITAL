// Reemplazar SOLO la función registerDownload_ actual por esta versión.
// Mantiene toda la lógica de autorización existente y agrega DIMENSION, SECTOR y AÑO al registro.

function registerDownload_(payload) {
  const email = normalizeEmail_(payload.email);
  const key = String(payload.key || '').trim().toLowerCase();
  const coverage = String(payload.coverage || 'Cobertura territorial');
  const format = String(payload.format || 'Archivo');
  const dimension = String(payload.dimension || 'SIN DIMENSION');
  const sector = String(payload.sector || 'SIN SECTOR');
  const anio = String(payload.anio || 'SIN AÑO');
  let result = 'RECHAZADO';
  let message = 'Correo no autorizado o clave incorrecta.';

  if (validEmail_(email) && key === DOWNLOAD_KEY && isAuthorized_(email)) {
    result = 'DESCARGA AUTORIZADA';
    message = 'Descarga autorizada.';
  }

  sheet_(SHEET_LOG).appendRow([
    now_(),
    email,
    coverage,
    format,
    result,
    dimension,
    sector,
    anio
  ]);

  return result === 'DESCARGA AUTORIZADA'
    ? {ok:true, authorized:true, message:message}
    : {ok:false, authorized:false, message:message};
}
