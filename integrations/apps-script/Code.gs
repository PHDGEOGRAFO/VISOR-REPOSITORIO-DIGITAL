const SPREADSHEET_ID = '1QO_fmZEgzqA0J57ychDcgIsH8ewEAgYjs-aytVPLYp0';
const ADMIN_EMAIL = 'phernandez@munistgo.cl';
const DOWNLOAD_KEY = 'oficina';
const SHEET_REQUESTS = 'SOLICITUDES';
const SHEET_USERS = 'USUARIOS_AUTORIZADOS';
const SHEET_LOG = 'REGISTRO_DESCARGAS';

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('No existe la hoja ' + name);
  return sh;
}

function now_() {
  return new Date();
}

function isAuthorized_(email) {
  const sh = sheet_(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (normalizeEmail_(values[r][0]) === email) {
      const status = String(values[r][1] || '').trim().toUpperCase();
      return status === 'SI' || status === 'SÍ' || status === 'TRUE' || status === 'AUTORIZADO';
    }
  }
  return false;
}

function addOrAuthorizeUser_(email) {
  const sh = sheet_(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (normalizeEmail_(values[r][0]) === email) {
      sh.getRange(r + 1, 2, 1, 3).setValues([['SI', now_(), 'Autorizado desde solicitud del Visor Territorial']]);
      return;
    }
  }
  sh.appendRow([email, 'SI', now_(), 'Autorizado desde solicitud del Visor Territorial']);
}

function findPendingByToken_(token) {
  const sh = sheet_(SHEET_REQUESTS);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][5] || '') === token && String(values[r][4] || '').toUpperCase() === 'PENDIENTE') {
      return {sheet: sh, row: r + 1, email: normalizeEmail_(values[r][1]), coverage: String(values[r][2] || ''), format: String(values[r][3] || '')};
    }
  }
  return null;
}

function requestAccess_(payload) {
  const email = normalizeEmail_(payload.email);
  const coverage = String(payload.coverage || 'Cobertura territorial');
  const format = String(payload.format || 'Archivo');
  if (!validEmail_(email)) return {ok:false, message:'Correo electrónico no válido.'};
  if (isAuthorized_(email)) return {ok:true, authorized:true, message:'El correo ya se encuentra autorizado.'};

  const token = Utilities.getUuid();
  sheet_(SHEET_REQUESTS).appendRow([now_(), email, coverage, format, 'PENDIENTE', token, '']);
  const serviceUrl = ScriptApp.getService().getUrl();
  const approveUrl = serviceUrl + '?action=approve&token=' + encodeURIComponent(token);
  const rejectUrl = serviceUrl + '?action=reject&token=' + encodeURIComponent(token);
  const subject = 'Solicitud de acceso · Visor Territorial';
  const body = [
    'Se ha recibido una solicitud de acceso para descarga de coberturas.',
    '',
    'Correo: ' + email,
    'Cobertura: ' + coverage,
    'Formato: ' + format,
    '',
    'AUTORIZAR:', approveUrl,
    '',
    'RECHAZAR:', rejectUrl,
    '',
    'Subdirección de Planificación y Sustentabilidad - Visor Territorial'
  ].join('\n');
  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
  return {ok:true, message:'Solicitud enviada. Recibirá un correo cuando su acceso sea autorizado.'};
}

function registerDownload_(payload) {
  const email = normalizeEmail_(payload.email);
  const key = String(payload.key || '').trim().toLowerCase();
  const coverage = String(payload.coverage || 'Cobertura territorial');
  const format = String(payload.format || 'Archivo');
  let result = 'RECHAZADO';
  let message = 'Correo no autorizado o clave incorrecta.';

  if (validEmail_(email) && key === DOWNLOAD_KEY && isAuthorized_(email)) {
    result = 'DESCARGA AUTORIZADA';
    message = 'Descarga autorizada.';
  }
  sheet_(SHEET_LOG).appendRow([now_(), email, coverage, format, result]);
  return result === 'DESCARGA AUTORIZADA' ? {ok:true, authorized:true, message:message} : {ok:false, authorized:false, message:message};
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'request') return json_(requestAccess_(payload));
    if (payload.action === 'download') return json_(registerDownload_(payload));
    return json_({ok:false, message:'Acción no reconocida.'});
  } catch (err) {
    return json_({ok:false, message:String(err && err.message ? err.message : err)});
  }
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  const token = String((e && e.parameter && e.parameter.token) || '');
  if (action !== 'approve' && action !== 'reject') {
    return HtmlService.createHtmlOutput('<h3>Visor Territorial</h3><p>Servicio de autorización activo.</p>');
  }
  const request = findPendingByToken_(token);
  if (!request) return HtmlService.createHtmlOutput('<h3>Visor Territorial</h3><p>La solicitud no existe, ya fue resuelta o el enlace no es válido.</p>');

  if (action === 'reject') {
    request.sheet.getRange(request.row, 5).setValue('RECHAZADO');
    request.sheet.getRange(request.row, 7).setValue(now_());
    MailApp.sendEmail(request.email, 'Solicitud de acceso · Visor Territorial', [
      'Su solicitud de acceso para descarga de coberturas del Visor Territorial no ha sido autorizada.',
      '',
      'Saludos,',
      'Subdirección de Planificación y Sustentabilidad - Visor Territorial'
    ].join('\n'));
    return HtmlService.createHtmlOutput('<h3>Visor Territorial</h3><p>Solicitud rechazada.</p>');
  }

  addOrAuthorizeUser_(request.email);
  request.sheet.getRange(request.row, 5).setValue('AUTORIZADO');
  request.sheet.getRange(request.row, 7).setValue(now_());
  MailApp.sendEmail(request.email, 'Acceso autorizado al Visor Territorial', [
    'Su acceso para descarga de coberturas del Visor Territorial ha sido autorizado.',
    '',
    'Para descargar información, deberá ingresar en cada descarga:',
    '',
    'Correo: el mismo correo autorizado.',
    'Clave: oficina',
    '',
    'Cada descarga quedará registrada indicando usuario, fecha, hora y cobertura descargada.',
    '',
    'Saludos,',
    'Subdirección de Planificación y Sustentabilidad - Visor Territorial'
  ].join('\n'));
  return HtmlService.createHtmlOutput('<h3>Visor Territorial</h3><p>Usuario autorizado correctamente. Se envió el correo de confirmación.</p>');
}
