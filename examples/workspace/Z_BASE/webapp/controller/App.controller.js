sap.ui.define(['sap/ui/core/mvc/Controller'], function (Controller) {
  'use strict';

  return Controller.extend('example.Z_BASE.controller.App', {

    onInit: function() {
			this.getRouter().getRoute("Z_APP1").attachPatternMatched(this.routeMatched, this);
			this.getRouter().getRoute("Z_APP2").attachPatternMatched(this.routeMatched, this);
    },

    routeMatched: function(oEvt) {
      var routeName = oEvt.getParameter("name");
      this.byId("selectApp").setSelectedKey(routeName);
    },

    changeApp: function(oEvt) {
      var selectedItem = oEvt.getParameter("selectedItem");
      var selectedKey = selectedItem.getKey();
      this.navTo(selectedKey);
    },

    navTo: function(target, params) {
      this.getRouter().navTo(target, params);
    },

    getRouter: function() {
      return this.getOwnerComponent().getRouter();
    }

  });
});
