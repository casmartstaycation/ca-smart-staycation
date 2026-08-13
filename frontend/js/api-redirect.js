/*
 * CA Smart Staycation API routing fix
 *
 * The guest booking page previously hard-coded the retired Render API URL.
 * Keep older scripts compatible by transparently routing that URL to the
 * same-origin Vercel /api endpoint. This also fixes the unit gallery,
 * because unit-gallery.js uses the same legacy API base URL.
 */
(function () {
    "use strict";

    const LEGACY_API = "https://ca-smart-staycation-muqd.onrender.com/api";
    const SAME_ORIGIN_API = "/api";

    if (typeof window.fetch !== "function") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        try {
            if (typeof input === "string" && input.indexOf(LEGACY_API) === 0) {
                input = SAME_ORIGIN_API + input.slice(LEGACY_API.length);
            } else if (input instanceof Request && input.url.indexOf(LEGACY_API) === 0) {
                input = new Request(
                    SAME_ORIGIN_API + input.url.slice(LEGACY_API.length),
                    input
                );
            }
        } catch (error) {
            console.warn("API URL rewrite failed; using original request.", error);
        }

        return originalFetch(input, init);
    };
})();
