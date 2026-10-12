var __JFJC_SETTINGS__ = (function () {
  const N = __JFJC_NATIVE__, TOPICS_KEY = 'import.include-topics', SOURCE_LINK_KEY = 'import.include-source-link';
  function enabled(key) {
    const value = N.preference(key, true);
    return value !== false && value !== 0;
  }
  function importTopics() { return enabled(TOPICS_KEY); }
  function importSourceLink() { return enabled(SOURCE_LINK_KEY); }
  function saveTopics(enabled) {
    N.savePreference(TOPICS_KEY, Boolean(enabled));
  }
  function saveSourceLink(enabled) { N.savePreference(SOURCE_LINK_KEY, Boolean(enabled)); }
  function label(text, size, bold) {
    const view = new UILabel({ x: 0, y: 0, width: 100, height: 24 });
    view.text = text; view.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    view.textColor = bold ? UIColor.darkGrayColor() : UIColor.grayColor();
    return view;
  }
  function setup(controller) {
    if (typeof UIScrollView === 'undefined' || typeof UISwitch === 'undefined') throw new Error('当前 MN 版本缺少设置页所需的滚动视图或开关接口');
    const page = new UIScrollView({ x: 0, y: 36, width: 920, height: 644 });
    page.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1);
    page.showsVerticalScrollIndicator = true; page.alwaysBounceVertical = true; page.hidden = true;
    controller.settingsPage = page; controller.view.addSubview(page);
    const section = new UIView({ x: 20, y: 18, width: 880, height: 144 });
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 10;
    section.layer.borderWidth = 0.5; section.layer.borderColor = UIColor.colorWithWhiteAlpha(0.8, 0.45);
    controller.importSettingsSection = section; page.addSubview(section);
    controller.importSettingsTitle = label('导入设置', 17, true); section.addSubview(controller.importSettingsTitle);
    controller.importSettingsDivider = new UIView({ x: 20, y: 48, width: 840, height: 0.5 });
    controller.importSettingsDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4);
    section.addSubview(controller.importSettingsDivider);
    controller.importTopicsTitle = label('导入知识点', 16, true); section.addSubview(controller.importTopicsTitle);
    controller.importTopicsDescription = label('在题卡正文中保留题目所属知识点', 12, false);
    controller.importTopicsDescription.numberOfLines = 0; section.addSubview(controller.importTopicsDescription);
    controller.importTopicsSwitch = new UISwitch({ x: 808, y: 69, width: 51, height: 31 });
    controller.importTopicsSwitch.addTargetActionForControlEvents(controller, 'toggleImportTopics:', 1 << 12);
    section.addSubview(controller.importTopicsSwitch);
    controller.importSourceLinkDivider = new UIView({ x: 20, y: 144, width: 840, height: 0.5 });
    controller.importSourceLinkDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4);
    section.addSubview(controller.importSourceLinkDivider);
    controller.importSourceLinkTitle = label('导入原题链接', 16, true); section.addSubview(controller.importSourceLinkTitle);
    controller.importSourceLinkDescription = label('在题卡中添加“查看原题”入口', 12, false);
    controller.importSourceLinkDescription.numberOfLines = 0; section.addSubview(controller.importSourceLinkDescription);
    controller.importSourceLinkSwitch = new UISwitch({ x: 808, y: 159, width: 51, height: 31 });
    controller.importSourceLinkSwitch.addTargetActionForControlEvents(controller, 'toggleImportSourceLink:', 1 << 12);
    section.addSubview(controller.importSourceLinkSwitch);
    refresh(controller);
  }
  function layout(controller, frame) {
    if (!controller.settingsPage) return;
    const width = Math.max(0, frame.width - 40), textWidth = Math.max(0, width - 116);
    // 窄窗口为说明文字预留三行，开关始终固定在分组右侧。
    const descriptionHeight = textWidth < 210 ? 54 : 36, rowHeight = 54 + descriptionHeight, height = 100 + descriptionHeight + rowHeight;
    controller.settingsPage.frame = frame;
    controller.settingsPage.contentSize = { width: frame.width, height: Math.max(frame.height + 1, height + 36) };
    controller.importSettingsSection.frame = { x: 20, y: 18, width: width, height: height };
    controller.importSettingsTitle.frame = { x: 20, y: 12, width: Math.max(0, width - 40), height: 28 };
    controller.importSettingsDivider.frame = { x: 20, y: 48, width: Math.max(0, width - 40), height: 0.5 };
    controller.importTopicsTitle.frame = { x: 20, y: 62, width: textWidth, height: 24 };
    controller.importTopicsDescription.frame = { x: 20, y: 91, width: textWidth, height: descriptionHeight };
    controller.importTopicsSwitch.frame = { x: Math.max(0, width - 71), y: 69, width: 51, height: 31 };
    controller.importSourceLinkDivider.frame = { x: 20, y: 54 + rowHeight, width: Math.max(0, width - 40), height: 0.5 };
    controller.importSourceLinkTitle.frame = { x: 20, y: 62 + rowHeight, width: textWidth, height: 24 };
    controller.importSourceLinkDescription.frame = { x: 20, y: 91 + rowHeight, width: textWidth, height: descriptionHeight };
    controller.importSourceLinkSwitch.frame = { x: Math.max(0, width - 71), y: 69 + rowHeight, width: 51, height: 31 };
  }
  function refresh(controller) {
    if (controller.importTopicsSwitch) controller.importTopicsSwitch.on = importTopics();
    if (controller.importSourceLinkSwitch) controller.importSourceLinkSwitch.on = importSourceLink();
  }
  function toggleOption(controller, sender, key) {
    const value = Boolean(N.value(sender, 'on'));
    try { N.savePreference(key, value); refresh(controller); }
    catch (error) { refresh(controller); N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
  }
  function toggle(controller, sender) { toggleOption(controller, sender || controller.importTopicsSwitch, TOPICS_KEY); }
  function toggleSourceLink(controller, sender) { toggleOption(controller, sender || controller.importSourceLinkSwitch, SOURCE_LINK_KEY); }
  return { importTopics: importTopics, saveTopics: saveTopics, importSourceLink: importSourceLink, saveSourceLink: saveSourceLink,
    setup: setup, layout: layout, refresh: refresh, toggle: toggle, toggleSourceLink: toggleSourceLink };
})();
