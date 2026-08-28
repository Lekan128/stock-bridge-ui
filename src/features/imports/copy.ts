import type { ImportFieldDescriptor, ImportKind, ImportMode } from '@/features/imports/types'
import { MAX_FILE_BYTES, MAX_ROWS, SESSION_TTL_HOURS } from '@/features/imports/constants'

/**
 * Every user-facing string in the import flow, in one file.
 *
 * It is centralised because the copy rules (spec §9.6) are the kind of discipline that decays
 * the moment strings live next to the markup:
 *
 *  1. A column name is never the subject of a sentence the user reads. `unit_of_measure` is a
 *     wire key; "Unit of measure" is a label; "Every product needs a unit of measure — what is
 *     Garri 25kg measured in?" is the sentence. `fieldLabel()` exists so no component is ever
 *     tempted to print the key.
 *  2. No UUID is ever rendered. Anywhere. Not for a supplier, a product, a user, or an upload.
 *  3. Every bulk affordance says its count. "Fix all 12" beats "Fix all".
 *  4. The words "escrow", "session", "staging" and "batch" appear nowhere — not in a tooltip,
 *     not in an aria-label. `assertCopyIsClean()` below enforces this in development.
 *
 * The word for an uploaded file in this UI is "upload" or "import", and the thing the user is
 * in the middle of is "this import" or "this file" — never the fourth banned word.
 */

const numberFormatter = new Intl.NumberFormat('en-NG')

export function formatCount(value: number): string {
  return numberFormatter.format(value)
}

/** "1 row" / "4 rows" — plural agreement in one place. */
export function pluralRows(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'row' : 'rows'}`
}

/**
 * The verb that goes with `pluralRows`. "1 row name a supplier" is the kind of sentence that
 * makes a careful reader trust the rest of the screen slightly less, and every one of these
 * headings is built from a count that is genuinely 1 some of the time.
 */
function rowsVerb(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/**
 * "9.4 MB" / "312 KB". A 200 KB spreadsheet rounded to "0.2 MB" reads like a rounding error and
 * "0 MB" — which is what a small .csv produced — reads like a broken file, so anything under a
 * megabyte is quoted in the unit it is actually measured in.
 */
export function formatMegabytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`
}

/**
 * The only sanctioned way to turn a field key into something a person reads.
 * Falls back to a de-underscored, sentence-cased key so an unknown field still never renders
 * as `unit_of_measure`.
 */
