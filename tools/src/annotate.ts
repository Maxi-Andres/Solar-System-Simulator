/**
 * GitHub Actions annotations: shown on the run's page and through the API without signing
 * in, where a job's log is not. Printed only on Actions; elsewhere the log line beside each
 * one says the same.
 */

/** The message as a workflow command takes it: %, CR and LF escaped, cut to a size the page shows. */
export function escapeAnnotation(message: string): string {
  return message.slice(0, 4000).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/** The title as a workflow command takes it: also no ',' or ':', which end the property. */
function escapeTitle(title: string): string {
  return escapeAnnotation(title.slice(0, 200)).replaceAll(',', '%2C').replaceAll(':', '%3A');
}

export function githubAnnotation(level: 'error' | 'warning', title: string, message: string): void {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::${level} title=${escapeTitle(title)}::${escapeAnnotation(message)}`);
  }
}

export function githubWarning(title: string, message: string): void {
  githubAnnotation('warning', title, message);
}
