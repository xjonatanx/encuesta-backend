-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "cargo" TEXT,
    "jefeDirecto" TEXT,
    "turno" TEXT,
    "respuestas" JSONB,
    "recomendacion" INTEGER,
    "mejoras" TEXT,
    "destacados" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_rut_key" ON "User"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_userId_key" ON "Survey"("userId");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
