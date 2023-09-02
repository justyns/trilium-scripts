# trilium-scripts
Scripts and utilities for [Trilium](https://github.com/zadam/trilium).

**Note**:  I am new to Trilium, and am not a javascript dev.  Please feel free to suggest improvements!


## add-gps-labels

This is a combination of a frontend and backend script.   The frontend script requests your current gps location from the browser and then sends it to the backend script to update the label attributes on the current note.  `#latitude=` and `#longitude=` labels are used to store the coordinates.

It doesn't work on the desktop Electron builds, but should work fine in mobile (and desktop) browsers.  When running the script for the first time, you shoul get prompted to allow location permissions.

See <https://github.com/zadam/trilium/discussions/4201> for the original background.
