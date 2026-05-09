-- CreateTable
CREATE TABLE "Scene" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Character" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SceneCharacter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scene_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "target_x_norm" REAL NOT NULL,
    "target_y_norm" REAL NOT NULL,
    "tolerance_norm" REAL NOT NULL DEFAULT 0.02,
    CONSTRAINT "SceneCharacter_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SceneCharacter_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scene_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "elapsed_ms" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Discovery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "scene_character_id" INTEGER NOT NULL,
    "found_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "click_x_norm" REAL NOT NULL,
    "click_y_norm" REAL NOT NULL,
    CONSTRAINT "Discovery_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Discovery_scene_character_id_fkey" FOREIGN KEY ("scene_character_id") REFERENCES "SceneCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Scene_slug_key" ON "Scene"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "SceneCharacter_scene_id_idx" ON "SceneCharacter"("scene_id");

-- CreateIndex
CREATE UNIQUE INDEX "SceneCharacter_scene_id_character_id_key" ON "SceneCharacter"("scene_id", "character_id");

-- CreateIndex
CREATE INDEX "Session_scene_id_status_ended_at_idx" ON "Session"("scene_id", "status", "ended_at");

-- CreateIndex
CREATE INDEX "Session_status_last_activity_at_idx" ON "Session"("status", "last_activity_at");

-- CreateIndex
CREATE INDEX "Session_scene_id_elapsed_ms_attempts_idx" ON "Session"("scene_id", "elapsed_ms", "attempts");

-- CreateIndex
CREATE INDEX "Discovery_session_id_idx" ON "Discovery"("session_id");

-- CreateIndex
CREATE INDEX "Discovery_scene_character_id_idx" ON "Discovery"("scene_character_id");

-- CreateIndex
CREATE UNIQUE INDEX "Discovery_session_id_scene_character_id_key" ON "Discovery"("session_id", "scene_character_id");
