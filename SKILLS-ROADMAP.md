# OpenExcel Skills System - Analysis & Enterprise Roadmap

## Current State Analysis

### How Skills Work Today

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Uploads   │────▶│  IndexedDB      │────▶│  VFS Mount      │
│  SKILL.md       │     │  (skillFiles)   │     │  /home/skills/  │
│  + files        │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                  ┌──────▼────────┐
                                                  │ System Prompt │
                                                  │ (Injection)   │
                                                  └───────────────┘
```

### Storage Details

**Database:** IndexedDB (`OpenExcelDB_v3`)  
**Table:** `skillFiles`  
**Schema:**
```typescript
interface SkillFileRecord {
  id: string;           // Format: "{skillName}:{path}"
  skillName: string;    // Unique skill identifier
  path: string;         // Relative path within skill
  data: Uint8Array;     // File content
}
```

**Location:** Browser's IndexedDB (client-side only)  
**Persistence:** Survives page refresh, browser restart  
**Scope:** Per-browser, per-user

### Skill Structure

```markdown
---
name: Data Analysis
description: Expert data analysis and visualization
platform: excel
---

# Skill Instructions

When the user asks about data analysis:
1. First read the data using get_cell_ranges
2. Analyze trends and patterns
3. Create visualizations if requested
...
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/storage/db.ts` | IndexedDB operations (saveSkillFiles, loadSkillFiles) |
| `src/lib/skills/index.ts` | Skill management (add, remove, install, sync) |
| `src/lib/vfs/index.ts` | Virtual filesystem mounting |
| `src/taskpane/components/chat/settings-panel.tsx` | Skills UI |

### Current Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Install Skills** | ✅ Working | Via Settings UI |
| **Uninstall Skills** | ✅ Working | Removes from IndexedDB |
| **VFS Mounting** | ✅ Working | `/home/skills/{name}/` |
| **Prompt Injection** | ✅ Working | `<available_skills>` section |
| **Persistence** | ✅ Working | IndexedDB survives refresh |
| **Multiple Files** | ✅ Working | Folders supported |
| **Frontmatter Parsing** | ✅ Working | YAML name/description/platform |

---

## Current Limitations

| Limitation | Impact | Enterprise Blocker |
|------------|--------|-------------------|
| **Local-only storage** | Skills don't sync across devices | ❌ Teams can't share |
| **No versioning** | Can't track changes or rollback | ❌ No audit trail |
| **No permissions** | Anyone can install/uninstall | ❌ Governance required |
| **No discovery** | Manual file selection only | ❌ Can't scale |
| **No analytics** | Don't know which skills are used | ❌ Can't measure ROI |
| **No backup** | Lost if browser data cleared | ❌ Business continuity risk |

---

## Enterprise Skills Roadmap

### Phase 1: Cloud Sync (Weeks 5-6)
**Goal:** Team skill sharing via Supabase

#### Features
| Feature | Description | Effort |
|---------|-------------|--------|
| **Supabase Storage** | Store skills in `skills` table | Medium |
| **Team Library** | Browse/install team skills | Medium |
| **Sync on Login** | Auto-download team skills | Low |
| **Local + Cloud** | Hybrid (local + team skills) | Medium |

#### Database Schema
```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  platform TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  is_public BOOLEAN DEFAULT false,
  UNIQUE(team_id, name)
);

CREATE TABLE skill_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(skill_id, path)
);

CREATE INDEX idx_skills_team ON skills(team_id);
CREATE INDEX idx_skill_files_skill ON skill_files(skill_id);
```

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    SKILLS SYNC                              │
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │  Local       │         │  Supabase    │                │
│  │  IndexedDB   │◀───────▶│  (Cloud)     │                │
│  │  Skills      │  Sync   │  Skills      │                │
│  └──────────────┘         └──────────────┘                │
│         │                       │                          │
│         └───────────────────────┼──────────────────────────┘
│                                 │
│                    ┌────────────▼────────────┐
│                    │  Skill Manager          │
│                    │  - Merge local + team   │
│                    │  - Conflict resolution  │
│                    └────────────┬────────────┘
│                                 │
│                    ┌────────────▼────────────┐
│                    │  VFS + System Prompt    │
│                    └─────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 2: Version Control (Weeks 7-8)
**Goal:** Track changes, enable rollback

#### Features
| Feature | Description | Effort |
|---------|-------------|--------|
| **Version History** | Track all changes | Medium |
| **Diff Viewer** | See what changed | Medium |
| **Rollback** | Revert to previous version | Low |
| **Change Comments** | Why was this changed | Low |

#### Database Schema Addition
```sql
CREATE TABLE skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changelog TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, version)
);

