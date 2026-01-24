# Superwall Click-by-Click Build Guide

## Paywall: "Download Your Creation" (Pro Tier)

This is a sequential click-by-click guide for building a paywall in Superwall's editor.

---

## REFERENCE: Design Values

Keep these values handy as you build:

**Colors:**
- Gold accent: `#C9A87C`
- Background: `#FEFCF9`
- Text dark: `#1A1614`
- Text medium: `#6B635B`
- Text light: `#9C948C`
- Surface: `#F7F4F0`
- White: `#FFFFFF`

**Text Content:**
- Headline: `Download Your Creation`
- Subhead: `Save high-quality images to your photos`
- Benefit 1: `Unlimited downloads`
- Benefit 2: `Share to all platforms`
- Benefit 3: `No watermarks`
- Benefit 4: `Priority support`
- CTA: `Continue`
- Dismiss: `Not now`
- Legal: `Subscription automatically renews. Cancel anytime.`

---

## SEQUENCE START

### PART 1: Initial Setup

**Click 1:** Click the paywall name at top-left (shows "New Paywall" with pencil icon)
**Click 2:** Clear the text and type: `Download Your Creation`
**Click 3:** Press Enter or click outside to confirm

---

### PART 2: Add Background Stack

**Click 4:** Click `+ Add Element` button in the left sidebar
**Click 5:** Click `Stack` from the element menu
**Click 6:** In the right sidebar, find the "Background" or "Fill" section
**Click 7:** Click the color picker/input
**Click 8:** Type: `#FEFCF9`
**Click 9:** Press Enter to confirm

---

### PART 3: Add Hero Image

**Click 10:** Click `+ Add Element` in left sidebar
**Click 11:** Click `Image` from the element menu
**Click 12:** In right sidebar, find "Size" section
**Click 13:** Click the Width input field
**Click 14:** Clear it and type: `100`
**Click 15:** Click the "%" option or unit selector, select `%`
**Click 16:** Click the Height input field
**Click 17:** Clear it and type: `200`
**Click 18:** Make sure unit is `px`
**Click 19:** Find "Image Source" or "URL" field
**Click 20:** Paste a beauty-themed image URL or upload an image
**Click 21:** Find "Content Mode" or "Fit" dropdown
**Click 22:** Select `Cover` or `Fill`

---

### PART 4: Add Close/Dismiss Button (X)

**Click 23:** Click `+ Add Element` in left sidebar
**Click 24:** Click `Icon` from the element menu
**Click 25:** In right sidebar, find the icon picker (search field shows "Search 1,432 icons")
**Click 26:** Click the search field
**Click 27:** Type: `close` or `x`
**Click 28:** Click the X/close icon from results
**Click 29:** Find "Size" section in right sidebar
**Click 30:** Click Width input, type: `36`
**Click 31:** Click Height input, type: `36`
**Click 32:** Find "Layer" section
**Click 33:** Find "Icon" color input
**Click 34:** Click it and type: `#FFFFFF`
**Click 35:** Find "Background" section (may need to expand)
**Click 36:** Enable background/fill
**Click 37:** Click color input, type: `#000000`
**Click 38:** Find opacity slider or input
**Click 39:** Set opacity to: `40` (or 0.4)
**Click 40:** Find "Rounded" checkbox
**Click 41:** Check it to make corners rounded (creates circle)
**Click 42:** Find "Position" section
**Click 43:** Set position to absolute/manual
**Click 44:** Set Top: `12` px
**Click 45:** Set Right: `12` px
**Click 46:** Find "Tap Behavior" section
**Click 47:** Click `+ Add Action`
**Click 48:** Select `Close` or `Dismiss Paywall`

---

### PART 5: Add Content Container (Card that overlaps hero)

**Click 49:** Click `+ Add Element` in left sidebar
**Click 50:** Click `Stack` from element menu
**Click 51:** In right sidebar, find "Background" section
**Click 52:** Click color input, type: `#FEFCF9`
**Click 53:** Find "Corner Radius" or "Rounded" section
**Click 54:** Set top-left radius: `24`
**Click 55:** Set top-right radius: `24`
**Click 56:** Set bottom radii to: `0`
**Click 57:** Find "Padding" section
**Click 58:** Set Horizontal padding: `24`
**Click 59:** Set Top padding: `24`
**Click 60:** Find "Margin" section
**Click 61:** Set Top margin: `-24` (negative to overlap hero)

