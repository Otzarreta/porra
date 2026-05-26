const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collect365ScoresTeamRefs,
  mergePlayers,
  normalize365ScoresSquadHtml,
  parsePlayerDetail,
  playerIdFromHref,
} = require('./playerScraper.js');

test('normalize365ScoresSquadHtml extracts active national-team players and skips coaches', () => {
  const html = `
    <a href="/en-us/football/player/lionel-scaloni-6382#national">
      <div>Lionel Scaloni</div><div>Argentina(Coach)</div>
    </a>
    <a href="/en-us/football/player/lionel-messi-874#national">
      <div>Lionel Messi</div><div>Inter Miami(Right Forward)</div>
    </a>
    <a href="/en-us/football/player/kylian-mbappe-39820">
      <div>Kylian Mbappe</div><div>Soccer · France</div>
    </a>
  `;

  const players = normalize365ScoresSquadHtml(html, {
    teamId: 'argentina',
    sourceTeamId: '2378',
    url: 'https://www.365scores.com/en-us/football/team/argentina-2378/squad',
  });

  assert.equal(players.length, 1);
  assert.equal(players[0].id, '365-874');
  assert.equal(players[0].name, 'Lionel Messi');
  assert.equal(players[0].teamId, 'argentina');
  assert.equal(players[0].club, 'Inter Miami');
  assert.equal(players[0].position, 'Right Forward');
  assert.equal(players[0].source, '365scores');
});

test('collect365ScoresTeamRefs builds team squad URLs from World Cup games', async () => {
  const refs = await collect365ScoresTeamRefs({
    startDate: '2026-06-11',
    endDate: '2026-06-11',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        games: [
          {
            competitionId: 5930,
            homeCompetitor: {id: 5106, name: 'Mexico', nameForURL: 'mexico'},
            awayCompetitor: {id: 5103, name: 'South Africa', nameForURL: 'south-africa'},
          },
        ],
      }),
    }),
  });

  assert.deepEqual(refs.map(ref => ref.teamId), ['mexico', 'south-africa']);
  assert.equal(refs[0].url, 'https://www.365scores.com/en-us/football/team/mexico-5106/squad');
  assert.equal(refs[1].url, 'https://www.365scores.com/en-us/football/team/south-africa-5103/squad');
});

test('mergePlayers updates fetched players and deactivates stale 365Scores entries for synced teams', () => {
  const merged = mergePlayers([
    {id: '365-1', name: 'Old Name', teamId: 'argentina', active: true, source: '365scores'},
    {id: '365-2', name: 'Removed Player', teamId: 'argentina', active: true, source: '365scores'},
    {id: 'manual-1', name: 'Manual Player', teamId: 'argentina', active: true, source: 'manual'},
  ], [
    {id: '365-1', name: 'New Name', teamId: 'argentina', active: true, source: '365scores'},
    {id: '365-3', name: 'Added Player', teamId: 'argentina', active: true, source: '365scores'},
  ], {syncedTeamIds: ['argentina']});

  const byId = Object.fromEntries(merged.players.map(player => [player.id, player]));
  assert.equal(merged.added, 1);
  assert.equal(merged.updated, 1);
  assert.equal(merged.deactivated, 1);
  assert.equal(byId['365-1'].name, 'New Name');
  assert.equal(byId['365-2'].active, false);
  assert.equal(byId['manual-1'].active, true);
});

test('player detail and href helpers parse 365Scores values', () => {
  assert.deepEqual(parsePlayerDetail('Inter Miami(Right Forward)'), {
    club: 'Inter Miami',
    position: 'Right Forward',
  });
  assert.equal(playerIdFromHref('/en-us/football/player/lionel-messi-874#national'), '874');
});
