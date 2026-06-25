/*
 * Suggested marker callsigns — short, recognisable easter-egg names used as the
 * placeholder for an unnamed terminal's marker (instead of a flat "Add
 * marker"). Stable per terminal id so it doesn't flicker between renders.
 */
const CALLSIGNS = [
  "Neo",
  "Trinity",
  "Hal",
  "Jarvis",
  "Glados",
  "R2-D2",
  "Wall-E",
  "Data",
  "Spock",
  "Yoda",
  "Gandalf",
  "Frodo",
  "Mario",
  "Yoshi",
  "Link",
  "Zelda",
  "Kirby",
  "Sonic",
  "Groot",
  "Baymax",
  "Bender",
  "Optimus",
  "Cortana",
  "Clippy",
  "Tron",
  "Ripley",
  "Deckard",
  "Vega",
  "Orion",
  "Nova",
  "Atlas",
  "Apollo",
  "Phoenix",
  "Comet",
  "Quasar",
  "Pulsar",
  "Nebula",
  "Cosmo",
  "Echo",
  "Pixel",
  "Glitch",
  "Cipher",
  "Vortex",
  "Zenith",
];

export function suggestedCallsign(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return CALLSIGNS[Math.abs(hash) % CALLSIGNS.length];
}
