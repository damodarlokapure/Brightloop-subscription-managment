/*
  Warnings:

  - You are about to drop the column `taxId` on the `SubscriptionLine` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SubscriptionLine" DROP CONSTRAINT "SubscriptionLine_productId_fkey";

-- DropIndex
DROP INDEX "SubscriptionLine_variantId_idx";

-- AlterTable
ALTER TABLE "SubscriptionLine" DROP COLUMN "taxId",
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "productId" DROP NOT NULL,
ALTER COLUMN "quantity" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "SubscriptionStatusHistory" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "fromStatus" "SubscriptionStatus",
    "toStatus" "SubscriptionStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SubscriptionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionStatusHistory_subscriptionId_idx" ON "SubscriptionStatusHistory"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionStatusHistory_toStatus_idx" ON "SubscriptionStatusHistory"("toStatus");

-- AddForeignKey
ALTER TABLE "SubscriptionStatusHistory" ADD CONSTRAINT "SubscriptionStatusHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionLine" ADD CONSTRAINT "SubscriptionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
