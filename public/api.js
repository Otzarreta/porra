/* API client para el backend Express. */
const API = (() => {
  const base = '/api';

  async function request(path, opts = {}) {
    const headers = {'Content-Type': 'application/json', ...(opts.headers || {})};
    const res = await fetch(base + path, {...opts, headers});
    if (!res.ok) {
      const err = new Error(`API ${res.status} ${res.statusText}`);
      err.status = res.status;
      try { err.body = await res.json(); } catch {}
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    getMeta: () => request('/meta'),
    getPlayers: () => request('/players'),
    getKickoffs: () => request('/kickoffs'),
    getResults: () => request('/results'),
    getRanking: () => request('/ranking', {cache: 'no-store'}),
    getMatchPredictions: (matchId) => request('/matches/' + encodeURIComponent(matchId) + '/predictions'),
    access: (email, player, restore) => request('/access', {
      method: 'POST',
      body: JSON.stringify({email, player, restore: !!restore}),
    }),
    savePorra: (data, accessToken) => request('/porras', {
      method: 'POST',
      headers: accessToken ? {Authorization: `Bearer ${accessToken}`} : {},
      body: JSON.stringify(data),
    }),
  };
})();

if (typeof window !== 'undefined') window.API = API;
