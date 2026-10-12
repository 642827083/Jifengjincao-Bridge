var __JFJC_STORE__ = (function () {
  function path() {
    const base = String(__JFJC_NATIVE__.value(Application.sharedInstance(), 'documentPath') || '');
    if (!base) throw new Error('MN 文稿目录不可用'); return base + '/cn.marginnote.jifengjincao-bridge';
  }
  function read() {
    const file = path() + '/imports.json', manager = NSFileManager.defaultManager();
    if (!manager.fileExistsAtPath(file)) return { schemaVersion: 1, tasks: [], mappings: {} };
    const data = NSData.dataWithContentsOfFile(file);
    if (!data) throw new Error('导入记录无法读取，原文件已保留');
    let result;
    try { result = NSJSONSerialization.JSONObjectWithDataOptions(data, 1); }
    catch (error) { throw new Error('导入记录格式损坏，原文件已保留'); }
    if (!result || result.schemaVersion !== 1 || !Array.isArray(result.tasks) || !result.mappings || typeof result.mappings !== 'object' || Array.isArray(result.mappings)) throw new Error('导入记录版本或格式不支持，原文件已保留');
    return result;
  }
  function save(state) {
    const directory = path(), manager = NSFileManager.defaultManager();
    if (!manager.fileExistsAtPath(directory) && !manager.createDirectoryAtPathWithIntermediateDirectoriesAttributes(directory, true, null)) throw new Error('无法创建插件数据目录');
    const data = NSJSONSerialization.dataWithJSONObjectOptions(state, 1);
    if (!data || !data.writeToFileAtomically(directory + '/imports.json', true)) throw new Error('导入记录保存失败');
  }
  function task(record) {
    const state = read();
    state.tasks = state.tasks.filter(function (item) { return item.id !== record.id; });
    state.tasks.push(record); state.tasks = state.tasks.slice(-20); save(state);
  }
  function mapping(notebookId, key, note, entry) {
    const state = read();
    state.mappings[notebookId + '|' + key] = { noteId: __JFJC_NATIVE__.noteId(note), updatedAt: entry.updatedAt, number: entry.number };
    save(state);
  }
  return { read: read, task: task, mapping: mapping };
})();
