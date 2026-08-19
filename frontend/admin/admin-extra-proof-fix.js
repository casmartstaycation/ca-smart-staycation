(function () {
  'use strict';

  function repair(root) {
    (root || document).querySelectorAll('a[href*="/file/extra-request"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (/\/file\/extra-request\/[^/?#]+(?:[/?#]|$)/i.test(href)) return;
      const block = link.closest('.notes');
      const text = block ? block.parentElement?.textContent || block.textContent || '' : '';
      const match = text.match(/Extra (?:Guest|Set of Amenities) Request\s*#(\d+)/i);
      if (!match) return;
      const index = Math.max(0, Number(match[1]) - 1);
      link.setAttribute('href', `${href.replace(/\/$/, '')}/${index}`);
      link.dataset.adminFile = '1';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => repair());
  else repair();

  const details = document.getElementById('bookingDetails');
  if (details) new MutationObserver(() => repair(details)).observe(details, { childList: true, subtree: true });
})();