---

### PART 6: Add Header Row (Icon + PRO Badge)

**Click 62:** Make sure the content Stack is selected
**Click 63:** Click `+ Add Element`
**Click 64:** Click `Stack` (this will be a horizontal row)
**Click 65:** Find "Direction" or "Axis" setting
**Click 66:** Select `Horizontal` or `Row`
**Click 67:** Find "Alignment" setting
**Click 68:** Select `Center` (vertical alignment)
**Click 69:** Find "Spacing" or "Gap" input
**Click 70:** Type: `12`

---

### PART 7: Add Icon Badge (Download icon in gold box)

**Click 71:** Make sure the horizontal Stack (header row) is selected
**Click 72:** Click `+ Add Element`
**Click 73:** Click `Stack` or `View`
**Click 74:** In right sidebar, find "Size" section
**Click 75:** Set Width: `44`
**Click 76:** Set Height: `44`
**Click 77:** Find "Background" section
**Click 78:** Click color input, type: `#C9A87C`
**Click 79:** Find opacity, set to: `15` (or 0.15)
**Click 80:** Find "Corner Radius"
**Click 81:** Set all corners to: `12`
**Click 82:** Find "Alignment" for contents
**Click 83:** Set to: `Center` (both axes)

**Click 84:** With icon badge Stack selected, click `+ Add Element`
**Click 85:** Click `Icon`
**Click 86:** Click icon search field
**Click 87:** Type: `download`
**Click 88:** Click the download arrow icon
**Click 89:** Find "Size" in right sidebar
**Click 90:** Set Width: `24`
**Click 91:** Set Height: `24`
**Click 92:** Find "Icon" color
**Click 93:** Type: `#C9A87C`

---

### PART 8: Add PRO Badge

**Click 94:** Click the header row Stack to select it (parent of icon badge)
**Click 95:** Click `+ Add Element`
**Click 96:** Click `Stack` or `View`
**Click 97:** Find "Background" section
**Click 98:** Type color: `#C9A87C`
**Click 99:** Set opacity: `15`
**Click 100:** Find "Padding" section
**Click 101:** Set Horizontal: `12`
**Click 102:** Set Vertical: `6`
**Click 103:** Find "Corner Radius"
**Click 104:** Set to: `8`

**Click 105:** With PRO badge Stack selected, click `+ Add Element`
**Click 106:** Click `Text`
**Click 107:** Click the text content field
**Click 108:** Type: `PRO`
**Click 109:** Find "Font Size"
**Click 110:** Set to: `11`
**Click 111:** Find "Font Weight"
**Click 112:** Select: `Bold` or `700`
**Click 113:** Find "Color"
**Click 114:** Type: `#C9A87C`
**Click 115:** Find "Letter Spacing" if available
**Click 116:** Set to: `0.5`

---

### PART 9: Add Headline Text

**Click 117:** Click the main content Stack to select it
**Click 118:** Click `+ Add Element`
**Click 119:** Click `Text`
**Click 120:** Click text content field
**Click 121:** Type: `Download Your Creation`
**Click 122:** Find "Font Size"
**Click 123:** Set to: `28`
**Click 124:** Find "Font Weight"
**Click 125:** Select: `Bold` or `700`
**Click 126:** Find "Color"
**Click 127:** Type: `#1A1614`
**Click 128:** Find "Margin" section
**Click 129:** Set Bottom margin: `6`

---

### PART 10: Add Subhead Text

**Click 130:** Click `+ Add Element`
**Click 131:** Click `Text`
**Click 132:** Click text content field
**Click 133:** Type: `Save high-quality images to your photos`
**Click 134:** Find "Font Size"
**Click 135:** Set to: `15`
**Click 136:** Find "Font Weight"
**Click 137:** Select: `Regular` or `400`
**Click 138:** Find "Color"
**Click 139:** Type: `#6B635B`
**Click 140:** Find "Margin" section
**Click 141:** Set Bottom margin: `20`

