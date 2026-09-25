import { useEffect } from 'react'
import { t, useLanguage, useTheme, setLanguage, setTheme, type Language, type Theme } from './i18n'
export function DisplayControls() {
  const language = useLanguage(); const theme = useTheme()
  useEffect(() => { document.title = t('DedupeSafe Checker') }, [language])
  return <div className="display-controls">
    <label><span>{t('Language')}</span><select aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="tr">Türkçe</option><option value="de">Deutsch</option></select></label>
    <label><span>{t('Appearance')}</span><select aria-label={t('Appearance')} value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">{t('System')}</option><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
  </div>
}
export function AppBar() { return <div className="app-bar"><a className="app-brand" href="/">DedupeSafe</a><DisplayControls /></div> }
