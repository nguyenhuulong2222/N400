// Parity with the web app's grader: `index.html` line 6056:
//   function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g,''); }
//
// Drops every non-ASCII-alphanumeric character. This is intentionally
// lossy — diacritics, punctuation, whitespace all collapse — so the
// bidirectional substring grader in grade.ts tolerates the typical
// variations in USCIS-accepted answers.

export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
