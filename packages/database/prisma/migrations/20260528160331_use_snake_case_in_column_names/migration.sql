ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";

DROP INDEX "refresh_tokens_familyId_idx";

DROP INDEX "refresh_tokens_tokenHash_key";

DROP INDEX "refresh_tokens_userId_idx";

ALTER TABLE "refresh_tokens" DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "familyId",
DROP COLUMN "replacedById",
DROP COLUMN "revokedAt",
DROP COLUMN "tokenHash",
DROP COLUMN "userAgent",
DROP COLUMN "userId",
ADD COLUMN  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN  "expires_at" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN  "family_id" UUID NOT NULL,
ADD COLUMN  "replaced_by_id" UUID,
ADD COLUMN  "revoked_at" TIMESTAMPTZ(3),
ADD COLUMN  "token_hash" TEXT NOT NULL,
ADD COLUMN  "user_agent" TEXT,
ADD COLUMN  "user_id" UUID NOT NULL;

ALTER TABLE "users" DROP COLUMN "createdAt",
ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
