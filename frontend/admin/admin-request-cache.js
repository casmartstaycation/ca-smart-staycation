/* CA Smart Staycation — admin request deduplication/cache */
(function(){
  const originalFetch = window.fetch.bind(window);
  const cache = new Map();
  const TTL = 15000;
  const paths = [
    '/api/bookings',
    '/api/rooms',
    '/api/parking',
    '/api/vouchers',
    '/api/settings',
    '/api/admin/inbox',
    '/api/settings/admin-notification-email'
  ];

  function pathFor(input){
    const req = input instanceof Request ? input : null;
    const raw = String(req ? req.url : input || '');
    try { return new URL(raw, location.href).pathname; } catch { return ''; }
  }

  function keyFor(input, init){
    const req = input instanceof Request ? input : null;
    const method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    if(method !== 'GET') return null;
    const path = pathFor(input);
    if(!paths.includes(path)) return null;
    try { return `${method} ${new URL(String(req ? req.url : input), location.href).href}`; } catch { return null; }
  }

  function cloneResponse(record){
    return new Response(record.text, {
      status: record.status,
      statusText: record.statusText,
      headers: record.headers
    });
  }

  window.fetch = function(input, init){
    const method = String((init && init.method) || (input instanceof Request && input.method) || 'GET').toUpperCase();
    const path = pathFor(input);
    const key = keyFor(input, init);

    if(method !== 'GET'){
      return originalFetch(input, init).then(response => {
        if(response.ok){
          for(const cachedPath of paths){
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
    if(existing && (existing.expiresAt > now || existing.promise)){
      return existing.promise ? existing.promise.then(cloneResponse) : Promise.resolve(cloneResponse(existing));
    }

    const promise = originalFetch(input, init).then(async response => {
      const text = await response.text();
      const record = {
        text,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        expiresAt: Date.now() + TTL
      };
      cache.set(key, record);
      return record;
    }).catch(error => {
      cache.delete(key);
      throw error;
    });

    cache.set(key, {promise, expiresAt: 0});
    return promise.then(cloneResponse);
  };

  window.caSmartAdminInvalidateCache = function(path){
    for(const key of cache.keys()) if(key.includes(path)) cache.delete(key);
  };
})();
