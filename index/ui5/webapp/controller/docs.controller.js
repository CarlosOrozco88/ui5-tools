sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.docs', {
    itemPressDocs: function (oEvt) {
      var oSrc = oEvt.getParameter('listItem');
      var oCtx = oSrc.getBindingContext('ui5tools');
      var oPath = oCtx.getPath().split('/').join('-');
      this.getRouter().navTo('docsDetail', {
        hash: oPath,
      });
    },

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },
  });
});
