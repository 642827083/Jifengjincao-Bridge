function createJifengjincaoBridgeAddon() {
  return JSB.defineClass('JifengjincaoBridgeAddon : JSExtension', {
    sceneWillConnect: function () { self.panelController = __JFJC_PANEL__.create(self); __JFJC_SOURCE__.register(self); console.log('[Jifengjincao Bridge] 插件已初始化'); },
    sceneDidDisconnect: function () {
      __JFJC_SOURCE__.unregister(self);
      if (self.panelController) { __JFJC_SETTINGS__.cancelFold(self.panelController); __JFJC_TRANSPORT__.cancel(self.panelController); if (self.panelController.view.superview) self.panelController.view.removeFromSuperview(); }
      self.panelController = null;
    },
    notebookWillOpen: function () {
      __JFJC_SOURCE__.register(self);
      if (!self.panelController) self.panelController = __JFJC_PANEL__.create(self);
      self.panelController.addon = self;
      __JFJC_CARD_LOCATOR__.resume(self);
      if (__JFJC_NATIVE__.preference('visible', false)) __JFJC_PANEL__.show(self.panelController);
    },
    notebookWillClose: function () { if (self.panelController) { __JFJC_SETTINGS__.cancelFold(self.panelController); __JFJC_TRANSPORT__.cancel(self.panelController, __JFJC_CARD_LOCATOR__.switching(self)); } },
    onSourceLink: function (sender) {
      const addon = self;
      try { __JFJC_SOURCE__.receive(addon, sender); }
      catch (error) { __JFJC_NATIVE__.show(addon, String(error.message || error)); }
    },
    queryAddonCommandStatus: function () { return { image: 'icon.png', object: self, selector: 'togglePanel:', checked: Boolean(self.panelController && self.panelController.visible) }; },
    togglePanel: function () {
      const addon = self;
      try {
        if (!addon.panelController) addon.panelController = __JFJC_PANEL__.create(addon);
        if (addon.panelController.visible) __JFJC_PANEL__.hide(addon.panelController); else __JFJC_PANEL__.show(addon.panelController);
      } catch (error) { __JFJC_NATIVE__.show(addon, String(error.message || error)); }
    }
  });
}
