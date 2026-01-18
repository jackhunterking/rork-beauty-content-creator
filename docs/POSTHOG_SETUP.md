# PostHog Analytics Setup Guide

This guide covers the PostHog integration for Resulta and how to configure the PostHog dashboard.

## Environment Variables

Add these to your `.env` file:

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=your_posthog_project_api_key
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # or https://eu.i.posthog.com for EU
```

To get your API key:
1. Go to PostHog Dashboard
2. Navigate to Project Settings → Project API Key
3. Copy the key (starts with `phc_`)

## PostHog Dashboard Configuration

### 1. Enable Session Replay

1. Go to **Project Settings** → **Session Replay**
2. Toggle **Record user sessions** to ON
3. Configure sampling rate (start with 100%, reduce if needed for cost)
4. Set up masking rules if needed (we already mask text inputs in code)

### 2. Create Key Funnels

Create these funnels to track user journeys:

#### Onboarding Funnel
```
Steps:
1. app_opened (App launch)
2. paywall_presented (Onboarding paywall shown)
3. paywall_dismissed (User completed survey)
4. user_signed_up (Account created)
```

#### Subscription Funnel
```
Steps:
1. paywall_presented
2. transaction_start
3. transaction_complete OR subscription_start
```

#### Content Creation Funnel
```
Steps:
1. template_selected
2. image_captured OR image_uploaded
3. content_edited
4. content_saved
5. content_exported OR content_shared
```

### 3. Set Up Cohorts

Create user cohorts for segmentation:

#### Premium Users
- Filter: `is_premium` = `true`

#### Free Users  
- Filter: `is_premium` = `false` OR `is_premium` is not set

#### By Industry
- Filter: `industry` = `[specific industry value]`

#### By Goal
- Filter: `goal` = `[specific goal value]`

### 4. Create Dashboards

#### Main Product Dashboard
Include these insights:
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Session duration distribution
- Screen views breakdown
- Paywall conversion rate
- Subscription revenue events

#### Subscription Performance Dashboard
- Paywall impressions
- Transaction start rate
- Transaction completion rate
- Trial starts
- Subscription status changes

### 5. Set Up Alerts (Optional)

Configure alerts for:
- Sudden drop in DAU (>20% decrease)
- Transaction failure rate spikes
- Error rate increases

## Events Reference

### App Lifecycle Events
| Event Name | Description |
|------------|-------------|
| `app_opened` | App opened/foregrounded |
| `app_backgrounded` | App moved to background |
| `app_installed` | First app launch |

### Authentication Events
| Event Name | Description | Properties |
|------------|-------------|------------|
| `user_signed_up` | New account created | `method`, `user_id` |
| `user_signed_in` | User logged in | `method`, `user_id` |
| `user_signed_out` | User logged out | - |

### Superwall/Paywall Events
| Event Name | Description | Properties |
|------------|-------------|------------|
| `paywall_presented` | Paywall shown | `paywall_name`, `paywall_identifier` |
| `paywall_dismissed` | Paywall closed | `paywall_name`, `result_type` |
| `paywall_skipped` | Paywall not shown | `skip_reason` |
| `paywall_error` | Paywall error | `error` |

### Transaction Events
| Event Name | Description |
|------------|-------------|
| `transaction_start` | Purchase initiated |
| `transaction_complete` | Purchase successful |
| `transaction_fail` | Purchase failed |
| `transaction_restore` | Purchase restored |
| `subscription_start` | Subscription activated |
| `trial_start` | Trial started |

### Content Events
| Event Name | Description |
|------------|-------------|
| `template_selected` | User selected a template |
| `template_viewed` | User viewed template details |
| `image_captured` | User took a photo |
| `image_uploaded` | User uploaded an image |
| `content_edited` | User edited content |
| `content_saved` | User saved to drafts |
| `content_exported` | User exported content |
| `content_shared` | User shared content |

### User Properties
| Property | Description | Values |
|----------|-------------|--------|
| `industry` | User's industry | From onboarding survey |
| `goal` | User's goal | From onboarding survey |
| `is_premium` | Premium status | `true`/`false` |
| `subscription_status` | Current status | `ACTIVE`/`INACTIVE`/`UNKNOWN` |
| `subscription_source` | Source of premium | `superwall`/`complimentary`/`none` |
| `current_plan` | Current billing plan | `weekly`/`monthly` |
| `sign_up_method` | How user signed up | `apple`/`google`/`email` |

## Session Replay Tips

### Viewing Recordings
1. Go to **Session Replay** in the sidebar
2. Filter by:
   - User properties (premium status, industry)
   - Events (e.g., users who saw paywall)
   - Time range

### Privacy Considerations
- Text inputs are automatically masked
- User-uploaded images are visible (for UX analysis)
- Credit card/password fields are masked by default

### Debugging with Replays
1. Find users who experienced issues
2. Filter by error events
3. Watch their session to understand context

## Integration with Superwall

All Superwall events are automatically forwarded to PostHog with the prefix `superwall_` or mapped to standard event names.

### Event Mapping
| Superwall Event | PostHog Event |
|-----------------|---------------|
| `paywallPresent` | `paywall_presented` |
| `paywallDismiss` | `paywall_dismissed` |
| `transactionStart` | `transaction_start` |
| `transactionComplete` | `transaction_complete` |
| `subscriptionStart` | `subscription_start` |
| `freeTrialStart` | `trial_start` |

### Superwall User Identity
User identity is shared between Superwall and PostHog:
- On sign-in: Both systems receive the user ID
- On sign-out: Both systems reset

## Feature Flags (Optional)

PostHog supports feature flags for A/B testing:

```typescript
import { isFeatureEnabled, getFeatureFlagValue } from '@/services/posthogService';

// Check boolean flag
const showNewUI = await isFeatureEnabled('new-editor-ui');

// Get multivariate flag value
const variant = await getFeatureFlagValue('pricing-experiment');
```

Create flags in PostHog Dashboard → Feature Flags

## Troubleshooting

### Events Not Appearing
1. Check `EXPO_PUBLIC_POSTHOG_API_KEY` is set
2. Verify host URL is correct (US vs EU)
3. Check console logs for `[PostHog]` messages
4. Events may take 1-2 minutes to appear

### Session Replay Not Working
1. Ensure session replay is enabled in project settings
2. Check that `enableSessionReplay: true` in code
3. Verify minimum iOS version (13+)

### User Identity Issues
1. Verify `identifyUser` is called after auth
2. Check `resetUser` is called on sign out
3. Look for duplicate anonymous IDs

## Files Reference

| File | Purpose |
|------|---------|
| `services/posthogService.ts` | Main PostHog service with all functions |
| `hooks/useScreenTracking.ts` | Automatic screen view tracking |
| `hooks/useAuth.ts` | User identity integration |
| `app/_layout.tsx` | Provider setup and Superwall event forwarding |
| `app.config.js` | Environment variable configuration |
