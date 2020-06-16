sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.docsDetail', {
    onInit: function () {
      this.getRouter().getRoute('docsDetail').attachPatternMatched(this.refreshDoc, this);
    },

    refreshDoc: function (oEvt) {
      var path = oEvt.getParameter('arguments').hash.split('-').join('/');
      this.getView().bindElement('ui5tools>' + path);
    },

    navDocs: function () {
      this.getRouter().navTo('docs');
    },

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },
  });
});
