/// <reference types="vite/client" />
import { Marked } from 'marked'
import run from './run.json'
import { siteHeader, siteFooter } from './chrome'
import { siteHead } from './head'
import chrome from './chrome.css?raw'
import styles from './docs.css?raw'
import overview from '../../docs/index.md?raw'
import gettingStarted from '../../docs/getting-started.md?raw'
import accounts from '../../docs/accounts.md?raw'
import playbooks from '../../docs/playbooks.md?raw'
import renewals from '../../docs/renewals.md?raw'
import agents from '../../docs/agents.md?raw'
import moveIn from '../../docs/move-in.md?raw'
import backups from '../../docs/backups.md?raw'

const guides = [
  { slug: '', title: 'Overview', description: 'Owner guides for renewal evidence, approved playbooks and decisions in Buoy.', source: overview, file: 'index.md' },
  { slug: 'getting-started', title: 'Getting started', description: 'Run Buoy locally, finish owner setup and add your first account.', source: gettingStarted, file: 'getting-started.md' },
  { slug: 'accounts', title: 'Accounts and evidence', description: 'Record renewal terms, understand evidence-based health and refresh account sources.', source: accounts, file: 'accounts.md' },
  { slug: 'playbooks', title: 'Playbooks', description: 'Prepare a playbook, approve its task and record completion evidence.', source: playbooks, file: 'playbooks.md' },
  { slug: 'renewals', title: 'Renewal decisions', description: 'Prepare and approve renewal decisions with retained evidence and terms.', source: renewals, file: 'renewals.md' },
  { slug: 'agents', title: 'Agents', description: 'Use scoped agent credentials to list renewals and prepare proposals for people to approve.', source: agents, file: 'agents.md' },
  { slug: 'move-in', title: 'Move in', description: 'Preview, apply and undo your account JSON imports in Buoy.', source: moveIn, file: 'move-in.md' },
  { slug: 'backups', title: 'Backup and restore', description: 'Export Buoy domain records and restore an empty installation.', source: backups, file: 'backups.md' },
]

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))
const path = (slug: string) => slug ? `/docs/${slug}` : '/docs'

/** Inline code never breaks inside a token or inside the command's head ("npx -y @runeditrun/rer dev"); it may wrap
 * only before an argument: a repository or path (has a "/"), an option ("--owner-email"), an address or a <placeholder>. */
const argument = (token: string) => /^(--|<)/.test(token) || (!token.startsWith('@') && /[/@]/.test(token))
const inlineCode = (text: string) => {
  const groups: string[][] = []
  for (const token of text.split(/ +/)) groups.length && !argument(token) ? groups[groups.length - 1].push(token) : groups.push([token])
  return `<code>${groups.map(group => `<span class="code-run">${group.map(escape).join(' ')}</span>`).join(' ')}</code>`
}

/** Repository Markdown is compiled into static pages; no app state or client JavaScript is included. */
export function docsPages(): Array<{ path: string; html: string }> {
  return guides.map((guide, index) => {
    const contents: Array<{ id: string; title: string }> = []
    const headingIds = new Set<string>()
    const markdown = new Marked({
      gfm: true,
      renderer: {
        // Documentation is checked-in prose, but raw HTML is displayed rather than executed.
        html({ text }) { return escape(text) },
        codespan({ text }) { return inlineCode(text) },
        link({ href, title, tokens }) {
          const label = this.parser.parseInline(tokens)
          if (!/^(https:\/\/|\/(?!\/)|#)/i.test(href)) return label
          return `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ''}>${label}</a>`
        },
        heading({ depth, text, tokens }) {
          const stem = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'
          let id = stem
          for (let suffix = 2; headingIds.has(id); suffix++) id = `${stem}-${suffix}`
          headingIds.add(id)
          if (depth === 2) contents.push({ id, title: text })
          return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
        },
      },
    })
    const article = markdown.parse(guide.source, { async: false })
    const navigation = guides.map(item => `<a href="${path(item.slug)}"${item.slug === guide.slug ? ' aria-current="page"' : ''}>${escape(item.title)}</a>`).join('')
    const toc = contents.map(item => `<a href="#${item.id}">${escape(item.title)}</a>`).join('')
    const previous = guides[index - 1], next = guides[index + 1]
    const pager = `<nav class="docs-pager" aria-label="Guide pages">${previous ? `<a href="${path(previous.slug)}"><span>← Previous</span>${escape(previous.title)}</a>` : '<span></span>'}${next ? `<a href="${path(next.slug)}"><span>Next →</span>${escape(next.title)}</a>` : ''}</nav>`
    const html = siteHead({ title: guide.slug ? `${guide.title} · Buoy docs` : 'Buoy docs', description: guide.description, path: path(guide.slug), style: chrome + styles })
      + `<body class="docs-page buoy-paper"><a class="docs-skip" href="#guide">Skip to guide</a>${siteHeader('docs')}`
      + `<div class="docs-layout"><aside class="docs-sidebar"><p class="docs-eyebrow">Owner guides</p><nav class="docs-guides" aria-label="Documentation">${navigation}</nav>${contents.length ? `<nav class="docs-toc" aria-label="On this page"><p class="docs-eyebrow">On this page</p>${toc}</nav>` : ''}</aside>`
      + `<main id="guide" class="docs-main" tabindex="-1"><article class="docs-article">${article}</article>${pager}<p class="docs-source"><a href="${escape(run.repository)}/blob/main/docs/${guide.file}">Read this guide in the repository</a></p></main></div>`
      + `${siteFooter()}</body></html>`
    return { path: path(guide.slug), html }
  })
}
