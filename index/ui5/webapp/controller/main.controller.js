sap.ui.define(['sap/ui/core/mvc/Controller', 'sap/m/IconTabFilter', 'sap/m/VBox', 'sap/ui/core/HTML'], function (
  Controller,
  IconTabFilter,
  VBox,
  HTML
) {
  'use strict';

  return Controller.extend('ui5tools.controller.main', {
    pressTile: function (oEvt) {
      var oSrc = oEvt.getSource();
      var oCtx = oSrc.getBindingContext('ui5tools');
      var oObj = oCtx.getObject();
      sap.m.URLHelper.redirect(window.location.origin + '/' + oObj, false);
    },

    selectIconTabbar: function (oEvt) {
      var key = oEvt.getParameter('key');
      if (key === 'launchpad') {
        this.navToFLP();
      } else if (key === 'docs') {
        if (this.byId('docsTree')) {
          this.byId('docsTree').expandToLevel(1);
        }
      }
    },

    docsPages: {},
    itemPressTreeDocs: function (oEvt) {
      var oSrc = oEvt.getParameter('listItem');
      var oCtx = oSrc.getBindingContext('ui5tools');
      var oPath = oCtx.getPath().split('/').join('-');
      var oObj = oCtx.getObject();
      var idTabFilter = this.createId(oPath + '_doc');
      var tabbar = this.byId('iconTabBar');
      if (!this.byId(idTabFilter)) {
        var tabFilter = new IconTabFilter({
          icon: 'sap-icon://document-text',
          iconColor: 'Neutral',
          iconDensityAware: true,
          text: oObj.name,
          key: idTabFilter,
          id: idTabFilter,
          content: [
            new VBox({
              width: '100%',
              height: '100%',
              items: [
                new HTML({
                  content: oObj.markdown,
                }),
              ],
            }).addStyleClass('markdown-body'),
          ],
        });
        tabbar.addItem(tabFilter);
      }
      tabbar.setSelectedKey(idTabFilter);
    },
    navToFLP: function () {
      sap.m.URLHelper.redirect(window.location.origin + '/flp', false);
    },
  });
});
