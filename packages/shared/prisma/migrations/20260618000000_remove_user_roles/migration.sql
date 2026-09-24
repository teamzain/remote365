ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "defaultMemberRole" DROP DEFAULT;
ALTER TABLE "Invitation" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE "Organization" ALTER COLUMN "defaultMemberRole" TYPE TEXT USING "defaultMemberRole"::TEXT;
ALTER TABLE "Invitation" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;

UPDATE "User" SET "role" = '';
UPDATE "Organization" SET "defaultMemberRole" = '';
UPDATE "Invitation" SET "role" = '';

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT '';
ALTER TABLE "Organization" ALTER COLUMN "defaultMemberRole" SET DEFAULT '';
ALTER TABLE "Invitation" ALTER COLUMN "role" SET DEFAULT '';

DROP TYPE IF EXISTS "UserRole";
