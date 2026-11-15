# Security Specification — EasyTap Ride Firestore Rules

## 1. Data Invariants
1. **Profile Ownership**: Only a verified Google user (`email_verified == true`) can create `/profiles/{profileId}` where `profileId == request.auth.uid` and `ownerId == request.auth.uid`. `ownerId`, `ownerEmail`, and `createdAt` are immutable.
2. **Bounded Caregiver List**: `assistEmails` is strictly bounded to `<= 10` lowercase email strings. Only the profile owner can modify `assistEmails`, `ownerName`, or manage `/assists/{assistId}` documents.
3. **Caregiver Access Scope**: A verified user whose lowercase email is in `profiles/{profileId}.assistEmails` can read the profile, list/create/update/delete `/places/{placeId}`, and update only `sosName`, `sosRelationship`, `sosPhone`, and `updatedAt` on the profile.
4. **Master Gate & Instant Revocation**: Single-document reads and all writes on `/places/{placeId}` and `/assists/{assistId}` inspect `get(/databases/$(database)/documents/profiles/$(profileId))` (or `getAfter(...)` during atomic batch syncs). Removing an email from `profiles/{profileId}.assistEmails` immediately revokes access.
5. **Query Enforcer (No `get()` in `allow list`)**: All `allow list` rules check `resource.data.ownerId == request.auth.uid` or `(email_verified == true && email.lower() in resource.data.assistEmails)` directly on `resource.data`.
6. **Temporal Integrity & Strict Allowlists**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update. Every write checks `hasAll` + `hasOnly` (create) or `affectedKeys().hasOnly(...)` (update).

## 2. "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Identity Spoofing on Profile Create**: Creating `/profiles/userB` while authenticated as `userA` (`ownerId: "userA"` or `"userB"`).
2. **Shadow Field Injection on Profile**: Creating `/profiles/userA` with an extra key `isAdmin: true`.
3. **Unverified Email Bypass**: Attempting any write or caregiver read when `request.auth.token.email_verified == false`.
4. **Owner Hijack on Update**: Updating `ownerId` or `ownerEmail` on `/profiles/userA`.
5. **Caregiver Privilege Escalation**: A caregiver updating `assistEmails` or `ownerName` on `/profiles/userA`.
6. **Unbounded Array Attack**: Setting `assistEmails` with 11 items.
7. **Oversized String / Resource Poisoning**: Setting `ownerName` or `place.name` > 100/80 chars, or `profileId`/`placeId` > 128 chars or containing invalid characters (`../hack`).
8. **Blanket List Scraping**: Running `getDocs(collection(db, 'profiles'))` without a `where('assistEmails', 'array-contains', myEmail)` or `ownerId` filter.
9. **Unauthorized PII Read**: User C (not `ownerId` and not in `assistEmails`) calling `getDoc(doc(db, 'profiles', 'userA'))`.
10. **Client Timestamp Forgery**: Creating a `place` with `createdAt: new Date(0)` instead of `serverTimestamp()`.
11. **Orphaned Subcollection Write**: Creating `/profiles/nonExistentId/places/place1` when parent profile does not exist.
12. **Caregiver Deleting Owner's Assist List**: A caregiver attempting to create or delete `/profiles/userA/assists/assist1`.
