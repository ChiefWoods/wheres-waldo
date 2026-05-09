import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "../generated/prisma/client";
import {
  collectCharacters,
  collectSceneCharacterCoordinates,
  collectScenes,
} from "./scene-data.ts";

const seedDatabase = async (prisma: PrismaClient) => {
  const scenes = await collectScenes();
  const characters = await collectCharacters();
  const sceneCharacterCoordinatesBySceneSlug = await collectSceneCharacterCoordinates(
    scenes,
    characters,
  );

  const sceneBySlug = new Map<string, number>();
  const characterByName = new Map<string, number>();

  for (const scene of scenes) {
    const upserted = await prisma.scene.upsert({
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

    sceneBySlug.set(upserted.slug, upserted.id);
  }

  for (const name of characters) {
    const upserted = await prisma.character.upsert({
      where: { name },
      create: { name },
      update: { name },
      select: { id: true, name: true },
    });

    characterByName.set(upserted.name, upserted.id);
  }

  let sceneCharacterRowCount = 0;

  for (const scene of scenes) {
    const sceneId = sceneBySlug.get(scene.slug);
    if (!sceneId) {
      throw new Error(`Missing scene id for slug ${scene.slug}`);
    }

    const sceneCharacters = sceneCharacterCoordinatesBySceneSlug.get(scene.slug);
    if (!sceneCharacters) {
      throw new Error(`Missing scene character coordinates for scene ${scene.slug}.`);
    }

    for (const characterEntry of sceneCharacters.values()) {
      const characterName = characterEntry.characterName;
      const characterId = characterByName.get(characterName);
      if (!characterId) {
        throw new Error(
          `Scene ${scene.slug} references character ${characterName}, but no matching character asset exists.`,
        );
      }

      const { xNorm, yNorm } = characterEntry;

      await prisma.sceneCharacter.upsert({
        where: {
          scene_id_character_id: {
            scene_id: sceneId,
            character_id: characterId,
          },
        },
        create: {
          scene_id: sceneId,
          character_id: characterId,
          target_x_norm: xNorm,
          target_y_norm: yNorm,
        },
        update: {
          target_x_norm: xNorm,
          target_y_norm: yNorm,
        },
      });

      sceneCharacterRowCount += 1;
    }
  }

  console.log(
    `Seeded ${scenes.length} scenes, ${characters.length} characters, ${sceneCharacterRowCount} scene-character rows.`,
  );
};

const main = async () => {
  // avoid circular dependency
  const databaseUrl = process.env.DATABASE_URL ?? "file:./data/dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
};

if (import.meta.main) {
  await main();
}

export { seedDatabase };
