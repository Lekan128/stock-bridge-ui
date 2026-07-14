const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}
