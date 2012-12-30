goog.provide('gaspass.App');
goog.require('goog.array');
goog.require('goog.crypt');
goog.require('goog.crypt.Sha256');
goog.require('goog.crypt.Aes');
goog.require('goog.crypt.Cbc');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.dom.forms');
goog.require('goog.events.EventType');
goog.require('goog.events.EventHandler');

/**
 * An application class for GAS Password Manager.
 * @constructor
 */
gaspass.App = function() {

  /**
   * An encryption key.
   * @type {Array.<number>}
   * @private
   */
  this.encryptionKey_ = '';

  /**
   * Event handler management.
   * @type {goog.events.EventHandler};
   * @private
   */
  this.eh_ = new goog.events.EventHandler(this);

  // Register event handlers.
  this.eh_.listen(goog.dom.getElement('pass'),      goog.events.EventType.SUBMIT, this.onPass_);
  this.eh_.listen(goog.dom.getElement('search'),    goog.events.EventType.SUBMIT, this.onSearch_);
  this.eh_.listen(goog.dom.getElement('post-form'), goog.events.EventType.SUBMIT, this.onPost_);
  this.eh_.listen(goog.dom.getElement('result'),    goog.events.EventType.CLICK,  this.onShow_);
};

goog.scope(function() {
  var _ = gaspass.App;

  /**
   * Encrypt string
   * @param {string} str String to encrypt.
   * @return {{data:string, iv:string}} The result of encryption.
   */
  _.prototype.encrypt = function(str) {
    var iv = goog.array.map(
      goog.array.repeat(0, 16),
      function(v) { return (Math.random() * 512) & 0xff; });

    var plainText  = goog.crypt.stringToUtf8ByteArray(str);
    plainText.push(0);

    var cipher     = new goog.crypt.Cbc(new goog.crypt.Aes(this.encryptionKey_));
    var cipherText = cipher.encrypt(plainText, iv);

    return {
      data: '"' + goog.crypt.byteArrayToHex(cipherText) + '"',
      iv:   '"' + goog.crypt.byteArrayToHex(iv) + '"'
    };
  };

  /**
   * Decrypt string
   * @param {string} str String to decrypt.
   * @param {string} iv Initial vector.
   */
  _.prototype.decrypt = function(str, iv) {
    str = goog.crypt.hexToByteArray(str.replace(/\"/g, ''));
    iv  = goog.crypt.hexToByteArray(iv.replace(/\"/g, ''));

    var cipher    = new goog.crypt.Cbc(new goog.crypt.Aes(this.encryptionKey_));
    var plainText = cipher.decrypt(str, iv);
    var length    = plainText.indexOf(0);
    if(length >= 0) {
      plainText.length = length;
    }

    return goog.crypt.utf8ByteArrayToString(plainText);
  };

  /**
   * This method is called when the passphrase form is submitted.
   * @param {goog.events.Event} e An event object.
   * @private
   */
  _.prototype.onPass_ = function(e) {
    e.preventDefault();
    var formData = goog.dom.forms.getFormDataMap(e.target).toObject();
    var hash     = new goog.crypt.Sha256();
    hash.update(formData['text'][0]);
    this.encryptionKey_ = hash.digest();
    goog.dom.getElement('pass').style.display = 'none';
  };

  /**
   * This method is called when the search form is submitted.
   * @param {goog.events.Event} e An event object.
   * @private
   */
  _.prototype.onSearch_ = function(e) {
    e.preventDefault();
    var formData = goog.dom.forms.getFormDataMap(e.target).toObject();
    var term     = formData['text'][0];
    google.script.run.withSuccessHandler(goog.bind(this.onSearchSucceeded_, this)).search(term);
  };

  /**
   * This method is called when the search is completed successfully.
   * @param {string} result The JSON representation of the search result.
   * @private
   */
  _.prototype.onSearchSucceeded_ = function(result) {
    var resultEl = goog.dom.getElement('result');
    resultEl.style.display = 'block';

    resultEl = resultEl.getElementsByTagName('tbody')[0];
    goog.dom.removeChildren(resultEl);
    goog.array.forEach(JSON.parse(result), function(row) {
      var password = this.decrypt(row[2]||'', row[3]||'');
      var el = goog.dom.createDom(
        'tr', null,
        goog.dom.createDom('td', null, row[0]),
        goog.dom.createDom('td', null, row[1]),
        goog.dom.createDom('td', null, goog.dom.createDom('input', {'value':password})),
        goog.dom.createDom('td', 'show'));
      resultEl.appendChild(el);
    }, this);
  };

  /**
   * This method is called when the add entry form is submitted.
   * @param {goog.events.Event} e An event object.
   * @private
   */
  _.prototype.onPost_ = function(e) {
    e.preventDefault();
    var formData = goog.dom.forms.getFormDataMap(e.target).toObject();
    var password = this.encrypt(formData['password'][0]);
    var data = [
      formData['site'][0],
      formData['user'][0],
      password.data,
      password.iv];
    google.script.run.withSuccessHandler(goog.bind(this.onPostSucceeded_, this)).postData(data);
  };

  /**
   * This method is called when an entry is added successfully.
   * @private
   */
  _.prototype.onPostSucceeded_ = function() {
    var formEl = goog.dom.getElement('post-form');
    goog.array.forEach(formEl.getElementsByTagName('input'), function(el) {
      el.value = '';
    }, this);
  };

  /**
   * This method is called when a show button is clicked.
   * @param {goog.events.Event} e An event object.
   * @private
   */
  _.prototype.onShow_ = function(e) {
    var rowEl = e.target.parentNode;
    goog.dom.classes.toggle(rowEl, 'shown');
  };

});

var app = new gaspass.App();
