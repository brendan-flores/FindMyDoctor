# Git Commit Grouping Instructions — GitHub Desktop

Review all current uncommitted changes in the repository and organize them into logical commit groups.

These instructions are intended for **GitHub Desktop / the GitHub app**, where files are selected using **checkboxes** before committing.

## Rules

1. Review **all current Git changes** before creating commit recommendations.

2. Group files that belong to the same:
   - feature
   - bug fix
   - refactor
   - documentation update
   - styling/formatting change
   - maintenance/configuration task

3. Do **not** group unrelated changes into the same commit.

4. If a change does not logically belong to another group, make it a separate solo commit.

5. For every commit group, clearly identify:
   - **CHECKED** — files that MUST be checked in GitHub Desktop for this commit.
   - **UNCHECKED** — files that MUST remain unchecked and must NOT be included in this commit.
   - The exact commit message to enter in GitHub Desktop.
   - A short explanation of why those files belong together.

6. The file-selection instructions must be explicit. Do not simply say "select the relevant files."

7. Always show the **full repository-relative path exactly as it appears in GitHub Desktop**, including the directory.

   For example, do NOT write:
   - `GitHub_Desktop_Commit_Grouping_Instructions.md`

   Write:
   - `docs/GitHub_Desktop_Commit_Grouping_Instructions.md`

   The path must include every parent directory shown by GitHub Desktop.

8. All commit titles MUST follow this exact format:

   `[Flores][type] title`

   Examples:
   - `[Flores][feat] add admin dashboard`
   - `[Flores][fix] resolve appointment status update`
   - `[Flores][refactor] reorganize doctor API routes`
   - `[Flores][docs] update database documentation`

9. Use an appropriate commit type:
   - `feat` — new functionality
   - `fix` — bug fix
   - `refactor` — code restructuring without changing behavior
   - `docs` — documentation changes
   - `style` — styling or formatting changes
   - `chore` — maintenance or configuration changes

10. Commit titles must be specific and accurately describe the actual changes.

11. Avoid vague commit titles such as:
   - `Update files`
   - `Fix changes`
   - `Changes`
   - `Update project`

12. Do not assume a file belongs in a commit merely because it was modified at the same time. Group changes based on their actual purpose.

13. Do not stage, commit, push, modify, or delete anything.

14. Only analyze the current changes and provide recommendations for GitHub Desktop.

## GitHub Desktop Workflow

For each recommended commit:

1. Open the **Changes** tab in GitHub Desktop.
2. Review the files listed under **Changes**.
3. **CHECK** only the files listed under **CHECKED**.
4. **UNCHECK** every file listed under **UNCHECKED**.
5. Verify that the selected files match the recommended commit group.
6. Enter the provided commit message.
7. Commit only after verifying the file selection.

> **Important:** The checked/unchecked lists are per commit. A file that is unchecked for one commit may be checked for a later commit.

## Required Output Format

### Commit 1 — [Short Purpose]

**Files to CHECK:**

- [x] `docs/path/to/file1`
- [x] `src/path/to/file2`

**Files to UNCHECK:**

- [ ] `src/path/to/unrelated-file`
- [ ] `docs/path/to/another-change`

**Why these files belong together:**

Briefly explain the common purpose of the checked files.

**GitHub Desktop commit message:**

```text
[Flores][type] descriptive commit title
```

---

### Commit 2 — [Short Purpose]

**Files to CHECK:**

- [x] `src/path/to/file3`

**Files to UNCHECK:**

- [ ] `docs/path/to/file1`
- [ ] `src/path/to/file2`
- [ ] `docs/path/to/unrelated-file`

**Why these files belong together:**

Briefly explain the purpose of this separate commit.

**GitHub Desktop commit message:**

```text
[Flores][type] descriptive commit title
```

## Important File-Selection Rule

If there are **N changed files**, every commit recommendation should account for all N files.

Do not leave the user guessing which files should remain unchecked.

For each commit, explicitly show:

```text
CHECK:
full repository-relative path(s) belonging to this commit

UNCHECK:
full repository-relative path(s) for all other changed files
```

If a commit contains only one file, clearly identify it as a **solo commit**.

## Example

Suppose the current changes are:

```text
mobile/lib/pages/login_page.dart
mobile/lib/widgets/login_form.dart
mobile/lib/pages/profile_page.dart
docs/README.md
```

### Commit 1 — Login Feature

**Files to CHECK:**

- [x] `mobile/lib/pages/login_page.dart`
- [x] `mobile/lib/widgets/login_form.dart`

**Files to UNCHECK:**

- [ ] `mobile/lib/pages/profile_page.dart`
- [ ] `docs/README.md`

**Why these files belong together:**

Both files implement the login feature and should be committed together.

**GitHub Desktop commit message:**

```text
[Flores][feat] add login form and login page
```

### Commit 2 — Profile Page

**Files to CHECK:**

- [x] `mobile/lib/pages/profile_page.dart`

**Files to UNCHECK:**

- [ ] `mobile/lib/pages/login_page.dart`
- [ ] `mobile/lib/widgets/login_form.dart`
- [ ] `docs/README.md`

**Why this is separate:**

The profile page is unrelated to the login feature.

**GitHub Desktop commit message:**

```text
[Flores][feat] add profile page
```

### Commit 3 — Documentation

**Files to CHECK:**

- [x] `docs/README.md`

**Files to UNCHECK:**

- [ ] `mobile/lib/pages/login_page.dart`
- [ ] `mobile/lib/widgets/login_form.dart`
- [ ] `mobile/lib/pages/profile_page.dart`

**Why this is separate:**

The README is documentation and is unrelated to the application feature changes.

**GitHub Desktop commit message:**

```text
[Flores][docs] update project documentation
```

## Exact Path Requirement

When analyzing a newly created or modified documentation file, always preserve its **full repository-relative path**.

For example, if GitHub Desktop shows:

```text
☑ docs/GitHub_Desktop_Commit_Grouping_Instructions.md
```

the recommendation MUST say:

```text
**Files to CHECK:**

- [x] `docs/GitHub_Desktop_Commit_Grouping_Instructions.md`
```

Never shorten it to:

```text
GitHub_Desktop_Commit_Grouping_Instructions.md
```

The directory is part of the file path and must be included.

## Final Verification

Before recommending each commit, verify:

- [ ] The checked files belong to one logical change.
- [ ] Unrelated files are explicitly marked unchecked.
- [ ] No file is accidentally included in multiple commits unless its changes genuinely represent separate logical changes and GitHub Desktop can safely handle that selection.
- [ ] The commit type matches the actual change.
- [ ] The title follows `[Flores][type] title`.
- [ ] The title is specific and descriptive.
- [ ] No Git operation is performed by these instructions.
