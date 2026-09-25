// This runs only on authored static pages, never on the React CSV workspace.
const root = document.documentElement;
const originalTitle = document.title;
let language = root.lang;
const translate = source => dictionaries[language]?.[source] ?? source;
const controls = document.createElement('div');
controls.className = 'display-controls';
controls.innerHTML = '<label><span data-label="Language"></span><select aria-label="Language"><option value="en">English</option><option value="tr">Türkçe</option><option value="de">Deutsch</option></select></label><label><span data-label="Appearance"></span><select aria-label="Appearance"><option value="system" data-label="System"></option><option value="light" data-label="Light"></option><option value="dark" data-label="Dark"></option></select></label>';
(document.querySelector('.site-header') ?? document.querySelector('main')).appendChild(controls);
if (document.querySelector('.legal-page')) document.querySelector('.back-link').after(controls);
const [languageSelect, themeSelect] = controls.querySelectorAll('select');
languageSelect.value = language;
themeSelect.value = root.dataset.theme ?? 'system';
// Capture original authored strings once. Do not translate data or mutate React nodes.
const texts = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
let node;
while ((node = walker.nextNode())) {
  if (node.parentElement.closest('script,style,code,.display-controls')) continue;
  const key = node.textContent.trim();
  if (dictionaries.tr[key]) texts.push({ node, original: node.textContent, key });
}
const attributes = [...document.querySelectorAll('[aria-label]')].filter(element => !controls.contains(element)).map(element => ({element, source:element.getAttribute('aria-label')}));
function render() {
  root.lang = language;
  document.title = translate(originalTitle);
  texts.forEach(({node, original, key}) => { node.textContent = original.replace(key, translate(key)); });
  attributes.forEach(({element,source}) => element.setAttribute('aria-label',translate(source)));
  controls.querySelectorAll('[data-label]').forEach(element => { element.textContent = translate(element.dataset.label); });
  languageSelect.setAttribute('aria-label',translate('Language'));
  themeSelect.setAttribute('aria-label',translate('Appearance'));
}
languageSelect.addEventListener('change', () => { language = languageSelect.value; try { localStorage.setItem('ds-language',language); } catch {} render(); });
themeSelect.addEventListener('change', () => { root.dataset.theme = themeSelect.value; try { localStorage.setItem('ds-theme',themeSelect.value); } catch {} });
render();
