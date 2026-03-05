# OpenExcel Enterprise Roadmap

## Executive Summary

OpenExcel is a production-ready, open-source Excel add-in with AI chat integration. This roadmap outlines the path from individual use to enterprise-grade SaaS.

---

## Current State (v1.0)

### ✅ Completed Features

| Category | Features |
|----------|----------|
| **Multi-Provider Support** | 10+ LLM providers (OpenAI, Anthropic, Google, OpenRouter, Groq, etc.) |
| **API Key Management** | Per-provider key isolation in localStorage |
| **State Architecture** | Context-driven state sync (no desync bugs) |
| **Error Handling** | Toast notifications, auto-retry, rate limit handling |
| **Data Integrity** | localStorage corruption detection & auto-recovery |
| **Security** | BYOK model (users own their keys) |
| **Hosting** | Static site (Vercel-compatible) |

### 📊 Current Robustness Score

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Core Functionality | ⭐⭐⭐⭐⭐ | Matches industry leaders |
| Error Handling | ⭐⭐⭐⭐⭐ | Auto-retry, rate limits, corruption recovery |
| User Experience | ⭐⭐⭐⭐ | Toast notifications, non-blocking |
| Security | ⭐⭐⭐ | Browser localStorage (standard for extensions) |
| Reliability | ⭐⭐⭐⭐⭐ | Context sync prevents desync |

---

## Enterprise Features Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Basic security & admin controls

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| Encrypted Key Storage | Medium | High | 🔴 P0 | ⏳ Pending |
| Admin/User Roles | Medium | High | 🔴 P0 | ⏳ Pending |
| Audit Logging | Low | High | 🔴 P0 | ⏳ Pending |

**Deliverables:**
- [ ] Master password encryption (AES-256)
- [ ] Role-based access control (admin, member, viewer)
- [ ] Local audit log with CSV export
- [ ] Supabase backend setup

---

### Phase 2: Team Collaboration (Weeks 3-4)
**Goal:** Multi-user support

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| Shared API Keys | High | High | 🔴 P0 | ⏳ Pending |
| Usage Quotas | Medium | Medium | 🟡 P1 | ⏳ Pending |
| Team Dashboard | Medium | High | 🔴 P0 | ⏳ Pending |

**Deliverables:**
- [ ] Backend service for key sharing
- [ ] Per-user spending limits
- [ ] Real-time usage analytics
- [ ] Team member invite system

---

### Phase 3: Enterprise Integration (Weeks 5-8)
**Goal:** Corporate readiness

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| SSO/SAML | High | High | 🔴 P0 | ⏳ Pending |
| Centralized Billing | High | High | 🔴 P0 | ⏳ Pending |
| Compliance Export | Low | Medium | 🟡 P1 | ⏳ Pending |

**Deliverables:**
- [ ] Auth0/Okta integration (or Supabase SSO)
- [ ] Unified billing across team
- [ ] GDPR data export/delete
- [ ] SLA monitoring

---

### Phase 4: Advanced Features (Weeks 9-12)
**Goal:** Competitive differentiators

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| Custom Models | Medium | Medium | 🟡 P1 | ⏳ Pending |
| Workflow Automation | High | High | 🔴 P0 | ⏳ Pending |
| AI Governance | Medium | High | 🔴 P0 | ⏳ Pending |

**Deliverables:**
- [ ] Custom Ollama/vLLM endpoint support
- [ ] Pre-built Excel automation templates
- [ ] Content filtering & approval workflows
- [ ] Model allowlisting/blocklisting

---

## Technical Architecture

### Current Architecture (Client-Only)
```
┌─────────────┐     ┌─────────────┐
│   User's    │     │   LLM       │
│   Excel     │────▶│   APIs      │
│   Add-in    │     │   (Direct)  │
└─────────────┘     └─────────────┘
      │
      └─── localStorage (per user)
```

