# Sales Navigator Visible Lead Exporter

This is a separate Chrome/Edge Manifest V3 extension. It exports the lead cards
that LinkedIn Sales Navigator has already rendered in the current results page.

## Install

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `sales-navigator-exporter` folder.
5. Open or refresh a Sales Navigator people-search page.

The extension adds a small **Lead exporter** panel in the bottom-right corner.
Use **Resolve public URLs** first, then **Download CSV** or **Download JSON** to
save the currently rendered leads.
The export includes both `linkedinUrl` (the public `/in/...` profile URL, when
LinkedIn renders it) and `salesNavigatorUrl` (the Sales Navigator lead URL).

## Scope and limitations

- It reads only visible/rendered lead cards in the active tab.
- A public LinkedIn URL is included only when a public `/in/...` link is present
  in the rendered card or on the lead-detail page after the three-dot menu is
  opened. The resolver opens one LinkedIn lead-detail tab at a time, reads the
  visible link, and closes the tab.
- It does not call LinkedIn APIs, inspect network requests, bypass limits, log in,
  auto-scroll, auto-page, or send messages.
- If Sales Navigator has virtualized the list, scroll through the page first so
  the desired cards are rendered, then export each results page separately.
- LinkedIn can change its DOM; selectors are intentionally centralized in
  `src/content.js` and may need maintenance.
- Use the export only in accordance with LinkedIn's terms, your organization's
  policies, and applicable privacy/data-protection laws.
