import { t } from './i18n'
export function ProductFooter() {
  return (
    <footer className="product-footer">
      <a href="/privacy/">{t("Privacy")}</a>
      <a href="/limitations/">{t("Limitations")}</a>
      <a href="mailto:dedupesafe@outlook.com?subject=DedupeSafe%20feedback&amp;body=Role%20%28consultant%2Fagency%20or%20own%20HubSpot%20account%29%3A%0ADid%20you%20try%20an%20authorized%20real%20export%20or%20the%20demo%3F%0AWhat%20worked%2C%20matched%20incorrectly%2C%20or%20was%20missed%3F%0AWhere%20did%20you%20get%20stuck%3F%0AWhere%20did%20you%20find%20DedupeSafe%3F%0A%0APlease%20do%20not%20attach%20contact%20CSVs%2C%20audit%20reports%2C%20or%20customer%20personal%20data.%20Use%20invented%20examples%20if%20needed.">{t("Email feedback: dedupesafe@outlook.com")}</a>
      <a href="https://github.com/Eyyupisakarakasli/dedupesafe/issues">{t("Public bug tracker")}</a>
      <p>{t("Tell us what worked or went wrong. Do not send contact CSVs, audit reports or customer personal data.")}</p>
      <p>{t("Independent of and not authorized, endorsed, sponsored or approved by HubSpot, Inc.")}</p>
    </footer>
  )
}
