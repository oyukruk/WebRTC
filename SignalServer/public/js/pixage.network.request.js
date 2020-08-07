function PXC_Network_Request(options, successCallback, errorCallback, completeCallback) {

    this.xhr = 0;
    this.terminateRequest = false;


    this.ajaxOptions = {
        method: "GET",
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        async: true,
        timeout: 10000,
        cache: false,
        crossDomain: true,
    };

    options || (options = {});

    this.ajaxOptions = $.extend(this.ajaxOptions, options);

    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    this.completeCallback = completeCallback;
    this.isBusy = false;
};

PXC_Network_Request.prototype.setOptions = function (options) {
    this.ajaxOptions = {
        method: "GET",
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        async: true,
        timeout: 10000,
        cache: false,
        crossDomain: true,
    };

    options || (options = {});

    this.ajaxOptions = $.extend(this.ajaxOptions, options);
};

PXC_Network_Request.prototype.beginRequest = function () {
    this.isBusy = true;
};

PXC_Network_Request.prototype.requestCompleted = function () {
    this.isBusy = false;
};

PXC_Network_Request.prototype.dispose = function () {
    this.terminateRequest = true;
    if (this.xhr !== 0) {
        this.xhr.abort();
        delete this.xhr;
        this.xhr = 0;
    }

};