---

### PART 11: Add Benefits Container

**Click 142:** Click `+ Add Element`
**Click 143:** Click `Stack`
**Click 144:** Find "Direction"
**Click 145:** Select: `Vertical` or `Column`
**Click 146:** Find "Spacing/Gap"
**Click 147:** Set to: `12`
**Click 148:** Find "Margin" section
**Click 149:** Set Bottom margin: `24`

---

### PART 12: Add Benefit Row 1 (Unlimited downloads)

**Click 150:** With benefits Stack selected, click `+ Add Element`
**Click 151:** Click `Stack`
**Click 152:** Set Direction: `Horizontal`
**Click 153:** Set Alignment: `Center`
**Click 154:** Set Gap: `12`

**Add icon container:**
**Click 155:** Click `+ Add Element`
**Click 156:** Click `Stack`
**Click 157:** Set Width: `36`, Height: `36`
**Click 158:** Set Background: `#C9A87C`, Opacity: `8`
**Click 159:** Set Corner Radius: `10`
**Click 160:** Set content alignment: `Center`

**Click 161:** With icon container selected, click `+ Add Element`
**Click 162:** Click `Icon`
**Click 163:** Search: `download`
**Click 164:** Select download icon
**Click 165:** Set Size: `18` x `18`
**Click 166:** Set Color: `#C9A87C`

**Add text:**
**Click 167:** Click the benefit row Stack
**Click 168:** Click `+ Add Element`
**Click 169:** Click `Text`
**Click 170:** Type: `Unlimited downloads`
**Click 171:** Set Font Size: `15`
**Click 172:** Set Font Weight: `Medium` or `500`
**Click 173:** Set Color: `#1A1614`

---

### PART 13: Add Benefit Row 2 (Share to all platforms)

**Repeat clicks 150-173 with these changes:**
- Icon search: `share` (arrow pointing up-right)
- Text: `Share to all platforms`

---

### PART 14: Add Benefit Row 3 (No watermarks)

**Repeat clicks 150-173 with these changes:**
- Icon search: `sparkles` or `stars`
- Text: `No watermarks`

---

### PART 15: Add Benefit Row 4 (Priority support)

**Repeat clicks 150-173 with these changes:**
- Icon search: `headphones`
- Text: `Priority support`

---

### PART 16: Add Pricing Container

**Click 174:** Click main content Stack
**Click 175:** Click `+ Add Element`
**Click 176:** Click `Stack`
**Click 177:** Set Direction: `Vertical`
**Click 178:** Set Gap: `10`
**Click 179:** Set Bottom Margin: `20`

---

### PART 17: Add Weekly Pricing Option (Unselected)

**Click 180:** With pricing Stack selected, click `+ Add Element`
**Click 181:** Look for `Product` element, or use `Stack`
**Click 182:** Set Background: `#F7F4F0`
**Click 183:** Set Corner Radius: `14`
**Click 184:** Set Padding Horizontal: `16`
**Click 185:** Set Padding Vertical: `14`
**Click 186:** Set Direction: `Horizontal`
**Click 187:** Set Alignment: `Center`
**Click 188:** Set content to: `Space Between`

**Add radio button (unselected):**
**Click 189:** Click `+ Add Element`
**Click 190:** Click `Stack` or `View`
**Click 191:** Set Width: `20`, Height: `20`
**Click 192:** Set Border: `2` px, Color: `#E8E4DF`
**Click 193:** Set Corner Radius: `10` (makes it circular)
**Click 194:** Set Background: transparent/none

**Add label:**
**Click 195:** Click `+ Add Element`
**Click 196:** Click `Text`
**Click 197:** Type: `Weekly`
**Click 198:** Set Font Size: `15`, Weight: `Semibold`, Color: `#1A1614`

**Add price:**
**Click 199:** Click `+ Add Element`
**Click 200:** Click `Text`
**Click 201:** Type: `$4.99/week`
**Click 202:** Set Font Size: `18`, Weight: `Bold`, Color: `#1A1614`

---

### PART 18: Add Monthly Pricing Option (Selected - Default)

