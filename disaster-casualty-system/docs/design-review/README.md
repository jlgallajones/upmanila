# SCRIBER design review

Prepared 22 October 2026 for the existing Disaster Casualty Management System in this repository. Architecture status: **for review / approval pending**.

## Open the deliverables

- Open `index.html` in a current browser. It works from disk without installation, network access, a database connection, or an API server.
- Open `diagrams/SCRIBER-diagrams.pdf` for the three architecture/database diagrams and `wireframes/SCRIBER-wireframes.pdf` for the two web/mobile wireframe sheets. They are separate documents. The full review and sign-off report remains in the repository as `SCRIBER-design-review.pdf`.
- The `diagrams/` folder contains three separate SVG diagrams and two Mermaid sources. The `wireframes/` folder contains separate web and mobile SVG wireframes. The downloadable ZIP retains these folders and omits the combined report.
- Use the Database tab to search 32 source tables, expand their declared fields, and inspect exact DDL excerpts with source filenames. The same catalog is provided as JSON.
- `schema-review.sql` contains read-only catalog queries for the intended PostgreSQL database. It does not apply changes.

If local file access is restricted by your browser, serve this folder:

```powershell
python -m http.server 5188 --bind 127.0.0.1 --directory disaster-casualty-system/docs/design-review
```

Then open `http://127.0.0.1:5188` from this computer. Run the command from the repository root.

## Walkthrough

1. Open **Web & mobile**, choose **Mobile app**, then **Add casualty**.
2. Select an incident and enter a synthetic name or unidentified label. Continue through identity, assessment, and review.
3. Enable **Offline** and save the report. It appears in **Records** as Pending, without appearing in the web register.
4. Reconnect by disabling Offline, then choose **Sync all**. The report becomes submitted and appears in the web register.
5. Choose **Web dashboard > Verification**, open the report, and approve it or return it with a required correction reason.
6. Reopen the mobile Records view to see the shared status and history. Try record search, incident and status filters, and **Wireframe view**.
7. **Reset demo** restores the initial records. Reloading the page also clears all changes.

All records, identities, incidents, facility capacity figures, and locations in this prototype are synthetic. Connection state, synchronization, authentication context, and review actions are simulations in browser memory. The prototype is a frontend design artifact; the existing production application continues to own real authentication, API integration, photo capture, storage, exports, and detailed role-specific clinical forms. Assessment colors are selected by the user and do not provide clinical recommendations. A return-for-correction decision displays its reason; editing and resubmission are outside this prototype's scope.

## Architecture and schema basis

The review uses these source areas:

- `api/src/app.ts`: mounted Express routes, request IDs and error handling.
- `api/src/middleware/auth.ts`: bearer-token validation, active-user profile and supported roles.
- `api/src/controllers/casualty.controller.ts`: submission identity checks, report creation and transaction calls.
- `website/app.js` and `website/styles.css`: dashboard responsibilities, realtime subscriptions and the cyan / neutral design palette.
- `mobile/src/offline/casualtyQueue.ts`: owner-associated local queue, attachment payloads, retry states and synchronization.
- `UP-Manila-DB.sql` and all `api/sql/*.sql`: declared entities, fields, foreign keys and constraints.
- `netlify.toml` and `render.yaml`: repository hosting configuration. No live deployment was inspected.

The schema catalog deliberately stores the union of CREATE TABLE and ADD COLUMN declarations. It preserves alternatives and their provenance; it does not resolve migration order, removals, renames, constraint changes, enum changes or deployment state. It is not an executable migration or a live database dump. Root enum declarations are valid; review the original role model against subsequent role migrations and middleware. Duplicate table declarations, per-incident victim-code uniqueness, retry constraints, API scope, realtime policies and real-device offline recovery need reviewer confirmation.

The core ERD shows selected relationships with key fields. The extension map groups additional declared entities. Optionality and uniqueness labels reflect source declarations, not verified deployed constraints. The PDF and HTML include a sign-off record; neither marks the design approved.

## Rebuild and validation

From the repository root:

```powershell
python disaster-casualty-system/docs/design-review/generate_review.py
node --check disaster-casualty-system/docs/design-review/review.js
node disaster-casualty-system/docs/design-review/verify-workflow.cjs
python disaster-casualty-system/docs/design-review/verify_review.py
```

Generation uses Python `reportlab`. PDF verification uses `pdfplumber`, `pypdf`, `pypdfium2`, and Pillow. The runtime prototype has no dependencies. Verification renders every PDF page into `disaster-casualty-system/tmp/design-review/`, checks PDF text bounds, asset references, SVG XML, schema provenance, and the cross-device workflow model. Browser-based UI interaction and actual narrow-screen rendering were not verified because no browser surface was available in this session.

No existing application source, production data, environment configuration or database schema was changed. Existing unrelated working-tree changes were preserved.
