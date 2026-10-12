JSB.require('JifengjincaoNative');
JSB.require('JifengjincaoSettings');
JSB.require('BBKaoyanAdapter');
JSB.require('BBKaoyanSourceLink');
JSB.require('BBKaoyanFormat');
JSB.require('BBKaoyanImportStore');
JSB.require('BBKaoyanTransport');
JSB.require('BBKaoyanClipboard');
JSB.require('BBKaoyanImport');
JSB.require('web-dist/BBKaoyanPageScript');
JSB.require('web-dist/ImportPageResource');
JSB.require('WebBridgeCommands');
JSB.require('WebPanelController');
JSB.require('WebAddon');

JSB.newAddon = function () {
  return createJifengjincaoBridgeAddon();
};
