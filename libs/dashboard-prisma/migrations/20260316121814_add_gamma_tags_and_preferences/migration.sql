-- CreateTable
CREATE TABLE "gamma_tags" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "requires_translation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamma_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screener_tag_preferences" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screener_tag_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screener_tag_preferences_tag_id_key" ON "screener_tag_preferences"("tag_id");

-- AddForeignKey
ALTER TABLE "screener_tag_preferences" ADD CONSTRAINT "screener_tag_preferences_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "gamma_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
