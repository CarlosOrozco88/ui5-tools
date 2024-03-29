sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.apps', {
    pressTile: function (oEvt) {
      var oSrc = oEvt.getSource();
      var oCtx = oSrc.getBindingContext('ui5tools');
      var oObj = oCtx.getObject();
      sap.m.URLHelper.redirect(window.location.origin + oObj.serverPath, false);
    },

    pathFolder: function (sPath, sBasePath) {
      var sFolder = '';
      if (sPath && sBasePath) {
        sFolder = sPath.replace(sBasePath, '');
      }
      return sFolder;
    },
  });
});
