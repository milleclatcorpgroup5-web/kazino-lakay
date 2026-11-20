import assert from 'node:assert/strict';
import { PENALTY_TEAMS, getPenaltyTeam } from '../src/games/penalty-roster.js';

assert.equal(PENALTY_TEAMS.length, 16, 'The current penalty selector must contain all 16 configured countries.');
assert.equal(new Set(PENALTY_TEAMS.map((team) => team.id)).size, PENALTY_TEAMS.length, 'Country IDs must be unique.');
for (const team of PENALTY_TEAMS) {
  assert.ok(team.name && team.flag && team.primary && team.secondary, `Missing team metadata for ${team.id}`);
  assert.ok(team.player?.name && team.player?.role, `Missing featured player for ${team.id}`);
  assert.ok(Number.isInteger(team.player.shirtNumber) && team.player.shirtNumber > 0, `Invalid shirt number for ${team.id}`);
}
assert.equal(getPenaltyTeam('argentina').player.name, 'Lionel Messi');
assert.equal(getPenaltyTeam('portugal').player.name, 'Cristiano Ronaldo');
assert.equal(getPenaltyTeam('brazil').player.name, 'Neymar Jr.');
assert.equal(getPenaltyTeam('not-a-country').id, 'haiti', 'Unknown country IDs must fall back safely to Haiti.');
console.log('Penalty roster validation passed (16 countries, 16 featured players).');
