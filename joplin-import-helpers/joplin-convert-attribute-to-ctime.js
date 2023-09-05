// https://github.com/justyns/trilium-scripts
// This script should be added as a js backend script
// Near the bottom is a note Id, it needs to be changed to the top-level note where you want to run it against
// WARNING: This uses sql directly and hasn't been tested super well.  Please make backups before running.

function transformDateFormat(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString();
}

async function updateNoteAndChildren(noteId) {
  const note = await api.getNote(noteId);

  if (!note) {
    api.log(`Note with ID ${noteId} not found.`);
    return;
  }

  let updatesNeeded = false;
  let updateContentNeeded = false;
  let sqlUpdate = 'UPDATE notes SET ';
  let sqlContentUpdate = 'UPDATE note_contents SET ';
  let params = [];

  let createdLabel = note.getLabelValue('created');
  let modifiedLabel = note.getLabelValue('modified') || note.getLabelValue('updated');

  if (createdLabel) {
    const createdUTC = transformDateFormat(createdLabel);
    sqlUpdate += 'dateCreated = ?, utcDateCreated = ? ';
    params.push(createdUTC, createdUTC);
    updatesNeeded = true;
  }

  if (modifiedLabel) {
    if (updatesNeeded) sqlUpdate += ', ';
    const modifiedUTC = transformDateFormat(modifiedLabel);
    sqlUpdate += 'dateModified = ?, utcDateModified = ?';
    params.push(modifiedUTC, modifiedUTC);
    updatesNeeded = true;

  }

  if (updatesNeeded) {
    sqlUpdate += ' WHERE noteId = ?';
    params.push(noteId);

    await api.sql.transactional(async () => {
      await api.sql.execute('UPDATE notes SET ' + sqlUpdate, params);
      if (modifiedLabel) {
        let sqlContentUpdate = 'UPDATE note_contents SET dateModified = ?, utcDateModified = ? WHERE noteId = ?';
        let modTime = transformDateFormat(modifiedLabel);
        await api.sql.execute(sqlContentUpdate, [modTime, modTime, noteId]);
      }
      api.log(`SQL update executed for note ${noteId}.`);
    });

    if (note.getLabelValue('created')) await note.removeAttribute('label', 'created');
    if (note.getLabelValue('modified')) await note.removeAttribute('label', 'modified');
    if (note.getLabelValue('updated')) await note.removeAttribute('label', 'updated');
    api.log(`Labels removed for note ${noteId}.`);

    const updatedNote = await api.getNote(noteId);
    api.log(`Updated dateCreated=${updatedNote.dateCreated}, dateModified=${updatedNote.dateModified}`);
  } else {
    api.log(`No labels 'created' or 'modified' found for note ${noteId}.`);
  }

  // Fetch and update child notes
  const childNoteIds = await api.sql.getRows(`SELECT noteId FROM branches WHERE parentNoteId = '${noteId}'`);
  // api.log(`Found ${childNoteIds.length} child notes`);
  for (const childNote of childNoteIds) {
    await updateNoteAndChildren(childNote.noteId);
  }
}

// Kick things off with the root note ID.
const rootNoteId = 'YunvRaCV0SgE';
updateNoteAndChildren(rootNoteId).catch(err => {
  console.error("An error occurred:", err);
});