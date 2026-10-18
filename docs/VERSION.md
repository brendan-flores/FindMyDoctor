# FindMyDoctor Application Version

## Current Version

The current version is maintained in `/docs/CURRENT_VERSION.md`. This file (`VERSION.md`) contains versioning rules and the complete version history.

**Important:** When implementing changes, always read `/docs/CURRENT_VERSION.md` first to determine the current version. After implementing changes, evaluate whether a version update is warranted based on the scope and impact. If warranted, propose the new version to the user for approval before updating either file.

---

## Versioning Rules

The system uses the `00.00` version format to remain consistent with the SRS, SDD, and SPMP documents.

### Version Format: `XX.YY`

- **Major Version (`XX.00`):** Increment the major version (reset minor to `00`) for:
  - Significant system revisions
  - Major architectural changes
  - Changes that substantially affect the overall system
  - Breaking changes that require migration or data schema changes
  - Removal of major features

- **Minor Version (`00.XX`):** Increment the minor version for:
  - New features that do not break existing functionality
  - Bug fixes and patches
  - Enhancements and improvements
  - UI/UX improvements
  - Documentation updates
  - Performance optimizations
  - Non-breaking API changes

### Decision Criteria

When evaluating whether to increment the major or minor version, consider:

**Warrants Major Version Increment:**
- Database schema changes that require migration
- API endpoint changes that break existing clients
- Removal of core features or functionality
- Changes to authentication/authorization flows
- Significant changes to business logic
- Architectural restructuring

**Warrants Minor Version Increment:**
- New features added without breaking existing ones
- Bug fixes in existing functionality
- UI/UX improvements
- Performance optimizations
- Documentation updates
- Configuration changes
- API additions (new endpoints, new optional parameters)

### Examples

- `01.00` — Initial system version
- `01.01` — Bug fixes and minor improvements
- `01.02` — Additional features and enhancements
- `02.00` — Major system revision or breaking changes

**Note:** These are guidelines. Version changes must be based on the actual scope and impact of the changes, not simply the number of files modified.

---

## Version History

The complete version history is maintained in `/docs/VERSION_HISTORY.md`. Use that file to view all past versions and their changes.

---

## Version History Template

When adding a new version to VERSION_HISTORY.md, document the following information:

```
### [VERSION_NUMBER] ([Release Date or "In Progress"])

**Purpose:** Brief description of the release's primary goal

**Significant Features:**
- Feature 1: Description
- Feature 2: Description

**Improvements:**
- Improvement 1: Description
- Improvement 2: Description

**Bug Fixes:**
- Bug 1: Description
- Bug 2: Description

**Removed/Modified Functionality:**
- Change 1: Description
- Change 2: Description

**Breaking Changes:** (if any)
- Breaking change 1: Description
- Breaking change 2: Description

**Documentation Updates:**
- Updated file 1: Description
- Updated file 2: Description
```
