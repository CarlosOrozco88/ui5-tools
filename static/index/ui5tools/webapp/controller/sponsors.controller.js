sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.sponsors', {
    selectLink: function (oEvt) {
      var oSrc = oEvt.getSource();
      var oData = oSrc.data();
      sap.m.URLHelper.redirect(oData.url, true);
    },
  });
});