### Enterprise Architecture (Client + Backend)
```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  Excel   │  │  Excel   │  │  Excel   │                 │
│  │ Add-in   │  │ Add-in   │  │ Add-in   │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       │             │             │                         │
│       └─────────────┼─────────────┘                         │
│                     │                                       │
│              ┌──────▼──────┐                                │
│              │   Vercel    │  (Static hosting)              │
│              │  (Edge CDN) │                                │
│              └──────┬──────┘                                │
└─────────────────────┼───────────────────────────────────────┘
                      │ HTTPS
                      │
              ┌───────▼────────┐
              │   Supabase     │
              │  ┌──────────┐  │
              │  │   Auth   │  │  (Users, SSO, Roles)
              │  └──────────┘  │
              │  ┌──────────┐  │
              │  │ Database │  │  (Keys, Audit, Usage)
              │  └──────────┘  │
              │  ┌──────────┐  │
              │  │ Realtime │  │  (Live dashboard)
              │  └──────────┘  │
              └────────────────┘
```

---

## Technology Stack

### Recommended Stack (Lean & Cost-Effective)

| Component | Technology | Purpose | Free Tier | Paid Tier |
|-----------|------------|---------|-----------|-----------|
| **Hosting** | Vercel | Static files, Edge CDN | ✅ 100GB/mo | $20/mo |
| **Backend** | Supabase | Auth + DB + Realtime | ✅ 500MB, 50K MAU | $25/mo |
| **Database** | PostgreSQL | Relational data | Included | Included |
| **Auth** | Supabase Auth | Email, OAuth, SSO | Included | Included |
| **Encryption** | Web Crypto API | Client-side AES-256 | ✅ Native | ✅ Native |
| **Analytics** | PostHog (optional) | Product analytics | ✅ 1M events/mo | $0-20/mo |

### Total Cost Projection

| Stage | Users | Vercel | Supabase | Total |
|-------|-------|--------|----------|-------|
| **Development** | 1-5 | $0 | $0 | **$0** |
| **Beta** | 5-50 | $0 | $0 | **$0** |
| **Launch** | 50-500 | $0 | $25 | **$25** |
| **Growth** | 500-5K | $20 | $25 | **$45** |
| **Scale** | 5K-50K | $20 | $50 | **$70** |
| **Enterprise** | 50K+ | Custom | Custom | **$200+** |

---

## Feature Specifications

### 1. Encrypted API Key Storage 🔐

```typescript
// Master password → AES-256 key → Encrypt API keys
interface EncryptedKey {
  iv: string;           // Initialization vector
  ciphertext: string;   // Encrypted API key
  salt: string;         // For key derivation
}

// Encryption flow
async function encryptKey(masterPassword: string, apiKey: string): Promise<EncryptedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(masterPassword, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await encryptAESGCM(key, iv, apiKey);
  return { iv: encode(iv), ciphertext: encode(ciphertext), salt: encode(salt) };
}
```

### 2. Role-Based Access Control 👥

```typescript
type Role = 'admin' | 'member' | 'viewer';

interface User {
  id: string;
  email: string;
  role: Role;
  teamId: string;
  createdAt: number;
}

const permissions = {
  admin: ['read', 'write', 'delete', 'manage_users', 'view_audit', 'manage_keys'],
  member: ['read', 'write'],
  viewer: ['read'],
};
```

### 3. Audit Logging 📋

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: 'api_call' | 'login' | 'key_created' | 'settings_changed' | 'user_added' | 'user_removed';
  provider?: string;
  model?: string;
  tokens?: number;
  cost?: number;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

// Example queries
SELECT * FROM audit_logs WHERE team_id = ? ORDER BY timestamp DESC LIMIT 100;
SELECT SUM(cost) FROM audit_logs WHERE team_id = ? AND timestamp > ?;
```

### 4. Usage Analytics 📊

```typescript
interface UsageStats {
  teamId: string;
  period: 'day' | 'week' | 'month';
  totalTokens: number;
  totalCost: number;
  byProvider: Record<string, number>;
  byUser: Record<string, number>;
  byModel: Record<string, number>;
}

