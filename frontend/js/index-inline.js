document.addEventListener('DOMContentLoaded', () => {
  const type = document.getElementById('bookingType');
  const idSection = document.getElementById('governmentIdSection');
  const idInput = document.getElementById('governmentId');
  const room = document.getElementById('room');
  const roomGroup = document.getElementById('roomGroup');

  // This helper is shared by some booking pages, but not every page contains
  // all of these controls. Silently do nothing when the controls are absent.
  if (!type || !idSection || !idInput || !room || !roomGroup) return;

  function updateDocumentRequirements() {
    const parkingOnly = type.value === 'parking';
    idSection.style.display = parkingOnly ? 'none' : '';
    idInput.required = !parkingOnly;
    if (parkingOnly) idInput.value = '';
    room.required = !parkingOnly;
    roomGroup.style.display = parkingOnly ? 'none' : '';
  }

  type.addEventListener('change', updateDocumentRequirements);
  updateDocumentRequirements();
});
