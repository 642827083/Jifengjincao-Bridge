var __JFJC_PANEL_NAVIGATION__ = (function () {
  const HEIGHT = 44, ANIMATION = 'jfjc.panel.navigation';
  function frames(width) {
    const groupWidth = Math.min(246, Math.max(0, width - 112)), x = (width - groupWidth) / 2;
    function tab(index) { return { x: x + index * groupWidth / 3, y: 0, width: groupWidth / 3, height: HEIGHT }; }
    return { math: tab(0), imports: tab(1), settings: tab(2),
      group: { x: x, y: 0, width: groupWidth, height: HEIGHT },
      close: { x: Math.max(0, width - 48), y: 0, width: 44, height: HEIGHT } };
  }
  function setup(controller) {
    controller.titleBarDragRegions = [0, 1].map(function () {
      const view = new UIView({ x: 0, y: 0, width: 0, height: HEIGHT });
      const pan = new UIPanGestureRecognizer(controller, 'movePanel:'); view.addGestureRecognizer(pan);
      if (typeof UITapGestureRecognizer !== 'undefined') {
        const tap = new UITapGestureRecognizer(controller, 'resetPanelOnDoubleTap:');
        tap.numberOfTapsRequired = 2; tap.cancelsTouchesInView = false;
        tap.delaysTouchesBegan = false; tap.delaysTouchesEnded = false;
        if (typeof tap.requireGestureRecognizerToFail === 'function') tap.requireGestureRecognizerToFail(pan);
        view.addGestureRecognizer(tap);
      }
      controller.titleBar.addSubview(view); return view;
    });
    const navigation = new UIView({ x: 0, y: 0, width: 0, height: HEIGHT });
    controller.mainNavigation = navigation; controller.titleBar.addSubview(navigation);
    const indicator = new UIView({ x: 0, y: 0, width: 0, height: 3 });
    indicator.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1); indicator.layer.cornerRadius = 1.5;
    controller.mainNavigationIndicator = indicator; navigation.addSubview(indicator);
    controller.mainNavigationButtons = [controller.mathButton, controller.importButton, controller.settingsButton];
    controller.mainNavigationButtons.forEach(function (view) { navigation.addSubview(view); });
    controller.titleBar.addSubview(controller.closeButton);
  }
  function refresh(controller, animated) {
    if (!controller.mainNavigation) return;
    const index = Math.max(0, ['math', 'import', 'settings'].indexOf(controller.activePage));
    const slot = controller.mainNavigation.bounds.width / 3, width = Math.min(24, Math.max(0, slot - 16));
    controller.mainNavigationButtons.forEach(function (view, position) {
      view.selected = index === position;
      view.setTitleColorForState(view.selected ? UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1) : UIColor.darkGrayColor(), 0);
    });
    __JFJC_NAVIGATION_MOTION__.move(controller.mainNavigationIndicator,
      { x: index * slot + (slot - width) / 2, y: HEIGHT - 6, width: width, height: 3 }, animated, ANIMATION, 0.22);
  }
  function layout(controller) {
    const f = frames(controller.titleBar.bounds.width);
    controller.mainNavigation.frame = f.group;
    [f.math, f.imports, f.settings].forEach(function (frame, index) {
      controller.mainNavigationButtons[index].frame = { x: frame.x - f.group.x, y: 0, width: frame.width, height: HEIGHT };
    });
    controller.closeButton.frame = f.close;
    controller.titleBarDragRegions[0].frame = { x: 0, y: 0, width: f.group.x, height: HEIGHT };
    controller.titleBarDragRegions[1].frame = { x: f.group.x + f.group.width, y: 0,
      width: Math.max(0, f.close.x - f.group.x - f.group.width), height: HEIGHT };
    refresh(controller, false);
  }
  function stop(controller) { __JFJC_NAVIGATION_MOTION__.stop(controller && controller.mainNavigationIndicator, ANIMATION); }
  return { height: HEIGHT, frames: frames, setup: setup, layout: layout, refresh: refresh, stop: stop };
})();
