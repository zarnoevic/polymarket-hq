-- CreateTable
CREATE TABLE "screener_tag_exclusions" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screener_tag_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screener_tag_exclusions_tag_id_key" ON "screener_tag_exclusions"("tag_id");

-- AddForeignKey
ALTER TABLE "screener_tag_exclusions" ADD CONSTRAINT "screener_tag_exclusions_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "gamma_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
