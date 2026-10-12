var __JFJC_SETTINGS__ = (function () {
  const N = __JFJC_NATIVE__, TOPICS_KEY = 'import.include-topics', SOURCE_LINK_KEY = 'import.include-source-link';
  const LOCATE_KEY = 'question-tools.show-locate-card', MODE_KEY = 'question-tools.card-location-mode';
  function enabled(key) {
    const value = N.preference(key, true);
    return value !== false && value !== 0;
  }
  function importTopics() { return enabled(TOPICS_KEY); }
  function importSourceLink() { return enabled(SOURCE_LINK_KEY); }
  function showLocateCard() { return enabled(LOCATE_KEY); }
  function cardLocationMode() { return N.preference(MODE_KEY, 'focus') === 'locate' ? 'locate' : 'focus'; }
  function saveCardLocationMode(mode) {
    if (mode !== 'locate' && mode !== 'focus') throw new Error('定位卡片方式无效');
    N.savePreference(MODE_KEY, mode);
  }
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
    const tools = new UIView({ x: 20, y: 18, width: 880, height: 226 });
    tools.backgroundColor = UIColor.whiteColor(); tools.layer.cornerRadius = 10;
    tools.layer.borderWidth = 0.5; tools.layer.borderColor = UIColor.colorWithWhiteAlpha(0.8, 0.45);
    controller.questionToolsSection = tools; page.addSubview(tools);
    controller.questionToolsTitle = label('题目工具', 17, true); tools.addSubview(controller.questionToolsTitle);
    controller.questionToolsDivider = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
    controller.questionToolsDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); tools.addSubview(controller.questionToolsDivider);
    controller.showLocateCardTitle = label('显示定位卡片', 16, true); tools.addSubview(controller.showLocateCardTitle);
    controller.showLocateCardDescription = label('在试卷、题目详情与复盘页显示定位卡片', 12, false);
    controller.showLocateCardDescription.numberOfLines = 0; tools.addSubview(controller.showLocateCardDescription);
    controller.showLocateCardSwitch = new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
    controller.showLocateCardSwitch.addTargetActionForControlEvents(controller, 'toggleShowLocateCard:', 1 << 12); tools.addSubview(controller.showLocateCardSwitch);
    controller.cardLocationModeDivider = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
    controller.cardLocationModeDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); tools.addSubview(controller.cardLocationModeDivider);
    controller.cardLocationModeTitle = label('定位卡片方式', 16, true); tools.addSubview(controller.cardLocationModeTitle);
    controller.cardLocationModeDescription = label('选择定位卡片时的操作', 12, false);
    controller.cardLocationModeDescription.numberOfLines = 0; tools.addSubview(controller.cardLocationModeDescription);
    controller.cardLocationModeValue = label('', 14, false);
    controller.cardLocationModeValue.textAlignment = 2; tools.addSubview(controller.cardLocationModeValue);
    controller.cardLocationModeChevron = label('›', 25, false);
    controller.cardLocationModeChevron.textAlignment = 1; tools.addSubview(controller.cardLocationModeChevron);
    controller.cardLocationModeButton = new UIButton({ x: 0, y: 0, width: 130, height: 40 });
    // 与大观园一致，文字和箭头独立排版，透明按钮覆盖整行。
    controller.cardLocationModeButton.setTitleForState('', 0);
    controller.cardLocationModeButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.cardLocationModeButton.addTargetActionForControlEvents(controller, 'chooseCardLocationMode:', 1 << 6); tools.addSubview(controller.cardLocationModeButton);
    const section = new UIView({ x: 20, y: 18, width: 880, height: 144 });
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 10;
    section.layer.borderWidth = 0.5; section.layer.borderColor = UIColor.colorWithWhiteAlpha(0.8, 0.45);
    controller.importSettingsSection = section; page.addSubview(section);
    controller.importSettingsTitle = label('题卡设置', 17, true); section.addSubview(controller.importSettingsTitle);
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
    const width = Math.max(0, frame.width - 40), narrow = width < 560;
    // 全部设置行共用尺寸；窄窗口统一把右侧控件放在说明下方。
    const rowHeight = narrow ? 114 : 70, descriptionHeight = narrow ? 36 : 18;
    const textWidth = Math.max(0, width - (narrow ? 40 : 224)), height = 49 + rowHeight * 2 + 13;
    function group(section, title, divider, y) {
      section.frame = { x: 20, y: y, width: width, height: height };
      title.frame = { x: 20, y: 12, width: Math.max(0, width - 40), height: 28 };
      divider.frame = { x: 20, y: 48, width: Math.max(0, width - 40), height: 0.5 };
    }
    function row(title, description, toggle, index) {
      const y = 49 + index * rowHeight, center = y + (narrow ? 92 : rowHeight / 2);
      title.frame = { x: 20, y: y + 12, width: textWidth, height: 24 };
      description.frame = { x: 20, y: y + 38, width: textWidth, height: descriptionHeight };
      if (toggle) toggle.frame = { x: Math.max(0, width - 71), y: center - 15.5, width: 51, height: 31 };
      return center;
    }
    const dividerFrame = { x: 20, y: 48 + rowHeight, width: Math.max(0, width - 40), height: 0.5 };
    controller.settingsPage.frame = frame;
    controller.settingsPage.contentSize = { width: frame.width, height: Math.max(frame.height + 1, height * 2 + 54) };
    group(controller.questionToolsSection, controller.questionToolsTitle, controller.questionToolsDivider, 18);
    row(controller.showLocateCardTitle, controller.showLocateCardDescription, controller.showLocateCardSwitch, 0);
    const center = row(controller.cardLocationModeTitle, controller.cardLocationModeDescription, null, 1);
    controller.cardLocationModeDivider.frame = dividerFrame;
    controller.cardLocationModeValue.frame = { x: Math.max(20, width - 192), y: center - 12, width: 132, height: 24 };
    controller.cardLocationModeChevron.frame = { x: Math.max(20, width - 50), y: center - 18, width: 30, height: 36 };
    controller.cardLocationModeButton.frame = { x: 0, y: 49 + rowHeight, width: width, height: rowHeight };
    group(controller.importSettingsSection, controller.importSettingsTitle, controller.importSettingsDivider, height + 36);
    row(controller.importTopicsTitle, controller.importTopicsDescription, controller.importTopicsSwitch, 0);
    row(controller.importSourceLinkTitle, controller.importSourceLinkDescription, controller.importSourceLinkSwitch, 1);
    controller.importSourceLinkDivider.frame = { x: dividerFrame.x, y: dividerFrame.y, width: dividerFrame.width, height: dividerFrame.height };
  }
  function refresh(controller) {
    if (controller.importTopicsSwitch) controller.importTopicsSwitch.on = importTopics();
    if (controller.importSourceLinkSwitch) controller.importSourceLinkSwitch.on = importSourceLink();
    if (controller.showLocateCardSwitch) controller.showLocateCardSwitch.on = showLocateCard();
    if (controller.cardLocationModeValue) controller.cardLocationModeValue.text = cardLocationMode() === 'locate' ? '仅定位' : '定位并聚焦';
  }
  function toggleOption(controller, sender, key) {
    const value = Boolean(N.value(sender, 'on'));
    try { N.savePreference(key, value); refresh(controller); }
    catch (error) { refresh(controller); N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
  }
  function toggle(controller, sender) { toggleOption(controller, sender || controller.importTopicsSwitch, TOPICS_KEY); }
  function toggleSourceLink(controller, sender) { toggleOption(controller, sender || controller.importSourceLinkSwitch, SOURCE_LINK_KEY); }
  function toggleLocate(controller, sender) {
    toggleOption(controller, sender || controller.showLocateCardSwitch, LOCATE_KEY);
    if (!showLocateCard()) __JFJC_CARD_LOCATOR__.cancel(controller.addon);
    __JFJC_PANEL__.syncQuestionTools(controller).catch(function (error) { console.log('[Jifengjincao Bridge] 定位按钮更新失败：' + String(error.message || error)); });
  }
  function chooseMode(controller) {
    __JFJC_CARD_LOCATOR_UI__.chooseMode(controller, cardLocationMode(), function (mode) {
      try { saveCardLocationMode(mode); refresh(controller); }
      catch (error) { N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
    });
  }
  return { importTopics: importTopics, saveTopics: saveTopics, importSourceLink: importSourceLink, saveSourceLink: saveSourceLink,
    showLocateCard: showLocateCard, cardLocationMode: cardLocationMode, saveCardLocationMode: saveCardLocationMode,
    setup: setup, layout: layout, refresh: refresh, toggle: toggle, toggleSourceLink: toggleSourceLink, toggleLocate: toggleLocate, chooseMode: chooseMode };
})();
