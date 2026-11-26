# Security Specification & Red Team Payloads — Shadow Knight Game Zone

## 1. Data Invariants
1. **Verified Legal Rights Gate**: Public portal visitors can only `get` or `list` documents in `/published_games/{gameId}` when `resource.data.legalRightsVerified == true`. Unverified drafts remain visible solely to verified admins.
2. **Admin-Only Publishing & Remote Settings**: Only verified administrators (`isAdmin()` checking `/admins/$(request.auth.uid)` or verified bootstrap owner email with `email_verified == true`) can create, update, or delete `/published_games/{gameId}` or update `/portal_settings/config`.
3. **Strict Player Profile Ownership (Zero Blanket Reads)**: `/players/{uid}` cannot be listed (`allow list: if false`) and can only be read (`get`) or written by the matching verified user (`request.auth.uid == uid`) or `isAdmin()`. `uid` and `createdAt` are immutable after creation, and `updatedAt` must equal `request.time`.
4. **Global Leaderboard Integrity**: `/leaderboard/{entryId}` allows public reads (`allow list: if resource.data.score >= 0` with zero PII), allows `create` only by verified signed-in users where `incoming().uid == request.auth.uid`, `incoming().id == entryId`, and `incoming().createdAt == request.time`, and prevents players from mutating or deleting submitted entries.
5. **Strict Key & Size Enforcement**: Every create/update validates exact allowed keys (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update), bounded string/array `.size()` limits, safe URL prefixes, and server-enforced `request.time` timestamps.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Publish**: Unauthenticated client attempts `create` on `/published_games/rogue-game`.
2. **Non-Admin User Publish**: Signed-in non-admin user attempts `create` on `/published_games/my-game`.
3. **Unverified Email Admin Spoof**: User with `email == 'aravshrivastava50@gmail.com'` and `email_verified == false` attempts `update` on `/portal_settings/config`.
4. **Shadow Field Injection**: Admin attempts `create` on `/published_games/hack-1` with an extra shadow field `isFeaturedOverride: true`.
5. **Player Profile Cross-Account Read/Write**: Signed-in user `alice` attempts `get` or `update` on `/players/bob` or attempts `list` on `/players`.
6. **ID Poisoning**: Client attempts `get` on `/published_games/` with a 500-char invalid ID containing `$` or spaces.
7. **Unverified Game Listing**: Public visitor queries `/published_games` without `where('legalRightsVerified', '==', true)`.
8. **XSS / `javascript:` Bundle URL**: Admin attempts `create` on `/published_games/xss-1` with `gameBundleUrl: "javascript:alert(1)"`.
9. **Client Timestamp Forgery**: Signed-in player attempts `create` on `/leaderboard/lb-1` with forged `createdAt` not equal to `request.time`.
10. **Leaderboard UID Spoofing / Score Tampering**: User `alice` attempts `create` on `/leaderboard/lb-2` with `uid: "bob"` or attempts `update` on an existing `/leaderboard/lb-1` score.
11. **Armory Skin Injection**: Player attempts `update` on `/players/alice` setting `equippedSkin: "god-mode-hack"` or `unlockedSkins` exceeding max array size.
12. **Self-Assigned Admin Escalation**: Signed-in user attempts `create` on `/admins/<their-uid>` with `{ role: 'owner', email: '...' }`.
