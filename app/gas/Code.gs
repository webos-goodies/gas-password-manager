var SPREADSHEET_FILENAME    = 'GAS Password Manager';
var PROPNAME_SPREADSHEET_ID = 'gas_password_manager_spreadsheet_id';

function doGet() {
  var tpl = HtmlService.createTemplateFromFile('index.html');
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
    if((row[0] || '').indexOf(term) >= 0 || (row[1] || '').indexOf(term) >= 0) {
      result.push(row);
    }
  }
  return Utilities.jsonStringify(result);
}

function postData(data) {
  var sheet = getTargetSheet(true);
  sheet.appendRow(data);
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
