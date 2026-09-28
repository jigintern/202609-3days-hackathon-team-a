-- CreateTable
CREATE TABLE "VaultProfile" (
    "userId" TEXT NOT NULL,
    "kdfSalt" TEXT NOT NULL,
    "kdfIterations" INTEGER NOT NULL,
    "verifierIv" TEXT NOT NULL,
    "verifierCipher" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "cipherText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultEntry_userId_createdAt_idx" ON "VaultEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "VaultProfile" ADD CONSTRAINT "VaultProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
