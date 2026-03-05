# Skills Research Report - Portability & Marketplaces

**Research Date:** 2026-02-28  
**Status:** Complete

---

## Executive Summary

### Key Findings

| Question | Answer |
|----------|--------|
| **Can Claude/ChatGPT skills be transferred?** | ✅ **YES** - SKILL.md is an open standard |
| **Are there existing skills marketplaces?** | ✅ **YES** - 96,000+ skills available |
| **Do I need to build skills from scratch?** | ❌ **NO** - Download and adapt existing |
| **Is the format standardized?** | ✅ **YES** - Agent Skills is an open standard |
| **Which tools support SKILL.md?** | ✅ Claude, Cursor, Copilot, Codex, Continue, Windsurf, Cline, Cody, Amp |

---

## 1. SKILL.md Format - Open Standard

### What Is It?

**Agent Skills** is an **open standard** for packaging reusable AI agent capabilities as plain Markdown files with YAML frontmatter.

**Developed by:** Anthropic (October 2025)  
**Published as:** Open standard (December 2025)  
**Governed by:** Agentic AI Foundation (Linux Foundation)  
**Members:** AWS, Anthropic, Google, Microsoft, OpenAI, Block

### Format Structure

```markdown
---
name: angular-component
description: Generates Angular standalone components with signals
metadata:
  version: "1.0"
  author: Your Name
  license: MIT
---

# Skill Instructions

When the user asks to create a component:

1. Use standalone components
2. Use signal inputs/outputs
3. Use OnPush change detection
4. Use inject() for dependencies

## Example

\`\`\`typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyComponent {
  readonly input = input.required<string>();
}
\`\`\`
```

### Directory Structure

```
skill-name/
├── SKILL.md                 # Required - main instructions
├── scripts/                 # Optional - helper scripts
├── references/              # Optional - additional docs
├── assets/                  # Optional - templates, resources
└── plugin.json              # Optional - plugin metadata
```

---

## 2. Tool Compatibility

### ✅ Compatible AI Tools

| Tool | Support Level | Notes |
|------|--------------|-------|
| **Claude Code** | ✅ Native | Original platform |
| **Cursor** | ✅ Native | `.cursor/rules/` directory |
| **GitHub Copilot** | ✅ Native | `.github/skills/` directory |
| **OpenAI Codex** | ✅ Native | `.agents/skills/` directory |
| **Continue.dev** | ✅ Native | Via `rules` CLI |
| **Windsurf** | ✅ Native | Compatible |
| **Cline** | ✅ Native | Compatible |
| **Cody** | ✅ Native | Compatible |
| **Amp** | ✅ Native | Compatible |
| **Your App (OpenExcel)** | ⚠️ **Partial** | Uses SKILL.md format ✅ |

### Portability

**YES - Skills ARE transferable between tools!**

From research:
> *"Agent Skills is designed as an open, cross-platform standard specifically for portability"*
> *"Write once, use everywhere is an explicit design goal"*
> *"Skills are plain text files (Markdown + YAML) that live outside code"*

**The only difference is the directory location:**
- Claude Code: `~/.claude/skills/`
- Cursor: `.cursor/rules/`
- Copilot: `.github/skills/`
- Codex: `.agents/skills/`
- Your App: IndexedDB → VFS `/home/skills/`

---

## 3. Existing Skills Marketplaces

### Major Marketplaces (96,000+ Skills)

| Marketplace | Skills | Format | Download |
|-------------|--------|--------|----------|
| **SkillsMP** | 96,751+ | SKILL.md | Free |
| **LobeHub** | 5,000+ | SKILL.md | Free |
| **mdskills.ai** | 2,000+ | SKILL.md | Free |
| **cc-skills (GitHub)** | 20 plugins | SKILL.md | Free |
| **claude-code-skills** | 38 skills | SKILL.md | Free |
| **continuedev/rules** | 100+ | Markdown | Free |

### Example Skills Available

#### Development (20+)
- `adr` - Architecture Decision Records
- `plugin-dev` - Skill creation & validation
- `github-ops` - GitHub workflow automation
- `itp` - 4-phase development workflow
- `skill-creator` - Create your own skills

#### DevOps (15+)
- `devops-tools` - Docker, Kubernetes, CI/CD
- `cloudflare-troubleshooting` - Debug CF issues
- `git-town-workflow` - Git workflow enforcement

#### Documentation (9+)
- `doc-tools` - Markdown, LaTeX, Pandoc
- `docs-cleaner` - Consolidate documentation
- `ascii-diagrams` - Generate ASCII art

#### Quality (6+)
- `qa-expert` - QA testing infrastructure
- `link-tools` - Link validation
- `code-clone-detection` - Find duplicate code

#### Productivity (5+)
- `meeting-minutes-taker` - Generate meeting notes
- `notion-api` - Notion integration
- `prompt-optimizer` - EARS methodology

