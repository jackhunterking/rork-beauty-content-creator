# Beauty Content Creator - Monetization Strategy

> **Version:** 1.0  
> **Last Updated:** January 2026  
> **Status:** Active - Two-Tier Model

---

## Executive Summary

Beauty Content Creator targets individual beauty business owners (aestheticians, nail techs, hair stylists, lash artists) who need professional social media content quickly.

Our monetization strategy balances **viral growth through free users** with **sustainable revenue from Pro subscribers** who need brand control and premium templates.

### Core Principles

1. **Free Forever**: The free tier is genuinely useful, not a crippled demo
2. **Viral by Design**: Watermarked content from free users drives organic discovery
3. **Value-Based Upgrades**: Users upgrade for brand control and premium templates
4. **Simple & Clear**: Two tiers only - no confusion

---

## Tier Structure

### FREE TIER
*Goal: Maximize user acquisition & viral distribution*

| Feature | Availability |
|---------|--------------|
| **Templates** | ~10+ Starter templates (generous selection) |
| **Watermark** | Yes - All exports include branded watermark |
| **Formats** | All formats (1:1, 4:5, 9:16) |
| **Themes** | Default theme only (1 per template) |
| **Drafts** | Unlimited |
| **Portfolio** | Unlimited |
| **Brand Kit** | Not available |

**Why This Works:**
- Watermark = free advertising every time they post
- Generous template selection builds goodwill and habit formation
- No artificial limits on drafts/portfolio — we want daily usage
- All formats available = no frustration, maximum content creation

---

### PRO TIER

**Pricing (Configure in Superwall):**
- Monthly: `$__.__/month`
- Annual: `$__.__/year` (recommended ~33% discount)
- Lifetime (Early Adopter): `$___` (limited time offer)

*Goal: Convert engaged users who want brand control & premium content*

| Feature | Availability |
|---------|--------------|
| **Templates** | All templates (including Premium-only) |
| **Watermark** | No watermark on exports |
| **Formats** | All formats (1:1, 4:5, 9:16) |
| **Themes** | All color themes per template |
| **Drafts** | Unlimited |
| **Portfolio** | Unlimited |
| **Brand Kit** | Upload logo + set brand color |
| **Priority Support** | Email response within 24 hours |

**Value Proposition:**
- "Look professional" — no watermark means cleaner brand presence
- "Access everything" — premium templates unavailable to free users
- "Stand out" — theme variety differentiates from competitors
- "Own your brand" — Brand Kit makes content uniquely theirs

---

## Feature Monetization Matrix

| Feature | Free | Pro |
|---------|------|-----|
| Starter Templates (~10+) | ✅ | ✅ |
| Premium Templates | ❌ Locked | ✅ |
| Watermark | Yes (always) | No |
| All Formats | ✅ | ✅ |
| Default Theme | ✅ | ✅ |
| Additional Themes | ❌ | ✅ |
| Brand Kit | ❌ | ✅ |
| Drafts | Unlimited | Unlimited |
| Portfolio | Unlimited | Unlimited |

---

## Template Strategy

### Template Categories

```
TEMPLATE LIBRARY:
├── Starter (Free)     → ~10+ templates
│   ├── Classic Before/After layouts
│   ├── Clean minimal designs
│   └── Essential styles for all beauty niches
│
└── Premium (Pro Only) → Additional templates
    ├── Luxury/Elegant aesthetics
    ├── Trending designs
    ├── Specialty layouts (3-slot, 4-slot)
    └── Seasonal/Holiday themes
```

### Template Gating Implementation

- Database field: `is_premium` (boolean) on templates table
- Free users see ALL templates in gallery (creates desire)
- Premium templates show "PRO" badge overlay
- Tapping locked template triggers Superwall paywall

---

## Paywall Triggers (Superwall Placements)

| User Action | Placement Name | Gate Type |
|-------------|----------------|-----------|
| Download (free user) | `download_watermark` | Soft (allow with watermark) |
| Tap premium template | `template_premium` | Hard (must subscribe) |
| Tap locked theme | `theme_unlock` | Hard (must subscribe) |
| Open Brand Kit | `brand_kit_unlock` | Hard (must subscribe) |
| Settings → Upgrade | `settings_upgrade` | Soft (user-initiated) |

---

## Early Adopter Program

### Lifetime Offer Details

| Offer | Price | Equivalent To | Availability |
|-------|-------|---------------|--------------|
| Pro Lifetime | `$___` | ~20 months of monthly | Limited time or first 500 users |

### Early Adopter Benefits

- Lifetime access at discounted rate
- "Founding Member" recognition
- Priority feature requests
- Direct feedback channel

### Launch Strategy

1. **Soft Launch**: Lifetime-only for first 2 weeks (validates demand)
2. **Public Launch**: Introduce monthly/annual with lifetime still available
3. **Lifetime Sunset**: Announce removal 30 days before cutoff (creates urgency)

---

## Pricing Guidelines

### Recommended Price Points

| Tier | Monthly | Annual | Lifetime |
|------|---------|--------|----------|
| Suggested Range | $7.99 - $12.99 | $59.99 - $99.99 | $149 - $249 |

### Pricing Psychology

1. **Annual Discount (30-40%)**: Creates commitment, reduces churn
2. **Lifetime for Early Adopters**: Generates immediate cash, creates advocates
3. **Price Anchoring**: Position monthly as "cost of two coffees"

---

## Success Metrics

### Primary KPIs

| Metric | Target |
|--------|--------|
| Free → Pro Conversion | 5-8% |
| Monthly Churn (Pro) | <5% |
| Watermarked Exports (viral) | Track growth |

### Key Events to Track

- `template_premium_tapped` - Free user tapped locked template
- `paywall_presented` - Superwall paywall shown
- `subscription_started` - User converted to Pro
- `watermarked_export` - Free user exported with watermark

---

## Future Considerations (On Hold)

These features are planned but not in current implementation:

### Studio Tier (Future)
- AI Enhancement credits
- Video generation with monthly caps
- Early access to new templates

### Additional Features (Future)
- Connected accounts (Instagram/TikTok posting)
- Team sharing
- Template marketplace

---

## Implementation Checklist

- [x] Strategy documentation (this document)
- [ ] Database: Add `is_premium` field to templates
- [ ] Types: Update Template interface
- [ ] Service: Map `is_premium` from database
- [ ] UI: Premium badge on locked templates
- [ ] UI: Paywall trigger on premium template tap
- [ ] Superwall: Configure `template_premium` placement
- [ ] Admin: Ability to mark templates as premium
- [ ] Testing: Full flow verification

---

## Appendix: Database Schema

### Templates Table Addition

```sql
ALTER TABLE templates 
ADD COLUMN is_premium BOOLEAN DEFAULT false;

CREATE INDEX idx_templates_is_premium ON templates(is_premium);
```

---

*Document maintained by Product Team. Update pricing in Superwall dashboard.*