**Click 203:** Click pricing Stack
**Click 204:** Click `+ Add Element`
**Click 205:** Click `Product` or `Stack`
**Click 206:** Set Background: `#FFFFFF`
**Click 207:** Set Border: `2` px, Color: `#C9A87C`
**Click 208:** Set Corner Radius: `14`
**Click 209:** Set Padding Horizontal: `16`
**Click 210:** Set Padding Vertical: `14`

**Add radio button (selected):**
**Click 211:** Click `+ Add Element`
**Click 212:** Click `Stack`
**Click 213:** Set Width: `20`, Height: `20`
**Click 214:** Set Border: `2` px, Color: `#C9A87C`
**Click 215:** Set Corner Radius: `10`
**Click 216:** Set Background: transparent

**Add inner dot:**
**Click 217:** Click `+ Add Element` inside radio
**Click 218:** Click `Stack` or `View`
**Click 219:** Set Width: `10`, Height: `10`
**Click 220:** Set Background: `#C9A87C`
**Click 221:** Set Corner Radius: `5`

**Add labels container:**
**Click 222:** Click monthly option Stack
**Click 223:** Click `+ Add Element`
**Click 224:** Click `Stack` (vertical for label + savings)
**Click 225:** Set Direction: `Vertical`

**Click 226:** Click `+ Add Element`
**Click 227:** Click `Text`
**Click 228:** Type: `Monthly`
**Click 229:** Set Font Size: `15`, Weight: `Semibold`, Color: `#1A1614`

**Click 230:** Click `+ Add Element`
**Click 231:** Click `Text`
**Click 232:** Type: `Save 25%`
**Click 233:** Set Font Size: `11`, Weight: `Semibold`, Color: `#C9A87C`

**Add price:**
**Click 234:** Click `+ Add Element`
**Click 235:** Click `Text`
**Click 236:** Type: `$14.99/mo`
**Click 237:** Set Font Size: `18`, Weight: `Bold`, Color: `#1A1614`

---

### PART 19: Add CTA Button

**Click 238:** Click main content Stack
**Click 239:** Click `+ Add Element`
**Click 240:** Look for `Purchase Button` or `Button`
**Click 241:** Click it to add
**Click 242:** Set Background: `#C9A87C`
**Click 243:** Set Corner Radius: `14`
**Click 244:** Set Padding Vertical: `16`
**Click 245:** Set Width: `100%`
**Click 246:** Find text/label field
**Click 247:** Type: `Continue`
**Click 248:** Set Font Size: `17`
**Click 249:** Set Font Weight: `Semibold`
**Click 250:** Set Text Color: `#FFFFFF`
**Click 251:** Set Text Alignment: `Center`
**Click 252:** Set Bottom Margin: `10`

---

### PART 20: Add Dismiss Link

**Click 253:** Click `+ Add Element`
**Click 254:** Click `Button` or `Text`
**Click 255:** Type: `Not now`
**Click 256:** Set Font Size: `15`
**Click 257:** Set Color: `#6B635B`
**Click 258:** Set Background: transparent
**Click 259:** Set Alignment: `Center`
**Click 260:** Find "Tap Behavior" or "Action"
**Click 261:** Click `+ Add Action`
**Click 262:** Select: `Close` or `Dismiss`
**Click 263:** Set Padding Vertical: `10`

---

### PART 21: Add Legal Text

**Click 264:** Click `+ Add Element`
**Click 265:** Click `Text`
**Click 266:** Type: `Subscription automatically renews. Cancel anytime.`
**Click 267:** Set Font Size: `11`
**Click 268:** Set Color: `#9C948C`
**Click 269:** Set Text Alignment: `Center`
**Click 270:** Set Top Margin: `4`

---

### PART 22: Save

**Click 271:** Click the `Save` button (top right, green button)
**Click 272:** Confirm save if prompted

---

## SEQUENCE COMPLETE

The paywall should now show:
1. Hero image at top with X button
2. Content card overlapping hero
3. Download icon + PRO badge
4. "Download Your Creation" headline
5. Subhead text
6. 4 benefit rows with icons
7. Weekly option (unselected)
8. Monthly option (selected with gold border)
9. Gold "Continue" button
10. "Not now" dismiss link
11. Legal text at bottom
