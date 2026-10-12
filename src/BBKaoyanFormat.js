var __JFJC_FORMAT__ = (function () {
  function marker(value) { return '<!-- JFJC_' + value + ' -->'; }
  function escaped(text, index) {
    let count = 0;
    while (index > 0 && text[--index] === '\\') count++;
    return count % 2 === 1;
  }
  function inlineMath(text) {
    let output = '', start = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '$' || escaped(text, i)) continue;
      // 独立公式整体跳过，避免把 $$ 的两个符号当成行内公式。
      if (text[i + 1] === '$') {
        let end = text.indexOf('$$', i + 2);
        while (end >= 0 && escaped(text, end)) end = text.indexOf('$$', end + 2);
        if (end < 0) break;
        i = end + 1; continue;
      }
      let end = i + 1;
      while (end < text.length && text[end] !== '\n' && (text[end] !== '$' || escaped(text, end))) end++;
      if (end >= text.length || text[end] !== '$' || text[end + 1] === '$') continue;
      const math = text.slice(i + 1, end).trim();
      if (math) { output += text.slice(start, i) + '$' + math + '$'; start = end + 1; }
      i = end;
    }
    return output + text.slice(start);
  }
  function repairMath(value) {
    const protectedParts = [];
    let prefix = '\uE000JFJC_REPAIR_';
    while (String(value).indexOf(prefix) >= 0) prefix += '_';
    function protect(part) { protectedParts.push(part); return prefix + (protectedParts.length - 1) + '\uE001'; }
    let text = String(value || '').replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?=\r?$)/gm, protect);
    text = text.replace(/(`+)([^\n]*?)\1(?!`)/g, protect);
    text = inlineMath(text);
    protectedParts.forEach(function (part, i) { text = text.split(prefix + i + '\uE001').join(part); });
    return text;
  }
  function normalize(value) {
    const blocks = [];
    let prefix = '\uE000JFJC_CODE_';
    while (String(value).indexOf(prefix) >= 0) prefix += '_';
    let s = String(value || '').replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?=\r?$)/gm, function (block) {
      blocks.push(block); return prefix + (blocks.length - 1) + '\uE001';
    });
    s = s.replace(/(`+)([^\n]*?)\1(?!`)/g, function (block) {
      blocks.push(block); return prefix + (blocks.length - 1) + '\uE001';
    });
    s = s.replace(/\\\(([\s\S]*?)\\\)/g, function (_, math) { return '$' + math.trim() + '$'; })
      .replace(/\\\[([\s\S]*?)\\\]/g, function (_, math) { return '\n\n$$\n' + math.trim() + '\n$$\n\n'; })
      .replace(/\$\$([\s\S]*?)\$\$/g, function (_, math) { return '\n\n$$\n' + math.trim() + '\n$$\n\n'; })
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    s = inlineMath(s);
    blocks.forEach(function (block, i) { s = s.split(prefix + i + '\uE001').join(block); });
    return s;
  }
  function clean(value) { return String(value || '').replace(/<!--\s*JFJC_[\s\S]*?-->/g, '').trim(); }
  function assetMarkdown(asset, images) {
    const uri = images[String(asset.id)];
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(uri || '')) throw new Error('图片 ' + asset.id + ' 尚未下载');
    return '![' + (asset.alt || '题目配图').replace(/[\[\]\r\n]/g, ' ') + '](' + uri + ')';
  }
  function localize(value, inlineImages) {
    let s = clean(value);
    s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g, function (match, label, url) {
      if (!inlineImages[url]) throw new Error('正文图片尚未保存');
      return '![' + label + '](' + inlineImages[url] + ')';
    });
    if (/<img\b/i.test(s)) throw new Error('正文含 HTML 图片，请先转换为网站支持的图文格式');
    return normalize(s);
  }
  function questionTitle(entry, paper) { return clean(paper.title) + ' · 第 ' + clean(entry.number) + ' 题'; }
  function format(entry, paper, media, includeQuestion, includeAnswer, includeTopics, includeSourceLink) {
    media = media || { images: {}, inlineImages: {} };
    const images = media.images || {}, inline = media.inlineImages || {};
    function group(usage) { return entry.assets.filter(function (a) { return a.usage === usage; }); }
    const questionAssets = group('stem'), optionAssets = group('option');
    const question = [];
    let sourceLink = '';
    if (includeQuestion) {
      question.push(localize(entry.stem, inline));
      questionAssets.forEach(function (a) { question.push(assetMarkdown(a, images)); });
      'ABCD'.split('').forEach(function (key, index) {
        const content = localize(entry.options[key], inline);
        const image = optionAssets[index];
        if (content || image) question.push(key + '. ' + [content, image ? assetMarkdown(image, images) : ''].filter(Boolean).join('\n\n'));
      });
      if (optionAssets.length > 4) throw new Error('选项图片数量无法与 A–D 对应');
      if (includeTopics !== false && entry.topics.length) question.push('知识点：' + entry.topics.map(clean).join('；'));
      if (includeSourceLink !== false) sourceLink = '[查看原题](' + __JFJC_SOURCE__.link(paper.id, entry.id) + ')\n\n' + marker('SOURCE:' + __JFJC_ADAPTER__.key(paper.id, entry.id));
      // 链接开关只控制可见入口，题卡身份和顺序仍用于去重与补答案。
      question.push(marker('QUESTION:' + __JFJC_ADAPTER__.key(paper.id, entry.id)), marker('ORDER:' + entry.order));
    }
    const answer = [], answerPart = [], explanationPart = [];
    if (includeAnswer && __JFJC_ADAPTER__.hasAnswer(entry)) {
      if (entry.answer || group('answer').length) {
        answerPart.push('### 答案', localize(entry.answer, inline));
        group('answer').forEach(function (a) { answerPart.push(assetMarkdown(a, images)); });
        answerPart.push(marker('PART:answer'));
      }
      if (entry.explanation || group('explanation').length) {
        explanationPart.push('### 解析', localize(entry.explanation, inline));
        group('explanation').forEach(function (a) { explanationPart.push(assetMarkdown(a, images)); });
        explanationPart.push(marker('PART:explanation'));
      }
      answer.push(answerPart.filter(Boolean).join('\n\n'), explanationPart.filter(Boolean).join('\n\n'));
      answer.push(marker('ANSWER:' + __JFJC_ADAPTER__.key(paper.id, entry.id)));
    }
    return { question: question.filter(Boolean).join('\n\n'), sourceLink: sourceLink, answer: answer.filter(Boolean).join('\n\n'),
      answerPart: answerPart.filter(Boolean).join('\n\n'), explanationPart: explanationPart.filter(Boolean).join('\n\n'),
      answerComplete: Boolean(entry.answer || group('answer').length) && Boolean(entry.explanation || group('explanation').length) };
  }
  return { normalize: normalize, repairMath: repairMath, format: format, marker: marker, questionTitle: questionTitle };
})();
