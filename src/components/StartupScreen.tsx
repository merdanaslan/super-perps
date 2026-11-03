// Styles and matching pre-JavaScript markup live in index.html so startup never
// depends on downloading the lazy app bundle, its CSS, or a web font.
export function StartupScreen() {
  return (
    <div className="app-startup" role="status" aria-label="Loading super perps">
      <span className="app-startup-emblem" aria-hidden="true">
        <span className="app-startup-half app-startup-half-left" />
        <span className="app-startup-half app-startup-half-right" />
      </span>
      <span className="app-startup-brand" aria-hidden="true">
        super <span>perps</span>
      </span>
      <span className="app-startup-spinner" aria-hidden="true" />
    </div>
  );
}
