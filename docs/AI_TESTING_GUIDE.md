# AI Features Testing Guide

This document outlines the testing procedures for the AI enhancement features.

## Prerequisites

Before testing, ensure:

1. **Database migrations applied:**
   ```bash
   # Run in Supabase CLI or apply through dashboard
   supabase db push
   ```

2. **Edge functions deployed:**
   ```bash
   supabase functions deploy ai-enhance
   supabase functions deploy ai-credits
   supabase functions deploy ai-config
   ```

3. **N8N workflows configured:**
   - Set up workflows as documented in `docs/N8N_AI_WORKFLOWS.md`
   - Add `N8N_AI_WEBHOOK_URL` to Supabase edge function secrets

4. **Fal.AI API key:**
   - Add to N8N Cloud as a credential

---

## Test Cases

### 1. Credit System Tests

#### 1.1 New User Credit Initialization
**Steps:**
1. Create a new user account
2. Navigate to the AI Enhancement panel in the editor
3. Check credit display

**Expected:**
- Credits should show `10` (default allocation)
- Days until reset should show days until end of current month

#### 1.2 Credit Check Before Enhancement
**Steps:**
1. Open an existing project with a captured image
2. Select a photo slot
3. Open AI Enhancement panel
4. Attempt to use Auto-Quality (costs 2 credits)

**Expected:**
- If credits >= 2: Enhancement proceeds
- If credits < 2: Premium/credits modal appears

#### 1.3 Credit Deduction
**Steps:**
1. Note current credit balance
2. Process a successful enhancement
3. Check credit balance after

**Expected:**
- Credits reduced by the feature's cost
- Credits display updates immediately

#### 1.4 Credit Refund on Failure
**Steps:**
1. Note current credit balance
2. Trigger a failed enhancement (e.g., invalid image URL)
3. Check credit balance

**Expected:**
- Credits should be refunded to previous balance
- Error message displayed

#### 1.5 Monthly Credit Reset
**Steps:**
1. (Test environment) Set `period_end` in database to a past date
2. Open AI Enhancement panel

**Expected:**
- Credits should reset to `10`
- Period dates should update

---

### 2. AI Auto-Quality Tests

#### 2.1 Basic Enhancement
**Steps:**
1. Capture or upload a low-quality image
2. Select the image slot
3. Open AI panel
4. Select "AI Auto-Quality"
5. Wait for processing

**Expected:**
- Loading indicator appears on the image
- Enhanced image replaces original
- Credits deducted
- Success message displayed

#### 2.2 Large Image Handling
**Steps:**
1. Upload a high-resolution image (4000+ pixels)
2. Apply Auto-Quality

**Expected:**
- Enhancement completes (may take longer)
- Output maintains quality
- No timeout errors

#### 2.3 Multiple Enhancements
**Steps:**
1. Apply Auto-Quality to slot 1
2. Immediately apply to slot 2

**Expected:**
- First enhancement completes
- Second queues and starts after first
- Both images enhanced correctly

---

### 3. Background Remove Tests

#### 3.1 Portrait Background Removal
**Steps:**
1. Capture a portrait/selfie
2. Apply "Remove Background"
3. Inspect result

**Expected:**
- Background completely transparent
- Subject edges clean
- Hair and fine details preserved

#### 3.2 Product Photo Background Removal
**Steps:**
1. Upload a product image
2. Apply "Remove Background"

**Expected:**
- Product isolated correctly
- Complex shapes handled well
- Output is PNG with transparency

#### 3.3 Complex Background
**Steps:**
1. Upload image with busy background
2. Apply "Remove Background"

**Expected:**
- Subject identified correctly
- Minimal background artifacts
- Professional-quality cutout

---

### 4. Background Replace Tests

#### 4.1 Preset Selection
**Steps:**
1. Select an image
2. Choose "Replace Background"
3. Verify preset picker appears
4. Select "Studio White" preset

**Expected:**
- Preset picker shows categories
- Selection highlights
- Enhancement uses correct prompt

#### 4.2 Free vs Premium Presets
**Steps:**
1. As non-premium user, open preset picker
2. Attempt to select a premium preset

**Expected:**
- Free presets (first 3) selectable
- Premium presets show lock icon
- Selecting premium triggers paywall

#### 4.3 Background Quality
**Steps:**
1. Apply different background presets
2. Compare results