#### Specialized
- `mql5` - Trading indicators
- `quant-research` - Quantitative analysis
- `iOS-APP-developer` - Xcode/SwiftUI
- `ppt-creator` - PowerPoint generation
- `youtube-downloader` - yt-dlp integration

---

## 4. How to Download Existing Skills

### Method 1: Direct Download (Easiest)

```bash
# Clone a skills repository
git clone https://github.com/daymade/claude-code-skills.git

# Copy skills to your app's directory
cp -r claude-code-skills/skills/* /path/to/your/skills/
```

### Method 2: CLI Tools

```bash
# Using skills CLI
npx skills add daymade/claude-code-skills

# Using rules CLI (Continue.dev)
npm i -g rules-cli
rules add starter/nextjs-rules
rules render cursor  # Converts to Cursor format
```

### Method 3: From Marketplaces

```bash
# LobeHub
npx -y @lobehub/market-cli skills install openai-docs

# SkillsMP
# Visit https://skillsmp.com and download ZIP
```

### Method 4: Direct URL

```bash
# Download specific skill
curl -O https://raw.githubusercontent.com/daymade/claude-code-skills/main/skills/github-ops/SKILL.md
```

---

## 5. Adapting Skills for Your App

### What Works Out-of-the-Box ✅

| Feature | Compatible | Notes |
|---------|------------|-------|
| **SKILL.md format** | ✅ Yes | Standard YAML frontmatter |
| **Markdown instructions** | ✅ Yes | Plain text |
| **References folder** | ✅ Yes | Additional docs |
| **Assets folder** | ✅ Yes | Templates, examples |

### What Needs Adaptation ⚠️

| Feature | Issue | Solution |
|---------|-------|----------|
| **Tool-specific commands** | Claude-specific bash | Generalize for Excel context |
| **File paths** | `~/.claude/skills/` | Use VFS paths `/home/skills/` |
| **Platform references** | "In Claude..." | Change to "In OpenExcel..." |
| **Excel-specific skills** | N/A | Create new (your advantage!) |

### Adaptation Example

**Original (Claude Code):**
```markdown
---
name: github-pr
description: Creates GitHub pull requests
---

# GitHub PR Creator

When user asks to create a PR:

1. Run: `gh pr create --title "..."`
2. Verify with: `gh pr view`
```

**Adapted (OpenExcel):**
```markdown
---
name: excel-data-analysis
description: Analyzes Excel data and creates reports
---

# Excel Data Analysis

When user asks to analyze data:

1. Use `get_cell_ranges` to read data
2. Use `get_range_as_csv` for analysis
3. Use `set_cell_range` to write results
4. Use `modify_object` to create charts
```

---

## 6. Your Competitive Advantage

### What Others Don't Have

| Feature | Claude | Cursor | Copilot | **Your App** |
|---------|--------|--------|---------|--------------|
| **Excel Integration** | ❌ No | ❌ No | ⚠️ Limited | ✅ **Full** |
| **BYOK Model** | ⚠️ Limited | ❌ No | ❌ No | ✅ **Yes** |
| **Open Source** | ❌ No | ❌ No | ❌ No | ✅ **Yes** |
| **Skills Marketplace** | ✅ Yes | ✅ Yes | ❌ No | 📋 **Planned** |
| **Excel-Specific Skills** | ❌ No | ❌ No | ❌ No | ✅ **Unique** |

### Opportunity: Excel-Specific Skills

**No one has Excel-specific AI skills!** This is your differentiator.

**Potential Skills:**
| Skill | Use Case | Value |
|-------|----------|-------|
| `financial-close` | Month-end close automation | 20hrs/month saved |
| `sox-compliance` | SOX audit trail validation | Compliance |
| `data-reconciliation` | Compare sheets, find mismatches | 5hrs/week |
| `pivot-table-expert` | Create complex pivots | Skill multiplier |
| `vba-to-formulas` | Convert VBA to Excel formulas | Legacy modernization |
| `power-query-expert` | Power Query transformations | Data prep |
| `dashboard-designer` | Create executive dashboards | Visual reporting |
| `audit-trail-generator` | Generate audit documentation | Compliance |

---

## 7. Recommended Strategy

### Phase 1: Import Existing Skills (Week 1)
**Goal:** Populate marketplace quickly

1. **Download 10-20 generic skills** from GitHub marketplaces
2. **Adapt for Excel context** (change tool references)
3. **Test in your app** (ensure they work with Excel tools)
4. **Package as "Starter Pack"** for users

**Skills to Import:**
- `skill-creator` → `excel-skill-creator`
- `prompt-optimizer` → `excel-prompt-optimizer`
- `markdown-tools` → Keep as-is
- `docs-cleaner` → Keep as-is

### Phase 2: Create Excel-Specific Skills (Weeks 2-3)
**Goal:** Unique value proposition

1. **Build 5-10 Excel-specific skills** (see list above)
2. **Test with real audit workflows**
3. **Document use cases**
4. **Feature in marketplace**

