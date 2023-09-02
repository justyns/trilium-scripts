// https://github.com/justyns/trilium-scripts
// This script is meant to be added as a frontend js note.  It adds a simple command palette
// that can execute other script notes.
// To register a note for the command palette, add the following label: cmdPalette
// The value of `cmdPalette` is used as the name/description of the command.
// The palette can be opened by swiping down on mobile, or pressing cmd+shift+p / ctrl+shift+p on desktop.

// Note:  This is very experimental right now

let paletteKeydownHandler;

async function getAvailableCommands() {
  const cmdNotes = await api.getNotesWithLabel('cmdPalette');
  return cmdNotes.map(n => ({ id: n.noteId, name: n.getLabelValue('cmdPalette') }));
}

function updateSelectedCommand(selectedIndex, palette) {
  const commandItems = Array.from(palette.getElementsByClassName('command-item'))
    .filter(item => item.style.display !== 'none');
    
  selectedIndex = (selectedIndex + commandItems.length) % commandItems.length;
  
  commandItems.forEach((item, index) => {
    item.classList.toggle('selected', selectedIndex === index);
  });
  return selectedIndex;
}

async function executeCommand(commandObj) {
  const note = await api.getNote(commandObj.id);
  note ? await note.executeScript() : console.log('Note not found.');
}

function createPaletteElement() {
  const palette = document.createElement('div');
  palette.id = 'commandPalette';
  palette.className = 'command-palette';
  document.body.appendChild(palette);
  return palette;
}

async function showPalette(commands, palette) {
  console.log('Inside showPalette:', commands);
  palette.innerHTML = '';
  let selectedIndex = 0;

  paletteKeydownHandler = async function(e) {
    if (e.key === 'ArrowDown') {
      selectedIndex++;
    } else if (e.key === 'ArrowUp') {
      selectedIndex--;
    } else if (['Enter', 'Escape'].includes(e.key)) {
      if (e.key === 'Enter') await executeCommand(commands[selectedIndex]);
      palette.style.display = 'none';
      palette.removeEventListener('keydown', paletteKeydownHandler);
      return;
    }
    e.preventDefault();
    selectedIndex = updateSelectedCommand(selectedIndex, palette);
  }
    
  palette.addEventListener('keydown', paletteKeydownHandler);

  const searchBox = document.createElement('input');
  searchBox.type = 'text';
  searchBox.placeholder = 'Search commands...';
  searchBox.className = 'search-box';
  searchBox.oninput = () => updateSelectedCommand(selectedIndex, palette);
  palette.appendChild(searchBox);

  const commandContainer = document.createElement('div');
  commandContainer.className = 'command-container';
  commands.forEach((command, index) => {
    const item = document.createElement('div');
    item.className = 'command-item';
    item.textContent = command.name;
    item.onclick = async () => {
      await executeCommand(command);
      palette.style.display = 'none';
      palette.removeEventListener('keydown', paletteKeydownHandler);
    };
    item.classList.toggle('selected', selectedIndex === index);
    commandContainer.appendChild(item);
  });
  palette.appendChild(commandContainer);
  palette.style.display = 'block';
  setTimeout(() => searchBox.focus(), 0);
}

function addStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
.command-palette {
  display: none;
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 75%;
  max-width: 100%;
  background-color: #1E1E1E;
  color: white;
  border: 1px solid #3C3C3C;
  border-radius: 4px;
  padding: 10px;
  z-index: 9999;
}

@media screen and (max-width: 768px) {
  .command-palette {
    width: 100%; /* full width on mobile screens */
    left: 0;
    transform: translate(0, -50%);
  }
}

.command-container {
  max-height: 200px;
  overflow-y: scroll;
}
.command-item {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #3C3C3C;
}
.command-item.selected {
  background-color: #3C3C3C;
}
`;
  document.head.appendChild(style);
}

function init() {
  addStyles();
  const palette = createPaletteElement();
  console.log('Palette element:', palette);

  document.addEventListener("keydown", async function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyP") {
      const commands = await api.runOnBackend(getAvailableCommands, []);
      await showPalette(commands, palette);
    }
  });
    
    let startY, startX;
    let disablePullToRefresh = false;

    document.addEventListener('touchstart', function(e) {
      startY = e.touches[0].clientY;
      if (startY < 100) {  // 100 pixels from the top
        // Only set startX if the swipe starts near the top
        startX = e.touches[0].clientX;
        disablePullToRefresh = true;
      } else {
        startX = null;  // Reset startX to prevent unwanted swipes
        disablePullToRefresh = false;
      }
    }, false);
    
    document.addEventListener('touchmove', function(e) {
      if (disablePullToRefresh) {   
        e.preventDefault(); // may prevent pull-to-refresh
      }
    }, { passive: false });

    document.addEventListener('touchend', async function(e) {
      if (startX === null) return;  // Ignore if swipe didn't start near the top

      let endX = e.changedTouches[0].clientX;
      let endY = e.changedTouches[0].clientY;

      const dx = startX - endX;
      const dy = startY - endY;

      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 100) {
        if (dy < 0) {
          console.log('Swipe down detected');
          if (window.navigator && window.navigator.vibrate) {
            navigator.vibrate(100);  // vibrate for 100 ms
          }
          const commands = await api.runOnBackend(getAvailableCommands, []);
          await showPalette(commands, palette);
        }
      }
    }, false);

}

// Initialize the script
init();