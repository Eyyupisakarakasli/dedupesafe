/**
 * The checker's own Content Security Policy, injected into app/index.html as a
 * meta tag during a production build.
 *
 * The site-wide header allows `connect-src 'self'` so the marketing pages can
 * report a page view. The checker must not be able to open any connection at
 * all. A browser enforces every policy it receives, so the stricter one wins
 * where both apply.
 *
 * Path-scoped headers were tried first and removed: a source pattern that did
 * not match `/app/` left the checker with no security headers at all.
 *
 * The tag is added only in a build, because the dev server needs its websocket
 * and its inline scripts.
 */
export const CHECKER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'none'",
  "worker-src 'self' blob:",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

export const CHECKER_CSP_TAG =
  '<meta http-equiv="Content-Security-Policy" content="' + CHECKER_CSP + '" />'

/**
 * Returns the checker's HTML with the tag added. Any other page is unchanged.
 *
 * @param filename Build path with forward slashes; vite.config normalises it.
 */
export function withCheckerCsp(html: string, filename: string): string {
  if (!filename.includes('app/index.html')) return html
  if (html.includes('http-equiv="Content-Security-Policy"')) return html
  return html.replace('</head>', '  ' + CHECKER_CSP_TAG + '\n  </head>')
}
