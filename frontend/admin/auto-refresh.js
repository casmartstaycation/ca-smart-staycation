/* CA Smart Staycation — Admin request optimization + booking auto-refresh */
(function(){
  const originalFetch = window.fetch.bind(window);
  const cache = new Map();
  const CACHE_TTL = 15000;
  const CACHED_PATHS = [
    '/api/bookings',
    '/api/rooms',
    '/api/parking',
    '/api/vouchers',
    '/api/settings',
    '/api/admin/inbox',
    '/api/settings/admin-notification-email'
  ];

  function getPath(input){
    const req = input instanceof Request ? input : null;
    try { return new URL(String(req ? req.url : input || ''), location.href).pathname; }
    catch { return ''; }
  }

  function getKey(input, init){
    const req = input instanceof Request ? input : null;
    const method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    if(method !== 'GET') return null;
    const path = getPath(input);
    if(!CACHED_PATHS.includes(path)) return null;
    try { return `${method} ${new URL(String(req ? req.url : input), location.href).href}`; }
    catch { return null; }
  }

  function makeResponse(record){
    return new Response(record.text, {
      status: record.status,
      statusText: record.statusText,
      headers: record.headers
    });
  }

  window.fetch = function(input, init){
    const req = input instanceof Request ? input : null;
    const method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    const path = getPath(input);
    const key = getKey(input, init);

    // Any successful write invalidates the related GET cache immediately.
    if(method !== 'GET'){
      return originalFetch(input, init).then(response=>{
        if(response.ok){
          for(const cachedPath of CACHED_PATHS){
            if(path === cachedPath || path.startsWith(`${cachedPath}/`)){
              for(const cachedKey of cache.keys()){
                if(cachedKey.includes(cachedPath)) cache.delete(cachedKey);
              }
            }
          }
        }
        return response;
      });
    }

    if(!key) return originalFetch(input, init);

    const now = Date.now();
    const existing = cache.get(key);
    if(existing && (existing.promise || existing.expiresAt > now)){
      return existing.promise
        ? existing.promise.then(makeResponse)
        : Promise.resolve(makeResponse(existing));
    }

    const promise = originalFetch(input, init).then(async response=>{
      const text = await response.text();
      const record = {
        text,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        expiresAt: Date.now() + CACHE_TTL
      };
      cache.set(key, record);
      return record;
    }).catch(error=>{
      cache.delete(key);
      throw error;
    });

    cache.set(key, {promise, expiresAt:0});
    return promise.then(makeResponse);
  };

  window.caSmartAdminInvalidateCache = function(path){
    for(const key of cache.keys()) if(key.includes(path)) cache.delete(key);
  };

  const REFRESH_MS = 120000;
  let refreshInProgress = false;
  async function refreshAdminBookings(){
    if(refreshInProgress || document.hidden || typeof window.loadBookings !== 'function') return;
    refreshInProgress = true;
    try { await window.loadBookings(true); }
    finally { refreshInProgress = false; }
  }
  setInterval(refreshAdminBookings, REFRESH_MS);
})();
