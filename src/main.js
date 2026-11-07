JSB.require('JifengjincaoNative');
JSB.require('JifengjincaoNavigationMotion');
JSB.require('JifengjincaoPanelNavigation');
JSB.require('JifengjincaoSettingsNavigation');
JSB.require('JifengjincaoSettings');
JSB.require('BBKaoyanAdapter');
JSB.require('BBKaoyanSourceLink');
JSB.require('JifengjincaoCommentFold');
JSB.require('BBKaoyanFormat');
JSB.require('BBKaoyanImportStore');
JSB.require('BBKaoyanTransport');
JSB.require('JifengjincaoHandwriting');
JSB.require('BBKaoyanClipboard');
JSB.require('BBKaoyanImport');
JSB.require('JifengjincaoCardLocatorUI');
JSB.require('JifengjincaoCardLocator');
JSB.require('JifengjincaoSingleImport');
JSB.require('web-dist/BBKaoyanPageScript');
JSB.require('web-dist/ImportPageResource');
JSB.require('web-dist/ExtraTextPageResource');
JSB.require('WebBridgeCommands');
JSB.require('WebPanelController');
JSB.require('WebAddon');

JSB.newAddon = function () {
  return createJifengjincaoBridgeAddon();
};
