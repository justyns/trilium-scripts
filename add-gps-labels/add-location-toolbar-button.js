// Frontend script to add a custom launcher button
api.createOrUpdateLauncher({
  id: 'update_location',
  type: 'script',
  title: 'Update Location',
  isVisible: true,
  icon: 'bx-map',
  keyboardShortcut: 'ctrl+shift+l', // this can be removed if you don't want a key shortcut
  scriptNoteId: 'iquE6wmrtZyv' // This should point to the note ID of 'add-gps-coords'
});