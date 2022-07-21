sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('ui5tools.controller.info', {
    splitComma: function (sProperty) {
      var sText = '';
      var aProperty = sProperty ? sProperty.split(',') : [];
      for (var i = 0; i < aProperty.length; i++) {
        sText += '<span class="sapMText">' + aProperty[i] + '</span><br />';
      }
      return '<span>' + sText + '</span>';
    },

    formatPreloadSrc: function (aPrealoadSrc) {
      var sPreloadSrc = '';
      for (var i = 0; aPrealoadSrc && i < aPrealoadSrc.length; i++) {
        sPreloadSrc += '<span class="sapMText">' + aPrealoadSrc[i] + '</span><br />';
      }
      return '<span>' + sPreloadSrc + '</span>';
    },

    formatReplaceKeyValue: function (aReplaceOKeyValue) {
      var sReplaceKeyValue = '';
      if (aReplaceOKeyValue && aReplaceOKeyValue.length) {
        sReplaceKeyValue = aReplaceOKeyValue
          .map(function (oKeyValue) {
            return '<span class="sapMText">' + oKeyValue.key + ': <em>' + oKeyValue.value + '</em></span>';
          })
          .join('<br />');
      }
      return '<span>' + sReplaceKeyValue + '</span>';
    },
  });
});
