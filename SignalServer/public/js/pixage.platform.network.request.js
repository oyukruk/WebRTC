function PXC_Platform_Network_Request(options, successCallback, errorCallback, completeCallback) {

    PXC_Network_Request.call(this, options, successCallback, errorCallback, completeCallback);

}

PXC_Platform_Network_Request.prototype = Object.create(PXC_Network_Request.prototype);
PXC_Platform_Network_Request.prototype.constructor = PXC_Platform_Network_Request;

PXC_Platform_Network_Request.prototype.requestCompleted = function () {
    PXC_Network_Request.prototype.requestCompleted.call(this);

};

PXC_Platform_Network_Request.prototype.dispose = function () {
    PXC_Network_Request.prototype.dispose.call(this);
};

PXC_Platform_Network_Request.prototype.setOptions = function (options) {
    PXC_Network_Request.prototype.setOptions.call(this,options);
};

PXC_Platform_Network_Request.prototype.beginRequest = function () {
    PXC_Network_Request.prototype.beginRequest.call(this);

    if (this.xhr !== 0) {
        this.xhr.abort();
        delete this.xhr;
        this.xhr = null;
    }


    var _this = this;
    this.xhr = $.ajax(this.ajaxOptions)
    .done(function (data, textStatus, jqXHR) {

        if (_this.terminateRequest)
            return;
        if (typeof (_this.successCallback) == 'function') {
            _this.successCallback(data);
        }
    })
  .fail(function (jqXHR, textStatus, errorThrown) {
      if (_this.terminateRequest || textStatus === "abort")
          return;
      if (typeof (_this.errorCallback) == 'function') {
          _this.errorCallback(jqXHR.responseText);
      }
  })
  .always(function () {
      if (_this.terminateRequest)
          return;

      _this.requestCompleted();
      if (typeof (_this.completeCallback) == 'function') {
          _this.completeCallback();
      }
  });
};