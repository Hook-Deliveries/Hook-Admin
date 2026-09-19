export const APP_TAB_BAR_HEIGHT = 60;
// Only a small visual gap beyond the system navigation safe area.
export const APP_TAB_BAR_BOTTOM_GAP = 2;
export const APP_TAB_BAR_CONTENT_GAP = 12;

export const APP_TAB_BAR_CONTENT_INSET =
  APP_TAB_BAR_HEIGHT + APP_TAB_BAR_BOTTOM_GAP + APP_TAB_BAR_CONTENT_GAP;

/** Docked action bar, stacked directly above the tab bar as a matching pill. */
export const APP_ACTION_BAR_HEIGHT = 56;
export const APP_ACTION_BAR_GAP = 6;

export const APP_ACTION_BAR_BOTTOM =
  APP_TAB_BAR_BOTTOM_GAP + APP_TAB_BAR_HEIGHT + APP_ACTION_BAR_GAP;

/**
 * Extra bottom padding a page owes when it renders a StickyActionBar. The shell's
 * `<main>` already clears the tab bar, so this covers only the action bar itself.
 */
export const APP_ACTION_BAR_CONTENT_INSET =
  APP_ACTION_BAR_HEIGHT + APP_ACTION_BAR_GAP;
