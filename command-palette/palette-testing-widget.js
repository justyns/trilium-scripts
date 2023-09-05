const CMD_PALETTE_TPL = `
<div id="command-palette-dialog" class="modal mx-auto" tabindex="-1" role="dialog">
  <div class="modal-dialog modal-dialog-centered" role="document">
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
`;
  document.head.appendChild(style);
}

async function getAvailableCommands(query) {
  query = query.toLowerCase();
  const cmdNotes = await api.getNotesWithLabel('cmdPalette');
  const cmdObjs = cmdNotes.map(n => ({ id: n.noteId,
                                       name: n.getLabelValue('cmdPalette'),
                                       isCmd: true,
                                    }));
  return cmdObjs.filter(cmd => cmd.name.toLowerCase().includes(query));
}

async function searchNotes(query) {
  return await api.searchForNotes(query)
}

async function getAvailableNotes(query) {
  const notes = await api.runOnBackend(searchNotes, [query])
  const noteObjs = notes.map(n => ({ id: n.noteId,
                                     name: n.title,
                                     isCmd: false,
                                    }));
  return noteObjs;
}

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
    if (isCmd) {
      await note.executeScript();
    } else {
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

    
    this.$searchBox.on('input', () => this.handleSearchInput());
    this.$widget.on('keydown', (e) => this.handleKeydown(e));
    this.$widget.on('shown.bs.modal', () => {
      this.modalActive = true;
    });
    this.$widget.on('hidden.bs.modal', () => {
      this.modalActive = false;
    });
  }
  
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

      if (itemTop <= containerTop || (this.selectedIndex === 0 && containerTop > 0)) {
        // container.scrollTop -= (containerTop - itemTop);
        container.scrollTop -= (itemTop + selectedItem.clientHeight);
        // container.scrollTop = itemTop;
      } else if (itemBottom > containerBottom) {
        container.scrollTop += (itemBottom - containerBottom);
        // container.scrollTop = itemTop;
      }
    }
    // console.log(`selectedIndex: ${this.selectedIndex}`);
  }


  async showCommands(query) {
    const commands = await api.runOnBackend(getAvailableCommands, [query.trim()]);
    this.renderItems(commands);
  }

  async showNotes(query) {
    const notes = await getAvailableNotes(query.trim());
    await this.renderItems(notes);
  }

  async renderItems(items) {
    this.$commandContainer.empty();
    items.forEach((item, index) => {
      const $itemDiv = $(`<div class="command-item" data-note-id="${item.id}" data-is-cmd="${item.isCmd}">${item.name}</div>`);
        $itemDiv.on('click', async () => {
          await executeCommand(item);
          this.$widget.modal('hide');
        });
        
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
  
  $('#command-palette-dialog').on('shown.bs.modal', function () {
    setTimeout(() => {
      palette.$searchBox.focus();
      palette.$searchBox[0].setSelectionRange(2, 2);
    }, 0);
  });

  document.addEventListener("keydown", async function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyP") {
      console.log('opening palette');
      palette.showDialog();
    }
  });

  $('#command-palette-dialog').modal({ show: false });
}

$(document).ready(function() {
  init();
});