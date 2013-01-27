var SPREADSHEET_FILENAME    = 'GAS Password Manager';
var PROPNAME_SPREADSHEET_ID = 'gas_password_manager_spreadsheet_id';
var PROPNAME_SALT           = 'gas_password_manager_salt';

function doGet() {
  var tpl  = HtmlService.createTemplateFromFile('index.html');
  var salt = UserProperties.getProperty(PROPNAME_SALT);
  if(!salt) {
    salt = '';
    for(var i = 0 ; i < 32 ; i++) {
      var v = ((Math.random() * 512) & 0xff).toString(16);
      while(v.length < 2) { v = '0' + v; }
      salt += v.substr(0, 2);
    }
    UserProperties.setProperty(PROPNAME_SALT, salt);
  }
  tpl.salt = salt;
  return tpl.evaluate();
}

function search(term) {
  var sheet = getTargetSheet(false);
  if(!sheet) {
    return [];
  }
  var data   = sheet.getDataRange().getValues();
  var result = [];
  for(var i = 0, l = data.length ; i < l ; i++) {
    var row = data[i];
    if((''+row[0]).indexOf(term) >= 0 || (''+row[1]).indexOf(term) >= 0) {
      var r = [];
      for(var ii = 0, ll = row.length ; ii < ll ; ii++) {
        r[ii] = (''+row[ii]).replace(/^"|"$/g, '');
      }
      result.push(r);
    }
  }
  return Utilities.jsonStringify(result);
}

function postData(data) {
  var sheet = getTargetSheet(true);
  var row   = [];
  for(var i = 0, l = data.length ; i < l ; i++) {
    row[i] = '"' + data[i] + '"';
  }
  sheet.appendRow(row);
}

function getTargetSheet(createIfNeeded) {
  var file   = null;
  var fileId = UserProperties.getProperty(PROPNAME_SPREADSHEET_ID);
  if(fileId) {
    try { file = SpreadsheetApp.openById(fileId); } catch(e) {}
  }
  if(!file && createIfNeeded) {
    file = SpreadsheetApp.create(SPREADSHEET_FILENAME);
    UserProperties.setProperty(PROPNAME_SPREADSHEET_ID, file.getId());
  }
  if(!file) {
    return null;
  }
  return file.getSheets()[0];
}
