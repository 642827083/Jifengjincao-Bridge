var __JFJC_SETTINGS_NAVIGATION__ = (function () {
  const TABS = ['question', 'card', 'ai'], TITLES = ['题目工具', '题卡工具', 'AI 工具'];
  const HEADER_HEIGHT = 68, SLIDER = 'jfjc.settings.slider', CONTENT = 'jfjc.settings.content';
  function sections(controller) { return [controller.questionToolsSection, controller.importSettingsSection, controller.aiToolsSection]; }
  function setup(controller) {
    controller.settingsSection = 'question'; controller.settingsScrollPositions = {};
    const header = new UIView({ x: 0, y: 44, width: 920, height: HEADER_HEIGHT });
    header.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 1); header.hidden = true;
    controller.settingsHeader = header; controller.view.addSubview(header);
    const navigation = new UIView({ x: 20, y: 10, width: 100, height: 48 });
    navigation.backgroundColor = UIColor.colorWithWhiteAlpha(0.96, 0.96); navigation.layer.cornerRadius = 24;
    navigation.layer.borderWidth = 0.5; navigation.layer.borderColor = UIColor.colorWithWhiteAlpha(0.8, 0.45);
    navigation.layer.shadowColor = UIColor.colorWithWhiteAlpha(0, 1); navigation.layer.shadowOpacity = 0.1;
    navigation.layer.shadowOffset = { width: 0, height: 3 }; navigation.layer.shadowRadius = 8;
    controller.settingsNavigation = navigation; header.addSubview(navigation);
    const slider = new UIView({ x: 4, y: 4, width: 0, height: 40 });
    slider.backgroundColor = UIColor.whiteColor(); slider.layer.cornerRadius = 20;
    slider.layer.shadowColor = UIColor.colorWithWhiteAlpha(0, 1); slider.layer.shadowOpacity = 0.08;
    slider.layer.shadowOffset = { width: 0, height: 1 }; slider.layer.shadowRadius = 3;
    controller.settingsNavigationSlider = slider; navigation.addSubview(slider);
    controller.settingsPage.layer.masksToBounds = true;
    controller.settingsNavigationButtons = TITLES.map(function (title, index) {
      const view = new UIButton({ x: 0, y: 4, width: 100, height: 40 });
      view.tag = index; view.setTitleForState(title, 0); view.titleLabel.font = UIFont.boldSystemFontOfSize(14);
      view.backgroundColor = UIColor.colorWithWhiteAlpha(1, 0); view.layer.cornerRadius = 20;
      view.addTargetActionForControlEvents(controller, 'selectSettingsSection:', 1 << 6);
      navigation.addSubview(view); return view;
    });
  }
  function layout(controller, frame, restoredOffset, animated) {
    if (!controller.settingsHeader) return;
    const width = frame.width, capsule = Math.min(420, Math.max(0, width - 40));
    const page = controller.settingsPage, offset = page.contentOffset;
    const requested = typeof restoredOffset === 'number' ? restoredOffset : Number(offset && offset.y) || 0;
    controller.settingsHeader.frame = { x: 0, y: frame.y, width: width, height: HEADER_HEIGHT };
    controller.settingsHeader.hidden = controller.activePage !== 'settings';
    controller.settingsNavigation.frame = { x: (width - capsule) / 2, y: 10, width: capsule, height: 48 };
    // 导航与内容使用独立区域，滚动到末尾也不会遮挡设置行。
    page.frame = { x: 0, y: frame.y + HEADER_HEIGHT, width: width, height: Math.max(0, frame.height - HEADER_HEIGHT) };
    let contentHeight = 0;
    sections(controller).forEach(function (view, index) {
      view.hidden = TABS[index] !== controller.settingsSection;
      if (!view.hidden) contentHeight = view.frame.y + view.frame.height + 20;
    });
    controller.settingsNavigationButtons.forEach(function (view, index) {
      view.frame = { x: 4 + index * (capsule - 8) / 3, y: 4, width: Math.max(0, (capsule - 8) / 3), height: 40 };
      view.selected = TABS[index] === controller.settingsSection;
      view.setTitleColorForState(view.selected ? UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1) : UIColor.darkGrayColor(), 0);
    });
    const selected = Math.max(0, TABS.indexOf(controller.settingsSection));
    __JFJC_NAVIGATION_MOTION__.move(controller.settingsNavigationSlider, controller.settingsNavigationButtons[selected].frame, animated, SLIDER, 0.3);
    const height = page.frame.height;
    page.contentSize = { width: width, height: Math.max(height + 1, contentHeight) };
    page.contentOffset = { x: 0, y: Math.max(0, Math.min(requested, Math.max(0, contentHeight - height))) };
  }
  function stop(controller) {
    __JFJC_NAVIGATION_MOTION__.stop(controller && controller.settingsNavigationSlider, SLIDER);
    if (controller) sections(controller).forEach(function (view) { __JFJC_NAVIGATION_MOTION__.stop(view, CONTENT); });
  }
  function select(controller, sender) {
    if (controller.activePage !== 'settings' || !sender) return;
    const index = Number(__JFJC_NATIVE__.value(sender, 'tag'));
    if (!TABS[index] || controller.settingsNavigationButtons[index] !== sender || TABS[index] === controller.settingsSection) return;
    const offset = controller.settingsPage.contentOffset;
    controller.settingsScrollPositions[controller.settingsSection] = Math.max(0, Number(offset && offset.y) || 0);
    __JFJC_CARD_LOCATOR_UI__.cancelMode(controller); __JFJC_SETTINGS__.cancelFold(controller);
    sections(controller).forEach(function (view) { __JFJC_NAVIGATION_MOTION__.stop(view, CONTENT); });
    controller.settingsSection = TABS[index];
    layout(controller, controller.webView.frame, controller.settingsScrollPositions[controller.settingsSection] || 0, true);
    __JFJC_NAVIGATION_MOTION__.animate(sections(controller)[index], 'opacity', 0.4, 1, 0.18, CONTENT);
  }
  return { setup: setup, layout: layout, select: select, stop: stop };
})();
