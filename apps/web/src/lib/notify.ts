// App-wide toast messages without React or MUI: code that runs outside a
// component (the axios interceptors in lib/api.ts) raises a message here, and
// NotificationProvider shows it. Keeping this separate stops every importer
// of lib/api.ts from pulling MUI's Snackbar into its bundle.

export type NotifySeverity = 'success' | 'info' | 'warning' | 'error'

type Listener = (message: string, severity: NotifySeverity) => void

let listener: Listener | null = null

export const notify = (message: string, severity: NotifySeverity = 'error') => {
  if (listener) listener(message, severity)
  else console.warn('[notify] no NotificationProvider mounted:', message)
}

/** NotificationProvider registers itself here; pass null to unregister. */
export const setNotifyListener = (next: Listener | null) => {
  listener = next
}
