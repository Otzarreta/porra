/* ═══════════════════════════════════════════════════════
   API CLIENT — habla con el backend Express
═══════════════════════════════════════════════════════ */
const API = (() => {
  const base = '/api';

  async function request(path, opts = {}) {
    const res = await fetch(base + path, {
      headers: {'Content-Type': 'application/json'},
      ...opts,
    });
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
    getMeta:    () => request('/meta'),
    getPorras:  () => request('/porras'),
    getPorra:   (id) => request('/porras/' + encodeURIComponent(id)),
    savePorra:  (data) => request('/porras', {method:'POST', body: JSON.stringify(data)}),
    getResults: () => request('/results'),
    getRanking: () => request('/ranking'),
  };
})();

if (typeof window !== 'undefined') window.API = API;
