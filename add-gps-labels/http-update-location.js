// https://github.com/justyns/trilium-scripts
// This script should be added as a js backend script with
// the label #customRequestHandler=update-location 

const {
  req,
  res
} = api;
const {
  secret,
  noteId,
  latitude,
  longitude
} = req.body;

if (req.method === 'POST' && secret === 'secretgoeshere') {
  try {
    // Fetch the note you want to update by its noteId
    const note = api.getNote(noteId);

    if (!note) {
      res.status(404).send("Note not found");
      return;
    }

    // Create new label attributes for the note
    const labels = [{
        type: "label",
        name: "latitude",
        value: latitude.toString(),
        isInheritable: false
      },
      {
        type: "label",
        name: "longitude",
        value: longitude.toString(),
        isInheritable: false
      }
    ];

    for (const label of labels) {
      note.setLabel(label.name, label.value);
    }

    res.status(200).send("Attributes updated successfully");
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send("Internal Server Error");
  }
} else {
  res.status(400).send("Bad Request");
}