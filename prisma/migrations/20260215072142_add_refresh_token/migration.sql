-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "refresh_token_expiry" TIMESTAMP(3);
