// https://github.com/justyns/trilium-scripts
// This script should be added as a js frontend script

async function addLabelsToNote(noteId, latitude, longitude) {
  // Create the label payload
  const payload = {
    secret: 'secretgoeshere',
    noteId: noteId,
    latitude: latitude.toString(),
    longitude: longitude.toString()
  };

  try {
    const response = await fetch('/custom/update-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('Attributes updated');
    } else {
      console.log('Failed to update attributes');
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }

}

const noteId = api.getActiveContextNote().noteId;
console.log(noteId);

// Request location from browser
navigator.geolocation.getCurrentPosition((position) => {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  addLabelsToNote(noteId, latitude, longitude)
    .catch((error) => {
      console.log('An error occurred:', error);
    });
}, (error) => {
  console.log('Geolocation error:', error);
});