/** Provider keys can live in query parameters, URL paths or user-info. Keep the
 * build guard and HTTP/WebSocket redaction aligned, including encoded spellings. */
export function privateRpcStrings(urls: readonly (string | undefined)[]) {
  const secrets = new Set<string>();
  for (const value of urls) {
    if (!value) continue;
    secrets.add(value);
    try {
      const url = new URL(value);
      for (const part of [
        ...url.searchParams.values(),
        ...url.pathname.split('/'),
        url.username,
        url.password,
      ]) {
        if (part.length >= 8) secrets.add(part);
        try {
          const decoded = decodeURIComponent(part);
          if (decoded.length >= 8) secrets.add(decoded);
        } catch {
          // A literal percent sign is valid in a credential; retain the raw form.
        }
      }
    } catch {
      // Configuration validation fails closed separately; still guard the raw value.
    }
  }
  return [
    ...new Set(
      [...secrets].flatMap((value) => [
        value,
        encodeURIComponent(value),
        JSON.stringify(value).slice(1, -1),
      ]),
    ),
  ].sort((a, b) => b.length - a.length);
}
