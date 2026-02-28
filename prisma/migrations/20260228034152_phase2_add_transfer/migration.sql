-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "to_account_id" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
