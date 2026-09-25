// Only display preferences are persisted; contact data never enters storage.
(function () {
  const read = (key) => { try { return localStorage.getItem(key) } catch { return null } };
  const language = read('ds-language');
  const theme = read('ds-theme');
  document.documentElement.lang = ['en','tr','de'].includes(language) ? language : 'en';
  document.documentElement.dataset.theme = ['light','dark'].includes(theme) ? theme : 'system';
})();
