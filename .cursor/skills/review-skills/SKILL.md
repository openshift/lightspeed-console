---
name: review-skills
description: >-
  Review project AI skills for duplication, stale references, mistakes, and
  structural issues. Use when the user asks to review skills, audit skills,
  check for duplicate skills, or verify skill quality.
---

# Review Skills

Read every `SKILL.md` under `.cursor/skills/` (and any files they reference).
Check for:

1. **Structural issues** — missing/malformed frontmatter, referenced supporting
   files that don't exist.
2. **Duplication** — skills that overlap significantly or could be merged.
3. **Stale references** — file paths, npm scripts, branch names, or source
   symbols that no longer exist in the repo. Verify each against the actual
   codebase.
4. **Mistakes** — typos, incorrect commands, contradictions between skills.
5. **Consistency** — shared steps (e.g. lint/i18n/build) described differently,
   inconsistent terminology for the same concept.

## Report

Group findings by skill. Use 🔴 error / 🟡 warning / 🟢 suggestion. Omit
clean skills. End with: `Reviewed N skills. M have issues.`
