type SceneAssetModule = {
  default: string;
};

export type SceneAsset = {
  slug: string;
  name: string;
  imageUrl: string;
};

function toSceneName(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

const sceneModules = import.meta.glob<SceneAssetModule>(
  "/assets/scenes/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true },
);

export const scenes: SceneAsset[] = Object.entries(sceneModules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([filePath, module]) => {
    const fileName = filePath.split("/").pop() ?? "";
    const slug = fileName.replace(/\.[^.]+$/, "");

    return {
      slug,
      name: toSceneName(slug),
      imageUrl: module.default,
    };
  });

export const defaultSceneSlug = scenes[0]?.slug;
