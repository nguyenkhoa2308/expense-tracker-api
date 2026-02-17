-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