CREATE TABLE skill_version_files (
  version_id UUID NOT NULL REFERENCES skill_versions(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (version_id, path)
);
```

---

### Phase 3: Permissions & Governance (Weeks 9-10)
**Goal:** Enterprise control

#### Features
| Feature | Description | Effort |
|---------|-------------|--------|
| **Role-Based Access** | Admin/Member/Viewer | Medium |
| **Approval Workflow** | Review before publish | High |
| **Compliance Tags** | GDPR, SOX, HIPAA | Low |
| **Allowlist/Blocklist** | Control which skills | Medium |

#### Permissions Matrix
| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| Install skills | ✅ | ✅ | ✅ |
| Create skills | ✅ | ✅ | ❌ |
| Publish to team | ✅ | ⚠️ (needs approval) | ❌ |
| Delete skills | ✅ | ❌ | ❌ |
| Manage permissions | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ |

---

### Phase 4: Marketplace & Analytics (Weeks 11-12)
**Goal:** Discoverability & ROI

#### Features
| Feature | Description | Effort |
|---------|-------------|--------|
| **Skill Marketplace** | Browse & discover | High |
| **Categories** | Finance, HR, Legal, etc. | Low |
| **Ratings & Reviews** | Community feedback | Medium |
| **Usage Analytics** | Most-used, ROI | High |
| **Trending Skills** | Popular across teams | Medium |

#### Analytics Dashboard Metrics
```typescript
interface SkillAnalytics {
  skillId: string;
  totalInstalls: number;
  activeUsers: number;
  totalUses: number;       // Count of skill-referenced messages
  avgSessionTokens: number;
  costSavings?: number;    // Estimated vs manual work
  topUsers: { userId: string; uses: number }[];
  usageByDay: { date: string; uses: number }[];
}
```

---

## Example Enterprise Skills

### By Industry

| Industry | Skill | Use Case | Value |
|----------|-------|----------|-------|
| **Accounting** | SOX Compliance | Audit trail validation | $50K+/yr saved |
| **Accounting** | Month-End Close | Checklist automation | 20hrs/month saved |
| **Legal** | Contract Review | Clause extraction | 10hrs/contract |
| **Legal** | GDPR Request | Privacy data export | Compliance |
| **Finance** | Financial Close | Reconciliation | 40hrs/month |
| **HR** | Onboarding | New hire workflow | 5hrs/employee |
| **Operations** | Inventory | Stock reconciliation | Reduce shrinkage |
| **Healthcare** | HIPAA Audit | PHI tracking | Compliance |

### Skill Template Structure
```markdown
---
name: SOX Compliance Checker
description: Validates audit trails for SOX compliance
platform: excel
version: 1.0
compliance: [SOX, Audit]
author: Audit Team
---

# SOX Compliance Checker

## When to Use
- Monthly close process
- Audit preparation
- Internal controls testing

## Steps
1. Identify all journal entries in the workbook
2. Check for approval signatures (column headers)
3. Flag entries without approval
4. Generate compliance report

## Output Format
- Summary sheet with pass/fail
- Detailed exceptions list
- Remediation recommendations

## Compliance References
- SOX Section 404
- COSO Framework
```

---

## Migration Plan

### From Local to Cloud

**Step 1: Backup Local Skills**
```javascript
// Export all local skills
const skills = await loadAllSkillFiles();
const backup = JSON.stringify(skills);
// Download as file
```

**Step 2: Upload to Supabase**
```typescript
async function migrateSkillsToCloud(skills: SkillFile[]) {
  const { data, error } = await supabase
    .from('skills')
    .upsert(skills.map(toCloudFormat));
  
  if (error) throw error;
  return data;
}
```

**Step 3: Sync on Login**
```typescript
useEffect(() => {
  async function syncSkills() {
    // Download team skills
    const teamSkills = await fetchTeamSkills(teamId);
    
    // Merge with local
    const merged = mergeSkills(localSkills, teamSkills);
    
    // Update VFS
    syncSkillsToVfs(merged);
  }
  
  if (user) syncSkills();
}, [user]);
```

---

## Success Metrics

| Metric | Current | Phase 1 Target | Phase 4 Target |
|--------|---------|----------------|----------------|
| **Skills per User** | ~2 | 5 | 20 |
| **Team Skills** | 0 | 10 | 100+ |
| **Skill Usage Rate** | Unknown | 50% of sessions | 80% of sessions |
| **Time Saved** | Unknown | 1hr/week/user | 5hrs/week/user |
| **ROI** | N/A | 2x subscription | 10x subscription |

---

## Competitive Analysis

| Feature | OpenExcel | Continue.dev | Claude | Copilot |
|---------|-----------|--------------|--------|---------|
| **Custom Skills** | ✅ Yes | ⚠️ Rules only | ✅ Yes | ❌ No |
| **Cloud Sync** | 📋 Planned | ❌ No | ✅ Yes | ✅ Yes |
| **Team Sharing** | 📋 Planned | ❌ No | ❌ No | ✅ Yes |
| **Version Control** | 📋 Planned | ❌ No | ❌ No | ❌ No |
| **Marketplace** | 📋 Planned | ⚠️ Limited | ❌ No | ❌ No |
| **Analytics** | 📋 Planned | ❌ No | ❌ No | ⚠️ Basic |

**Competitive Advantage:** Only open-source solution with enterprise skills + version control + marketplace.

---

## Implementation Checklist

### Phase 1: Cloud Sync
- [ ] Set up Supabase `skills` and `skill_files` tables
- [ ] Create API endpoints (upload, download, list)
- [ ] Update skills UI to show team library
- [ ] Implement sync on login
- [ ] Test with 5 beta users

### Phase 2: Version Control
- [ ] Add `skill_versions` table
- [ ] Implement version tracking on save
- [ ] Build diff viewer UI
- [ ] Add rollback functionality
- [ ] Changelog UI

### Phase 3: Permissions
- [ ] Add `permissions` column to skills table
- [ ] Implement approval workflow
- [ ] Build admin dashboard
- [ ] Add compliance tags
- [ ] Allowlist/blocklist UI

### Phase 4: Marketplace
- [ ] Build marketplace UI
- [ ] Implement categories
- [ ] Add ratings/reviews
- [ ] Build analytics dashboard
- [ ] Usage tracking

---

## Next Steps

**Ready to start?** Pick the first feature:

1. 🔐 **Cloud sync** (Supabase storage + team library)
2. 📦 **Version control** (track changes, rollback)
3. 👥 **Permissions** (admin/member roles, approval)
4. 📊 **Analytics** (usage tracking, ROI)

**Recommended order:** Cloud Sync → Version Control → Permissions → Analytics

---

*Last Updated: 2026-02-28*  
*Version: 1.0*
