type CharacterAssetModule = {
  default: string;
};

export type CharacterAsset = {
  slug: string;
  name: string;
  imageUrl: string;
};

function toCharacterName(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

const characterModules = import.meta.glob<CharacterAssetModule>(
  "/assets/characters/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true },
);

export const characters: CharacterAsset[] = Object.entries(characterModules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([filePath, module]) => {
    const fileName = filePath.split("/").pop() ?? "";
    const slug = fileName.replace(/\.[^.]+$/, "");

    return {
      slug,
      name: toCharacterName(slug),
      imageUrl: module.default,
    };
  });

export const defaultCharacterSlug = characters[0]?.slug;
