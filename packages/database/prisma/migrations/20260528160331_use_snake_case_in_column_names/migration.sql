ALTER TABLE "refresh_tokens" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "familyId" TO "family_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "replacedById" TO "replaced_by_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "revokedAt" TO "revoked_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "refresh_tokens" RENAME COLUMN "userAgent" TO "user_agent";
ALTER TABLE "refresh_tokens" RENAME COLUMN "userId" TO "user_id";

ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";

ALTER INDEX "refresh_tokens_tokenHash_key" RENAME TO "refresh_tokens_token_hash_key";
ALTER INDEX "refresh_tokens_userId_idx" RENAME TO "refresh_tokens_user_id_idx";
ALTER INDEX "refresh_tokens_familyId_idx" RENAME TO "refresh_tokens_family_id_idx";

ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "refresh_tokens_userId_fkey" TO "refresh_tokens_user_id_fkey";
