var __JFJC_CARD_LOCATOR_UI__ = (function () {
  function button(title, controller, selector) {
    const result = new UIButton({ x: 0, y: 0, width: 100, height: 36 });
    result.setTitleForState(title, 0);
    result.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.1, 0.36, 0.72, 1), 0);
    result.titleLabel.font = UIFont.systemFontOfSize(14);
    result.addTargetActionForControlEvents(controller, selector, 1 << 6);
    return result;
  }

  function layout(controller) {
    const modeChoice = controller && controller.cardLocationModeChoice;
    if (modeChoice) {
      const bounds = controller.view.bounds;
      const width = Math.min(360, Math.max(0, bounds.width - 40));
      const height = Math.max(0, bounds.height - 36);
      modeChoice.overlay.frame = { x: 0, y: 36, width: bounds.width, height };
      modeChoice.sheet.frame = { x: (bounds.width - width) / 2, y: Math.max(0, (height - 224) / 2), width, height: 224 };
      modeChoice.title.frame = { x: 16, y: 16, width: Math.max(0, width - 32), height: 30 };
      modeChoice.buttons.forEach(function (row, index) { row.frame = { x: 16, y: 62 + index * 50, width: Math.max(0, width - 32), height: 42 }; });
    }
    const choice = controller && controller.cardLocationChoice;
    if (!choice) return;
    const bounds = controller.view.bounds;
    const width = Math.max(0, bounds.width - 24);
    const height = Math.max(0, bounds.height - 62);
    choice.view.frame = { x: 12, y: 50, width, height };
    choice.title.frame = { x: 16, y: 12, width: Math.max(0, width - 112), height: 30 };
    choice.cancel.frame = { x: Math.max(0, width - 80), y: 10, width: 66, height: 34 };
    choice.scroll.frame = { x: 12, y: 56, width: Math.max(0, width - 24), height: Math.max(0, height - 68) };
    choice.buttons.forEach(function (row, index) { row.frame = { x: 0, y: index * 88, width: Math.max(0, width - 24), height: 80 }; });
    choice.scroll.contentSize = { width: Math.max(0, width - 24), height: choice.buttons.length * 88 };
  }

  function close(controller) {
    const choice = controller && controller.cardLocationChoice;
    if (!choice) return null;
    controller.cardLocationChoice = null;
    try { choice.view.removeFromSuperview(); }
    catch (error) { console.log(`[Jifengjincao Bridge] 移除题卡选择列表失败：${error && error.message || error}`); }
    return choice;
  }

  function cancel(controller) {
    const choice = close(controller);
    if (choice) choice.reject(new Error("已取消定位"));
  }

  function select(controller, index, sender) {
    const choice = controller && controller.cardLocationChoice;
    if (!choice || !Number.isSafeInteger(index) || !choice.candidates[index]) return;
    if (sender && choice.buttons[index] !== sender) return;
    const candidate = choice.candidates[index];
    close(controller);
    choice.resolve(candidate);
  }

  function choose(controller, candidates) {
    if (!controller || !controller.view) return Promise.reject(new Error("题卡选择窗口不可用，请重新打开插件面板"));
    cancel(controller);
    return new Promise(function (resolve, reject) {
      let view;
      try {
        view = new UIView({ x: 0, y: 0, width: 100, height: 100 });
        view.backgroundColor = UIColor.whiteColor();
        view.layer.cornerRadius = 10;
        view.layer.borderWidth = 0.5;
        view.layer.borderColor = UIColor.colorWithWhiteAlpha(0.8, 0.6);
        const title = new UILabel({ x: 0, y: 0, width: 100, height: 30 });
        title.text = "选择要定位的题卡（" + candidates.length + "）";
        title.font = UIFont.boldSystemFontOfSize(17);
        title.textColor = UIColor.darkGrayColor();
        const cancelButton = button("取消", controller, "cancelCardLocationChoice:");
        const scroll = new UIScrollView({ x: 0, y: 0, width: 100, height: 100 });
        scroll.showsVerticalScrollIndicator = true;
        const buttons = candidates.map(function (candidate, index) {
          const row = button(candidate.studySetTitle + "\n" + (candidate.path ? candidate.path + " / " : "") + candidate.title + "\n卡片 " + candidate.noteId.slice(0, 8), controller, "selectCardLocationChoice:");
          row.tag = index;
          row.titleLabel.numberOfLines = 3;
          row.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.94, 0.97, 1, 1);
          row.layer.cornerRadius = 8;
          scroll.addSubview(row);
          return row;
        });
        view.addSubview(title);
        view.addSubview(cancelButton);
        view.addSubview(scroll);
        controller.cardLocationChoice = { view, title, cancel: cancelButton, scroll, buttons, candidates, resolve, reject };
        controller.view.addSubview(view);
        layout(controller);
      } catch (error) {
        if (view && view.superview) view.removeFromSuperview();
        controller.cardLocationChoice = null;
        reject(error);
      }
    });
  }
  function cancelMode(controller) {
    const choice = controller && controller.cardLocationModeChoice;
    if (!choice) return;
    controller.cardLocationModeChoice = null;
    choice.overlay.removeFromSuperview();
  }

  function selectMode(controller, index, sender) {
    const choice = controller && controller.cardLocationModeChoice;
    if (!choice || !Number.isSafeInteger(index) || index < 0 || index > 2) return;
    if (sender && choice.buttons[index] !== sender) return;
    cancelMode(controller);
    if (index < 2) choice.onSelect(choice.values[index]);
  }

  function chooseMode(controller, current, onSelect) {
    chooseOption(controller, "定位卡片方式", ["locate", "focus"], ["仅定位", "定位并聚焦"], current, "selectCardLocationMode:", onSelect);
  }

  function chooseOption(controller, heading, values, labels, current, selector, onSelect) {
    if (!controller || !controller.view) throw new Error("定位方式选择窗口不可用，请重新打开插件面板");
    if (controller.cardLocationChoice) throw new Error("请先完成当前题卡选择");
    cancelMode(controller);
    const overlay = new UIView({ x: 0, y: 0, width: 100, height: 100 });
    overlay.backgroundColor = UIColor.colorWithWhiteAlpha(0, 0.2);
    const sheet = new UIView({ x: 0, y: 0, width: 100, height: 100 });
    sheet.backgroundColor = UIColor.whiteColor();
    sheet.layer.cornerRadius = 12;
    const title = new UILabel({ x: 0, y: 0, width: 100, height: 30 });
    title.text = heading;
    title.font = UIFont.boldSystemFontOfSize(17);
    title.textColor = UIColor.darkGrayColor();
    sheet.addSubview(title);
    const buttons = labels.concat(["取消"]).map(function (text, index) {
      const row = button(text + (index < 2 && values[index] === current ? "（当前）" : ""), controller, selector);
      row.tag = index;
      row.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.94, 0.97, 1, 1);
      row.layer.cornerRadius = 8;
      sheet.addSubview(row);
      return row;
    });
    overlay.addSubview(sheet);
    controller.cardLocationModeChoice = { overlay, sheet, title, buttons, values, onSelect };
    controller.view.addSubview(overlay);
    layout(controller);
  }

  return { choose, layout, select, cancel, chooseMode, chooseOption, selectMode, cancelMode };
})();
