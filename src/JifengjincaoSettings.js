var __JFJC_SETTINGS__ = (function () {
  const N = __JFJC_NATIVE__, TOPICS_KEY = 'import.include-topics';
  const LOCATE_KEY = 'question-tools.show-locate-card', MODE_KEY = 'question-tools.card-location-mode';
  const SINGLE_KEY = 'question-tools.show-single-import', POSITION_KEY = 'question-tools.single-import-position';
  const PASTE_KEY = 'ai-tools.show-paste';
  function enabled(key) {
    const value = N.preference(key, true);
    return value !== false && value !== 0;
  }
  function importTopics() { return enabled(TOPICS_KEY); }
  function showLocateCard() { return enabled(LOCATE_KEY); }
  function showPaste() { return enabled(PASTE_KEY); }
  function showSingleImport() { return Boolean(N.preference(SINGLE_KEY, false)); }
  function singleImportPosition() { return N.preference(POSITION_KEY, 'child') === 'sibling' ? 'sibling' : 'child'; }
  function cardLocationMode() { return N.preference(MODE_KEY, 'focus') === 'locate' ? 'locate' : 'focus'; }
  function saveCardLocationMode(mode) {
    if (mode !== 'locate' && mode !== 'focus') throw new Error('定位卡片方式无效');
    N.savePreference(MODE_KEY, mode);
  }
  function saveTopics(enabled) {
    N.savePreference(TOPICS_KEY, Boolean(enabled));
  }
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
    controller.showLocateCardDescription = label('在试卷、题目详情与 AI 页面显示定位入口', 12, false);
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
    controller.showSingleImportTitle = label('显示导入本题', 16, true); tools.addSubview(controller.showSingleImportTitle);
    controller.showSingleImportDescription = label('在题目旁显示导入本题，仅导入题目', 12, false);
    controller.showSingleImportDescription.numberOfLines = 0; tools.addSubview(controller.showSingleImportDescription);
    controller.showSingleImportSwitch = new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
    controller.showSingleImportSwitch.addTargetActionForControlEvents(controller, 'toggleShowSingleImport:', 1 << 12); tools.addSubview(controller.showSingleImportSwitch);
    controller.singleImportPositionTitle = label('导入本题位置', 16, true); tools.addSubview(controller.singleImportPositionTitle);
    controller.singleImportPositionDescription = label('插入到所选卡片的子节点或同级节点', 12, false);
    controller.singleImportPositionDescription.numberOfLines = 0; tools.addSubview(controller.singleImportPositionDescription);
    controller.singleImportPositionValue = label('', 14, false); controller.singleImportPositionValue.textAlignment = 2; tools.addSubview(controller.singleImportPositionValue);
    controller.singleImportPositionChevron = label('›', 25, false); controller.singleImportPositionChevron.textAlignment = 1; tools.addSubview(controller.singleImportPositionChevron);
    controller.singleImportPositionButton = new UIButton({ x: 0, y: 0, width: 1, height: 1 });
    controller.singleImportPositionButton.setTitleForState('', 0); controller.singleImportPositionButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.singleImportPositionButton.addTargetActionForControlEvents(controller, 'chooseSingleImportPosition:', 1 << 6); tools.addSubview(controller.singleImportPositionButton);
    ['showSingleImportDivider', 'singleImportPositionDivider'].forEach(function (name) {
      controller[name] = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
      controller[name].backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); tools.addSubview(controller[name]);
    });
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
    const ai = new UIView({ x: 20, y: 18, width: 880, height: 144 });
    ai.backgroundColor = UIColor.whiteColor(); ai.layer.cornerRadius = 10;
    ai.layer.borderWidth = 0.5; ai.layer.borderColor = UIColor.colorWithWhiteAlpha(0.8, 0.45);
    controller.aiToolsSection = ai; page.addSubview(ai);
    controller.aiToolsTitle = label('AI 工具', 17, true); ai.addSubview(controller.aiToolsTitle);
    controller.aiToolsDivider = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
    controller.aiToolsDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); ai.addSubview(controller.aiToolsDivider);
    controller.showPasteTitle = label('显示粘贴', 16, true); ai.addSubview(controller.showPasteTitle);
    controller.showPasteDescription = label('在 AI 对话输入框显示粘贴，可粘贴文字或图片', 12, false);
    controller.showPasteDescription.numberOfLines = 0; ai.addSubview(controller.showPasteDescription);
    controller.showPasteSwitch = new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
    controller.showPasteSwitch.addTargetActionForControlEvents(controller, 'toggleShowPaste:', 1 << 12); ai.addSubview(controller.showPasteSwitch);
    refresh(controller);
  }
  function layout(controller, frame) {
    if (!controller.settingsPage) return;
    const width = Math.max(0, frame.width - 40), narrow = width < 560;
    // 全部设置行共用尺寸；窄窗口统一把右侧控件放在说明下方。
    const rowHeight = narrow ? 114 : 70, descriptionHeight = narrow ? 36 : 18;
    const textWidth = Math.max(0, width - (narrow ? 40 : 224)), toolsHeight = 49 + rowHeight * 4 + 13, cardHeight = 49 + rowHeight + 13;
    function group(section, title, divider, y, height) {
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
    controller.settingsPage.contentSize = { width: frame.width, height: Math.max(frame.height + 1, toolsHeight + cardHeight * 2 + 72) };
    group(controller.questionToolsSection, controller.questionToolsTitle, controller.questionToolsDivider, 18, toolsHeight);
    row(controller.showLocateCardTitle, controller.showLocateCardDescription, controller.showLocateCardSwitch, 0);
    const center = row(controller.cardLocationModeTitle, controller.cardLocationModeDescription, null, 1);
    controller.cardLocationModeDivider.frame = dividerFrame;
    controller.cardLocationModeValue.frame = { x: Math.max(20, width - 192), y: center - 12, width: 132, height: 24 };
    controller.cardLocationModeChevron.frame = { x: Math.max(20, width - 50), y: center - 18, width: 30, height: 36 };
    controller.cardLocationModeButton.frame = { x: 0, y: 49 + rowHeight, width: width, height: rowHeight };
    row(controller.showSingleImportTitle, controller.showSingleImportDescription, controller.showSingleImportSwitch, 2);
    const singleCenter = row(controller.singleImportPositionTitle, controller.singleImportPositionDescription, null, 3);
    controller.showSingleImportDivider.frame = { x: 20, y: 48 + rowHeight * 2, width: Math.max(0, width - 40), height: 0.5 };
    controller.singleImportPositionDivider.frame = { x: 20, y: 48 + rowHeight * 3, width: Math.max(0, width - 40), height: 0.5 };
    controller.singleImportPositionValue.frame = { x: Math.max(20, width - 192), y: singleCenter - 12, width: 132, height: 24 };
    controller.singleImportPositionChevron.frame = { x: Math.max(20, width - 50), y: singleCenter - 18, width: 30, height: 36 };
    controller.singleImportPositionButton.frame = { x: 0, y: 49 + rowHeight * 3, width: width, height: rowHeight };
    group(controller.aiToolsSection, controller.aiToolsTitle, controller.aiToolsDivider, toolsHeight + 36, cardHeight);
    row(controller.showPasteTitle, controller.showPasteDescription, controller.showPasteSwitch, 0);
    group(controller.importSettingsSection, controller.importSettingsTitle, controller.importSettingsDivider, toolsHeight + cardHeight + 54, cardHeight);
    row(controller.importTopicsTitle, controller.importTopicsDescription, controller.importTopicsSwitch, 0);
  }
  function refresh(controller) {
    if (controller.importTopicsSwitch) controller.importTopicsSwitch.on = importTopics();
    if (controller.showLocateCardSwitch) controller.showLocateCardSwitch.on = showLocateCard();
    if (controller.cardLocationModeValue) controller.cardLocationModeValue.text = cardLocationMode() === 'locate' ? '仅定位' : '定位并聚焦';
    if (controller.showSingleImportSwitch) controller.showSingleImportSwitch.on = showSingleImport();
    if (controller.showPasteSwitch) controller.showPasteSwitch.on = showPaste();
    if (controller.singleImportPositionValue) controller.singleImportPositionValue.text = singleImportPosition() === 'sibling' ? '同级节点' : '子节点';
  }
  function toggleOption(controller, sender, key) {
    const value = Boolean(N.value(sender, 'on'));
    try { N.savePreference(key, value); refresh(controller); }
    catch (error) { refresh(controller); N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
  }
  function toggle(controller, sender) { toggleOption(controller, sender || controller.importTopicsSwitch, TOPICS_KEY); }
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
  function toggleSingle(controller, sender) {
    toggleOption(controller, sender || controller.showSingleImportSwitch, SINGLE_KEY);
    __JFJC_PANEL__.syncQuestionTools(controller).catch(function (error) { console.log('[Jifengjincao Bridge] 导入按钮更新失败：' + String(error.message || error)); });
  }
  function togglePaste(controller, sender) {
    toggleOption(controller, sender || controller.showPasteSwitch, PASTE_KEY);
    if (!showPaste()) __JFJC_CLIPBOARD__.cancel(controller);
    __JFJC_PANEL__.syncAiTools(controller).catch(function (error) { console.log('[Jifengjincao Bridge] 粘贴按钮更新失败：' + String(error.message || error)); });
  }
  function choosePosition(controller) {
    __JFJC_CARD_LOCATOR_UI__.chooseOption(controller, '导入本题位置', ['child', 'sibling'], ['子节点', '同级节点'], singleImportPosition(), 'selectSingleImportPosition:', function (position) {
      try { N.savePreference(POSITION_KEY, position); refresh(controller); }
      catch (error) { N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
    });
  }
  return { importTopics: importTopics, saveTopics: saveTopics, showPaste: showPaste, togglePaste: togglePaste,
    showLocateCard: showLocateCard, cardLocationMode: cardLocationMode, saveCardLocationMode: saveCardLocationMode,
    showSingleImport: showSingleImport, singleImportPosition: singleImportPosition, toggleSingle: toggleSingle, choosePosition: choosePosition,
    setup: setup, layout: layout, refresh: refresh, toggle: toggle, toggleLocate: toggleLocate, chooseMode: chooseMode };
})();
