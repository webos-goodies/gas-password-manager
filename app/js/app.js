goog.provide('gaspass.App');
goog.require('goog.array');
goog.require('goog.crypt');
goog.require('goog.crypt.Aes');
goog.require('goog.crypt.Cbc');
goog.require('goog.crypt.Hmac');
goog.require('goog.crypt.Sha256');
goog.require('goog.crypt.pbkdf2');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.dom.dataset');
goog.require('goog.dom.forms');
goog.require('goog.events.EventType');
goog.require('goog.events.EventHandler');

/**
 * XOR two byte arrays. (optimized)
 * @param {!Array.<number>} bytes1 Byte array 1.
 * @param {!Array.<number>} bytes2 Byte array 2.
 * @return {!Array.<number>} Resulting XOR of the two byte arrays.
 */
goog.crypt.xorByteArray = function(bytes1, bytes2) {
  goog.asserts.assert(
      bytes1.length == bytes2.length,
      'XOR array lengths must match');

  var result = [];
  for (var i = 0, l = bytes1.length ; i < l ; i++) {
    result[i] = bytes1[i] ^ bytes2[i];
  }
  return result;
};

/**
 * An application class for GAS Password Manager.
 * @constructor
 */
gaspass.App = function() {

  /**
   * Shared encryption key.
   * @type {Array.<number>}
   * @private
   */
  this.sharedKey_ = '';

  /**
   * Salt for shared encryption key.
   * @type {Array.<number>}
   * @private
   */
  this.sharedSalt_ = goog.crypt.hexToByteArray(window['sharedSalt']);

  /**
   * Master password.
   * @type {Array.<number>}
   * @private
   */
  this.password_ = '';

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
  this.eh_.listen(goog.dom.getElement('result'),    goog.events.EventType.CLICK,  this.onOps_);
};

goog.scope(function() {
  var _ = gaspass.App;

  /**
   * Derives encryption key from password.
   * @param {Array.<number>} salt
   * @return {Array.<number>} Encryption key.
   */
  _.prototype.getEncryptionKey = function(salt) {
    var hmac = new goog.crypt.Hmac(new goog.crypt.Sha256(), this.password_, 64);
    hmac.update(goog.crypt.pbkdf2.deriveKeySha1(this.password_, salt, 5000, 128));
    hmac.update(this.sharedKey_);
    return hmac.digest();
  };

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

    var key        = this.getEncryptionKey(iv);
    var cipher     = new goog.crypt.Cbc(new goog.crypt.Aes(key));
    var cipherText = cipher.encrypt(plainText, iv);

    return {
      data: goog.crypt.byteArrayToHex(cipherText),
      iv:   goog.crypt.byteArrayToHex(iv)
    };
  };

  /**
   * Decrypt string
   * @param {string} str String to decrypt.
   * @param {string} iv Initial vector.
   */
  _.prototype.decrypt = function(str, iv) {
    str = goog.crypt.hexToByteArray(str);
    iv  = goog.crypt.hexToByteArray(iv);

    var key       = this.getEncryptionKey(iv);
    var cipher    = new goog.crypt.Cbc(new goog.crypt.Aes(key));
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
    goog.dom.getElement('pass').style.display = 'none';
    this.password_  = goog.crypt.stringToByteArray(formData['text'][0]);
    this.sharedKey_ = goog.crypt.pbkdf2.deriveKeySha1(this.password_, this.sharedSalt_, 1000, 128);
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
      var el = goog.dom.createDom(
        'tr', null,
        goog.dom.createDom('td', null, row[0]),
        goog.dom.createDom('td', null, row[1]),
        goog.dom.createDom('td', null, goog.dom.createDom('input')),
        goog.dom.createDom('td', 'ops',
          goog.dom.createDom('a', {'href':'#', 'class':'lock' }),
          goog.dom.createDom('a', {'href':'#', 'class':'show' })));
      goog.dom.dataset.set(el, 'password', row[2]||'');
      goog.dom.dataset.set(el, 'iv',       row[3]||'');
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
  _.prototype.onOps_ = function(e) {
    var rowEl = goog.dom.getAncestorByTagNameAndClass(e.target, 'tr');
    if(e.target.nodeName.toLowerCase() != 'a' || !rowEl) {
      return;
    }
    e.preventDefault();

    if(goog.dom.classes.has(e.target, 'show')) {

      if(goog.dom.classes.has(rowEl, 'unlocked')) {
        goog.dom.classes.toggle(rowEl, 'shown');
      }

    } else if(goog.dom.classes.has(e.target, 'lock')) {

      var password = goog.dom.dataset.get(rowEl, 'password');
      var iv       = goog.dom.dataset.get(rowEl, 'iv');
      var inputEl  = rowEl.getElementsByTagName('input')[0];
      inputEl.value = this.decrypt(password, iv);

      goog.dom.classes.addRemove(e.target, 'lock', 'unlock');
      goog.dom.classes.add(rowEl, 'unlocked');

    }
  };

});

var app = new gaspass.App();
