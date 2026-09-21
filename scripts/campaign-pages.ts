export const CAMPAIGNS = [
  'consultants/reddit', 'consultants/community', 'owners/reddit', 'owners/community',
] as const

export function campaignHtml(html: string, campaign: typeof CAMPAIGNS[number]): string {
  const lede = campaign.startsWith('consultants/')
    ? 'Review a client’s HubSpot contact export before connecting an app to their portal. Use only exports you are authorized to process. Review candidates locally and approve each row removal.'
    : 'Review contacts exported from your own HubSpot Free or Starter account. Check candidate matches locally and approve each row removal. This tool does not merge contacts inside your portal.'
  return html
    .replace('</head>', '<meta name="robots" content="noindex, follow" />\n</head>')
    .replace(/<p class="lede">[\s\S]*?<\/p>/, `<p class="lede">${lede}</p>`)
}