export function fieldLabel(fields: ImportFieldDescriptor[], key: string): string {
  const found = fields.find((field) => field.key === key)
  if (found) return found.label
  const words = key.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function fieldLabels(fields: ImportFieldDescriptor[], keys: string[]): string {
  const labels = keys.map((key) => fieldLabel(fields, key))
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export const KIND_COPY: Record<ImportKind, { title: string; shortTitle: string }> = {
  PRODUCT_CATALOG: { title: 'Add or update products', shortTitle: 'Products' },
  STOCK_IN: { title: 'Record stock you received', shortTitle: 'Stock received' },
}

/**
 * Plain language for `ImportMode` — the enum spelling never reaches the screen. The question is
 * asked before upload because the answer changes what counts as an error during validation
 * (spec §9.2), so it is phrased as a condition, not as a setting.
 */
export const MODE_OPTIONS: { value: ImportMode; label: string; hint: string }[] = [
  {
    value: 'CREATE_ONLY',
    label: 'Skip it',
    hint: 'Leave what you already have untouched. Only brand-new products are added.',
  },
  {
    value: 'CREATE_OR_UPDATE',
    label: 'Update it',
    hint: 'Change the details that differ, and add anything new. Best for a supplier price list.',
  },
  {
    value: 'UPDATE_ONLY',
    label: 'Only update, never add',
    hint: "Nothing new is created. A product you don't already have is flagged instead.",
  },
]

export const copy = {
  chooser: {
    title: 'What are you importing?',
    subtitle: 'Pick the job you came here to do — we will take care of the rest.',
    /** The card's own call to action. Here rather than in the JSX so the guard below sees it. */
    start: 'Start',
    cards: {
      PRODUCT_CATALOG: {
        title: 'Add or update products',
        body: 'Build your catalog, or update prices and suppliers in bulk.',
        footnote: 'Includes opening stock for brand-new products.',
      },
      STOCK_IN: {
        title: 'Record stock you received',
        body: 'Deliveries you bought outside Procure Paddy.',
        footnote: 'We pre-fill your products — you just add the quantities.',
      },
    },
  },

  upload: {
    title: (kind: ImportKind) => KIND_COPY[kind].title,
    /**
     * Shown instead of the dropzone when the signed-in user is not allowed to run this kind of
     * import. The API would refuse them anyway (contract §3); being told why, here, beats a
     * server error after they have picked a file.
     */
    notAllowedTitle: (kind: ImportKind) =>
      kind === 'STOCK_IN'
        ? 'You cannot record stock for this company'
        : 'You cannot add or change products for this company',
    notAllowedBody:
      "Your account does not include it. Ask whoever manages your team's access if you need it.",
    dropzoneHeading: 'Drop your file here, or browse',
    dropzoneLimits: `Up to ${formatCount(MAX_ROWS)} rows · ${formatMegabytes(MAX_FILE_BYTES)} · .xlsx or .csv`,
    dropzoneActive: 'Release to use this file',
    templateLead: 'First time?',
    templateLink: 'Download the template',
    templateTail: '— it comes with your vendors and units already filled into dropdowns.',
    stockInTemplateLink: 'Download your stock sheet',
    stockInTemplateTail: '— your products are already on it, so you only fill in the quantities.',
    modeQuestion: 'If a product is already in your catalog:',
    submit: 'Upload and check it',
    checking: 'Checking your file…',
    /** Drawn *and* written: a bar on its own tells nobody how much longer to wait. */
    sending: (percent: number) => (percent >= 100 ? 'Sent — checking it now' : `Sending… ${percent}%`),
    clear: 'Choose a different file',
    tooLarge: (bytes: number) =>
      `That file is ${formatMegabytes(bytes)} — the limit is ${formatMegabytes(MAX_FILE_BYTES)}. Try saving it as .xlsx, or split it in two.`,
    wrongType: (name: string) =>
      `We can read .xlsx and .csv files. "${name}" is neither — open it in Excel and save it as .xlsx.`,
    empty: 'That file has no rows in it.',
  },

  recent: {
    title: 'Recent imports',
    empty: 'Nothing imported yet',
    emptyBody: 'Once you upload a file it shows up here, so you can pick it back up or undo it.',
    resume: 'Pick up where you left off',
    view: 'View',
    undo: 'Undo',
    inProgress: 'Not finished',
    expired: 'Expired',
    // FAILED never means "we could not read this file" — an unreadable file is refused at upload
    // with a 400 and never becomes an import at all. FAILED is set only when a commit that had
    // already validated clean blew up part-way and rolled back, so the badge has to say that.
    failed: "Didn't go through",
  },

  review: {
    title: (filename: string) => `Review · ${filename}`,
    /**
     * The 48-hour retention line. Spec §9.6 says mention it exactly once, plainly, and this is
     * the one place — it belongs next to "Save & finish later", because that is the moment the
     * question "how long do I have?" is actually being asked.
     */
    retention: `We'll keep this for ${Math.round(SESSION_TTL_HOURS / 24)} days, so you can come back to it.`,
    ready: (count: number) => `${formatCount(count)} ready`,
    needAttention: (count: number) => `${formatCount(count)} need attention`,
    toCheck: (count: number) => `${formatCount(count)} to check`,
    skipped: (count: number) => `${formatCount(count)} skipped`,
    /**
     * What a screen reader hears when the counters change.
     *
     * The visible counters drop a whole `<span>` out of the DOM when a count reaches zero, and a
     * node *removed* from a live region is not announced by any major screen reader — so fixing
     * the last bad row, the moment this screen exists for, would be completely silent. One
     * sentence that is always present and only ever changes its text is announced every time.
     */
    liveSummary: (ready: number, errors: number, warnings: number) => {
      const parts = [`${formatCount(ready)} ready`]
      if (errors > 0) parts.push(`${formatCount(errors)} need attention`)
      if (warnings > 0) parts.push(`${formatCount(warnings)} to check`)
      return errors === 0 && warnings === 0
        ? `${parts.join(', ')}. Nothing left to fix.`
        : `${parts.join(', ')}.`
    },
    /** The badge on a phone's issue card — a per-row count, not the file-wide one. */
    cardIssues: (count: number) =>
      count === 1 ? '1 thing to fix' : `${formatCount(count)} things to fix`,
    cardChecks: (count: number) =>
      count === 1 ? '1 thing to check' : `${formatCount(count)} things to check`,
    filterAll: 'All',
    filterIssues: 'Issues',
    filterLabel: 'Which rows to show',
    allGood: (count: number) => `All ${pluralRows(count)} look good.`,
    allGoodBody: "Nothing to fix — we checked every row against your catalog, your suppliers and your units.",
    allGoodSkipped: (count: number) =>
      `${pluralRows(count)} were blank, so we'll leave them out.`,
    saveForLater: 'Save & finish later',
    savedToast: 'Saved. Pick it back up any time from Recent imports.',
    continue: 'Continue',
    continueBlocked: (count: number) =>
      `Fix the ${pluralRows(count)} above and you can carry on.`,
    discard: 'Discard this upload',
    discardTitle: 'Discard this upload?',
    discardBody: 'Nothing has been imported yet, so nothing will change in your catalog. The file itself is untouched.',
    discardConfirm: 'Discard it',
    discardedToast: 'Upload discarded. Nothing was changed.',
    showAllColumns: 'Show every column',
    showFewerColumns: 'Show only what matters',
    columnsNote: (shown: number, total: number) =>
      `Showing ${shown} of ${total} columns — the ones you need to act on.`,
    rowLabel: (excelRow: number) => `Row ${excelRow}`,
    continuation: '(same SKU)',
    continuationExplainer: (parentRow: number) =>
      `Another supplier for the product on row ${parentRow}. Only the supplier columns count on this line.`,
    editCell: (label: string, excelRow: number) => `Edit ${label} on row ${excelRow}`,
    commitEdit: 'Press Enter to save, Escape to cancel',
    saveCell: 'Save',
    cancelCell: 'Cancel',
    skipRow: 'Leave this row out',
    unskipRow: 'Put this row back in',
    skippedBadge: 'Left out',
    okBadge: 'Ready',
    bulkFix: (count: number, value: string) =>
      `Fix all ${formatCount(count)} "${value}" rows`,
    bulkFixDone: (count: number) => `Fixed ${pluralRows(count)}.`,
    bulkFixNeedsValue: 'Pick a replacement first',
    editFailed: "That change didn't save. We've put the old value back.",
    stockInLink: 'Record stock you received',
    noIssues: 'Nothing needs attention',
    noIssuesBody: 'Every row in this file is ready to import.',
    noRows: 'No rows to show',
    loadFailed: "We couldn't load this upload.",
    expiredTitle: 'This upload has expired',
    expiredBody: `We keep an unfinished upload for ${Math.round(SESSION_TTL_HOURS / 24)} days. Upload the file again and we'll pick it up from there.`,
    /**
     * FAILED is a commit that blew up, not a file we could not open.
     *
     * A file we cannot read is refused at upload with a 400 and never gets this far — there is no
     * import to come back to and no URL to land on. The only way to reach FAILED is for a file
     * that had already validated clean to fail part-way through the write and roll back, which is
     * exactly why the previous wording was harmful: it sent someone whose file was fine off to
     * re-save it in Excel, and said nothing about the thing they actually need to know, which is
     * that their catalog and their stock are untouched.
     *
     * Phrased to match the sentence the server sends on the same failure, so the toast and the
     * screen do not tell the same story two ways.
     */
    failedTitle: 'This import could not be completed',
    failedBody:
      'Something went wrong part-way through, so nothing was imported and nothing in your catalog or your stock was changed. Upload the file again to try once more.',
    parsing: 'Reading your file…',
    parsingBody: 'This usually takes a few seconds.',

    /**
     * The grid's own furniture. It used to be inline in `ReviewGrid`, which put the copy most
     * likely to be tweaked in a hurry outside the reach of `assertCopyIsClean()` below.
     */
    gridCaption:
      'Rows from your file. Each cell can be edited — press Enter to open a cell, Escape to leave it.',
    gridRegion: 'Your rows — scroll sideways for the rest of the columns',
    colRow: 'Row',
    colStatus: 'Status',
    statusValid: 'Ready',
    statusCommitted: 'Imported',
    statusError: 'Needs attention',
    statusWarning: 'Worth a look',
    statusSkipped: 'Left out',
  },

  resolve: {
    vendorHeading: (rows: number) =>
      `${pluralRows(rows)} ${rowsVerb(rows, 'names', 'name')} a supplier we don't recognise`,
    unitHeading: (rows: number) =>
      `${pluralRows(rows)} ${rowsVerb(rows, 'uses', 'use')} a unit we don't recognise`,
    productHeading: (rows: number) =>
      `${pluralRows(rows)} ${rowsVerb(rows, 'names', 'name')} a product you don't stock yet`,
    usedOn: (rows: number) => `used on ${pluralRows(rows)}`,
    choose: 'Choose…',
    chooseLabel: (value: string) => `What "${value}" should be`,
    // No leading "+" — the button draws its own plus icon, and two of them read as a typo.
    createNew: 'Create new',
    createNewVendor: 'Add as a new supplier',
    createNewProduct: 'Create this product',
    baseUnitLabel: (name: string) => `What is ${name} measured in?`,
    baseUnitHint: 'We need this before we can record a delivery of it.',
    baseUnitMissing: 'Pick what it is measured in first',
    leaveBlank: 'Leave blank',
    skipRows: (rows: number) =>
      rows === 1 ? 'Leave that row out' : `Leave those ${pluralRows(rows)} out`,
    apply: (rows: number) => `Apply to ${pluralRows(rows)}`,
    applyAll: (choices: number) => `Apply all ${formatCount(choices)} choices`,
    applyingProgress: (done: number, total: number) =>
      `Applying… ${formatCount(done)} of ${formatCount(total)}`,
    /**
     * Only the cards on screen are counted by "Apply all", so this says how many are not — a
     * button that silently accepted 380 unseen fuzzy matches would be the opposite of the
     * "one decision, forty-seven rows" idea it is meant to serve.
     */
    showMore: (hidden: number) =>
      hidden === 1 ? 'Show 1 more' : `Show the other ${formatCount(hidden)}`,
    showFewer: 'Show fewer',
    hiddenNote: (hidden: number) =>
      `${formatCount(hidden)} more are hidden for now. "Apply all" only covers the ones on screen.`,
    resolved: 'Sorted',
    resolvedAs: (label: string) => `Using ${label}`,
    applyFailed: "That didn't stick. Nothing was changed — try again.",
    /** The one-line promise under each group heading. Lives here so the guard below sees it. */
    onceForAll: 'Answer once and we will apply it to every row that used it.',
    appliedToast: (rows: number) => `${pluralRows(rows)} updated.`,
    matchHint: (hint: string | null) => hint ?? '',
  },

  mapping: {
    title: 'Which column is which?',
    body: "This file doesn't use our template, so tell us what each column holds. We've guessed where we could.",
    ignore: "Don't import this column",
    missing: (labels: string) => `We still need a column for ${labels}.`,
    save: 'Use these columns',
    saving: 'Rechecking every row…',
    /**
     * Two of the file's columns pointed at the same field. Left unsaid, one of them silently
     * wins on the server and the user never learns which — so it blocks, and names the field.
     */
    duplicate: (labels: string) =>
      `More than one of your columns is set to ${labels}. Pick one for each, and set the others to "Don't import this column".`,
    unmapped: 'Not matched',
    yourColumn: 'Your column',
    ourField: 'What it holds',
    saveFailed: "We couldn't apply that. Nothing changed.",
  },

  confirm: {
    back: 'Back',
    blockedTitle: 'Not ready yet',
    loadFailed: "We couldn't work out what this import would do.",
    working: 'Importing…',
    failed: 'The import did not run. Nothing was changed.',
    reassure: 'Nothing has changed in your catalog yet.',
    reassureStockIn: 'No stock has been recorded yet.',
  },

  result: {
    viewProducts: 'View products',
    viewStock: 'View products',
    downloadReport: 'Download report',
    reportHint: 'A spreadsheet of every row and what happened to it.',
    undo: 'Undo this import',
    undoTitle: 'Undo this import?',
    undoBody:
      'We will put everything back the way it was before this file ran. Anything you have changed by hand since then stays as it is.',
    undoConfirm: 'Yes, undo it',
    undoneToast: 'Undone. Everything is back the way it was.',
    undoFailed: "We couldn't undo that. Nothing was changed.",
    undoBlockedTitle: "This one can't be undone",
    undoBlockedRow: (excelRow: number) => `Row ${excelRow}`,
    importAnother: 'Import another file',
    notUndoable: 'This import can no longer be undone.',
  },

  steps: {
    progressLabel: 'Import progress',
    upload: 'Upload',
    review: 'Review',
    confirm: 'Confirm',
  },

  common: {
    retry: 'Try again',
    back: 'Back',
    loading: 'Loading',
  },
} as const

/**
 * Development-time guard for spec §9.6 / contract §8.6: the four words must appear nowhere in
 * the UI. Copy lives here, so checking here catches it. Functions are called with plausible
 * arguments so their output is checked too, not just the literals.
 */
const BANNED = ['escrow', 'session', 'staging', 'batch'] as const

function walk(value: unknown, path: string, report: (where: string, text: string) => void): void {
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    const hit = BANNED.find((word) => lower.includes(word))
    if (hit) report(path, value)
    return
  }
  if (typeof value === 'function') {
    try {
      walk((value as (...args: unknown[]) => unknown)(3, 'Kilogram (kg)'), path, report)
    } catch {
      /* a function with a different arity — its literals are checked by its neighbours */
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, report))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, report)
  }
}

export function assertCopyIsClean(): string[] {
  const problems: string[] = []
  walk(copy, 'copy', (where, text) => problems.push(`${where}: ${text}`))
  walk(MODE_OPTIONS, 'MODE_OPTIONS', (where, text) => problems.push(`${where}: ${text}`))
  walk(KIND_COPY, 'KIND_COPY', (where, text) => problems.push(`${where}: ${text}`))
  return problems
}

if (import.meta.env.DEV) {
  const problems = assertCopyIsClean()
  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[imports/copy] banned words reached user-facing copy:\n' + problems.join('\n'))
  }
}