**Expected:**
- Backgrounds match descriptions
- Subject blends naturally
- No obvious artifacts at edges

#### 4.4 All Categories
**Steps:**
1. Test one preset from each category:
   - Studio (White, Gray, Black)
   - Solid (Cream, Blue)
   - Nature (Outdoor, Sunset)
   - Blur (Soft Blur)
   - Professional (Office, Luxury)

**Expected:**
- All categories produce appropriate backgrounds
- Color/mood matches preset name

---

### 5. Premium Access Tests

#### 5.1 Non-Premium User
**Steps:**
1. Log in as non-premium user
2. Open AI panel

**Expected:**
- Features show PRO badge
- Cost badge shows credit requirement
- Selecting triggers premium request

#### 5.2 Premium User
**Steps:**
1. Log in as premium user (or complimentary pro)
2. Open AI panel

**Expected:**
- Features accessible
- Credit costs shown
- No PRO badges

---

### 6. Error Handling Tests

#### 6.1 Network Error
**Steps:**
1. Disable network
2. Attempt enhancement

**Expected:**
- Clear error message
- Credits not deducted
- App doesn't crash

#### 6.2 Service Unavailable
**Steps:**
1. (Test) Return 503 from N8N
2. Attempt enhancement

**Expected:**
- "Service temporarily unavailable" message
- Credits refunded
- Can retry later

#### 6.3 Invalid Image
**Steps:**
1. Try to enhance a slot with no image
2. Try with corrupted image URL

**Expected:**
- Clear user-friendly error
- No unexpected behavior

---

### 7. Analytics Verification

#### 7.1 Event Tracking
**Steps:**
1. Complete several enhancements
2. Check PostHog dashboard

**Expected Events:**
- `ai_enhancement_started` with feature_key
- `ai_enhancement_completed` with generation_id, processing_time
- `ai_enhancement_failed` (for failures)
- `ai_credits_depleted` (when out of credits)

#### 7.2 User Properties
**Steps:**
1. Check PostHog user profile

**Expected Properties:**
- `ai_credits_remaining`: current balance
- `ai_last_generation_date`: last enhancement time

---

### 8. UI/UX Tests

#### 8.1 Loading States
**Steps:**
1. Start an enhancement
2. Observe UI

**Expected:**
- AI panel shows processing indicator
- Image slot shows loading overlay
- Buttons disabled during processing

#### 8.2 Credit Display
**Steps:**
1. Open AI panel
2. Check credit display

**Expected:**
- Current balance visible
- Reset date shown
- Updates after enhancements

#### 8.3 Error Messages
**Steps:**
1. Trigger various errors
2. Check messages

**Expected:**
- Messages are user-friendly
- No technical jargon
- Clear next steps

---

## Database Verification

After testing, verify in Supabase:

### ai_generations table
```sql
SELECT * FROM ai_generations 
ORDER BY created_at DESC 
LIMIT 10;
```

Check:
- Correct user_id
- Feature key matches
- Status transitions (pending → processing → completed/failed)
- Credits charged
- Processing time recorded

### ai_credits table
```sql
SELECT * FROM ai_credits WHERE user_id = '<test_user_id>';
```

Check:
- Credits deducted correctly
- Period dates correct
- No negative balance

---

## Performance Benchmarks

| Feature | Expected Time | Maximum Time |
|---------|--------------|--------------|
| Auto-Quality | 5-15 seconds | 60 seconds |
| Background Remove | 3-8 seconds | 30 seconds |
| Background Replace | 5-12 seconds | 45 seconds |

---

## Known Limitations

1. **Local Images:** Images must be uploaded to cloud storage before AI processing. Local file:// URLs won't work.

2. **Image Size:** Very large images may take longer or fail. Consider adding a warning for images > 10MB.

3. **Rate Limits:** Fal.AI has rate limits. Multiple rapid requests may queue.

---

## Troubleshooting

### Enhancement stuck on "processing"
1. Check N8N workflow execution logs
2. Verify Fal.AI API key is valid
3. Check edge function logs in Supabase

### Credits not updating
1. Check RLS policies on ai_credits table
2. Verify user is authenticated
3. Check edge function response

### Background presets not loading
1. Verify background_presets table has data
2. Check is_active flag on presets
3. Verify RLS allows SELECT for authenticated users
