sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.docs', {
    itemPressDocs: function (oEvt) {
      var oSrc = oEvt.getParameter('listItem');
      var oCtx = oSrc.getBindingContext('ui5tools');
      var oObject = oCtx.getObject();
      this.getRouter().navTo('docsDetail', {
        hash: oObject.hash,
      });
    },

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },
  });
});
