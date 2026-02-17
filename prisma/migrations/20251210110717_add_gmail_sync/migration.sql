-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "email_id" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gmail_access_token" TEXT,
ADD COLUMN     "gmail_connected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gmail_refresh_token" TEXT,
ADD COLUMN     "gmail_token_expiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "synced_emails" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "subject" TEXT,
    "from" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "synced_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "synced_emails_user_id_message_id_key" ON "synced_emails"("user_id", "message_id");

-- AddForeignKey
ALTER TABLE "synced_emails" ADD CONSTRAINT "synced_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
