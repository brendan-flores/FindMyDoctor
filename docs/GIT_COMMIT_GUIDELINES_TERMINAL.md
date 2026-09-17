# Git Commit Grouping Instructions

Review all current uncommitted changes in the repository and organize them into logical commit groups.

## Rules

1. Review all current Git changes before creating recommendations.

2. Group files or changes that belong to the same feature, fix, refactor, or purpose.

3. Do not group unrelated changes into the same commit.

4. If a change does not logically belong to any group, treat it as a separate solo commit.

5. For each group or solo change, provide:
   - The exact `git add` command needed to stage the relevant files.
   - The exact `git commit -m` command with the commit title (ready to copy and paste).
   - A clear and descriptive commit title that accurately describes the actual changes.

6. All commit titles MUST follow this exact format:

   `[Flores][type] title`

   Examples:
   - `[Flores][feat] add admin dashboard`
   - `[Flores][fix] resolve appointment status update`
   - `[Flores][refactor] reorganize doctor API routes`
   - `[Flores][docs] update database documentation`

7. Use an appropriate commit type such as:
   - `feat` — new functionality
   - `fix` — bug fix
   - `refactor` — code restructuring without changing behavior
   - `docs` — documentation changes
   - `style` — styling or formatting changes
   - `chore` — maintenance or configuration changes

8. The title must be specific and accurately describe what the changes actually do. Avoid vague titles such as:
   - `Update files`
   - `Fix changes`
   - `Changes`
   - `Update project`

9. Do not stage, commit, push, modify, or delete anything.

10. Only analyze the current changes and provide the recommended staging commands and commit titles.

## Required Output Format

### Commit 1

```bash
git add path/to/file1 path/to/file2