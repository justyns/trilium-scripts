// https://github.com/justyns/trilium-scripts
// This script is meant to be added as a frontend js note.  It adds a simple command palette
// that can execute other script notes.  This version can also search through
// regular notes in addition to executing commands.
// 
// It is similar to the command palette in palette-testing.js, but uses the built-in widget code
// and type of modal used by the jump-to-note feature.
// 
// To register a note for the command palette, add the following label: cmdPalette
// The value of `cmdPalette` is used as the name/description of the command.
// The palette can be opened by swiping down on mobile, or pressing cmd+shift+p / ctrl+shift+p on desktop.
//
// To activate this script, you'll need to add the following label attributes to the script note:
//   #widget #run=mobileStartup 

// Note:  This is very experimental right now
const CMD_PALETTE_TPL = `
<div id="command-palette-dialog" class="modal mt-auto" tabindex="-1" role="dialog">
  <div class="modal-dialog modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Command Palette</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        <input type="text" class="form-control search-box" placeholder="Type to search...">
        <div class="command-container mt-3"></div>
      </div>
    </div>
  </div>
</div>
`;

function addStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
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
  background-color: var(--active-item-background-color);
  color: var(--active-item-text-color);
}
.command-item.selected .meta {
  font-size: 11px;
  color: var(--active-item-text-color);
}
.command-item .meta {
  font-size: 11px;
  // color: var(--active-item-text-color);
}
`;
  document.head.appendChild(style);
}

// meant to run in the backend to query notes
async function getAvailableCommands(query) {
  query = query.toLowerCase();
  const cmdNotes = await api.getNotesWithLabel('cmdPalette');
  const cmdObjs = cmdNotes.map(n => ({
    id: n.noteId,
    name: n.getLabelValue('cmdPalette'),
    description: n.getLabelValue('cmdPaletteDesc'),
    isCmd: true,
  }));
  return cmdObjs.filter(cmd => cmd.name.toLowerCase().includes(query));
}

// meant to run in the backend to query notes
async function searchNotes(query) {
  let notes = await api.searchForNotes(query)
  notes.sort((a, b) => {
    const aDate = a.utcDateModified || a.utcDateCreated;
    const bDate = b.utcDateModified || b.utcDateCreated;
    return new Date(bDate) - new Date(aDate);
  });
  const noteObjs = notes.map(n => ({
    id: n.noteId,
    name: n.title,
    // TODO: This path looks like root/oNMdLSYltGKH/d7khRTr4hOG2/6uKcCZ7G3ucB/NAICpE8qdo7v/Uf36joVIOPnC/CO4q2TGsJDHK instead of the friendly version
    path: n.getBestNotePathString(),
    isCmd: false,
    creationTime: n.utcDateCreated,
    modificationTime: n.utcDateModified,
  }));
  return noteObjs
}

async function getAvailableNotes(query) {
  const noteObjs = await api.runOnBackend(searchNotes, [query]);
  // console.log('Available notes:');
  // console.log(noteObjs);
  return noteObjs;
}


// Executes a command based on the selected item, or go to selected note
async function executeCommand(selectedItem) {
  const noteId = $(selectedItem).data('note-id');
  const isCmd = $(selectedItem).data('is-cmd');

  console.log("Executing:", selectedItem.textContent, "Note ID:", noteId);

  if (noteId) {
    const note = await api.getNote(noteId);

    if (!note) {
      api.log(`Note with ID ${noteId} not found.`);
      return;
    }

    // If it's a command, execute the note as a script
    if (isCmd) {
      await note.executeScript();
    } else {
      // Otherwise, open the note and focus on it
      api.activateNote(noteId);
      await api.waitUntilSynced();
    }
  }
}

class CommandAndNotePalette {
  constructor() {
    this.$widget = $('#command-palette-dialog');
    this.$searchBox = this.$widget.find('.search-box');
    this.$commandContainer = this.$widget.find('.command-container');
    this.selectedIndex = 0;
    this.modalActive = false;


    // Need to handle both any input for searching, and specific keydown events for navigation
    this.$searchBox.on('input', () => this.handleSearchInput());
    this.$widget.on('keydown', (e) => this.handleKeydown(e));

    // Helpers to keep track of whether the modal is active
    this.$widget.on('shown.bs.modal', () => {
      this.modalActive = true;
    });
    this.$widget.on('hidden.bs.modal', () => {
      this.modalActive = false;
    });
  }

  // Filters the list of available commands or notes based on the search box input
  async handleSearchInput() {
    const query = this.$searchBox.val().trim();
    this.selectedIndex = 0; // reset selected index
    if (!query) {
      this.showCommands('');
      return;
    }
    if (query.startsWith('>')) {
      this.showCommands(query.substring(1));
    } else {
      this.showNotes(query);
    }
  }

  async handleKeydown(e) {
    if (!this.modalActive) return;

    const commandItems = Array.from(this.$commandContainer[0].getElementsByClassName('command-item'))
      .filter(item => item.style.display !== 'none');

    if (e.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % commandItems.length;
    } else if (e.key === 'ArrowUp') {
      this.selectedIndex = (this.selectedIndex - 1 + commandItems.length) % commandItems.length;
    } else if (e.key === 'Enter') {
      const selectedItem = commandItems[this.selectedIndex];
      if (selectedItem) {
        await executeCommand(selectedItem);
        this.$widget.modal('hide');
        return;
      }
    }

    commandItems.forEach((item, index) => {
      item.classList.toggle('selected', this.selectedIndex === index);
    });

    // Auto-scroll logic
    const selectedItem = commandItems[this.selectedIndex];
    if (selectedItem) {
      const container = this.$commandContainer[0];
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.clientHeight;

      // console.log(`itemTop: ${itemTop}, containerTop: ${containerTop}, scrollTop: ${container.scrollTop}, container offset height: ${container.offsetHeight}, item offset height: ${selectedItem.offsetHeight}, container client height: ${container.clientHeight}, item client height: ${selectedItem.clientHeight}`);

      // Scroll up or down depending on whether the selected item is visible
      if (itemTop <= containerTop || (this.selectedIndex === 0 && containerTop > 0)) {
        container.scrollTop -= (itemTop + selectedItem.clientHeight);
      } else if (itemBottom > containerBottom) {
        container.scrollTop += (itemBottom - containerBottom);
      }
    }
    // console.log(`selectedIndex: ${this.selectedIndex}`);
  }


  async showCommands(query) {
    const commands = await api.runOnBackend(getAvailableCommands, [query.trim()]);
    await this.renderItems(commands);
  }

  async showNotes(query) {
    const notes = await getAvailableNotes(query.trim());
    await this.renderItems(notes);
  }

  async handleItemInteraction($itemDiv, index) {
    this.selectedIndex = index;
    await executeCommand($itemDiv);
    this.$widget.modal('hide');
  }

  async renderItems(items) {
    this.$commandContainer.empty();
    items.forEach((item, index) => {
      let displayText = `${item.name}`;
      if (item.description) {
        displayText += ` <span class="meta"> - ${item.description}</span>`;
      }
      if (item.creationTime || item.modificationTime) {
        displayText += ` <span class="meta">| Created: ${item.creationTime} | Modified: ${item.modificationTime}</span>`;
      }
      // TODO: Make this look prettier
      const $itemDiv = $(`<div class="command-item" data-note-id="${item.id}" data-is-cmd="${item.isCmd}">${displayText}</div>`);
      $itemDiv.on('click', () => this.handleItemInteraction($itemDiv, index));
      // $itemDiv.on('touchend', function(e) {
      //   e.preventDefault();
      //   e.stopPropagation();
      //   handleItemInteraction.call(this, $itemDiv, index);
      // }.bind(this));
      if (index === this.selectedIndex) {
        $itemDiv.addClass('selected');
      }
      this.$commandContainer.append($itemDiv);
    });
  }

  showDialog() {
    this.$widget.modal('show');
    this.$searchBox.val('> ');
    this.handleSearchInput();
  }
}

function init() {
  $('body').append(CMD_PALETTE_TPL);
  const palette = new CommandAndNotePalette();
  addStyles();

  $('#command-palette-dialog').on('shown.bs.modal', function() {
    setTimeout(() => {
      // This should auto focus the search box and put the cursor after the >
      palette.$searchBox.focus();
      palette.$searchBox[0].setSelectionRange(2, 2);
    }, 0);
  });

  document.addEventListener("keydown", async function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyP") {
      // console.log('opening palette');
      palette.showDialog();
    }
  });

  let startY, startX;
  let disablePullToRefresh = false;

  // Support for swiping down on mobile to open the palette modal
  document.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
    if (startY < 100) { // 100 pixels from the top
      // Only set startX if the swipe starts near the top
      startX = e.touches[0].clientX;
      disablePullToRefresh = true;
    } else {
      startX = null; // Reset startX to prevent unwanted swipes
      disablePullToRefresh = false;
    }
  }, false);

  document.addEventListener('touchmove', function(e) {
    if (disablePullToRefresh) {
      e.preventDefault(); // prevents pull-to-refresh on chrome
    }
  }, {
    passive: false
  });

  document.addEventListener('touchend', async function(e) {
    if (startX === null) return; // Ignore if swipe didn't start near the top

    let endX = e.changedTouches[0].clientX;
    let endY = e.changedTouches[0].clientY;

    const dx = startX - endX;
    const dy = startY - endY;

    // only care if we're swiping down
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 100) {
      if (dy < 0) {
        // console.log('Swipe down detected');
        if (window.navigator && window.navigator.vibrate) {
          navigator.vibrate(100); // vibrate for 100 ms
        }
        palette.showDialog();
      }
    }
  }, false);

  // I ran into issues with the keyboard shortcuts not working in the modal unless it was initialized early
  $('#command-palette-dialog').modal({
    show: false
  });
}

$(document).ready(function() {
  // Wait til the rest of the page is ready and then init everything since we're injecting stuff into the dom
  init();
});