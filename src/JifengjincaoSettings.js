var __JFJC_SETTINGS__ = (function () {
  const N = __JFJC_NATIVE__, TOPICS_KEY = 'import.include-topics';
  const LOCATE_KEY = 'question-tools.show-locate-card', MODE_KEY = 'question-tools.card-location-mode';
  const SINGLE_KEY = 'question-tools.show-single-import', POSITION_KEY = 'question-tools.single-import-position';
  // 沿用旧开关键，保留用户已有的显示设置。
  const PASTE_KEY = 'ai-tools.show-paste', UPLOAD_SOURCE_KEY = 'ai-tools.upload-source';
  function enabled(key) {
    const value = N.preference(key, true);
    return value !== false && value !== 0;
  }
  function importTopics() { return enabled(TOPICS_KEY); }
  function showLocateCard() { return enabled(LOCATE_KEY); }
  function showUpload() { return enabled(PASTE_KEY); }
  function uploadSource() { return N.preference(UPLOAD_SOURCE_KEY, 'clipboard') === 'handwriting' ? 'handwriting' : 'clipboard'; }
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
    view.textColor = bold ? UIColor.colorWithRedGreenBlueAlpha(37 / 255, 40 / 255, 48 / 255, 1) : UIColor.colorWithRedGreenBlueAlpha(122 / 255, 129 / 255, 139 / 255, 1);
    return view;
  }
  function setup(controller) {
    if (typeof UIScrollView === 'undefined' || typeof UISwitch === 'undefined') throw new Error('当前 MN 版本缺少设置页所需的滚动视图或开关接口');
    const page = new UIScrollView({ x: 0, y: 112, width: 920, height: 568 });
    page.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1);
    page.showsVerticalScrollIndicator = true; page.alwaysBounceVertical = true; page.hidden = true;
    controller.settingsPage = page; controller.view.addSubview(page);
    const tools = new UIView({ x: 20, y: 18, width: 880, height: 226 });
    tools.backgroundColor = UIColor.whiteColor(); tools.layer.cornerRadius = 12;
    tools.layer.borderWidth = 1; tools.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
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
    section.backgroundColor = UIColor.whiteColor(); section.layer.cornerRadius = 12;
    section.layer.borderWidth = 1; section.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.importSettingsSection = section; page.addSubview(section);
    controller.importSettingsTitle = label('题卡工具', 17, true); section.addSubview(controller.importSettingsTitle);
    controller.importSettingsDivider = new UIView({ x: 20, y: 48, width: 840, height: 0.5 });
    controller.importSettingsDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4);
    section.addSubview(controller.importSettingsDivider);
    controller.importTopicsTitle = label('导入知识点', 16, true); section.addSubview(controller.importTopicsTitle);
    controller.importTopicsDescription = label('在题卡正文中保留题目所属知识点', 12, false);
    controller.importTopicsDescription.numberOfLines = 0; section.addSubview(controller.importTopicsDescription);
    controller.importTopicsSwitch = new UISwitch({ x: 808, y: 69, width: 51, height: 31 });
    controller.importTopicsSwitch.addTargetActionForControlEvents(controller, 'toggleImportTopics:', 1 << 12);
    section.addSubview(controller.importTopicsSwitch);
    controller.sourceFoldTitle = label('自动折叠原题评论', 16, true); section.addSubview(controller.sourceFoldTitle);
    controller.sourceFoldDescription = label('新导入及手动修复后的题卡生效', 12, false);
    controller.sourceFoldDescription.numberOfLines = 0; section.addSubview(controller.sourceFoldDescription);
    controller.sourceFoldSwitch = new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
    controller.sourceFoldSwitch.addTargetActionForControlEvents(controller, 'toggleSourceCommentFold:', 1 << 12); section.addSubview(controller.sourceFoldSwitch);
    controller.sourceCommentTitle = label('已导入题卡管理', 16, true); section.addSubview(controller.sourceCommentTitle);
    controller.sourceCommentDescription = label('折叠或展开当前学习集的原题评论', 12, false);
    controller.sourceCommentDescription.numberOfLines = 0; section.addSubview(controller.sourceCommentDescription);
    controller.sourceCommentChevron = label('›', 25, false); controller.sourceCommentChevron.textAlignment = 1; section.addSubview(controller.sourceCommentChevron);
    controller.sourceCommentButton = new UIButton({ x: 0, y: 0, width: 1, height: 1 });
    controller.sourceCommentButton.setTitleForState('', 0);
    controller.sourceCommentButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.sourceCommentButton.addTargetActionForControlEvents(controller, 'chooseSourceCommentDisplay:', 1 << 6); section.addSubview(controller.sourceCommentButton);
    controller.repairCardsTitle = label('修复题卡格式', 16, true); section.addSubview(controller.repairCardsTitle);
    controller.repairCardsDescription = label('仅当前学习集：整理题卡格式与原题链接', 12, false);
    controller.repairCardsDescription.numberOfLines = 0; section.addSubview(controller.repairCardsDescription);
    controller.repairCardsChevron = label('›', 25, false); controller.repairCardsChevron.textAlignment = 1; section.addSubview(controller.repairCardsChevron);
    controller.repairCardsButton = new UIButton({ x: 0, y: 0, width: 1, height: 1 });
    controller.repairCardsButton.setTitleForState('', 0); controller.repairCardsButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.repairCardsButton.addTargetActionForControlEvents(controller, 'repairImportedCards:', 1 << 6); section.addSubview(controller.repairCardsButton);
    ['sourceFoldDivider', 'sourceCommentDivider', 'repairCardsDivider'].forEach(function (name) {
      controller[name] = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
      controller[name].backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); section.addSubview(controller[name]);
    });
    const ai = new UIView({ x: 20, y: 18, width: 880, height: 144 });
    ai.backgroundColor = UIColor.whiteColor(); ai.layer.cornerRadius = 12;
    ai.layer.borderWidth = 1; ai.layer.borderColor = UIColor.colorWithRedGreenBlueAlpha(227 / 255, 231 / 255, 237 / 255, 1);
    controller.aiToolsSection = ai; page.addSubview(ai);
    controller.aiToolsTitle = label('AI 工具', 17, true); ai.addSubview(controller.aiToolsTitle);
    controller.aiToolsDivider = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
    controller.aiToolsDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); ai.addSubview(controller.aiToolsDivider);
    controller.showUploadTitle = label('显示上传', 16, true); ai.addSubview(controller.showUploadTitle);
    controller.showUploadDescription = label('在 AI 对话输入框显示上传按钮', 12, false);
    controller.showUploadDescription.numberOfLines = 0; ai.addSubview(controller.showUploadDescription);
    controller.showUploadSwitch = new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
    controller.showUploadSwitch.addTargetActionForControlEvents(controller, 'toggleShowUpload:', 1 << 12); ai.addSubview(controller.showUploadSwitch);
    controller.uploadSourceDivider = new UIView({ x: 0, y: 0, width: 1, height: 0.5 });
    controller.uploadSourceDivider.backgroundColor = UIColor.colorWithWhiteAlpha(0.8, 0.4); ai.addSubview(controller.uploadSourceDivider);
    controller.uploadSourceTitle = label('上传来源', 16, true); ai.addSubview(controller.uploadSourceTitle);
    controller.uploadSourceDescription = label('选择剪贴板内容或所选卡片最后一条手写', 12, false);
    controller.uploadSourceDescription.numberOfLines = 0; ai.addSubview(controller.uploadSourceDescription);
    controller.uploadSourceValue = label('', 14, false); controller.uploadSourceValue.textAlignment = 2; ai.addSubview(controller.uploadSourceValue);
    controller.uploadSourceChevron = label('›', 25, false); controller.uploadSourceChevron.textAlignment = 1; ai.addSubview(controller.uploadSourceChevron);
    controller.uploadSourceButton = new UIButton({ x: 0, y: 0, width: 1, height: 1 });
    controller.uploadSourceButton.setTitleForState('', 0); controller.uploadSourceButton.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0);
    controller.uploadSourceButton.addTargetActionForControlEvents(controller, 'chooseUploadSource:', 1 << 6); ai.addSubview(controller.uploadSourceButton);
    refresh(controller);
  }
  function layout(controller, frame) {
    if (!controller.settingsPage) return;
    const width = Math.max(0, frame.width - 40), narrow = width < 560;
    // 全部设置行共用尺寸；窄窗口统一把右侧控件放在说明下方。
    const rowHeight = narrow ? 114 : 70, descriptionHeight = narrow ? 36 : 18;
    const textWidth = Math.max(0, width - (narrow ? 40 : 224)), toolsHeight = 49 + rowHeight * 4 + 13, aiHeight = 49 + rowHeight * 2 + 13, cardHeight = 49 + rowHeight * 4 + 13;
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
    group(controller.questionToolsSection, controller.questionToolsTitle, controller.questionToolsDivider, 0, toolsHeight);
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
    group(controller.aiToolsSection, controller.aiToolsTitle, controller.aiToolsDivider, 0, aiHeight);
    row(controller.showUploadTitle, controller.showUploadDescription, controller.showUploadSwitch, 0);
    const uploadCenter = row(controller.uploadSourceTitle, controller.uploadSourceDescription, null, 1);
    controller.uploadSourceDivider.frame = dividerFrame;
    controller.uploadSourceValue.frame = { x: Math.max(20, width - 192), y: uploadCenter - 12, width: 132, height: 24 };
    controller.uploadSourceChevron.frame = { x: Math.max(20, width - 50), y: uploadCenter - 18, width: 30, height: 36 };
    controller.uploadSourceButton.frame = { x: 0, y: 49 + rowHeight, width: width, height: rowHeight };
    group(controller.importSettingsSection, controller.importSettingsTitle, controller.importSettingsDivider, 0, cardHeight);
    row(controller.importTopicsTitle, controller.importTopicsDescription, controller.importTopicsSwitch, 0);
    row(controller.sourceFoldTitle, controller.sourceFoldDescription, controller.sourceFoldSwitch, 1);
    const displayCenter = row(controller.sourceCommentTitle, controller.sourceCommentDescription, null, 2);
    controller.sourceFoldDivider.frame = dividerFrame;
    controller.sourceCommentDivider.frame = { x: 20, y: 48 + rowHeight * 2, width: Math.max(0, width - 40), height: 0.5 };
    controller.sourceCommentChevron.frame = { x: Math.max(20, width - 50), y: displayCenter - 18, width: 30, height: 36 };
    controller.sourceCommentButton.frame = { x: 0, y: 49 + rowHeight * 2, width: width, height: rowHeight };
    const repairCenter = row(controller.repairCardsTitle, controller.repairCardsDescription, null, 3);
    controller.repairCardsDivider.frame = { x: 20, y: 48 + rowHeight * 3, width: Math.max(0, width - 40), height: 0.5 };
    controller.repairCardsChevron.frame = { x: Math.max(20, width - 50), y: repairCenter - 18, width: 30, height: 36 };
    controller.repairCardsButton.frame = { x: 0, y: 49 + rowHeight * 3, width: width, height: rowHeight };
    __JFJC_SETTINGS_NAVIGATION__.layout(controller, frame);
  }
  function refresh(controller) {
    if (controller.importTopicsSwitch) controller.importTopicsSwitch.on = importTopics();
    if (controller.showLocateCardSwitch) controller.showLocateCardSwitch.on = showLocateCard();
    if (controller.cardLocationModeValue) controller.cardLocationModeValue.text = cardLocationMode() === 'locate' ? '仅定位' : '定位并聚焦';
    if (controller.showSingleImportSwitch) controller.showSingleImportSwitch.on = showSingleImport();
    if (controller.showUploadSwitch) controller.showUploadSwitch.on = showUpload();
    if (controller.uploadSourceValue) controller.uploadSourceValue.text = uploadSource() === 'handwriting' ? '卡片手写' : '剪贴板';
    const cardBusy = Boolean(controller.commentFoldOperation);
    if (controller.sourceFoldSwitch) { controller.sourceFoldSwitch.on = __JFJC_COMMENT_FOLD__.enabled(); controller.sourceFoldSwitch.enabled = !cardBusy; }
    if (controller.sourceCommentButton) controller.sourceCommentButton.enabled = !cardBusy;
    if (controller.repairCardsButton) controller.repairCardsButton.enabled = !cardBusy;
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
  function toggleUpload(controller, sender) {
    toggleOption(controller, sender || controller.showUploadSwitch, PASTE_KEY);
    if (!showUpload()) __JFJC_CLIPBOARD__.cancel(controller);
    __JFJC_PANEL__.syncAiTools(controller).catch(function (error) { console.log('[Jifengjincao Bridge] 上传按钮更新失败：' + String(error.message || error)); });
  }
  function chooseUploadSource(controller) {
    __JFJC_CARD_LOCATOR_UI__.chooseOption(controller, '上传来源', ['clipboard', 'handwriting'], ['剪贴板', '卡片手写'], uploadSource(), 'selectUploadSource:', function (source) {
      try {
        const previous = uploadSource();
        N.savePreference(UPLOAD_SOURCE_KEY, source); refresh(controller);
        if (previous !== source) __JFJC_CLIPBOARD__.cancel(controller);
        __JFJC_PANEL__.syncAiTools(controller).catch(function (error) { console.log('[Jifengjincao Bridge] 上传来源更新失败：' + String(error.message || error)); });
      } catch (error) { refresh(controller); N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
    });
  }
  function choosePosition(controller) {
    __JFJC_CARD_LOCATOR_UI__.chooseOption(controller, '导入本题位置', ['child', 'sibling'], ['子节点', '同级节点'], singleImportPosition(), 'selectSingleImportPosition:', function (position) {
      try { N.savePreference(POSITION_KEY, position); refresh(controller); }
      catch (error) { N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
    });
  }
  function cancelFold(controller) {
    controller.commentFoldOperation = null;
    if (controller.sourceCommentDescription) controller.sourceCommentDescription.text = '折叠或展开当前学习集的原题评论';
    refresh(controller);
  }
  function toggleFold(controller, sender) {
    if (controller.commentFoldOperation) { refresh(controller); return; }
    try { __JFJC_COMMENT_FOLD__.setEnabled(Boolean(N.value(sender || controller.sourceFoldSwitch, 'on'))); }
    catch (error) { N.show(controller.addon, '设置未保存：' + String(error.message || error)); }
    refresh(controller);
  }
  function foldBusy(controller) { return controller.previewing || controller.panelOperation || controller.clipboardOperation || controller.cardLocationRequest || controller.session && controller.session.running; }
  async function foldExisting(controller, collapsed) {
    if (controller.activePage !== 'settings' || controller.commentFoldOperation) return;
    if (foldBusy(controller)) { N.show(controller.addon, '请先完成当前导入或题目操作'); return; }
    const operation = {}; controller.commentFoldOperation = operation; refresh(controller);
    const active = function () { return controller.commentFoldOperation === operation && controller.activePage === 'settings' && controller.visible !== false && !foldBusy(controller); };
    try {
      const result = await __JFJC_COMMENT_FOLD__.batch(controller.addon, collapsed, function (value) {
        if (active()) controller.sourceCommentDescription.text = '正在处理 ' + value.processed + ' / ' + value.total + ' 张题卡…';
      }, active);
      if (controller.commentFoldOperation !== operation) return;
      N.show(controller.addon, (collapsed ? '已折叠 ' : '已展开 ') + result.changed + ' 张，原状态相同 ' + result.unchanged + ' 张'
        + (result.skipped ? '，跳过 ' + result.skipped + ' 张' : '')
        + (result.failed.length ? '，失败 ' + result.failed.length + ' 张：' + result.failed[0].reason : '') + (result.interrupted ? '；' + result.interrupted : ''));
    } catch (error) { if (controller.commentFoldOperation === operation) N.show(controller.addon, '处理未完成：' + String(error.message || error)); }
    finally { if (controller.commentFoldOperation === operation) cancelFold(controller); }
  }
  function chooseSourceDisplay(controller) {
    if (controller.activePage !== 'settings' || controller.commentFoldOperation) return;
    if (foldBusy(controller)) { N.show(controller.addon, '请先完成当前导入或题目操作'); return; }
    __JFJC_CARD_LOCATOR_UI__.chooseOption(controller, '已导入题卡管理', ['fold', 'unfold'], ['折叠原题评论', '展开原题评论'], null,
      'selectSourceCommentDisplay:', function (action) { if (controller.activePage === 'settings') foldExisting(controller, action === 'fold'); });
  }
  function repairCards(controller) {
    if (controller.activePage !== 'settings') return;
    if (controller.commentFoldOperation || foldBusy(controller)) { N.show(controller.addon, '请先完成当前导入或题目操作'); return; }
    __JFJC_CARD_LOCATOR_UI__.cancelMode(controller);
    try {
      const result = __JFJC_SOURCE__.repair(controller.addon);
      N.show(controller.addon, (result.changed ? '已完成 ' + result.changed + ' 项修复，可在 MN 中撤销' : '当前学习集的题卡无需修复')
        + (result.warnings.length ? '；原题评论未折叠：' + result.warnings[0].reason : ''));
    } catch (error) { N.show(controller.addon, '修复未完成：' + String(error.message || error)); }
  }
  return { importTopics: importTopics, saveTopics: saveTopics, showUpload: showUpload, toggleUpload: toggleUpload, uploadSource: uploadSource, chooseUploadSource: chooseUploadSource,
    showLocateCard: showLocateCard, cardLocationMode: cardLocationMode, saveCardLocationMode: saveCardLocationMode,
    showSingleImport: showSingleImport, singleImportPosition: singleImportPosition, toggleSingle: toggleSingle, choosePosition: choosePosition,
    setup: setup, layout: layout, refresh: refresh, toggle: toggle, toggleLocate: toggleLocate, chooseMode: chooseMode,
    cancelFold: cancelFold, toggleFold: toggleFold, foldExisting: foldExisting, chooseSourceDisplay: chooseSourceDisplay, repairCards: repairCards };
})();
