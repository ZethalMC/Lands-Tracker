// Registry of Minecraft servers this bot can render town boundaries from.
// Both currently run squaremap (https://github.com/jpenilla/squaremap),
// which serves its tile and marker JSON publicly with no auth required —
// see src/lib/download.js and src/lib/mapTiles.js for how it's consumed.
export const MAP_SOURCES = {
  earthmc: {
    id: "earthmc",
    label: "EarthMC",
    baseUrl: "https://map.earthmc.net",
    worldName: "minecraft_overworld",
    markerSetId: "towny",
  },
  stoneworks: {
    id: "stoneworks",
    label: "Stoneworks",
    baseUrl: "https://map.stoneworks.gg/abex",
    // Inferred, not verified: Stoneworks' main (Abexilas) map was offline for
    // an in-game war when this was added, so its settings.json couldn't be
    // read directly. Its nether map (a live, separate squaremap instance at
    // map.stoneworks.gg/nether) uses the vanilla dimension key
    // "minecraft_the_nether", so "minecraft_overworld" is the same
    // convention applied to its main world. Confirm and correct here once
    // https://map.stoneworks.gg/abex/tiles/settings.json is reachable again.
    worldName: "minecraft_overworld",
    markerSetId: "towny",
  },
};

export const DEFAULT_SOURCE_ID = "earthmc";

export function getSource(sourceId) {
  const source = MAP_SOURCES[sourceId];
  if (!source) throw new Error(`Unknown map source: ${sourceId}`);
  return source;
}

/** Discord slash-command choice list ({name, value}) for every registered map source. */
export function mapSourceChoices() {
  return Object.values(MAP_SOURCES).map((source) => ({ name: source.label, value: source.id }));
}
