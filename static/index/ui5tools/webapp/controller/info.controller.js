sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.info', {
    formatPreloadSrc: function (aPrealoadSrc) {
      var sPreloadSrc = '';
      for (var i = 0; i < aPrealoadSrc.length; i++) {
        sPreloadSrc += '<span class="sapMText">' + aPrealoadSrc[i] + '</span><br />';
      }
      return '<p>' + sPreloadSrc + '</p>';
    },

    formatReplaceKeyValue: function (aReplaceOKeyValue) {
      var sReplaceKeyValue = '';
      if (aReplaceOKeyValue.length) {
        sReplaceKeyValue = aReplaceOKeyValue.map(function(oKeyValue) {
          return '<span class="sapMText">' + oKeyValue.key + ': <em>' + oKeyValue.value + '</em></span>';
        }).join('<br />');
      }
      return '<p>' + sReplaceKeyValue + '</p>';

    },
  });
});
