# Remote Forced Update System

This document explains how to use the remote forced update feature to require users to update the app.

## Overview

The forced update system allows you to block users from using the app until they update to a minimum required version. This is controlled entirely through the Supabase database.

## Database Configuration

The configuration is stored in the `app_config` table in Supabase. There is a single row with `id = 'global'`.

| Column | Type | Description |
|--------|------|-------------|
| `min_ios_version` | text | Minimum required iOS version (e.g., "1.0.0") |
| `min_android_version` | text | Minimum required Android version (e.g., "1.0.0") |
| `force_update_enabled` | boolean | Master toggle to enable/disable forced updates |
| `update_message` | text | Message shown to users on the update screen |
| `store_url_ios` | text | App Store URL for iOS |
| `store_url_android` | text | Play Store URL for Android |

## How to Force an Update

1. Go to Supabase Dashboard
2. Open Table Editor
3. Select `app_config` table
4. Edit the `global` row:
   - Set `min_ios_version` to the new minimum version (e.g., "1.1.0")
   - Set `min_android_version` to the new minimum version
   - Set `force_update_enabled` to `true`
5. Save changes

Users on older versions will immediately see a blocking screen and cannot use the app until they update.

## How to Disable Forced Update

1. Go to Supabase Dashboard
2. Open Table Editor
3. Select `app_config` table
4. Edit the `global` row:
   - Set `force_update_enabled` to `false`
5. Save changes

Users can now continue using the app regardless of their version.

## Customizing the Update Message

Edit the `update_message` field in the `app_config` table to change what users see on the update screen.

Default message:
> A new version of the app is available. Please update to continue using the app.

## Setting Store URLs

Before going live, update the store URLs:

- `store_url_ios`: Your App Store URL (e.g., `https://apps.apple.com/app/resulta/id1234567890`)
- `store_url_android`: Your Play Store URL (e.g., `https://play.google.com/store/apps/details?id=app.resulta.android`)

## Version Format

Versions use semantic versioning format: `MAJOR.MINOR.PATCH`

Examples:
- 1.0.0
- 1.0.1
- 1.1.0
- 2.0.0

The app compares versions numerically. Version 1.1.0 is greater than 1.0.9.

## What Users See

When an update is required, users see a full-screen blocking view with:
- App logo
- "Update Required" title
- Your custom message
- Their current version vs required version
- "Update Now" button that opens the app store

Users cannot dismiss this screen or access any part of the app.

## Notes

- The check happens after the splash screen
- If the config fetch fails (no internet), users are allowed to continue
- Web platform is not affected by forced updates
- The current app version is read from `app.config.js`