// Dashboard metrics
- Tokens used this month
- Cost breakdown by provider
- Top users by usage
- Remaining quota
```

---

## Pricing Tiers

| Tier | Price | Features | Target |
|------|-------|----------|--------|
| **Free** | $0 | Individual, localStorage, all providers, basic error handling | Personal use |
| **Team** | $10/user/mo | Encrypted storage, shared keys, audit logs, 100K tokens/mo, team dashboard | Small teams (5-50) |
| **Enterprise** | Custom | SSO/SAML, unlimited audit, custom models, SLA, governance, dedicated support | Corporations (50+) |

---

## MVP Scope (4 Weeks)

### Week 1-2: Foundation
- [ ] Supabase project setup
- [ ] User authentication (email/password)
- [ ] Encrypted key storage (client-side AES-256)
- [ ] Basic admin panel (user management)

### Week 3-4: Team Features
- [ ] Audit logging (database schema + logging)
- [ ] Usage tracking (per API call)
- [ ] Team dashboard (usage stats)
- [ ] Deploy & test with real users

---

## Success Metrics

| Metric | Current | MVP Target | Enterprise Target |
|--------|---------|-------------|-------------------|
| **Active Users** | 1 | 50 | 5,000+ |
| **Teams** | 0 | 10 | 500+ |
| **API Calls/mo** | ~100 | 10,000 | 1M+ |
| **Uptime** | N/A | 99% | 99.9% |
| **Revenue** | $0 | $0 | $10K+/mo |

---

## Next Steps

### Immediate (This Week)
1. [ ] Set up Supabase project
2. [ ] Create database schema
3. [ ] Implement encrypted key storage
4. [ ] Test with master password flow

### Short-term (This Month)
1. [ ] Complete Phase 1 features
2. [ ] Onboard 5 beta users
3. [ ] Gather feedback on team features
4. [ ] Iterate on dashboard UX

### Long-term (This Quarter)
1. [ ] Launch Team tier
2. [ ] Acquire 10 paying teams
3. [ ] Implement SSO for enterprise
4. [ ] Reach $1K MRR

---

## Competitive Analysis

| Feature | OpenExcel | Continue.dev | Claude for Excel | Copilot Pro |
|---------|-----------|--------------|------------------|-------------|
| **Multi-Provider** | ✅ 10+ | ✅ 5+ | ❌ 1 (Claude) | ❌ 1 (GPT-4) |
| **Open Source** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **BYOK** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Team Features** | 🏗️ In Progress | ⚠️ Limited | ❌ No | ✅ Yes |
| **SSO** | 📋 Planned | ❌ No | ✅ Yes | ✅ Yes |
| **Audit Logs** | 📋 Planned | ❌ No | ✅ Yes | ✅ Yes |
| **Price** | Free-$10/mo | Free | $20/mo | $20/mo |

**Competitive Advantage:** Best of both worlds - open-source flexibility + enterprise features at 1/2 the price.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Supabase downtime** | Low | High | Export/backup daily, multi-region |
| **Security breach** | Medium | Critical | Client-side encryption, zero-knowledge |
| **Low adoption** | Medium | High | Free tier, open-source community |
| **Vendor lock-in** | Low | Medium | Standard PostgreSQL, easy migration |
| **Cost overrun** | Low | Low | Usage monitoring, auto-scaling limits |

---

## Contact & Resources

- **Repository:** `c:\Users\BrantenKonyana\OneDrive - Genesis Chartered Accountants\Documents\open-excel-main`
- **Documentation:** `README.md`, `PROVIDERS.md`
- **Architecture:** See diagrams above
- **Next Review:** After Phase 1 completion

---

*Last Updated: 2026-02-28*
*Version: 1.0*
