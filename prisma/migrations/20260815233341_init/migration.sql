-- CreateTable
CREATE TABLE "save_games" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "content_version" TEXT NOT NULL,
    "ruler_name" TEXT NOT NULL,
    "government_type" TEXT NOT NULL,
    "in_game_day" INTEGER NOT NULL,
    "in_game_date" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "save_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "save_games_user_id_updated_at_idx" ON "save_games"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "save_games_user_id_slot_key" ON "save_games"("user_id", "slot");
