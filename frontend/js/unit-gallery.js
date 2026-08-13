const UNIT_GALLERY_API = "/api";

(function () {
  const css = `
    .unit-info-panel {
      margin-top: 18px;
      padding: 0;
      width: 100%;
      box-sizing: border-box;
      grid-column: 1 / -1;
    }

    .unit-gallery {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      width: 100%;
      box-sizing: border-box;
    }

    .unit-primary-photo {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 21 / 9;
      object-fit: cover;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid #ddd;
      box-sizing: border-box;
      background: #f5f3ef;
    }

    .unit-photo-thumbs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      margin-top: 10px;
      padding-bottom: 3px;
      width: 100%;
      box-sizing: border-box;
    }

    .unit-photo-thumbs img {
      width: 76px;
      height: 58px;
      object-fit: cover;
      border-radius: 5px;
      border: 1px solid #ddd;
      cursor: pointer;
      flex: 0 0 auto;
      background: #f5f3ef;
    }

    .unit-photo-thumbs img:hover {
      border-color: #c9a44c;
    }

    .unit-description {
      margin-top: 16px;
      padding: 18px;
      border: 1px solid #e2ddd5;
      border-radius: 8px;
      background: #fff;
    }

    .unit-description h3,
    .unit-amenities h3 {
      margin: 0 0 7px;
      font-size: 20px;
    }

    .unit-description p {
      margin: 0;
      line-height: 1.6;
      color: #555;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .unit-amenities {
      margin-top: 12px;
      padding: 18px;
      border: 1px solid #e2ddd5;
      border-radius: 8px;
      background: #fff;
    }

    .unit-amenity-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .unit-amenity {
      padding: 7px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #f8f6f2;
      font-size: 13px;
      color: #444;
    }

    .unit-gallery-message {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 180px;
      padding: 20px;
      background: #f5f3ef;
      border: 1px solid #e2ddd5;
      border-radius: 8px;
      color: #888;
      text-align: center;
    }

    .unit-lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.87);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 25px;
      box-sizing: border-box;
    }

    .unit-lightbox img {
      max-width: 94vw;
      max-height: 88vh;
      object-fit: contain;
      border-radius: 8px;
    }

    .unit-lightbox button {
      position: absolute;
      background: none;
      border: 0;
      color: #fff;
      cursor: pointer;
    }

    .unit-lightbox .unit-close {
      right: 22px;
      top: 14px;
      font-size: 42px;
    }

    .unit-lightbox .unit-nav {
      top: 50%;
      transform: translateY(-50%);
      font-size: 52px;
      padding: 12px 18px;
    }

    .unit-lightbox .unit-prev {
      left: 12px;
    }

    .unit-lightbox .unit-next {
      right: 12px;
    }

    @media (max-width: 700px) {
      .unit-primary-photo {
        aspect-ratio: 16 / 10;
      }

      .unit-info-panel {
        margin-top: 14px;
      }

      .unit-photo-thumbs img {
        width: 68px;
        height: 52px;
      }
    }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  let units = [];

  const CACHE_KEY = "caSmartStaycationRoomsGallery";
  const CACHE_TTL = 5 * 60 * 1000;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function isParkingOnly() {
    return String(
      document.getElementById("bookingType")?.value || ""
    ).toLowerCase() === "parking";
  }

  /*
   * Convert database image values into usable browser URLs.
   *
   * Handles:
   *   https://...
   *   /uploads/...
   *   uploads/...
   *   filename.jpg
   */
  function normalizeImage(value) {
    if (!value) return "";

    let src = "";

    if (typeof value === "string") {
      src = value.trim();
    } else if (typeof value === "object") {
      src = String(
        value.url ||
        value.path ||
        value.filename ||
        value.file ||
        value.src ||
        ""
      ).trim();
    }

    if (!src) return "";

    if (/^(https?:)?\/\//i.test(src)) {
      return src;
    }

    if (src.startsWith("data:")) {
      return src;
    }

    if (src.startsWith("/")) {
      return src;
    }

    if (src.startsWith("uploads/")) {
      return `/${src}`;
    }

    return `/uploads/${src}`;
  }

  function getUnitImages(unit) {
    if (!unit) return [];

    const possibleSources = [
      unit.images,
      unit.photos,
      unit.gallery,
      unit.galleryImages,
      unit.imageUrls
    ];

    let source = possibleSources.find(
      Array.isArray
    );

    if (!source) return [];

    return source
      .map(normalizeImage)
      .filter(Boolean);
  }

  function openPhoto(images, startIndex) {
    if (!images.length) return;

    let index = startIndex;

    const modal = document.createElement("div");
    modal.className = "unit-lightbox";

    modal.innerHTML = `
      <button
        type="button"
        class="unit-close"
        aria-label="Close"
      >×</button>

      <button
        type="button"
        class="unit-nav unit-prev"
        aria-label="Previous photo"
      >‹</button>

      <img
        alt="Accommodation photo"
      >

      <button
        type="button"
        class="unit-nav unit-next"
        aria-label="Next photo"
      >›</button>
    `;

    const img = modal.querySelector("img");

    function show() {
      index = (index + images.length) % images.length;
      img.src = images[index];
      img.alt = `Accommodation photo ${index + 1} of ${images.length}`;
    }

    function close() {
      document.removeEventListener("keydown", keyHandler);
      modal.remove();
    }

    function keyHandler(event) {
      if (!document.body.contains(modal)) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        index--;
        show();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        index++;
        show();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    modal.querySelector(".unit-prev").onclick = (event) => {
      event.stopPropagation();
      index--;
      show();
    };

    modal.querySelector(".unit-next").onclick = (event) => {
      event.stopPropagation();
      index++;
      show();
    };

    modal.querySelector(".unit-close").onclick = close;

    modal.onclick = (event) => {
      if (event.target === modal) {
        close();
      }
    };

    document.addEventListener("keydown", keyHandler);

    document.body.appendChild(modal);

    show();
  }

  function selected() {
    const room = document.getElementById("room");

    if (!room) return null;

    const id = String(room.value || "");

    if (!id) return null;

    return units.find(
      (unit) => String(unit._id) === id
    ) || null;
  }

  function getPanel() {
    let panel = document.getElementById("unitInfoPanel");

    if (panel) return panel;

    const room = document.getElementById("room");

    if (!room) return null;

    const group =
      document.getElementById("roomGroup") ||
      room.closest(".form-group") ||
      room.parentElement;

    if (!group) return null;

    panel = document.createElement("div");

    panel.id = "unitInfoPanel";
    panel.className = "unit-info-panel";

    /*
     * Put gallery before the calendar.
     */
    const formGrid =
      group.closest(".form-grid") ||
      document.querySelector(".form-grid");

    const calendarGrid =
      document.getElementById("calendarGrid");

    const calendarGroup =
      calendarGrid?.closest(".form-group") ||
      calendarGrid?.parentElement;

    if (formGrid && calendarGroup) {
      formGrid.insertBefore(panel, calendarGroup);
    } else if (group.parentElement) {
      group.parentElement.appendChild(panel);
    }

    return panel;
  }

  function render() {
    const room = document.getElementById("room");

    if (!room) return;

    const panel = getPanel();

    if (!panel) {
      console.warn(
        "CA Smart Staycation: #roomInfoPanel could not be created because #room was not found."
      );
      return;
    }

    /*
     * Parking-only booking must not show accommodation gallery.
     */
    if (isParkingOnly()) {
      panel.style.display = "none";
      panel.innerHTML = "";
      return;
    }

    panel.style.display = "";

    const unit = selected();

    if (!unit) {
      panel.innerHTML = `
        <div class="unit-gallery-message">
          Select an accommodation to view photos.
        </div>
      `;
      return;
    }

    const images = getUnitImages(unit);

    const amenities =
      Array.isArray(unit.amenities)
        ? unit.amenities.filter(Boolean)
        : [];

    const unitName =
      unit.unitName ||
      unit.name ||
      unit.unitNumber ||
      "Selected Accommodation";

    panel.innerHTML = `
      <div class="unit-gallery">

        ${
          images.length
            ? `
              <img
                class="unit-primary-photo"
                loading="lazy"
                src="${esc(images[0])}"
                alt="${esc(unitName)}"
                data-photo="0"
              >

              <div class="unit-photo-thumbs">
                ${
                  images.map((image, index) => `
                    <img
                      loading="lazy"
                      src="${esc(image)}"
                      alt="Photo ${index + 1}"
                      data-photo="${index}"
                    >
                  `).join("")
                }
              </div>
            `
            : `
              <div class="unit-gallery-message">
                No photos available for this accommodation.
              </div>
            `
        }

        <div class="unit-description">
          <h3>${esc(unitName)}</h3>

          <p>${esc(
            unit.description ||
            "No description available for this accommodation."
          )}</p>
        </div>

        ${
          amenities.length
            ? `
              <div class="unit-amenities">
                <h3>Amenities</h3>

                <div class="unit-amenity-list">
                  ${
                    amenities.map((amenity) => `
                      <span class="unit-amenity">
                        ${esc(amenity)}
                      </span>
                    `).join("")
                  }
                </div>
              </div>
            `
            : ""
        }

      </div>
    `;

    /*
     * Gallery click handlers.
     */
    panel
      .querySelectorAll("[data-photo]")
      .forEach((element) => {
        element.addEventListener("click", () => {
          openPhoto(
            images,
            Number(element.dataset.photo)
          );
        });
      });

    /*
     * If an image fails, show a useful fallback
     * instead of leaving a broken image icon.
     */
    panel
      .querySelectorAll("img")
      .forEach((image) => {
        image.addEventListener(
          "error",
          () => {
            image.style.display = "none";
          },
          { once: true }
        );
      });
  }

  function useCached() {
    try {
      const raw =
        sessionStorage.getItem(CACHE_KEY);

      if (!raw) return false;

      const cached =
        JSON.parse(raw);

      if (
        !cached?.timestamp ||
        Date.now() - cached.timestamp > CACHE_TTL ||
        !Array.isArray(cached.data)
      ) {
        sessionStorage.removeItem(CACHE_KEY);
        return false;
      }

      units = cached.data;

      render();

      return true;

    } catch {
      return false;
    }
  }

  async function load() {
    if (isParkingOnly()) {
      return;
    }

    /*
     * Try cached data first.
     */
    if (useCached()) {
      return;
    }

    try {
      const controller =
        new AbortController();

      const timer =
        setTimeout(
          () => controller.abort(),
          10000
        );

      const response =
        await fetch(
          `${UNIT_GALLERY_API}/rooms`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              Accept: "application/json"
            },
            signal: controller.signal
          }
        );

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(
          `Rooms API returned HTTP ${response.status}`
        );
      }

      const json =
        await response.json();

      /*
       * Support both:
       * { data: [...] }
       * { rooms: [...] }
       * [...]
       */
      let roomData = [];

      if (Array.isArray(json)) {
        roomData = json;
      } else if (Array.isArray(json.data)) {
        roomData = json.data;
      } else if (Array.isArray(json.rooms)) {
        roomData = json.rooms;
      } else if (
        Array.isArray(json.data?.rooms)
      ) {
        roomData = json.data.rooms;
      }

      if (!roomData.length) {
        console.warn(
          "CA Smart Staycation: /api/rooms returned no accommodation records.",
          json
        );

        units = [];

        render();

        return;
      }

      units = roomData;

      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            data: units
          })
        );
      } catch {}

      render();

    } catch (error) {

      console.error(
        "CA Smart Staycation: unable to load accommodation gallery.",
        error
      );

      /*
       * Do not leave an old/stale gallery visible.
       */
      units = [];

      render();
    }
  }

  function setup() {
    const room =
      document.getElementById("room");

    const bookingType =
      document.getElementById("bookingType");

    /*
     * Accommodation selector.
     */
    if (room) {
      room.addEventListener(
        "change",
        () => {
          render();

          /*
           * Refresh room information after
           * selecting accommodation.
           */
          load();
        }
      );
    }

    /*
     * Booking type selector.
     *
     * Gallery:
     *   accommodation       -> SHOW
     *   accommodation+parking -> SHOW
     *   parking              -> HIDE
     */
    if (bookingType) {
      bookingType.addEventListener(
        "change",
        () => {

          const type =
            String(
              bookingType.value || ""
            ).toLowerCase();

          const panel =
            document.getElementById(
              "unitInfoPanel"
            );

          if (type === "parking") {

            if (panel) {
              panel.style.display = "none";
              panel.innerHTML = "";
            }

          } else {

            if (panel) {
              panel.style.display = "";
            }

            load();
            render();
          }
        }
      );
    }

    /*
     * Initial load.
     */
    if (!isParkingOnly()) {
      load();
    } else {
      const panel =
        document.getElementById(
          "unitInfoPanel"
        );

      if (panel) {
        panel.style.display = "none";
      }
    }
  }

  /*
   * Handle pages where script.js creates
   * the booking form after DOMContentLoaded.
   */
  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      setup,
      { once: true }
    );
  } else {
    setup();
  }

  /*
   * Some booking-page implementations populate
   * #room asynchronously. Watch for it and
   * refresh the gallery without requiring
   * another page reload.
   */
  const observer =
    new MutationObserver(() => {

      const room =
        document.getElementById("room");

      const bookingType =
        document.getElementById(
          "bookingType"
        );

      if (!room) return;

      if (
        bookingType &&
        String(
          bookingType.value || ""
        ).toLowerCase() === "parking"
      ) {
        return;
      }

      /*
       * Only render if the selected room
       * has changed.
       */
      const currentId =
        String(room.value || "");

      if (
        currentId &&
        units.some(
          (unit) =>
            String(unit._id) === currentId
        )
      ) {
        render();
      }

    });

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

})();
