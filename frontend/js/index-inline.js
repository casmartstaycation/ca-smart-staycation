document.addEventListener('DOMContentLoaded', () => {
  const type = document.getElementById('bookingType');
  const idSection = document.getElementById('governmentIdSection');
  const idInput = document.getElementById('governmentId');
  const room = document.getElementById('room');
  const roomGroup = document.getElementById('roomGroup');
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
