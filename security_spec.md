# Security Specification & Red Team Payloads — Shadow Knight Game Zone

## 1. Data Invariants
1. **Verified Legal Rights Gate**: Public portal visitors can only `get` or `list` documents in `/published_games/{gameId}` when `resource.data.legalRightsVerified == true`. Unverified drafts remain visible solely to verified admins.
2. **Admin-Only Publishing & Remote Settings**: Only verified administrators (`isAdmin()` checking `/admins/$(request.auth.uid)` or verified bootstrap owner email with `email_verified == true`) can create, update, or delete `/published_games/{gameId}` or update `/portal_settings/config`.
3. **Strict Key & Size Enforcement**: Every create/update validates exact allowed keys (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update), bounded string `.size()` limits, safe URL prefixes (`https://`, `gs://`, or clean Storage relative path—never `javascript:` or `data:`), and server-enforced `request.time` timestamps.
4. **Immutable Ownership & Creation Time**: `ownerUid` and `createdAt` cannot be modified after creation.
5. **Privilege Isolation**: Clients cannot create, list, or self-assign `/admins/{uid}` roles.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Publish**: Unauthenticated client attempts `create` on `/published_games/rogue-game`.
2. **Non-Admin User Publish**: Signed-in non-admin user attempts `create` on `/published_games/my-game`.
3. **Unverified Email Admin Spoof**: User with `email == 'aravshrivastava50@gmail.com'` and `email_verified == false` attempts `update` on `/portal_settings/config`.
4. **Shadow Field Injection**: Admin attempts `create` on `/published_games/hack-1` with an extra shadow field `isFeaturedOverride: true`.
5. **Owner UID Spoofing**: Admin attempts `create` on `/published_games/spoof-owner` with `ownerUid: "someone-else-uid"`.
6. **ID Poisoning**: Client attempts `get` on `/published_games/` with a 500-char invalid ID containing `$` or spaces.
7. **Unverified Game Listing**: Public visitor queries `/published_games` without `where('legalRightsVerified', '==', true)` (attempts to list `legalRightsVerified == false` docs).
8. **XSS / `javascript:` Bundle URL**: Admin attempts `create` on `/published_games/xss-1` with `gameBundleUrl: "javascript:alert(1)"`.
9. **Client Timestamp Forgery**: Admin attempts `create` on `/published_games/time-spoof` with forged `createdAt` not equal to `request.time`.
10. **Immutable Field Mutation**: Admin attempts `update` on `/published_games/g1` changing `createdAt` or `ownerUid`.
11. **Config Enumeration / Arbitrary Settings Doc**: Public visitor attempts `list` on `/portal_settings` or `get` on `/portal_settings/secrets`.
12. **Self-Assigned Admin Escalation**: Signed-in user attempts `create` on `/admins/<their-uid>` with `{ role: 'owner', email: '...' }`.
