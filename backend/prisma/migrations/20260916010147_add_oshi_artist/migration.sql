-- AlterTable
ALTER TABLE "User" ADD COLUMN     "oshiArtistId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_oshiArtistId_fkey" FOREIGN KEY ("oshiArtistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
