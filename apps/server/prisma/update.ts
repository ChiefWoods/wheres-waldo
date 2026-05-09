import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "../generated/prisma/client";
import {
  collectCharacters,
  collectSceneCharacterCoordinates,
  collectScenes,
} from "./scene-data.ts";

const updateDatabase = async (prisma: PrismaClient) => {
  const scenes = await collectScenes();
  const characters = await collectCharacters();
  const sceneCharacterCoordinatesBySceneSlug = await collectSceneCharacterCoordinates(
    scenes,
    characters,
  );

  const sceneBySlug = new Map<string, number>();
  const characterByName = new Map<string, number>();

  for (const scene of scenes) {
    const upsertedScene = await prisma.scene.upsert({
      where: { slug: scene.slug },
      create: {
        slug: scene.slug,
        name: scene.name,
        width: scene.width,
        height: scene.height,
        is_active: true,
      },
      update: {
        name: scene.name,
        width: scene.width,
        height: scene.height,
        is_active: true,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    sceneBySlug.set(upsertedScene.slug, upsertedScene.id);
  }

  for (const name of characters) {
    const upsertedCharacter = await prisma.character.upsert({
      where: { name },
      create: { name },
      update: { name },
      select: { id: true, name: true },
    });

    characterByName.set(upsertedCharacter.name, upsertedCharacter.id);
  }

  const existingScenes = await prisma.scene.findMany({
    select: {
      id: true,
      slug: true,
    },
  });

  for (const scene of existingScenes) {
    sceneBySlug.set(scene.slug, scene.id);
  }

  const existingCharacters = await prisma.character.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  for (const character of existingCharacters) {
    characterByName.set(character.name, character.id);
  }

  let appendedSceneCharacterRows = 0;
  let skippedExistingSceneCharacters = 0;

  for (const [sceneSlug, sceneCharacters] of sceneCharacterCoordinatesBySceneSlug) {
    const sceneId = sceneBySlug.get(sceneSlug);
    if (!sceneId) {
      throw new Error(
        `Scene ${sceneSlug} does not exist. Add ${sceneSlug}.jpg under web/assets/scenes first.`,
      );
    }

    for (const sceneCharacter of sceneCharacters.values()) {
      const characterId = characterByName.get(sceneCharacter.characterName);
      if (!characterId) {
        throw new Error(
          `Scene ${sceneSlug} references character ${sceneCharacter.characterName}, but no matching character asset exists.`,
        );
      }

      const existingSceneCharacter = await prisma.sceneCharacter.findUnique({
        where: {
          scene_id_character_id: {
            scene_id: sceneId,
            character_id: characterId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingSceneCharacter) {
        skippedExistingSceneCharacters += 1;
        continue;
      }

      await prisma.sceneCharacter.create({
        data: {
          scene_id: sceneId,
          character_id: characterId,
          target_x_norm: sceneCharacter.xNorm,
          target_y_norm: sceneCharacter.yNorm,
        },
      });

      appendedSceneCharacterRows += 1;
    }
  }

  console.log(
    `Updated DB: ensured ${scenes.length} scenes, ensured ${characters.length} characters, appended ${appendedSceneCharacterRows} new scene-character rows, skipped ${skippedExistingSceneCharacters} existing rows.`,
  );
};

const main = async () => {
  // avoid circular dependency
  const databaseUrl = process.env.DATABASE_URL ?? "file:./data/dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await updateDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
};

if (import.meta.main) {
  await main();
}

export { updateDatabase };
