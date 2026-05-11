// Figma plugin entrypoint — runs in Figma's plugin sandbox
// This file is excluded from unit tests

figma.showUI(__html__, { width: 400, height: 500 });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'Select at least one frame or component' });
      return;
    }
    // Dynamic imports to avoid TS issues in plugin sandbox
    figma.ui.postMessage({ type: 'ready', count: selection.length });
  }
  if (msg.type === 'close') figma.closePlugin();
};
