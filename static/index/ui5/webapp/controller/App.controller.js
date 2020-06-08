sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.App', {
    selectLink: function (oEvt) {
      var oSrc = oEvt.getSource();
      var oData = oSrc.data();
      sap.m.URLHelper.redirect(oData.url, true);
    },

    navToFLP: function () {
      sap.m.URLHelper.redirect(window.location.origin + '/flp/', false);
    },

    navToReadme: function () {
      this.getRouter().navTo('markdown');
    },

    selectNav: function (oEvt) {
      var oSrc = oEvt.getSource();
      var sKey = oSrc.getKey();
      this.getRouter().navTo(sKey);
    },

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },
  });
});
