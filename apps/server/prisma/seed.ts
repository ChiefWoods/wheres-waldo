import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { basename, extname, resolve } from "node:path";

import { PrismaClient } from "../generated/prisma/client";
import { DEFAULT_TOLERANCE_NORM } from "../src/lib/game-config.ts";

const IMAGE_SCENES_DIR = resolve(import.meta.dir, "../../web/assets/scenes");
const IMAGE_CHARACTERS_DIR = resolve(import.meta.dir, "../../web/assets/characters");

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

type SceneSeedInput = {
  slug: string;
  name: string;
  width: number;
  height: number;
};

const toTitle = (value: string): string => {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const hashText = (text: string): number => {
  // Bun.hash is implemented natively and may return number or bigint depending on platform/runtime.
  // Normalize to uint32 to preserve the previous output format.
  const rawHash = Bun.hash(text);
  if (typeof rawHash === "bigint") {
    return Number(rawHash & 0xffffffffn);
  }

  return rawHash >>> 0;
};

const roundTo4 = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

const placeholderCoordinates = (sceneSlug: string, characterName: string) => {
  const key = `${sceneSlug}:${characterName}`;
  const xHash = hashText(`${key}:x`);
  const yHash = hashText(`${key}:y`);

  const xNorm = roundTo4(0.08 + (xHash / 0xffffffff) * 0.84);
  const yNorm = roundTo4(0.08 + (yHash / 0xffffffff) * 0.84);

  return { xNorm, yNorm };
};

const parseJpegDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Invalid JPEG file: missing SOI marker");
  }

  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      break;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 1 >= bytes.length) {
      break;
    }

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    offset += 2;

    if (segmentLength < 2 || offset + segmentLength - 2 > bytes.length) {
      throw new Error("Invalid JPEG file: malformed segment length");
    }

    if (SOF_MARKERS.has(marker)) {
      if (offset + 4 >= bytes.length) {
        throw new Error("Invalid JPEG file: missing SOF dimensions");
      }

      const height = (bytes[offset + 1] << 8) | bytes[offset + 2];
      const width = (bytes[offset + 3] << 8) | bytes[offset + 4];

      if (width <= 0 || height <= 0) {
        throw new Error("Invalid JPEG file: non-positive dimensions");
      }

      return { width, height };
    }

    offset += segmentLength - 2;
  }

  throw new Error("Invalid JPEG file: no SOF segment found");
};

const collectScenes = async (): Promise<SceneSeedInput[]> => {
  const sceneFiles = (await Array.fromAsync(new Bun.Glob("*.jpg").scan(IMAGE_SCENES_DIR))).sort();

  if (sceneFiles.length === 0) {
    throw new Error(`No JPG scenes found in ${IMAGE_SCENES_DIR}`);
  }

  const scenes: SceneSeedInput[] = [];

  for (const fileName of sceneFiles) {
    const filePath = resolve(IMAGE_SCENES_DIR, fileName);
    const bytes = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    const { width, height } = parseJpegDimensions(bytes);
    const slug = basename(fileName, extname(fileName));

    scenes.push({
      slug,
      name: toTitle(slug),
      width,
      height,
    });
  }

  return scenes;
};

const collectCharacters = async (): Promise<string[]> => {
  const characterFiles = (
    await Array.fromAsync(new Bun.Glob("*.webp").scan(IMAGE_CHARACTERS_DIR))
  ).sort();

  if (characterFiles.length === 0) {
    throw new Error(`No WEBP characters found in ${IMAGE_CHARACTERS_DIR}`);
  }

  return characterFiles.map((fileName) => toTitle(basename(fileName, extname(fileName))));
};

const seedDatabase = async (prisma: PrismaClient) => {
  const scenes = await collectScenes();
  const characters = await collectCharacters();

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

  for (const scene of scenes) {
    const sceneId = sceneBySlug.get(scene.slug);
    if (!sceneId) {
      throw new Error(`Missing scene id for slug ${scene.slug}`);
    }

    for (const characterName of characters) {
      const characterId = characterByName.get(characterName);
      if (!characterId) {
        throw new Error(`Missing character id for name ${characterName}`);
      }

      const { xNorm, yNorm } = placeholderCoordinates(scene.slug, characterName);

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
          tolerance_norm: DEFAULT_TOLERANCE_NORM,
        },
        update: {
          target_x_norm: xNorm,
          target_y_norm: yNorm,
          tolerance_norm: DEFAULT_TOLERANCE_NORM,
        },
      });
    }
  }

  // Keep output concise and deterministic for CI/dev logs.
  console.log(
    `Seeded ${scenes.length} scenes, ${characters.length} characters, ${scenes.length * characters.length} scene-character rows.`,
  );
};

const main = async () => {
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
