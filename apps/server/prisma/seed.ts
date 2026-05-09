import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { basename, extname, resolve } from "node:path";
import Papa from "papaparse";

import { PrismaClient } from "../generated/prisma/client";
import { DEFAULT_TOLERANCE_NORM } from "../src/lib/game-config.ts";

const IMAGE_SCENES_DIR = resolve(import.meta.dir, "../../web/assets/scenes");
const IMAGE_CHARACTERS_DIR = resolve(import.meta.dir, "../../web/assets/characters");
const SCENE_CHARACTERS_DIR = resolve(import.meta.dir, "../scene_characters");

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

type SceneSeedInput = {
  slug: string;
  name: string;
  width: number;
  height: number;
};

type CsvSceneCharacterRow = {
  character: string;
  x_from_left_norm: number;
  y_from_top_norm: number;
};

type SceneCharacterSeedInput = {
  characterName: string;
  xNorm: number;
  yNorm: number;
};

const toTitle = (value: string): string => {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const roundTo4 = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

const toSceneSlugFromCsvFile = (fileName: string): string => {
  return basename(fileName, extname(fileName));
};

const toNormValue = (
  value: number,
  label: string,
  sceneSlug: string,
  characterName: string,
): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(
      `Invalid ${label}=${value} for ${characterName} in scene ${sceneSlug}. Expected a value in [0, 1].`,
    );
  }

  return value;
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

const collectSceneCharacterCoordinates = async (): Promise<
  Map<string, Map<string, SceneCharacterSeedInput>>
> => {
  const csvFiles = (await Array.fromAsync(new Bun.Glob("*.csv").scan(SCENE_CHARACTERS_DIR))).sort();

  if (csvFiles.length === 0) {
    throw new Error(`No scene character CSV files found in ${SCENE_CHARACTERS_DIR}`);
  }

  const sceneCharacterCoordinatesBySceneSlug = new Map<
    string,
    Map<string, SceneCharacterSeedInput>
  >();

  for (const fileName of csvFiles) {
    const sceneSlug = toSceneSlugFromCsvFile(fileName);
    const filePath = resolve(SCENE_CHARACTERS_DIR, fileName);
    const csvContent = await Bun.file(filePath).text();
    const parseResult = Papa.parse<CsvSceneCharacterRow>(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parseResult.errors.length > 0) {
      const firstError = parseResult.errors[0];
      throw new Error(`Failed to parse ${fileName}: ${firstError.message}`);
    }

    const sceneCharacters = new Map<string, SceneCharacterSeedInput>();

    for (const row of parseResult.data) {
      const characterName = toTitle(String(row.character ?? ""));
      const xFromLeft = Number(row.x_from_left_norm);
      const yFromTop = Number(row.y_from_top_norm);

      if (!characterName) {
        throw new Error(`Missing character name in ${fileName}`);
      }

      const xFromLeftNorm = toNormValue(xFromLeft, "x_from_left_norm", sceneSlug, characterName);
      const yFromTopNorm = toNormValue(yFromTop, "y_from_top_norm", sceneSlug, characterName);

      const xNorm = roundTo4(xFromLeftNorm);
      const yNorm = roundTo4(yFromTopNorm);

      sceneCharacters.set(characterName, {
        characterName,
        xNorm,
        yNorm,
      });
    }

    if (sceneCharacters.size === 0) {
      throw new Error(`No scene character rows found in ${fileName}`);
    }

    sceneCharacterCoordinatesBySceneSlug.set(sceneSlug, sceneCharacters);
  }

  return sceneCharacterCoordinatesBySceneSlug;
};

const seedDatabase = async (prisma: PrismaClient) => {
  const scenes = await collectScenes();
  const characters = await collectCharacters();
  const sceneCharacterCoordinatesBySceneSlug = await collectSceneCharacterCoordinates();

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
      throw new Error(
        `Missing scene character coordinates for scene ${scene.slug}. Add ${scene.slug}.csv under ${SCENE_CHARACTERS_DIR}.`,
      );
    }

    for (const characterName of characters) {
      if (!sceneCharacters.has(characterName)) {
        throw new Error(
          `Missing coordinates for character ${characterName} in scene ${scene.slug}.`,
        );
      }
    }

    for (const characterEntry of sceneCharacters.values()) {
      const characterName = characterEntry.characterName;
      const characterId = characterByName.get(characterName);
      if (!characterId) {
        throw new Error(
          `CSV for scene ${scene.slug} references character ${characterName}, but no matching character asset exists.`,
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
          tolerance_norm: DEFAULT_TOLERANCE_NORM,
        },
        update: {
          target_x_norm: xNorm,
          target_y_norm: yNorm,
          tolerance_norm: DEFAULT_TOLERANCE_NORM,
        },
      });

      sceneCharacterRowCount += 1;
    }
  }

  // Keep output concise and deterministic for CI/dev logs.
  console.log(
    `Seeded ${scenes.length} scenes, ${characters.length} characters, ${sceneCharacterRowCount} scene-character rows.`,
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
