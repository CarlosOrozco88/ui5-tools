sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.links', {
    itemPressLinks: function (oEvt) {
      var oSrc = oEvt.getParameter('listItem');
      var oCtx = oSrc.getBindingContext('ui5tools');
      var opentab = oCtx.getProperty('opentab') !== undefined ? oCtx.getProperty('opentab') : true;
      var url = oCtx.getProperty('url');
      sap.m.URLHelper.redirect(url, opentab);
    },
  });
});
