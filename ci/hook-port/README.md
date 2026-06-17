# Hook-port tooling
Scripts used to port `data-testid` test hooks from starlabs-cicd templates into starlabs-angular.
- `autoport.cjs <files…>` — auto-extracts the data-testid + a functional anchor ((click)/formControlName/*ngFor…) from each golden line and inserts it where the anchor is unique. Reports OK/AMBIG/MISS/MANUAL.
- `anchor-port.cjs` / `find-replace-port.cjs` — explicit anchor / find→replace entries for text/icon and ambiguous elements.
Source of truth for what to port: `docs/TEST-HOOKS-MANIFEST.md`.
Run the remaining (operator board + text/icon count-spans) during the verified queue-green run so the suite confirms each placement.