### Phase 3: Community Marketplace (Weeks 4-6)
**Goal:** Ecosystem growth

1. **Launch marketplace UI** (browse, search, install)
2. **Allow user submissions**
3. **Curate quality skills**
4. **Feature "Skill of the Week"**

---

## 8. Technical Implementation

### Import Script (Pseudo-code)

```typescript
// Download skills from GitHub
async function importSkillsFromGitHub(repo: string) {
  const skills = await fetchGitHubRepo(repo);
  
  for (const skill of skills) {
    // Adapt SKILL.md for Excel context
    const adapted = adaptForExcel(skill);
    
    // Save to IndexedDB
    await saveSkillFiles(adapted.name, adapted.files);
    
    // Sync to VFS
    await syncSkillsToVfs();
  }
}

// Adapt tool references
function adaptForExcel(skill: Skill): Skill {
  let content = skill.content;
  
  // Replace Claude-specific references
  content = content.replace(/Claude/g, 'OpenExcel');
  content = content.replace(/gh pr create/g, 'Use GitHub API');
  content = content.replace(/~\/\.claude/g, '/home/skills');
  
  // Add Excel tool references
  content += '\n\n## Excel Tools Available\n';
  content += '- get_cell_ranges\n';
  content += '- set_cell_range\n';
  content += '- modify_object\n';
  
  return { ...skill, content };
}
```

### Marketplace Database Schema

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT,  -- development, finance, audit, productivity
  source TEXT,    -- 'imported', 'community', 'official'
  original_repo TEXT,  -- GitHub repo if imported
  version TEXT DEFAULT '1.0',
  downloads INTEGER DEFAULT 0,
  rating DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skill_files (
  skill_id UUID REFERENCES skills(id),
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (skill_id, path)
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_source ON skills(source);
```

---

## 9. Legal Considerations

### Licensing

Most skills are **open source**:

| License | Usage | Attribution Required |
|---------|-------|---------------------|
| **MIT** | ✅ Commercial use | Yes |
| **Apache 2.0** | ✅ Commercial use | Yes |
| **GPL** | ⚠️ Viral (use carefully) | Yes |
| **CC-BY** | ✅ Commercial use | Yes |

**Best Practice:**
- ✅ Import MIT/Apache licensed skills
- ✅ Give credit to original authors
- ✅ Link back to original repo
- ❌ Avoid GPL unless open-sourcing your skills

### Example Attribution

```markdown
---
name: excel-data-analysis
description: Analyzes Excel data
original_author: @daymade
original_repo: https://github.com/daymade/claude-code-skills
license: MIT
adapted_for: OpenExcel
---

*Adapted from [Claude Code Skills](https://github.com/daymade/claude-code-skills)*
```

---

## 10. Next Steps

### Immediate (This Week)
1. [ ] Clone `daymade/claude-code-skills` repo
2. [ ] Download 10 generic skills
3. [ ] Adapt for Excel context
4. [ ] Test in your app
5. [ ] Document the process

### Short-term (This Month)
1. [ ] Create 5 Excel-specific skills
2. [ ] Build marketplace UI (browse, search, install)
3. [ ] Launch with 20+ skills
4. [ ] Write documentation

### Long-term (This Quarter)
1. [ ] Community submissions
2. [ ] Rating & review system
3. [ ] Featured skills
4. [ ] 100+ skills in marketplace

---

## 11. Resources

### Marketplaces
- **SkillsMP:** https://skillsmp.com (96,751+ skills)
- **LobeHub:** https://lobehub.com/skills (5,000+ skills)
- **mdskills.ai:** https://mdskills.ai (2,000+ skills)

### GitHub Repos
- **daymade/claude-code-skills:** https://github.com/daymade/claude-code-skills (38 skills)
- **terrylica/cc-skills:** https://github.com/terrylica/cc-skills (20 plugins)
- **continuedev/rules:** https://github.com/continuedev/rules (100+ rules)

### Documentation
- **Agent Skills Spec:** https://lm-kit.com/blog/agent-skills-explained/
- **Continue Rules:** https://docs.continue.dev/customize/rules
- **Cursor Rules:** https://cursorrules.org/

### Tools
- **rules CLI:** `npm i -g rules-cli`
- **skills CLI:** `npx skills add <repo>`

---

## Conclusion

### Can you get skills online? **YES!**
- 96,000+ skills available
- Free to download
- Open standard format

### Do you need to build from scratch? **NO!**
- Import existing skills
- Adapt for Excel context
- Focus on Excel-specific skills (your differentiator)

### Is this a competitive advantage? **YES!**
- No one has Excel-specific AI skills
- You can be the "Excel AI Skills Marketplace"
- First-mover advantage in audit/accounting niche

---

*Research compiled: 2026-02-28*  
*Sources: GitHub, LobeHub, SkillsMP, mdskills.ai, LM-Kit, Continue.dev*
