/**
 * Whether the ProcurePal marketplace is open in this build.
 *
 * Closed, every `/marketplace/…` address shows the "opens soon" page (MarketplaceComingSoonPage),
 * the storefront header and footer drop search, cart and categories, and the workspace sidebar
 * tags Marketplace "Soon" and leaves out Marketplace orders and Delivery Addresses.
 *
 * Read at build time, like VITE_FOUNDING_OFFER:
 * - production: closed, because nothing sets the variable. To open it, set
 *   VITE_MARKETPLACE_OPEN=true in Netlify (Site configuration > Environment variables, production
 *   context) and redeploy. See DEPLOYMENT.md.
 * - staging and deploy previews: open, from netlify.toml, so the marketplace can still be tested.
 * - `npm run dev`: open, unless VITE_MARKETPLACE_OPEN=false is set to look at the closed page.
 * - e2e: its builds set it to true (e2e/README.md).
 */
const flag = import.meta.env.VITE_MARKETPLACE_OPEN as string | undefined

export const MARKETPLACE_OPEN = flag != null && flag !== '' ? flag === 'true' : import.meta.env.DEV
