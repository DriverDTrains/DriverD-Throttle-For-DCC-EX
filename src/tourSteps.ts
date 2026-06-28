import { DriveStep } from "driver.js";

/**
 * Defines the steps for the interactive onboarding tour.
 * Step actions allow App.tsx to execute specific logic (mode switches, connectivity) 
 * without relying on hardcoded indices.
 */
export interface SightsItem {
  label: string;
  step: number;
}

export interface AppTourStep extends Omit<DriveStep, "popover"> {
  popover?: Omit<NonNullable<DriveStep["popover"]>, "description"> & {
    description?: string;
    sights?: SightsItem[];
    sightsFromStep?: number;
    showReplay?: boolean;
    [key: string]: any;
  };
  onNext?: string[];
  onPrev?: string[];
  onShow?: string[];
  popoverDelay?: number;
  actionDelay?: number;
}

// ------------- TOUR INITIALIZATION ACTIONS ------------- //

export const tourInitializationActions: string[] = [
  'tour_backup_first_preset',
  'tour_restore_consist_1',
  'disconnect_all', 
  'set_mode_serial', 
  'hide_terminal', 
  'hide_wifi_advice',
  'close_loco_color_modal',
  'turn_off_serial_monitor',
  'edit_presets_off',
  'tour_highlight_reverse_button_off',
  'tour_highlight_move_up_down_off',
  'tour_highlight_clear_consist_off',
  'tour_highlight_hide_all_consists_off',
  'tour_hide_keyboard_key',
  'tour_hide_slider_drag_hand',
  'highlight_compact_throttle_off', 
  'highlight_compact_presets_off',
  'expand_throttle',
  'highlight_throttle_settings_off',
  'tour_set_throttle_mode_standard',
  'tour_set_speed_scale_steps',
  'tour_throttle_edit_off',
  'tour_set_estop_config_mode',
  'tour_set_stop_as_button:false',
  'tour_set_small_presets_active:false',
  'tour_set_thick_throttle:false',
  'tour_set_throttle_layout:standard',
  'tour_edit_functions:0:false',
  'tour_close_function_color',
  'tour_restore_f0_colors',
  'show_function_colors_off',
  'tour_restore_show_numbers',
  'tour_restore_show_names',
  'tour_close_function_groups_modal',
  'tour_show_functions_panel_sequence',
  'tour_set_sort_custom:0'
//  'tour_set_custom_box_style:0:0:320:180'
//  'expand_presets',
//  'expand_throttle',
//  'expand_functions'
];

export const TOUR_SAVE_DELAY = 800;
export const TOUR_RESTORE_DELAY = 800;

// ------------- TOUR STOP RESTART ACTIONS ------------- //

export const tourRestartCleanup: string[] = [
  'tour_restore_first_preset',
  'tour_restore_consist_1',
  'turn_off_serial_monitor',
  'disconnect_all', 
  'close_block_edit',
  'edit_presets_off',
  'track_power_off',
  'unjoin_blocks',
  'hide_blocks_view',
  'close_block_edit',
  'hide_icon_settings_sequence',
  'hide_display_settings_sequence',
  'hide_user_custom_settings_sequence',
  'highlight_compact_presets_off',
  'show_dcc_ex_roster_modal_off',
  'show_swipe_animation_off',
  'show_loco_sort_modal_off', 
  'close_loco_color_modal', 
  'close_delete_renumber_modal', 
  'show_roster_modal_off',  
  'show_loco_sort_modal_off', 
  'show_hard_limit_modal_off',
  'show_dcc_ex_roster_modal_off',
  'set_loco_details_modal_off',
  'unselect_first_dcc_ex_loco',
  'show_dcc_ex_import_conflict_off',
  'tour_delete_loco_3_variant',
  'tour_hide_consists',
  'tour_highlight_reverse_button_off',
  'tour_highlight_move_up_down_off',
  'tour_highlight_clear_consist_off',
  'tour_highlight_hide_all_consists_off',
  'tour_show_consist_warning_off',
  'tour_show_motion_warning_off',
  'tour_show_advanced_toggles_off',
  'tour_highlight_merge_btn_off',
  'tour_highlight_hide_header_btn_off',
  'tour_highlight_lock_btn_off',
  'tour_set_merge_address_off',
  'tour_set_address_focus_off',
  'tour_hide_keyboard_key',
  'tour_hide_slider_drag_hand',
  'tour_hide_button_hand',
  'tour_set_throttle_mode_standard',
  'tour_throttle_edit_off',
  'expand_presets',
  'expand_throttle',
  'expand_functions',
  'tour_set_speed_scale_steps',
  'tour_set_estop_config_mode',
  'tour_set_stop_as_button:false',
  'tour_set_small_presets_active:false',
  'tour_set_thick_throttle:false',
  'tour_set_throttle_layout:standard',
  'tour_functions_demo_cleanup',
  'tour_functions_enable_override:0:false',
  'tour_edit_functions:0:false',
  'tour_close_function_color',
  'tour_restore_f0_colors',
  'show_function_colors_off',
  'tour_restore_show_numbers',
  'tour_restore_show_names',
  'tour_close_function_groups_modal',
  'tour_show_functions_panel_sequence',
  'hide_user_custom_settings_sequence',
  'tour_turn_off_all_custom_settings_btn_highlight_off',
  'tour_hide_memory_autosave_confirm_sequence',
  'tour_clear_demomemory_1',
  'highlight_export_config_button_off',
  'tour_set_sort_custom:0',
  'tour_remove_loco_1234_colors'
];

export const tourMacros: Record<string, string[]> = {
  'tour_stop_restart_cleanup': tourRestartCleanup
};


// ------------- NAVIGATION MENUS ------------- //

export interface TourStop {
  title: string;
  targetStep: number;
}

export const tourStopsMenu: TourStop[] = [
  { title: 'Header Panel', targetStep: 7 },
  { title: 'Track Power Panel', targetStep: 28 }, 
  { title: 'Loco Address Panel', targetStep: 38 }, 
  { title: 'Throttle Control Panel', targetStep: 123 }, 
  { title: 'Loco Functions Panel', targetStep: 161 },
  { title: 'User Custom Settings', targetStep: 198 }
];

export const tourTOC = {
  tocHeader: "Guided Tour... All aboard!",
  welcome: "Welcome to the Driver-D Throttle for DCC-EX! This guided tour will help you master all the features of your new throttle.",
  beginIntroLabel: "Begin Guided Tour",
  endTourLabel: "End Tour",
  tocTitle: "Tour Stops",
  revisitLastLabel: "< Restart Prior Stop",
  nextTourStopLabel: "Next Tour Stop >"
};


export const headerSights_AddressPanel: SightsItem[] = [
  { label: 'Connection Basics', step: 7 },
  { label: 'DCC-EX Traffic Monitor', step: 15 },
  { label: 'Icon & Display Settings', step: 21 }
];

export const trackPowerSights_AddressPanel: SightsItem[] = [
  { label: 'Track Power Basics', step: 28 },
  { label: 'Joining Main & Prog', step: 31 },
  { label: 'Configure Blocks', step: 33 }
];

export const locoAddressSights_AddressPanel: SightsItem[] = [
  { label: 'Address Panel Basics', step: 38 },
  { label: 'Configure Presets', step: 52 },
  { label: 'Manage Roster & Import Locos', step: 70 },
  { label: 'Locomotive Consists', step: 89 },
  { label: 'Small Screen Controls', step: 113 }
];

export const throttleSights_AddressPanel: SightsItem[] = [
  { label: 'Throttle Basics', step: 123 },
  { label: 'Custom Throttle Settings', step: 137 },
  { label: 'Throttle Layout Controls', step: 150 },
  { label: 'Vertical Throttle Layout', step: 156 }
];

export const functionSights_AddressPanel: SightsItem[] = [
  { label: 'Functions Basics', step: 161 },
  { label: 'Configure Functions', step: 167 },
  { label: 'Display Options', step: 173 },
  { label: 'Function Groups', step: 179 },
  { label: 'Turnouts and Routes', step: 191 }
];

export const settingsSights_AddressPanel: SightsItem[] = [
  { label: 'User Settings Basics', step: 198 },
  { label: 'Memory Presets', step: 204 },
  { label: 'Export Configuration', step: 213 },
];


// ------------- INTRODUCTION WELCOME ------------- //

export const tourSteps: AppTourStep[] = [
    // Step 1: Welcome
  { 
    element: '#root', 
    onShow: ['tour_stop_restart_cleanup'],
    onPrev: ['cancel_to_menu'],
    popover: { 
      disableButtons: ['previous'],
      title: 'All aboard!', 
      description: "Welcome to the Driver-D Throttle for DCC-EX! All aboard! We'll start with a quick introduction to the throttle's five basic control panels.",
      side: "over",
      align: 'center',
      popoverClass: 'custom-popover-shift-up:100'
    } 
  },

  // Step 2: Throttle Header
  { 
    element: '#tour-header-card', 
    onShow: [],
    popover: { 
      title: 'Throttle Header Panel', 
      description: "This is the Throttle Header Panel. Here we can connect to our DCC-EX Command Station or an Emulator, as well as configure many custom settings to personalize the throttle and make it our own.",
      side: "bottom",
      align: 'center'
    } 
  },

  // Step 3: Track Power
  { 
    element: '#tour-track-power', 
    popover: { 
      title: 'Track Power Panel', 
      description: 'In the Track Power Panel we can toggle the power to the tracks, assign track blocks, and join the main and programming tracks.',
      side: "right",
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20'
    } 
  },

  // Step 4: Locomotive Roster
  { 
    element: '#tour-loco-address', 
    popover: { 
      title: 'Loco Address Panel', 
      description: 'In the Loco Address Panel we can select locomotives by address or pick from our saved presets, manage our roster, configure consists, and customize photos and colors. This is also where we can save or upload our throttle configuration files.',
      side: "right",
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20'
    } 
  },

  // Step 5: Speed Control
  { 
    element: '#throttle-control-card', 
    popover: { 
      title: 'Throttle Control Panel', 
      description: 'The Throttle Control Panel lets us control the speed of our locomotives. Options are available for both horizontal and vertical sliders, as well as standard and switching-shunting sliders. The Throttle Control Panel also supports mouse wheel control and keyboard shortcuts.',
      side: "left",
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20'
    } 
  },

  // Step 6: Loco Functions/Routes/Turnouts Detail (Placeholder)
  {
    element: '#functions-panel',
    onNext: ['finish_tour'],
    popover: {
      title: 'Loco Functions Panel',
      description: 'The Loco Functions, Routes, and Turnouts Panel lets us configure all our locomotive DCC decoder functions, as well as control the turnouts and routes configured in our DCC-EX command station. The Loco Functions Panel also supports keyboard shortcuts for all locomotive DCC functions.',
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20'
    }
  },


// ------------- HEADER PANEL ------------- //

  // Step 7: Throttle Header Begin
  { 
    element: '#tour-header-card', 
    onShow: ['tour_stop_restart_cleanup'],
    onPrev: ['cancel_to_menu'],
    popover: { 
      disableButtons: ['previous'],
      title: 'Throttle Header Panel', 
      description: "Let's take a closer look at the controls in the throttle's Header Panel.",
      side: "bottom",
      align: 'center',
      sights: headerSights_AddressPanel
    } 
  },

  // Step 8: Connectivity
  { 
    element: '#tour-connect', 
    onNext: ['set_mode_wifi'],
    onPrev: ['reset_to_base'],
    popover: { 
      title: 'Connectivity', 
      description: 'Here we can decide whether we would like to connect to our DCC-EX command station via a USB Serial cable or over WiFi. We can also use the Emulator if we would just like to try out or configure the throttle.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 9: Serial Connection
  { 
    element: '#tour-connect', 
    onShow: ['set_mode_serial'],
    popover: { 
      title: 'Serial Connection', 
      description: "When connecting over serial, we will be asked to select which serial port to connect to. We'll select the USB port that our DCC-EX command station is connected to. We may also be asked for permission to access our computer's serial or bluetooth ports.",
      side: "bottom",
      align: 'start',
      sightsFromStep: 7,
      showSightsToggle: true

    } 
  },

  // Step 10: WiFi Selection
  { 
    element: '#tour-connect', 
    onShow: ['set_mode_wifi'],
    onNext: ['show_wifi_advice_async'],
    onPrev: ['hide_wifi_advice'],
    actionDelay: 100,
    popover: { 
      title: 'WiFi Selection', 
      description: 'When connecting over Wi-Fi...',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 11: WiFi Connection
  { 
    element: '#tour-wifi-reminder', 
    onNext: ['hide_wifi_advice'],
    onPrev: ['show_wifi_advice_async'],
    actionDelay: 100,
    popover: { 
      title: 'WiFi Connection', 
      description: '...We will need to make sure that our computer and other devices such as our smart phone or tablet are on the same local Wi-Fi network as our DCC-EX command station.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 12: WiFi Configuration
  { 
    element: '#tour-wifi-config-combined', 
    onNext: ['set_mode_emulator'],
    onPrev: ['show_wifi_advice_async'],
    actionDelay: 100,
    popover: { 
      title: 'WiFi Configuration', 
      description: "We will also need to enter our DCC-EX command station\'s IP address and port number, which we can typically find shown on the command station's LCD or OLED display.",
      side: "bottom",
      align: 'start',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 13: Emulator Mode
  { 
    element: '#tour-connect', 
    onShow: ['set_mode_emulator'],
    onNext: ['set_mode_emulator'],
    onPrev: ['set_mode_wifi'],
    popover: { 
      title: 'Emulator Mode', 
      description: 'There is also a DCC-EX emulator that we can use if we just want to try out or configure the throttle. [Note: The Emulator does not emulate all DCC-EX commands.]',
      side: "bottom",
      align: 'end',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 14: Connect
  { 
    element: '#tour-connect-button', 
    onShow: ['set_mode_emulator'],
//    onNext: ['connect_emulator_sequence'],
    onPrev: ['set_mode_emulator'],
    actionDelay: 150,
    popover: { 
      title: 'Connect', 
      description: "After choosing which connection method we want to use to connect to our DCC-EX command station, or after selecting the Emulator, we can press the 'Connect' button.",
      side: "bottom",
      align: 'end',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 15: Serial Traffic Monitor
  { 
    element: '#tour-monitor-button', 
//    onShow: ['set_mode_emulator'],
    onShow: ['set_mode_emulator', 'connect_emulator_sequence'],
    onPrev: ['disconnect_emulator_sequence'],
    actionDelay: 150,
    popover: { 
      title: 'Serial Traffic Monitor', 
      description: 'Once we have connected to our DCC-EX command station or the Emulator, we can open the serial traffic monitor.',
      side: "bottom",
      align: 'end',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 16: Native Protocol Monitor
  { 
    element: '#tour-terminal', 
    onShow: ['set_mode_emulator'],
    popover: { 
      title: 'Native Protocol Monitor', 
      description: 'In the serial traffic monitor we can view the DCC-EX native protocol commands and information flowing back-and-forth between the throttle and the command station. We can also send DCC-EX native protocol commands to the command station via the input command line at the bottom.',
      side: "top",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 17: Terminal Controls
  { 
    element: '#tour-terminal-actions', 
    onShow: ['set_mode_emulator'],
    popover: { 
      title: 'Terminal Controls', 
      description: 'There are also buttons to clear the serial monitor as well as to tell DCC-EX to clear its registry of currently active locomotives.',
      side: "top",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 18: Sync Locomotive Status
  { 
    element: '#tour-loco-sync-button', 
  //  onShow: ['set_mode_emulator'],
    onNext: ['sync_status'],
    popover: { 
      title: 'Sync Locomotive Status', 
      description: 'When connected to our DCC-EX command station or the Emulator, there is also a button to refresh or sync the status of all our locomotives.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 19: Monitor Results
  { 
    element: '#tour-terminal', 
    onShow: ['show_terminal_sequence', 'set_mode_emulator'],
    onNext: ['hide_terminal_sequence'],
    popoverDelay: 100,
    actionDelay: 100,
    popover: { 
      title: 'Monitor Results', 
      description: 'After pressing the sync button, we can see the status of our tracks and all our active locomotives in the serial monitor window.',
      side: "top",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 20: Connection Info & IP
  { 
    element: '#tour-connection-info', 
    onPrev: ['show_terminal_sequence'],
    popover: { 
      title: 'Connection Status', 
      description: 'The throttle will show our connection status here, along with the IP address and port number (3000) of the computer running the throttle, which we can use as a bridge to connect to our DCC-EX command station from a smart phone or tablet.',
      side: "bottom",
      align: 'start',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 21: Custom App Icon
  { 
    element: '#tour-app-icon', 
    onNext: ['show_icon_settings_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: { 
      title: 'Custom App Icon', 
      description: 'The throttle also features an icon that we can customize and configure. Click the icon to open the Custom App Icon Settings.',
      side: "bottom",
      align: 'start',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 22: App Icon Settings
  { 
    element: '#tour-icon-settings-modal', 
    onShow: ['show_icon_settings_sequence'],
    onNext: ['hide_icon_settings_sequence'],
    onPrev: ['hide_icon_settings_sequence'],
    actionDelay: 300,
    popoverDelay: 400,
    popover: { 
      title: 'App Icon Settings', 
      description: 'The Custom App Icon Settings panel allows us to upload our own custom icon (PNG or SVG file) and configure its appearance in the throttle header, the locomotive preset buttons, and as the watermark in the throttle speed control panel.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 23: Display Settings
  { 
    element: '#tour-display-settings', 
    onPrev: ['hide_display_settings_sequence'],
    onNext: ['show_display_settings_sequence'],
    actionDelay: 400,
    popover: { 
      title: 'Display Settings', 
      description: "Finally, the Display Settings button lets us control the size and appearance of the throttle, and configure the throttle's custom settings.",
      side: "bottom",
      align: 'end',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },

  // Step 24: Display Settings Panel
  { 
    element: '#tour-display-settings-panel', 
    onShow: ['show_display_settings_sequence', 'layout_animation:1000:800'],
    onPrev: ['hide_display_settings_sequence'],
    actionDelay: 200,
    popoverDelay: 400,
    popover: { 
      title: 'Display Settings Panel', 
      description: 'On the Display settings panel we can choose from 4 layout sizes depending on the size of our screen or device.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showReplay: true,
      showSightsToggle: true
    } 
  },

  // Step 25: Throttle Appearance Themes
  { 
    element: '#tour-display-settings-panel', 
    onShow: ['show_display_settings_sequence', 'theme_animation:600:800', 'highlight_user_settings_off'],
    onPrev: ['show_display_settings_sequence'],
    actionDelay: 200,
    popoverDelay: 400,
    popover: { 
      title: 'Throttle Themes', 
      description: 'We can also choose from 5 color themes.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true,
      showReplay: true
    } 
  },

  // Step 26: Display Settings Summary
  { 
    element: '#tour-display-settings-panel', 
    onShow: ['show_display_settings_sequence', 'highlight_user_settings_on'],
    onNext: ['hide_display_settings_sequence', 'highlight_user_settings_off'],
    onPrev: ['show_display_settings_sequence', 'highlight_user_settings_off'],
    actionDelay: 200,
    popoverDelay: 400,
    popover: { 
      title: 'User Custom Settings', 
      description: "And we can configure dozens of user custom settings which we can save and recall from memory. We'll look at those some more at the end of the tour. This is also where we can find the interactive tour and user guide.",
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },
  // Step 27: Throttle Header End
  { 
    element: '#tour-header-card', 
    onNext: ['finish_tour'],
    onPrev: ['show_display_settings_sequence'],
    actionDelay: 400,
    popover: { 
      title: 'Throttle Header Summary', 
      description: "We have now completed our tour of the Driver-D Throttle for DCC-EX Header Panel! Let's move on to the next stop!",
      side: "bottom",
      align: 'center',
      sightsFromStep: 7,
      showSightsToggle: true
    } 
  },


// ------------- POWER PANEL ------------- //

  // Step 28: Track Power Panel Detail
  {
    element: '#tour-track-power',
    onShow: ['tour_stop_restart_cleanup'],
    onPrev: ['cancel_to_menu'],
    popover: {
      disableButtons: ['previous'],
      title: 'Track Power Panel',
      description: "Let's take a closer look at the controls in the Track Power Panel.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'right',
      align: 'start',
      sights: trackPowerSights_AddressPanel
    }
  },

  // Step 29: Power Button
  { 
    element: '#tour-power-button',
    popover: { 
      title: 'Track Power Button', 
      description: 'This is the power button. It controls the power to both the A & B track blocks on the DCC-EX command station.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 28,
      showSightsToggle: true
    } 
  },

  // Step 30: Power On Action
  { 
    element: '#tour-power-button',
    onShow: ['connect_emulator', 'track_power_on', 'unjoin_blocks', 'hide_blocks_view'],
    onPrev: ['track_power_off', 'disconnect_all'],
    popover: { 
      title: 'Power On', 
      description: 'When we are connected to our DCC-EX command station or the Emulator, pressing the power button will turn on and off the power to both the A & B track blocks.',
      side: "bottom",
      align: 'center',
      sightsFromStep: 28,
      showSightsToggle: true
    } 
  },

  // Step 31: Join
  { 
    element: '#tour-track-power', 
    onShow: ['join_blocks', 'track_power_on', 'hide_blocks_view'],
    popover: { 
      title: 'Join Tracks', 
      description: "Pressing the Join button will 'join' the main and programming tracks (A & B blocks) so that we can run our locomotives on them as though they were one block.",
      popoverClass: 'custom-popover-shift-down:20',
      side: "right",
      align: 'start',
      sightsFromStep: 28,
      showSightsToggle: true
    } 
  },

  // Step 32: Independent Blocks
  { 
    element: '#tour-track-power', 
    onShow: ['unjoin_blocks', 'show_blocks_view', 'set_2_blocks', 'blocks_power_animation:800:600'],
    popover: { 
      title: 'Independent Block Control', 
      description: 'Pressing the gear icon will allow us to control the power to the A and B blocks independently.',
      side: "right",
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 28,
      showReplay: true,
      showSightsToggle: true
    } 
  },

  // Step 33: Multi Blocks
  { 
    element: '#tour-track-power', 
    onShow: ['show_blocks_view', 'set_4_blocks', 'close_block_edit'],
    onNext: ['show_block_edit_sequence'], 
    popover: { 
      title: 'Multiple Track Blocks', 
      description: 'If our DCC-EX command station has more than two track blocks, we will see buttons for all the blocks (up to 8) shown here.',
      popoverClass: 'custom-popover-shift-down:20',
      side: "right",
      align: 'start',
      sightsFromStep: 28,
      showSightsToggle: true
    } 
  },

  // Step 34: Block C Edit
  {
    element: '#tour-block-edit-modal',
    onShow: ['open_block_c_edit'],
    onPrev: ['close_block_edit'],
    popover: {
      title: 'Block Assignment',
      description: 'If we long press on one of the track block power buttons, we can assign the type of power going to that block.',
      side: 'bottom',
      sightsFromStep: 28,
      showSightsToggle: true
    }
  },

  // Step 35: Select DC
  {
    element: '#tour-block-mode-DC',
    onShow: ['set_block_c_dc'],
    onPrev: ['show_block_edit_sequence'],
    popover: {
      title: 'DC Support',
      description: 'There are multiple options for DCC and DC power.',
      side: 'bottom',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 28,
      showSightsToggle: true
    }
  },

  // Step 36: Sync
  {
    element: '#tour-track-power',
    onShow: ['close_block_edit', 'sync_on'],
    onPrev: ['open_block_c_edit', 'sync_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Sync Status',
      description: 'Click the sync icon to read the track status from the DCC-EX command station and update the track power buttons.',
      side: 'bottom',
      align: 'center',
      sightsFromStep: 28,
      showSightsToggle: true
    }
  },

  // Step 37: Final Power State
  {
    element: '#tour-track-power',
    onShow: ['sync_off', 'hide_blocks_view', 'track_power_off'],
    onNext: ['finish_tour', 'disconnect_all'],
    popover: {
      title: 'Track Power Summary',
      description: 'We have now looked at all the features of the Track Power Panel.',
      popoverClass: 'custom-popover-shift-down:20',
      side: 'right',
      align: 'start',
      sightsFromStep: 28,
      showSightsToggle: true
    }
  },


// ------------- LOCO ADDRESS PANEL ------------- //

  // Step 38: Loco Address Panel Detail
  {
    element: '#tour-loco-address',
    onShow: ['tour_stop_restart_cleanup'],
    onPrev: ['cancel_to_menu'],
    popover: {
      disableButtons: ['previous'],
      title: 'Loco Address Panel',
      description: "Now let's take a look at the Loco Address Panel. The Loco Address Panel is divided into several different parts.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sights: locoAddressSights_AddressPanel
    }
  },

  // Step 39: Loco Address Box
  {
    element: '#tour-loco-address-box',
    onShow: ['show_road_names_on', 'loco_direction_animation:1000:1000:2'],
    popover: {
      title: 'Loco Address Display',
      description: "The address box displays the DCC address and direction of our currently selected locomotive or consist. The color of the number indicates the locomotive's forward or reverse direction, while the angle bracket indicates which way the locomotive is facing based on the settings in the Throttle Control Panel, which we'll look at later. If we've added a road name for our locomotive, the address box will show that too.",
      side: 'right',
      align: 'start',
//      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 40: Loco Address Entry
  {
    element: '#tour-loco-address-box',
    onShow: [`loco_entry_animation_1234:800:300`],
    popover: {
      title: 'Manual Address Entry',
      description: 'We can click in the address box and enter the DCC address for our locomotive.',
      side: 'right',
      align: 'start',
//      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 41: Presets
  {
    element: '#tour-loco-presets',
    popover: {
      title: 'Locomotive Presets',
      description: "We can create presets for all our locomotives that include each locomotive's road name and DCC address. We can decide how many presets to include in the throttle (up to 256 maximum) and can sort them to change their order. Finally, we can color each preset a different color with an accent color as well.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 42: Using Presets
  {
    element: '#tour-loco-presets',
    onShow: ['select_first_preset:200', 'loco_direction_animation:1000:1000:2'],
    popover: {
      title: 'Using Presets',
      description: "Click one of the locomotive preset buttons to control that locomotive. The selected locomotive's DCC address and road number will appear in the loco address box. Pressing the preset button again will toggle the locomotive's direction, and the button will change color.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 43: Nav Controls
  {
    element: '#tour-loco-address-box',
    onShow: ['loco_controls_flash_on:600:200', 'select_second_preset:1600', 'select_third_preset:2600', 'select_second_preset:3600', 'select_first_preset:4600'],
    onNext: ['loco_controls_flash_off'],
    onPrev: ['loco_controls_flash_off'],
    popover: {
      title: 'Roster Navigation',
      description: 'Double-chevron arrows at either end of the address box allow us to scroll to our next or previous visible locomotive preset.',
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 44: Photo Swipe
  {
    element: '#tour-loco-image',
    onShow: ['show_swipe_animation_on:1400:900:90', 'select_second_preset:1600', 'select_third_preset:2600', 'select_second_preset:3600', 'select_first_preset:4600', 'show_swipe_animation_off:4800'],
    onNext: ['show_swipe_animation_off'],
    onPrev: ['show_swipe_animation_off'],
    popover: {
      title: 'Photo Swipe',
      description: 'We can also swipe on a touch screen, or "control-flick" with the mouse pointer on the locomotive image to scroll to the next or previous preset.',
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 45: The Hidden Preset
  {
    element: '#tour-loco-address-box',
    onShow: ['loco_entry_animation_1234:800:300', 'loco_controls_flash_on:600:3500'],
    onNext: ['loco_controls_flash_off'],
    onPrev: ['loco_controls_flash_off'],
    popover: {
      title: 'The Hidden Preset',
      description: "If we manually enter the DCC address of a locomotive that is not in the throttle's 'roster', the throttle will remember that address for us as a 'hidden' preset when scrolling the presets. We can press the 'Clear' button to tell the roster to forget that 'hidden' preset and not include it when scrolling through our regular visible presets.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 46: Header Controls
  {
    element: '#tour-loco-card-header',
    onShow: ['loco_controls_flash_off'],
    popover: {
      title: 'Loco Address Panel Controls',
      description: 'We can use the controls at the top of the Loco Address Panel to configure all our locomotive presets and consists, as well as how much information is displayed in the Loco Address Panel. We can also save and import our throttle configuration files here. Finally, there are some additional controls that can hide parts of the throttle when running on a smartphone or other small display.',
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 47: Compact Presets
  {
    element: '#tour-loco-address',
    onShow: ['highlight_compact_presets_on', 'compact_presets_on:500', 'compact_presets_off:1500', 'compact_presets_on:2500', 'compact_presets_off:3500'],
    onNext: ['highlight_compact_presets_off'],
    onPrev: ['highlight_compact_presets_off'],
    popover: {
      title: 'Compact Presets',
      description: "Press the 'Compact Presets' button to hide or show the locomotive presets in the throttle. Hiding the presets can help save space on smartphones and smaller displays, where we can select our locomotives by swiping.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 48: Edit Presets Mode
  {
    element: '#tour-loco-address',
    onShow: ['edit_presets_on'],
    onPrev: ['edit_presets_off'],
    popover: {
      title: 'Configure Presets',
      description: 'Click the gear icon to configure all the Loco Address Panel settings and our locomotive roster and presets.',
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 49: Preset Roster Addition
  {
    element: '#tour-loco-preset-first-inputs',
    onShow: ['loco_preset_edit_animation:1500:300:800'],
    onPrev: ['edit_presets_on'],
    popover: {
      title: 'Adding a Preset',
      description: "We can enter a DCC address and road name for one of our locomotives into a preset box, and that locomotive will be added to the throttle's locomotive roster.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },
  
  // Step 50: Locomotive Photos
  {
    element: '#tour-loco-image',
    onShow: ['loco_image_hover_on', 'set_steam_placeholder_off', 'set_steam_placeholder_on:1200', 'set_diesel_placeholder_on:2400', 'set_steam_placeholder_on:3600'],
    onNext: ['loco_image_hover_off'],
    onPrev: ['edit_presets_on', 'loco_image_hover_off'],
    popover: {
      title: 'Locomotive Photos',
      description: "We can upload a photo or image of our selected locomotive, or use a simple 'watermark' image of a steam or diesel locomotive. The image can be any size, but 324x230 works well. We can also delete a previously saved image.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },


  // Step 51: Adjust Presets Count
  {
    element: '#tour-loco-address',
    onShow: ['edit_presets_on', 'highlight_presets_plus_minus_on', 'add_one_preset:800', 'add_one_preset:1600', 'add_one_preset:2400','remove_one_preset:3200', 'remove_one_preset:4000', 'remove_one_preset:4800'],
    onNext: ['highlight_presets_plus_minus_off'],
    onPrev: ['highlight_presets_plus_minus_off'],
    popover: {
      title: 'Adjust Presets Count',
      description: "Click on the '+' and '-' buttons to show more or fewer locomotive presets in the Loco Address Panel.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

// ------------- LOCO ADDRESS PANEL -- Sort & Configure Presets ------------- //

  // Step 52: Sort Presets
  {
    element: '#tour-loco-card-header',
    onShow: ['edit_presets_on', 'highlight_sort_presets_button_on'],
    onNext: ['highlight_sort_presets_button_off', 'show_loco_sort_modal_on'],
    onPrev: ['highlight_sort_presets_button_off'],
    popover: {
      title: 'Sort Presets',
      description: "Click on the 'Sort Presets' button (the button with the up and down arrows) to open a control panel where we can sort and configure our locomotive presets.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 53: Sort & Configure Presets modal
  {
    element: '#tour-loco-sort-modal',
    onShow: ['edit_presets_on', 'show_loco_sort_modal_on'],
    onPrev: ['show_loco_sort_modal_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Sort & Configure Presets',
      description: "On the Sort & Configure Presets control panel we can change the order of our locomotive presets, as well as how they are displayed. We can also edit the size of the throttle's locomotive roster, and import locomotives from DCC-EX. Finally, we can renumber or delete roster entries.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 54: Sort Buttons
  {
    element: '#tour-loco-sort-buttons',
    popover: {
      title: 'Presets Sort Options',
      description: "We have several different ways that we can sort our locomotive presets. The order in which we sort the presets determines the order in which they appear in the Loco Address Panel in the throttle.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 55: Presets List - Checkboxes
  {
    element: '#tour-loco-presets-list',
    onShow: [
      'tour_uncheck_loco_1234:1200',
      'tour_check_loco_1234:2500'
    ],
    onNext: [
      'tour_check_loco_1234:0'
    ],
    onPrev: [
      'tour_check_loco_1234:0'
    ],
    popover: {
      title: 'Include Presets in Sort',
      description: "Note that only the locomotive presets with the marked checkboxes will be included when we sort the presets, and if we uncheck a box on a preset, it will drop to the bottom of the list below those included in the sort. This can help us easily add or remove which locomotives we want to include in the throttle presets.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 56: Presets List - Manual Sort
  {
    element: '#tour-loco-presets-list',
    onShow: [
      'tour_move_loco_1234_down:1200',
      'tour_move_loco_1234_up:2500'
    ],
    onNext: [
      'tour_move_loco_1234_up:0'
    ],
    onPrev: [
      'tour_move_loco_1234_up:0'
    ],
    popover: {
      title: 'Manual Custom Sort',
      description: "We can manually sort the locomotive presets by pressing the up and down arrows in the individual presets until we get the order we want. This will give us our 'Custom' sort of locomotive presets.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 57: Sort By ID
  {
    element: '#tour-loco-sort-buttons',
    onShow: [
//      'tour_set_sort_custom:0',
      'tour_toggle_sort_id:1200',
      'tour_toggle_sort_id:2500'
    ],
    onNext: [
//      'tour_set_sort_custom:0'
    ],
    onPrev: [
      'tour_set_sort_custom:0'
    ],
    popover: {
      title: 'Sort by DCC Address (ID)',
      description: "We can also sort the presets by locomotive DCC address (ID), in either ascending or descending order.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 58: Sort By Road Name
  {
    element: '#tour-loco-sort-buttons',
    onShow: [
//      'tour_set_sort_custom:0',
      'tour_toggle_sort_road:1200',
      'tour_toggle_sort_road:2500'
    ],
    onNext: [
      'tour_toggle_sort_road:0',
//      'tour_set_sort_custom:0'
    ],
    onPrev: [
      'tour_toggle_sort_road:0',
//      'tour_set_sort_custom:0'
    ],
    popover: {
      title: 'Sort by Road Name & Address',
      description: "And we can sort the locomotive presets by their road names, again in either ascending or descending order, with the DCC addresses (ID) being used as the second-level sort for each road name, also in ascending or descending order.",
      side: 'bottom',
      align: 'end',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 59: Manual Sort Fallback
  {
    element: '#tour-loco-presets-list',
    onShow: [
      'tour_set_sort_id_desc:0',
//      'tour_move_loco_1234_down:1500',
//      'tour_move_loco_1234_up:2800'
    ],
    onNext: [
      'tour_set_sort_custom:0'
    ],
    onPrev: [
//      'tour_set_sort_custom:0'
    ],
    popover: {
      title: 'New Custom Sort',
      description: "Note that if we manually move one of the presets up or down after sorting them by DCC address or road name, we will immediately create a new 'Custom' sort, replacing our previous one.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 60: Preset Item Color Button
  {
    element: '#tour-loco-preset-item-0',
    onShow: ['edit_presets_on', 'show_loco_sort_modal_on'],
    onNext: ['open_loco_color_modal_sequence'],
    actionDelay: 400,
    popover: {
      title: 'Preset Configuration',
      description: "Each locomotive preset also has a palette icon. This allows us to set the colors for that locomotive preset in the throttle.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 61: Loco Color Modal
  {
    element: '#tour-loco-color-modal',
    onShow: [
      'open_loco_color_modal',
      'show_loco_sort_modal_off',
      'tour_select_loco_1234_yellow:1500',
      'tour_set_picker_opacity:2200:80'
    ],
    onPrev: ['close_loco_color_modal_sequence', 'show_loco_sort_modal_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Preset Button Color',
      description: "When we click on the palette icon, the Loco Button Color picker will open. Here we can choose a background color for our preset. The slider at the top lets us choose the color's opacity, which is how intense it is.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 62 : Custom Color Picker
  {
    element: '#tour-loco-custom-color-picker-container',
    onShow: ['show_inline_picker_on'],
    onNext: ['show_inline_picker_off'],
    onPrev: ['show_inline_picker_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Custom Loco Color',
      description: "If we don't like any of the color swatches shown, we can click the 'Custom / Background' button to open a full-spectrum color picker for 24-bit color.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 63 : Loco Preset Accent Color
  {
    element: '#tour-loco-color-mode-button',
    onShow: ['highlight_color_mode_button_on'],
    onNext: ['highlight_color_mode_button_off'],
    onPrev: ['highlight_color_mode_button_off', 'show_inline_picker_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Loco Accent Color',
      description: "In addition to picking a color for the preset button background, we can select an accent color. This color will appear as a stripe along the bottom edge of the locomotive preset button, just as many locomotives have a stripe on their cab body.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 64 : Loco Button / Accent Color
  {
    element: '#tour-loco-color-mode-button',
    onShow: ['set_color_modal_mode_accent', 'highlight_color_mode_button_on'],
//    onNext: ['highlight_color_mode_button_off'],
    onPrev: ['set_color_modal_mode_base', 'highlight_color_mode_button_on'],
//    actionDelay: 400,
//    popoverDelay: 400,
    popover: {
      title: 'Change to Accent Color Picker',
      description: "Click on the 'Loco Button Color' title at the top of the color picker and it will switch to the Loco Accent Color picker.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 65 : Loco Accent Color Picker
  {
    element: '#tour-loco-color-modal',
    onShow: [
      'tour_select_loco_1234_blue_accent:1500',
      'tour_set_picker_accent_opacity:2200:80'
    ],
    onNext: ['highlight_color_mode_button_off'],
//    actionDelay: 400,
//    popoverDelay: 400,
    popover: {
      title: 'Select Accent Color',
      description: "Again, we can select one of the available colors or use the custom color picker, and adjust the color's opacity.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 66 : Done or Cancel
  {
    element: '#tour-loco-color-footer',
    onShow: ['set_color_modal_mode_accent'],
    onNext: ['close_loco_color_modal', 'show_loco_sort_modal_on_sequence'],
    onPrev: ['set_color_modal_mode_accent', 'highlight_color_mode_button_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Done or Cancel',
      description: "After we have selected our locomotive preset button background color and accent color, if desired, click the 'Done' button to store the color(s) with the preset. We can also 'Cancel', or select 'None' for no color.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 67 : Loco Preset Colors On
  {
    element: '#tour-loco-sort-header-controls',
    onShow: [
      'close_loco_color_modal',
      'show_loco_sort_modal_on_sequence',
      'show_road_names_on',
      'show_loco_colors_on',
      'tour_apply_loco_1234_colors:0'
    ],
    onPrev: ['show_loco_sort_modal_off', 'open_loco_color_modal_sequence'],
//    onNext: ['show_loco_sort_modal_off', 'edit_presets_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Show Colors & Names',
      description: "To show the colors on the presets in the Loco Address Panel in the throttle, click the color button at the top of the Sort & Configure Presets panel so that it changes from 'Color Off' to 'Color On'. The 'Names' button next to it is used to show or hide the locomotive road names that we saw earlier in the preset buttons on the Loco Address panel in the throttle.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 68: Preset Gear Icon
  {
    element: '#tour-loco-preset-item-0',
    onNext: ['open_delete_renumber_modal_sequence'],
    onPrev: ['show_loco_sort_modal_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Preset Renumbering',
      description: "Each preset on the Sort & Configure Presets panel also has a red gear icon that we can use to delete or renumber the roster entry for that locomotive.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 69: Delete or Renumber Presets
  {
    element: '#tour-loco-delete-renumber-modal',
    onShow: ['open_delete_renumber_modal_sequence'],
    onNext: ['close_delete_renumber_modal', 'highlight_roster_button_on'],
    onPrev: ['close_delete_renumber_modal'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Delete or Renumber',
      description: "Note that renumbering a preset will have no effect on our locomotive's actual DCC address, so unless we also change the address in our locomotive's DCC decoder, our preset will no longer work with that locomotive. However, we can renumber a preset if we want to use it for a different locomotive, or if we have multiple locomotives with the same DCC address, which we will discuss later.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

// ------------- LOCO ADDRESS PANEL -- Manage Roster & Import Locos ------------- //

  // Step 70: Roster Button
  {
    element: '#tour-loco-sort-header-controls',
    onShow: ['close_delete_renumber_modal', 'show_loco_sort_modal_on_sequence', 'highlight_roster_button_on'],
    onNext: ['highlight_roster_button_off', 'show_roster_modal_on_sequence'],
    onPrev: ['highlight_roster_button_off', 'open_delete_renumber_modal_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Global Roster Settings',
      description: "Finally, there is a 'Roster' button at the top of the Sort & Configure Presets panel that lets us manage the size of our roster, as well as import roster entries from our DCC-EX command station.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 71: Manage Roster Capacity
  {
    element: '#tour-loco-manage-roster-modal',
    onShow: ['highlight_roster_button_off', 'show_roster_modal_on_sequence'],
    onNext: [],
    onPrev: ['show_roster_modal_off', 'highlight_roster_button_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Manage Roster Capacity',
      description: "In the Manage Roster control panel we can adjust sliders to set how many locomotives we have in our roster, and how many presets are included in the Loco Address Panel in the throttle.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 72: Roster Capacity Slider
  {
    element: '#tour-loco-roster-capacity-container',
    onShow: ['show_roster_modal_on'],
    onNext: ['show_hard_limit_modal_on_sequence'],
    onPrev: [],
    popover: {
      title: 'Roster Capacity',
      description: "The Roster Capacity slider is used to set the number of locomotive presets we want to include in the Sort & Configure Presets panel. Remember, not all of the locomotive presets in the Sort & Configure Presets panel will be shown in the Loco Address Panel in the throttle. But by having the locomotive presets available in the Sort & Configure Presets panel, we can easily move locomotives up on the list into one of the visible presets so they appear in the throttle. The default roster capacity is 16 locomotives out of 32 maximum possible slots. However we can increase the maximum number of slots by pressing on the number 32 at the right edge of the slider, and selecting a new maximum.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 73: Adjust Maximum Storage
  {
    element: '#tour-loco-hard-limit-modal',
    onShow: ['show_hard_limit_modal_on_sequence'],
    onNext: ['show_hard_limit_modal_off'],
    onPrev: ['show_hard_limit_modal_off', 'show_roster_modal_on_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Maximum Storage Limit',
      description: "Note that the throttle may become sluggish if we increase the maximum number of preset slots to 128 or 256, but your mileage may vary.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 74: Visible Presets Slider
  {
    element: '#tour-loco-visible-presets-container',
    onShow: ['show_hard_limit_modal_off', 'show_roster_modal_on'],
    onNext: [],
    onPrev: ['show_hard_limit_modal_on_sequence'],
    popover: {
      title: 'Visible Presets',
      description: "The Visible Presets slider shows the number of locomotive presets visible in the Loco Address Panel in the throttle. This is the same number that we saw earlier in the header of the Loco Address Panel, which we adjusted with the + and - buttons.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 75: Import Locos from DCC-EX
  {
    element: '#tour-loco-import-button',
    onShow: ['show_roster_modal_on', 'connect_emulator'],
    onNext: ['show_roster_modal_off', 'show_loco_sort_modal_off', 'show_dcc_ex_roster_modal_on_sequence'],
    onPrev: [],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Import from DCC-EX',
      description: "We can also import roster entries from our DCC-EX command station into the throttle's roster by pressing the Import Locos from DCC-EX button. This will open the DCC-EX Loco Roster control panel.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 76: DCC-EX Loco Roster Modal
  {
    element: '#tour-loco-dcc-ex-roster-modal',
    onShow: ['click_import_locos', 'connect_emulator'],
    onNext: [],
    onPrev: ['show_dcc_ex_roster_modal_off', 'show_roster_modal_on'],
    popover: {
      title: 'DCC-EX Loco Import',
      description: "Here we can select which locomotives we want to import from our DCC-EX command station into the throttle's roster. The panel will show which roster entries match those that are already in our roster presets, and which are unknown (new). Note: This only works when we are connected to the command station, and only if we have added our roster information to DCC-EX, although we can try it out with the Emulator.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },
  
  // Step 77: Roster Entry Detail Highlight
  {
    element: '#tour-loco-roster-entry-first',
    onShow: ['click_import_locos', 'connect_emulator', 'set_loco_details_modal_off'],
    onNext: ['show_dcc_ex_loco_details_modal_on_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'DCC-EX Roster Entry',
      description: 'We can also press on one of the locomotive roster entries to see details about that locomotive.',
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 78: Loco Details Modal
  {
    element: '#tour-loco-dcc-ex-details-modal',
    onShow: [],
    onPrev: ['set_loco_details_modal_off'],
    onNext: ['set_loco_details_modal_off'],
    popoverDelay: 400,
    popover: {
      title: 'DCC-EX Locomotive Details',
      description: "Here we will see all the locomotive's DCC functions according to our DCC-EX command station. If we would like to import the locomotive into the throttle's roster, click the 'Import Loco' button.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 79: Roster Entry Checkmark Mention
  {
    element: '#tour-loco-roster-entry-first',
    onShow: ['connect_emulator', 'set_loco_details_modal_off', 'show_dcc_ex_roster_modal_on', 'select_first_dcc_ex_loco'],
    onNext: [],
    onPrev: ['unselect_first_dcc_ex_loco', 'show_dcc_ex_loco_details_modal_on_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'DCC-EX Import Confirmation',
      description: "This will place a checkmark next to the locomotive's entry in the DCC-EX Loco Roster control panel. We can also manually add or remove the checkmarks by clicking on the checkbox.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 80: Import Selected & Cancel Buttons
  {
    element: '#tour-loco-dcc-ex-roster-footer',
    onShow: ['show_dcc_ex_roster_modal_on'],
    onNext: ['show_dcc_ex_import_conflict_on_sequence'],
    onPrev: [],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'DCC-EX Finalize Import',
      description: "Click 'Import Selected' to add the selected locomotive(s) to the throttle's roster, or click 'Cancel' to return to the Manage Roster control panel.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 81: Loco Collision Alert
  {
    element: '#tour-loco-import-conflict-alert',
    onShow: [],
    onPrev: ['show_dcc_ex_import_conflict_off'],
    onNext: [],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Address Collision',
      description: "If we try to import a locomotive with the same DCC address as one of the other locomotives already in the throttle's roster, we will be asked if we want to replace the roster entry with information from DCC-EX, create a new roster entry, or cancel.",
      side: 'top',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 82: Create New Roster Entry Detail
  {
    element: '#tour-loco-import-conflict-create-new-btn',
    onShow: [],
    onPrev: [],
    onNext: ['show_dcc_ex_import_finished_on_sequence'],
    popover: {
      title: 'Create New # Entry',
      description: "If we choose to create a new roster entry using the information from DCC-EX, the throttle will create a new entry for our locomotive with the next available 'hashtag' ID. By adding a hashtag (#) at the start of the roster ID for some of our locomotives, and adding a decimal point number at the end (#3.1, #3.2, etc.), we can have multiple locomotives in the throttle's roster with the same DCC address. Note: Because our locomotives will still have the same DCC address, we cannot control them independently. Any commands we send to one of the locomotives will be received by the others.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    },
  },

  // Step 83: Import Complete & Visible Presets
  {
    element: '#tour-loco-import-conflict-alert',
    onShow: ['tour_delete_loco_3_variant'],
    onPrev: ['show_dcc_ex_import_conflict_on_sequence'],
    onNext: ['tour_add_loco_3_variant', 'show_dcc_ex_import_conflict_off', 'show_dcc_ex_roster_modal_off', 'show_roster_modal_on_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'DCC-EX Import Complete',
      description: "If we import roster entries from DCC-EX, and the first available empty roster slots are not currently visible in the throttle, we will see a message asking if we want to make additional presets visible. This is equivalent to pressing the + button in the header of the Loco Address Panel in the throttle, or adjusting the Visible Presets slider in the Manage Roster control panel, both of which we saw previously.",
      side: 'top',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },


  // Step 84: Save Changes
  {
    element: '#tour-loco-manage-roster-modal',
    onShow: [],
    onNext: ['show_roster_modal_off', 'show_loco_sort_modal_on'],
    onPrev: ['show_dcc_ex_roster_modal_on', 'show_dcc_ex_import_conflict_on_sequence', 'show_dcc_ex_import_finished_on_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Save Roster Changes',
      description: "Now we can save our roster changes. Note: Any locomotives we imported from DCC-EX will already be added to the roster so what we select here won't affect those.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 85: Sort & Configure Presets modal
  {
    element: '#tour-loco-presets-list',
//    element: '#tour-loco-sort-modal',
    onShow: ['edit_presets_on'],
    onNext: ['show_loco_sort_modal_off', 'edit_presets_off'],
    onPrev: ['show_loco_sort_modal_off', 'show_roster_modal_on_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'New Roster Entries',
      description: "Now we should see any locomotives we just imported from DCC-EX in the throttle's roster. We may have to scroll down to see them if there are already a number of roster entries in the throttle. Note: We can close the Sort & Configure Presets panel by clicking the red button in the upper left corner, or by scrolling to the bottom of the list of presets and pressing the 'Close Sort' button.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 86: Loco Address Panel Revisit
  {
    element: '#tour-loco-address',
    onShow: ['show_road_names_on'],
    popover: {
      title: 'Loco Address Panel',
      description: "Depending on how we sorted our presets, we may also see our newly imported locomotive(s) in the locomotive presets in the Loco Address Panel.",
      side: 'right',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:80',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 87: Loco Address Box Revisit
  {
    element: '#tour-loco-address-box',
    onShow: [`loco_entry_animation_#3.1:800:300`],
    popover: {
      title: 'Loco Hashtag Address',
      description: "We can also enter the ID for one of our new locomotives in the address box. If we imported a new locomotive with the same DCC address as one of the other locomotives in our roster, we can enter its hashtag (#) ID in the box. We can also manually enter hashtag (#) locomotive IDs directly into the presets if we like.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 88: Loco Address Panel Revisit
  {
    element: '#tour-loco-address',
    onShow: ['show_road_names_on'],
    popover: {
      title: 'Loco Address Panel',
      description: "Remember, even though this new locomotive has a hashtag (#) ID, it still has the same DCC address as one or more of the other locomotives in our roster, so we will want to pay attention to which other locomotives with that address are on the track, as they will all receive the same commands from the throttle.",
      side: 'right',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:80',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },


// ------------- LOCO ADDRESS PANEL -- Locomotive Consists ------------- //

  // Step 89: Intro to Consists
  {
    element: '#tour-loco-header-and-address-combined',
    onShow: ['tour_hide_consists'],
    popover: {
      title: 'Introduction to Consists',
      description: "In addition to running single locomotives, we can run multiple locomotives together in consists.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 90: Consist Setup Icon
  {
    element: '#tour-consist-setup-btn',
    onShow: ['tour_hide_consists'],
    onNext: ['tour_show_consists_sequence'],
    popover: {
      title: 'Consist Setup',
      description: "Click the consist setup icon to open the consist setup and configuration controls.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 91: Consist Preset Buttons
  {
    element: '#tour-consist-presets-grid',
    onShow: ['tour_show_consists'],
    onNext: ['tour_prepare_consist_1_sequence'],
    onPrev: ['tour_hide_consists_sequence'],
    actionDelay: 100,
    popoverDelay: 100,
    popover: {
      title: 'Consist Presets',
      description: "We can configure up to nine different locomotive consists at a time.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 92: Select Consist Button
  {
    element: '#tour-consist-presets-grid',
    onShow: ['tour_prepare_consist_1'],
    onNext: [],
    onPrev: ['tour_show_consists_sequence'],
    popover: {
      title: 'Select Consist',
      description: "Select one of the consist preset buttons to edit that consist. For this example we\'ll start with a clear, empty consist.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 93: Add locomotives to the consist
  {
    element: '#tour-loco-presets-to-bottom-combined',
    onShow: [
      'tour_prepare_consist_1', 'tour_select_preset_1:1000', 'tour_select_preset_2:2000', 'tour_select_preset_3:3000'],
    onPrev: ['tour_prepare_consist_1_sequence'],
    actionDelay: 100,
    popoverDelay: 100,
    popover: {
      title: 'Add Locomotives',
      description: "Add locomotives to the consist by selecting their locomotive preset buttons. The order in which we select the presets determines the order of our locomotives in the consist, with the first locomotive we select being at the front of the consist, and the others following behind. Note: Our locomotives must be in a visible preset to add them to a consist, but once in the consist we can hide the presets if we like.",
      side: 'right',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:110',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 94: Consist Address Display
  {
    element: '#tour-loco-address-box',
    onShow: ['tour_set_consist_1_three_forward'],
    onPrev: ['tour_prepare_consist_1_sequence'],
    popover: {
      title: 'Consist Address Box',
      description: "The addresses of the locomotives in the consist will appear in the Loco Address box, which will show a 'Consist' indicator. The < or > direction indicator will indicate which way the lead locomotive is facing based on its settings in the Throttle Control Panel. The order of the locomotives in the Loco Address box is determined by the direction of the lead locomotive, so if the lead locomotive is facing left, then it will be on the left side of the address box, and if the lead locomotive is facing right, it will be on the right side. We'll learn how to set which direction the locomotive is facing later when we look at the Throttle Control Panel.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 95: Lead Locomotive Photo
  {
    element: '#tour-loco-image',
    popover: {
      title: 'Lead Locomotive Photo',
      description: "The lead locomotive's photo or image will appear in the photo box, with a stacked 'consist' icon in the upper left corner.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 96: Add a Reverse Locomotive
  {
    element: '#tour-loco-presets-to-bottom-combined',
    onShow: [
        'tour_set_consist_1_three_forward', 'tour_select_preset_3:500', 'tour_select_preset_3:1500', 'tour_select_preset_3:2500'],
    onPrev: ['tour_set_consist_1_three_forward'],
    actionDelay: 100,
    popoverDelay: 100,
    popover: {
      title: 'Reverse Locomotives',
      description: "Press a locomotive's preset button again if that locomotive is facing in the opposite direction from the lead locomotive. The locomotive preset will show that locomotive going in reverse. We can toggle the direction of the locomotive by repeatedly pressing its preset button.",
      side: 'right',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:120',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 97: Remove a Locomotive
  {
    element: '#tour-loco-presets-to-bottom-combined',
    onShow: [
        'tour_set_consist_1_three_preset_3_reverse',
        'tour_long_press_preset_2:1000'
    ],
//    onNext: ['tour_set_consist_1_three_preset_3_reverse'],
    onPrev: ['tour_set_consist_1_three_preset_3_reverse'],
    actionDelay: 100,
    popoverDelay: 100,
    popover: {
      title: 'Remove Locomotives',
      description: "Long-press on a locomotive's preset button to remove that locomotive from the consist.",
      side: 'right',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:120',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 98: Reverse Consist Order
  {
    element: '#tour-consist-header-actions',
    onShow: ['tour_set_consist_1_two_preset_3_reverse', 'tour_highlight_reverse_button_on'],
    onNext: ['tour_highlight_reverse_button_off'],
    onPrev: ['tour_set_consist_1_two_preset_3_reverse', 'tour_highlight_reverse_button_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Reverse Consist Order',
      description: "We can reverse the order of the consist by pressing the 'Reverse Order' button. Note that this is different from running our locomotives in reverse. Reversing the order of the consist means that our trailing locomotive will now become our lead locomotive. This would be as if we had disconnected our consist of locomotives and run them around the train, or turned them on a Y.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 99: Consist Order Reversed
  {
    element: '#tour-loco-address',
    onShow: ['tour_set_consist_1_reversed_order', 'tour_highlight_reverse_button_off'],
    onPrev: ['tour_set_consist_1_two_preset_3_reverse', 'tour_highlight_reverse_button_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Consist Order Reversed',
      description: "When we reverse the order of a consist, the image in the photo box will change to our new lead locomotive.",
      side: 'right',
      align: 'center',
      sightsFromStep: 38,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 100: Consist Locos Reversed
  {
    element: '#tour-loco-address',
    onShow: ['tour_highlight_reverse_button_off'],
    onPrev: ['tour_set_consist_1_reversed_order', 'tour_highlight_reverse_button_off'],
    popoverDelay: 400,
    popover: {
      title: 'Consist Locos Reversed',
      description: "The direction indicator in the address box will also change sides, and if our lead locomotive is facing in a different direction from our trailing locomotive, all the locomotives will also change directions. We will see this reflected in the colors of the addresses in the address box, and each locomotive's preset button below.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:160',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 101: Consist Preset Reversed
  {
    element: '#tour-consist-presets-grid',
    onShow: ['tour_set_consist_1_reversed_order', 'tour_highlight_reverse_button_off'],
    onPrev: ['tour_set_consist_1_reversed_order', 'tour_highlight_reverse_button_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Consist Preset Reversed',
      description: "The consist's preset button will also show that the consist has been reversed. Again, this does not mean that the consist is running in reverse, but rather that it has been 'turned' or run around the train. Assuming that our lead locomotive and trailing locomotive are facing in opposite directions, then the icon in the middle of the consist preset button will show that the former trailing locomotive now leading the consist is traveling in the forward direction when the consist is turned.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 102: Consist Order Buttons
  {
    element: '#tour-consist-header-actions',
    onShow: ['tour_set_consist_1_reversed_order', 'tour_highlight_move_up_down_on'],
    onNext: ['tour_highlight_move_up_down_off'],
    onPrev: ['tour_set_consist_1_reversed_order', 'tour_highlight_move_up_down_off'],
    popover: {
      title: 'Change Consist Preset Order',
      description: "We can change the order of the consist presets by pressing the 'Move Up' and 'Move Down' buttons.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 103: Clear Consist Button
  {
    element: '#tour-consist-header-actions',
    onShow: ['tour_set_consist_1_reversed_order', 'tour_highlight_clear_consist_on'],
    onNext: ['tour_highlight_clear_consist_off'],
    onPrev: ['tour_set_consist_1_reversed_order', 'tour_highlight_clear_consist_off'],
    popover: {
      title: 'Clear Consist',
      description: "We can delete/clear a consist by pressing the 'Clear Consist' button.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 104: Completing Consist Setup
  {
    element: '#tour-loco-header-and-address-combined',
    onShow: ['tour_set_consist_1_reversed_order'],
    onPrev: ['tour_set_consist_1_reversed_order'],
    popover: {
      title: 'Completing Consist Setup',
      description: "When we're done configuring our consists, we can press the Consist Setup button to close the configuration buttons and hide any empty, unused consists.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 105: Running Consists
  {
    element: '#tour-consist-presets-grid',
    onShow: ['tour_consist_setup_off'],
    onPrev: ['tour_set_consist_1_reversed_order'],
    popover: {
      title: 'Active Consist Mode',
      description: 'We can now run our consist just like any other locomotive by selecting its preset.',
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 106: Turning/Reversing Consists
  {
    element: '#tour-consist-presets-grid',
    onShow: ['tour_consist_setup_off', 'tour_toggle_consist_1:1500', 'tour_toggle_consist_1:2500', 'tour_toggle_consist_1:3500'],
    onPrev: ['tour_toggle_consist_1'],
    popover: {
      title: 'Turn Consist',
      description: "Press the consist preset button again to 'turn' or reverse the order of our consist. This is identical to pressing the 'Reverse Order' button when in consist setup mode.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 107: Hide All Consists
  {
    element: '#tour-consist-hide-all-btn',
    onShow: ['tour_consist_setup_off', 'tour_highlight_hide_all_consists_on'],
    onPrev: ['tour_highlight_hide_all_consists_off', 'tour_toggle_consist_1'],
    onNext: ['tour_highlight_hide_all_consists_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Hide All Consists & Exit',
      description: "When we are done running consists, or simply want to hide the consist presets, press the 'Hide all Consists' button.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 108: Active Consist Still Active
  {
    element: '#tour-loco-header-and-address-combined',
    onShow: ['tour_hide_consists'],
    onPrev: ['tour_consist_setup_off_sequence'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Active Consist Still Active',
      description: "Even after we hide the consist presets, if we were running a consist it will still be active in the throttle, and the locomotive addresses will be displayed in the address box and the locomotive presets.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:60',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 109: Run a New Locomotive Address
  {
    element: '#tour-loco-address-box',
    onShow: ['loco_entry_animation_12:800:300'],
    onPrev: ['tour_consist_setup_off'],
    popover: {
      title: 'Type Locomotive Address',
      description: "To run a new locomotive, we can click in the address box and type its address.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 110: Run Preset
  {
    element: '#tour-loco-address',
    onShow: ['select_first_preset'],
    onNext: ['tour_show_consist_warning_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Run Preset',
      description: "Or we can run one of our locomotives by selecting its preset.",
      side: 'right',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:160',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 111: Consist Warning Modal
  {
    element: '#tour-consist-warning-modal',
    onShow: ['tour_show_consist_warning_on'],
    onPrev: ['tour_show_consist_warning_off'],
    onNext: ['tour_show_consist_warning_off', 'tour_show_motion_warning_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Consist Warning',
      description: "If we select a preset for a locomotive that is part of a consist, and the consist is moving at any speed other than 0, the throttle will display a warning that trying to control that locomotive individually could cause unexpected behavior or derailments.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 112: Locomotive(s) Already in Motion Warning
  {
    element: '#tour-loco-individually-moving-warning-modal',
    onShow: ['tour_show_motion_warning_on'],
    onPrev: ['tour_show_motion_warning_off', 'tour_show_consist_warning_on'],
    onNext: ['tour_show_motion_warning_off'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Locomotive(s) Already in Motion',
      description: "Additional messages will warn us when we try to select a consist that includes a locomotive that is already in motion, either by itself or as part of another consist.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

// ------------- LOCO ADDRESS PANEL -- Hidden Small Screen Controls ------------- //


  // Step 113: Hidden Controls Long-Press
  {
    element: '#tour-loco-card-header',
    onShow: ['tour_show_motion_warning_off', 'highlight_compact_presets_on'],
    onPrev: ['tour_show_motion_warning_on', 'highlight_compact_presets_off'],
    onNext: ['highlight_compact_presets_off'],
    popover: {
      title: 'Small Screen Controls',
      description: "There is one more set of 'hidden' small-screen controls we can access by long-pressing the 'Compact Presets' button.",
      side: 'right',
      align: 'start',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 114: Advanced Buttons Overview
  {
    element: '#tour-loco-card-header',
    onShow: ['tour_show_advanced_toggles_on', 'tour_highlight_merge_btn_on', 'tour_highlight_hide_header_btn_on', 'tour_highlight_lock_btn_on'],
    onPrev: ['tour_show_advanced_toggles_off', 'tour_highlight_merge_btn_off', 'tour_highlight_hide_header_btn_off', 'tour_highlight_lock_btn_off', 'highlight_compact_presets_on'],
    onNext: ['tour_highlight_merge_btn_off', 'tour_highlight_hide_header_btn_off', 'tour_highlight_lock_btn_off'],
    popover: {
      title: 'Small Screen Navigation',
      description: "These hidden controls - the Merge Address Box, Hide Header Cards, and Lock Scroll buttons - are useful when operating the throttle on a small touchscreen, such as a smart phone or tablet.",
      side: 'top',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 115: Merge Address Box Activation
  {
    element: '#tour-loco-address',
    onShow: ['tour_show_advanced_toggles_on', 'tour_set_merge_address_on'],
    onPrev: ['tour_set_merge_address_off', 'tour_highlight_merge_btn_on', 'tour_highlight_hide_header_btn_on', 'tour_highlight_lock_btn_on'],
    onNext: ['tour_set_merge_address_off', 'tour_show_advanced_toggles_off'],
    popover: {
      title: 'Merge Address Box',
      description: "The 'Merge Address Box' button will merge the locomotive address box over the top of the locomotive photo or image to save space. All the functions and controls in the address box, including manually entering a locomotive's address into the box, and using the double-chevrons to scroll through the locomotive presets, are unchanged.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 116: Lock Scroll Button
  {
    element: '#tour-loco-address',
    onShow: ['tour_show_advanced_toggles_on', 'tour_highlight_lock_btn_on', 'tour_set_merge_address_off'],
    onPrev: ['tour_set_merge_address_on', 'tour_highlight_lock_btn_off'],
    onNext: ['tour_highlight_lock_btn_off'],
    popover: {
      title: 'Lock Scroll',
      description: "The 'Lock Scroll' button will lock the display on our touchscreen device, such as our smart phone or tablet, so that we can more easily interact with the throttle's sliders and buttons without the throttle moving around on the screen as we drag our finger. Press the button again to unlock the scroll.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 117: Hide Header Cards Button
  {
    element: '#tour-loco-address',
    onShow: ['tour_show_advanced_toggles_on', 'tour_highlight_hide_header_btn_on', 'tour_set_address_focus_off'],
    onPrev: ['tour_highlight_lock_btn_on', 'tour_highlight_hide_header_btn_off'],
    onNext: ['tour_highlight_hide_header_btn_off'],
    popover: {
      title: 'Hide Header Cards',
      description: "The 'Hide Header Cards' button will hide the Header Panel on the first press, and then hide both the Header Panel and the Track Power Panel and also lock the scroll on the second press.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 118: Hide Header Cards Activation
  {
    element: '#tour-loco-address',
    onShow: ['tour_show_advanced_toggles_on', 'tour_set_address_focus_on', 'tour_set_merge_address_off', 'expand_presets', 'expand_throttle', 'expand_functions'],
    onPrev: ['tour_set_address_focus_off', 'tour_highlight_hide_header_btn_on'],
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Throttle Collapsed',
      description: "This will collapse the throttle to its essential controls for selecting locomotives, controlling locomotive speed and direction, and activating locomotive DCC decoder functions.",
      side: 'right',
      align: 'center',
      popoverClass: 'custom-popover-shift-up:40',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 119: Compact UI Elements
  {
    element: '#tour-app-content',
    onShow: ['tour_set_address_focus_on', 'compact_presets', 'tour_set_merge_address_on', 'compact_throttle', 'compact_functions'],
    onPrev: ['tour_set_merge_address_off', 'expand_presets', 'expand_throttle', 'expand_functions'],
    popover: {
      title: 'Compact Footprint',
      description: "By using additional controls in the Loco Address, Throttle Control, and Loco Functions control panels, we can shrink the throttle to a very small footprint for our smart phone or tablet, while still having all its features available at our fingertips.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 120: Show Header Cards Re-show
  {
    element: '#tour-loco-card-header',
    onShow: ['tour_show_advanced_toggles_on', 'tour_set_address_focus_on'],
    onPrev: ['tour_set_address_focus_on', 'compact_presets', 'tour_set_merge_address_on', 'compact_throttle', 'compact_functions'],
    popover: {
      title: 'Show Header Cards',
      description: "Press the 'Hide Header Cards' button again to show the Header and Track Power control panels and unlock the display scroll. Long-press the 'Compact Presets' button again to hide the 'hidden' controls.",
      side: 'bottom',
      align: 'center',
      popoverClass: 'custom-popover-shift-right:32',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 121: Emergency Stop Long Press
  {
    element: '#tour-estop',
    onShow: ['tour_show_advanced_toggles_on', 'tour_set_address_focus_on'],
    onPrev: ['tour_show_advanced_toggles_on', 'tour_set_address_focus_on'],
    popover: {
      title: 'Emergency Recovery',
      description: "In some cases, the 'Hide Header Cards' and 'Lock Scroll' buttons may move off the visible portion of the screen when activated. If that happens, we can long-press on the Emergency Stop button for three seconds to show the hidden controls and unlock the screen.",
      side: 'left',
      align: 'center',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },

  // Step 122: Loco Address Panel Conclusion
  {
    element: '#tour-loco-address',
    onShow: ['tour_set_address_focus_off', 'expand_presets', 'tour_set_merge_address_off', 'expand_throttle', 'expand_functions', 'tour_show_advanced_toggles_off'],
    onNext: ['finish_tour'],
    onPrev: ['tour_show_advanced_toggles_on', 'tour_set_address_focus_on'],
    popover: {
      title: 'Loco Address Summary',
      description: "We have now explored all the features and controls in the Loco Address Panel of the Driver-D Throttle for DCC-EX. We learned how to configure our locomotive presets, manage our roster and import locomotives from DCC-EX, set up and run locomotives in consists, and minimize our throttle to run on a smart phone or tablet. Now let's look at how to control our locomotives' speed and direction.",
      side: 'right',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 38,
      showSightsToggle: true
    }
  },



// ------------- THROTTLE CONTROL PANEL ------------- //


  // Step 123: Throttle Speed Control Detail Start
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_stop_restart_cleanup'],
    onPrev: ['cancel_to_menu'],
    onNext: ['tour_throttle_edit_off', 'expand_throttle'],
    popover: {
      disableButtons: ['previous'],
      title: 'Throttle Control Panel',
      description: "Let's take a look at the Throttle Control Panel next. As with the other control panels, the Throttle Control Panel is divided into several different sections.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sights: throttleSights_AddressPanel
    }
  },

  // Step 124: Throttle Active State Note
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['set_mode_emulator', 'connect_emulator', 'track_power_on', 'tour_throttle_enable_override:0:true'],
    onPrev: ['disconnect_emulator_sequence', 'tour_throttle_enable_override:0:false'],
//    onPrev: ['tour_throttle_edit_off', 'expand_throttle'],
    popover: {
      title: 'Active Connection Required',
      description: "Note that most of the features of the Throttle Control Panel are only active when the throttle is connected to our DCC-EX command station or the Emulator, and the track power is on.",
      side: 'left',
      align: 'end',
      popoverClass: 'custom-popover-shift-up:40',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 125: Header Menus
  {
    element: '#tour-throttle-top-controls',
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Menus & Configuration',
      description: "At the top of the Throttle Control Panel are the settings and configuration menus. We'll come back to these in a moment.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 126: Speed Indicator
  {
    element: '#tour-throttle-top-controls',
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Speed Indicator',
      description: "Next is the throttle speed indicator, showing the currently selected locomotive or consist speed in speed steps.",
      side: 'bottom',
      align: 'start',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 127: Direction Buttons
  {
    element: '#tour-throttle-top-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_direction_reverse:1000', 'tour_throttle_direction_forward:2000', 'tour_throttle_direction_reverse:3000;','tour_throttle_direction_forward:4000'],
    onPrev: ['tour_throttle_direction_forward'],
    popover: {
      title: 'Forward & Reverse',
      description: "To the right of the speed indicator are the Forward and Reverse buttons, which allow us to change the direction of our locomotives. Note that several items in the throttle change color based on the direction our selected locomotive or consist is travelling, including the different speed displays, and the locomotive and consist addresses and presets.",
      side: 'bottom',
      align: 'end',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 128: Keyboard Shortcut - Direction
  {
    element: '#tour-throttle-top-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_direction_reverse:1400', 'tour_throttle_direction_forward:2400', 'tour_throttle_direction_reverse:3400;','tour_throttle_direction_forward:4400', 'tour_show_keyboard_key:up:400', 'tour_show_keyboard_key:down:1400', 'tour_show_keyboard_key:up:2400', 'tour_show_keyboard_key:down:3400', 'tour_show_keyboard_key:up:4400', 'tour_hide_keyboard_key:5400'],
    onPrev: ['tour_throttle_direction_forward'],
    onNext: ['tour_throttle_direction_forward'],
    popover: {
      title: 'Direction Keyboard Shortcut',
      description: "KEYBOARD SHORTCUT: Note that in addition to pressing the Forward and Reverse buttons, if we are using the throttle on a device that has a keyboard, we can use the up and down arrow keys to change the direction of our locomotive(s).",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 129: Speed Slider
  {
    element: '#tour-throttle-main-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_slider_drag:500:2000:75:-40', 'tour_throttle_slider_drag:2800:1400:45:-40'],
//    onNext: ['tour_throttle_speed_set_25'],
//    onPrev: ['tour_throttle_speed_set_0'],
    popover: {
      title: 'Throttle Speed Slider',
      description: "Below the speed indicator and direction buttons is the throttle speed slider, with + and - buttons at either end. We can drag the slider indicator with our mouse (or finger on a touchscreen device) to change the speed.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 130: +/- Buttons
  {
    element: '#tour-throttle-main-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_speed_plus_highlight:400:400', 'tour_throttle_speed_plus_highlight:1200:400', 'tour_throttle_speed_plus_highlight:2000:400', 'tour_throttle_speed_plus_highlight:2800:400', 'tour_throttle_speed_minus_highlight:3600:400', 'tour_throttle_speed_minus_highlight:4400:400', 'tour_throttle_speed_minus_highlight:5200:400', 'tour_throttle_speed_minus_highlight:6000:400', 'tour_throttle_speed_set:400:5', 'tour_throttle_speed_set:1200:10', 'tour_throttle_speed_set:2000:15', 'tour_throttle_speed_set:2800:20', 'tour_throttle_speed_set:3600:15', 'tour_throttle_speed_set:4400:10', 'tour_throttle_speed_set:5200:5', 'tour_throttle_speed_set:6000:0'],
    popover: {
      title: 'Plus (+) & Minus (-) Buttons',
      description: "The + and - buttons allow us to increase or decrease the speed by a set amount. The default is 5 speed steps, but we'll look at how to change that in a moment.",
      side: 'left',
      align: 'center',
      popoverClass: 'custom-popover-shift-down:50',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 131: +/- Keyboard Shortcuts
  {
//    element: '#tour-throttle-slider-combined',
    element: '#tour-throttle-main-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_show_keyboard_key:+:400:20', 'tour_hide_keyboard_key:800:20', 'tour_show_keyboard_key:+:1200:20','tour_hide_keyboard_key:1600:20', 'tour_show_keyboard_key:+:2000:20', 'tour_hide_keyboard_key:2400:20', 'tour_show_keyboard_key:-:2800:20', 'tour_hide_keyboard_key:3200:20', 'tour_show_keyboard_key:-:3600:20', 'tour_hide_keyboard_key:4000:20', 'tour_show_keyboard_key:-:4400:20', 'tour_hide_keyboard_key:4800', 'tour_throttle_speed_set:400:5', 'tour_throttle_speed_set:1200:10', 'tour_throttle_speed_set:2000:15', 'tour_throttle_speed_set:2800:10', 'tour_throttle_speed_set:3600:5', 'tour_throttle_speed_set:4400:0'],
    popover: {
      title: 'Speed Keyboard Shortcuts',
      description: "KEYBOARD SHORTCUT: The + and - keys, and the right and left arrow keys on the keyboard also have the same function.",
      side: 'left',
      align: 'center',
      popoverClass: 'custom-popover-shift-down:50',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 132: Mouse Control
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['set_mode_emulator', 'connect_emulator', 'track_power_on', 'tour_throttle_enable_override:0:true', 'tour_throttle_mouse_demo:400:15:1000:4000', 'tour_throttle_speed_set:400:5', 'tour_throttle_speed_set:1200:10', 'tour_throttle_speed_set:2000:15', 'tour_throttle_speed_set:2800:10', 'tour_throttle_speed_set:3600:5', 'tour_throttle_speed_set:4400:0'],
    popover: {
      title: 'Mouse Wheel Control',
      description: 'MOUSE CONTROL: If we are using the throttle on a device that has a mouse, then whenever the mouse pointer is within the Throttle Control panel, the mouse pointer will change to a green speedometer icon. When this happens we can also use our mouse scroll wheel to change the speed by the set increments.',
      side: 'right',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 133: Presets
  {
    element: '#tour-throttle-all-but-estop',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_preset_highlight:400:25:1000', 'tour_throttle_speed_set:400:25', 'tour_throttle_preset_highlight:1600:50:1000', 'tour_throttle_speed_set:1600:50', 'tour_throttle_preset_highlight:2800:100:1000', 'tour_throttle_speed_set:2800:100', 'tour_throttle_preset_highlight:4000:0:300', 'tour_throttle_speed_set:4000:0'],
    onPrev: ['tour_throttle_speed_set_0'],
    onNext: ['tour_throttle_speed_set_0'],
    popover: {
      title: 'Speed Presets',
      description: "Below the throttle speed slider are a number of speed preset buttons, including a Stop button. The Stop button is the equivalent of setting the speed to 0. As with many elements in the throttle, the color of the buttons will vary depending on whether the selected locomotive is going in the forward or reverse direction.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 134: Keyboard Shortcut - Stop
  {
    element: '#tour-throttle-preset-stop',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_show_keyboard_key:space:400:80', 'tour_hide_keyboard_key:1600'],
    popover: {
      title: 'Stop Keyboard Shortcut',
      description: "KEYBOARD SHORTCUT: The keyboard spacebar will also function as a 'Stop' command.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 135: Emergency Stop
  {
    element: '#tour-estop',
    actionDelay: 400,
    popoverDelay: 400,
    popover: {
      title: 'Emergency Stop',
      description: "Finally, at the bottom of the Throttle Control Panel is the Emergency Stop button. This will send DCC-EX the command to immediately stop all locomotives on the layout.  NOTE: As we discussed in the previous section, long-pressing the Emergency Stop button for 3 seconds will also show the Header and Track Power control panels if we have previously hidden them.",
      side: 'top',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },


  // Step 136: Keyboard Shortcut - Emergency Stop
  {
    element: '#tour-estop',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_show_keyboard_key:esc:400:80', 'tour_show_keyboard_key:/:1600:80', 'tour_hide_keyboard_key:2800'],
    popover: {
      title: 'E-Stop Keyboard Shortcuts',
      description: "KEYBOARD SHORTCUT: The Escape (ESC) key and the forward-slash key (/) will also perform an Emergency Stop.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 137: Compact Mode
  {
    element: '#tour-throttle-compact-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['set_mode_emulator', 'connect_emulator', 'track_power_on', 'tour_throttle_enable_override:0:true', 'highlight_compact_throttle_on'],
    onNext: ['compact_throttle'],
    onPrev: ['highlight_compact_throttle_off', 'expand_throttle'],
    popover: {
      title: 'Compact Throttle',
      description: "There are a number of different ways that we can customize the Throttle Control Panel. The 'Compact Throttle' button will hide the speed presets to save space.",
      side: 'right',
      align: 'start',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 138: Hidden Speed Presets & Stop Button
  {
    element: '#tour-throttle-main-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['highlight_compact_throttle_on'],
    onNext: ['highlight_compact_throttle_off', 'expand_throttle'],
    onPrev: ['expand_throttle'],
    popover: {
      title: 'Hidden Speed Presets',
      description: "Note that when the speed presets are hidden, the 'Stop' label on the speed slider becomes a functional 'Stop' button.",
      side: 'bottom',
      align: 'start',
      popoverClass: 'custom-popover-shift-right:80',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 139: Settings Gear
  {
    element: '#tour-throttle-settings-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['highlight_throttle_settings_on'],
    onNext: ['highlight_throttle_settings_off', 'tour_throttle_edit_on'],
    onPrev: ['highlight_throttle_settings_off', 'tour_throttle_edit_off', 'expand_throttle'],
    popover: {
      title: 'Throttle Settings',
      description: "The rest of the configuration settings are available by pressing the 'Throttle Settings' gear icon.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 140: Throttle Top Controls Settings
  {
    element: '#tour-throttle-settings-pane',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on'],
    onNext: [],
    onPrev: ['tour_throttle_edit_off'],
    popover: {
      title: 'Control Settings',
      description: "We'll start with some settings that affect how we control our locomotives.",
      side: 'left',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 141: Throttle Mode
  {
    element: '#tour-throttle-mode-setting-combined',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on'],
//    onNext: ['tour_throttle_edit_off'],
    popover: {
      title: 'Throttle Mode',
      description: "The 'Throttle Mode' setting allows us to switch from a standard throttle with speeds from 0 to 126 speed steps, and Forward and Reverse buttons, to a switching-shunting throttle with speeds from -126 speed steps Reverse to +126 speed steps Forward, with Stop in the middle.",
      side: 'bottom',
      align: 'start',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 142: Switching Throttle Mode
  {
    element: '#tour-throttle-main-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_throttle_mode_switching', 'tour_set_throttle_mode_standard:1500', 'tour_set_throttle_mode_switching:2500'],
    onNext: ['tour_set_throttle_mode_standard'],
    onPrev: ['tour_set_throttle_mode_standard'],
    popover: {
      title: 'Switching Throttle',
      description: "When we select the 'Switching' throttle, the forward and reverse buttons will disappear, and the throttle slider will adjust to show Max Reverse (REV) at one end, and Max Forward (FWD) at the other, with Stop in the middle. The large speed indicator near the top of the control panel will also show the direction FWD or REV along with the speed.",
      side: 'left',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 143: Throttle Orientation
  {
    element: '#tour-throttle-orientation-setting-combined',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_throttle_mode_standard'],
    onNext: [],
    onPrev: ['tour_set_throttle_mode_switching'],
    popover: {
      title: 'Locomotive Orientation',
      description: "The Forward Left (FWD Left) and Forward Right (FWD Right) buttons allow us to specify which direction our locomotive or consist is facing on the track. Note: This setting is for visual convenience only, and does not affect the commands sent to our DCC-EX command station.",
      side: 'bottom',
      align: 'end',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 144: Switching Orientation Demonstration
  {
    element: '#tour-throttle-main-controls',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_switching_orientation_right', 'tour_set_switching_orientation_left:1000', 'tour_set_switching_orientation_right:2000', 'tour_set_switching_orientation_left:3000', 'tour_set_switching_orientation_right:4000'],
    onNext: ['tour_set_switching_orientation_right'],
    onPrev: ['tour_set_switching_orientation_right'],
    popover: {
      title: 'Orientation Effects',
      description: "The direction that we choose to be forward will also determine the arrangement of the 'Forward' and 'Reverse' buttons, which end of the throttle slider is MIN and which end is MAX, which way the < or > direction indicator is pointing in the loco address box, and the orientation of our consist in the address box.",
      side: 'left',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 145: Specific vs. Universal Settings
  {
    element: '#tour-throttle-roster-settings',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on'],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Loco-Specific Settings',
      description: "Note that both the Throttle Mode setting and the Orientation setting are specific to individual locomotives, and the throttle stores these settings with its locomotive roster. That means that for each locomotive, we can choose which direction it is facing, and whether to use a standard or switching throttle with that locomotive. All the other configuration settings in the Throttle Control Panel are universal and apply regardless of what locomotive we are running.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 146: Scale Speed Steps or %
  {
    element: '#tour-throttle-speed-scale-combined',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on'],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Scale Speed Steps or %',
      description: "The Scale Speed Steps or % buttons allow us to choose whether to show our locomotive speeds in speed steps from 1-126, or as a percentage from 1-100. Note: This setting is for visual convenience only, and does not affect how the throttle communicates speed information to our DCC-EX command station.",
      side: 'bottom',
      align: 'end',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 147: Preset Speed Value Changes
  {
    element: '#tour-throttle-all-but-estop',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_speed_scale_steps', 'tour_set_speed_scale_percent:1000', 'tour_set_speed_scale_steps:2000', 'tour_set_speed_scale_percent:3000'],
    onNext: ['tour_set_speed_scale_steps'],
    onPrev: ['tour_set_speed_scale_steps'],
    popover: {
      title: 'Speed Presets Scale Update',
      description: 'In addition to the large locomotive speed indicator, the values on our speed preset buttons will update based on our scale speed setting.',
      side: 'left',
      align: 'center',
      popoverClass: 'custom-popover-shift-up:25',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 148: Speed Step Increment
  {
    element: '#tour-throttle-speed-increment-combined',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on'],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Speed Step Increment',
      description: "The Speed Step Increment buttons allow us to choose the amount the indicated speed will increase or decrease when we press the + or - buttons next to the throttle speed slider. Note that this also applies to the keyboard shortcuts and the mouse scroll wheel.",
      side: 'left',
      align: 'center',
//      popoverClass: 'custom-popover-shift-up:20',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 149: Speed Step Increment Example
  {
    element: '#tour-throttle-speed-increment-combined',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_speed_increment:5', 'tour_set_speed_increment:4:1000', 'tour_set_speed_increment:3:1500', 'tour_set_speed_increment:2:2000', 'tour_set_speed_increment:1:2500'],
    onNext: ['tour_set_speed_increment:5'],
    onPrev: ['tour_set_speed_increment:5'],
    popover: {
      title: 'Setting Speed Step Increment',
      description: "I always set the speed step increment to 1 because I prefer fine control over my locomotive speeds, but we can choose any value we like.",
      side: 'bottom',
      align: 'end',
      popoverClass: 'custom-popover-shift-left:45',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 150: Layout Customization Controls
  {
    element: '#tour-throttle-settings-title-combined',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['set_mode_emulator', 'connect_emulator', 'track_power_on', 'tour_throttle_enable_override:0:true', 'tour_throttle_edit_on'],
    onNext: [],
    onPrev: ['tour_throttle_edit_on'],
    popover: {
      title: 'Throttle Layout Controls',
      description: "Now let's look at some controls that we can use to customize the layout of the Throttle Control Panel.",
      side: 'bottom',
      align: 'center',
      popoverClass: 'custom-popover-shift-right:90',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 151: Cycle Emergency Stop Layout
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on'],
    onNext: [],
    onPrev: ['tour_throttle_edit_on'],
    popover: {
      title: 'Emergency Stop Layout',
      description: "The red 'Cycle Emergency Stop Layout' button lets us split the Emergency Stop button into two separate buttons: an 'Emergency Stop' button, and a regular 'Stop' button. This can provide us with a convenient Stop button when the speed presets are hidden.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 152: Cycle Emergency Stop Demonstration
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_show_button_hand:#tour-throttle-estop-mode-btn:500:6500:0:30', 'tour_set_estop_config_mode:1:500', 'tour_set_estop_config_mode:2:1500', 'tour_set_estop_config_mode:3:2500', 'tour_set_estop_config_mode:4:3500', 'tour_set_estop_config_mode:5:4500', 'tour_set_estop_config_mode:6:5500', 'tour_set_estop_config_mode:0:6550'],
    onNext: ['tour_set_estop_config_mode:0', 'tour_hide_button_hand'],
    onPrev: ['tour_set_estop_config_mode:0', 'tour_hide_button_hand'],
    popover: {
      title: 'Cycle Emergency Stop',
      description: "Press the button repeatedly to cycle through the seven options.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 153: Customize Stop is Label / Button Layout
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_show_button_hand:#tour-throttle-stop-mode-btn:1000:5000:0:30', 'tour_set_stop_as_button:true:1000', 'tour_set_stop_as_button:false:2500', 'tour_set_stop_as_button:true:4000', 'tour_set_stop_as_button:false:5500'],
    onNext: ['tour_set_stop_as_button:false', 'tour_hide_button_hand'],
    onPrev: ['tour_set_stop_as_button:false', 'tour_hide_button_hand'],
    popover: {
      title: 'Customize Stop Label',
      description: "The blue 'Stop is Label' / 'Stop is Button' button lets us turn the 'Stop' label on the throttle slider into a fully functional 'Stop' button at all times, not just when the speed presets are hidden by the 'Compact Throttle' button.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 154: Customize Small Presets
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_show_button_hand:#tour-throttle-small-presets-btn:1000:5000:0:30', 'tour_set_small_presets_active:true:1000', 'tour_set_small_presets_active:false:2500', 'tour_set_small_presets_active:true:4000', 'tour_set_small_presets_active:false:5500'],
    onNext: ['tour_set_small_presets_active:false', 'tour_hide_button_hand'],
    onPrev: ['tour_set_small_presets_active:false', 'tour_hide_button_hand'],
    popover: {
      title: 'Customize Small Presets',
      description: "The green 'Small Presets' button lets us replace the 'Stop' preset button with three small presets for throttle speeds 1, 5, and 10. This will provide us with handy presets for slow speed switching, and by using the 'Stop is Button' feature, or by cycling the Emergency Stop button layout, we can also be sure that we have a 'Stop' button at our fingertips at all times.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 155: Customize Thick Slider
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_show_button_hand:#tour-throttle-thick-slider-btn:1000:5000:0:30', 'tour_set_thick_throttle:true:1000', 'tour_set_thick_throttle:false:2500', 'tour_set_thick_throttle:true:4000', 'tour_set_thick_throttle:false:5500'],
    onNext: ['tour_set_thick_throttle:false', 'tour_hide_button_hand'],
    onPrev: ['tour_set_thick_throttle:false', 'tour_hide_button_hand'],
    popover: {
      title: 'Customize Thick Slider',
      description: "And the orange 'Thick Slider' button lets us replace the small round slider thumb with a thick bar. This can make it easier to 'grab' the slider on a touch screen display.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 156: Vertical Layout
  {
    element: '#tour-throttle-layout-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_throttle_layout:standard', 'set_mode_emulator', 'connect_emulator', 'track_power_on', 'tour_throttle_enable_override:0:true'],
    onNext: [],
    onPrev: ['tour_throttle_edit_on'],
    popover: {
      title: 'Vertical Layout',
      description: "Finally, the 'Vertical Layout' button allows us to switch from a Throttle Control Panel with a horizontal slider, to one of two options with a vertical slider.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 123,
      showSightsToggle: true
    }
  },

  // Step 157: Cycle Vertical Layout
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_throttle_layout:standard', 'tour_show_button_hand:#tour-throttle-layout-btn:500:4300:0:30', 'tour_set_throttle_layout:vertical:1000', 'tour_set_throttle_layout:reversed:2500', 'tour_set_throttle_layout:vertical:4300'],
    onNext: ['tour_set_throttle_layout:vertical', 'tour_hide_button_hand'],
    onPrev: ['tour_set_throttle_layout:standard', 'tour_hide_button_hand'],
    popover: {
      title: 'Cycle Vertical Layout',
      description: "Press the 'Vertical Layout' button to cycle through options for a vertical throttle slider on the left or on the right.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 158: Vertical Layout Benefits
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_off', 'tour_set_throttle_layout:vertical'],
    onNext: [],
    onPrev: ['tour_set_throttle_layout:vertical'],
    popover: {
      title: 'Vertical Layout Uses',
      description: "The vertical throttle layout can be useful when we want the slider near the edge of our handheld touchscreen device, such as a tablet.",
      side: 'left',
      align: 'center',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true
    }
  },

  // Step 159: Vertical Layout Options
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_on', 'tour_set_throttle_layout:vertical'],
    onNext: [],
    onPrev: ['tour_set_throttle_layout:vertical'],
    popover: {
      title: 'Vertical Layout Options',
      description: "Note that all the other options and controls are still available when using a vertical throttle layout, including the switching slider, locomotive orientation, speed scale, speed step increment, custom emergency stop / stop buttons, stop label as a button, small speed presets, and thick throttle slider.",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true
    }
  },

  // Step 160: Throttle Panel Conclusion
  {
    element: '#throttle-control-card',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_throttle_edit_off', 'tour_set_throttle_layout:standard'],
//    onNext: ['tour_set_throttle_layout:standard', 'tour_throttle_edit_off'],
    onPrev: [],
    onNext: ['finish_tour'],
    popover: {
      title: 'Throttle Panel Conclusion',
      description: "We have now looked at all the controls and features of the Throttle Control Panel. All aboard!",
      side: 'left',
      align: 'start',
      sightsFromStep: 123,
      popoverClass: 'custom-popover-shift-down:20',
      showSightsToggle: true
    }
  },

// ------------- LOCO FUNCTIONS PANEL ------------- //

  // Step 161: Loco Functions/Routes/Turnouts Detail
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['tour_stop_restart_cleanup'],
    onPrev: ['cancel_to_menu'],
    popover: {
      disableButtons: ['previous'],
      title: 'Loco Functions Panel',
      description: "Now let's look at the Loco Functions Panel. In addition to using this panel to select and configure our locomotive's DCC decoder functions, we can also use it to control the Routes and Turnouts configured in our DCC-EX command station.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sights: functionSights_AddressPanel
    }
  },

  // Step 162: Loco Functions Active State Note
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: ['set_mode_emulator', 'connect_emulator', 'track_power_on', 'tour_functions_enable_override:0:true', 'tour_functions_demo_cleanup'],
    onPrev: ['disconnect_emulator_sequence', 'tour_functions_enable_override:0:false'],
    popover: {
      title: 'Active Connection Required',
      description: "As with the Throttle Control Panel, many of the functions in the Loco Functions Panel are only active when the throttle is connected to our DCC-EX command station or the Emulator, and the track power is on.",
      side: 'left',
      align: 'center',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 163: Loco Function Buttons
  {
    element: '#tour-functions-top-row',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'tour_function_set:400:0:true',
//      'tour_function_set:1400:0:false',
      'tour_function_set:1400:1:true',
//      'tour_function_set:2800:1:false',
      'tour_function_set:2400:2:true',
      'tour_f2_pressed:2400:true',
      'tour_function_set:3400:2:false',
      'tour_f2_pressed:3400:false'
    ],
    onNext: ['tour_functions_demo_cleanup'],
    onPrev: ['tour_functions_demo_cleanup'],
    popover: {
      title: 'Locomotive Function Buttons',
      description: "Each button in the panel activates one of our locomotive's DCC decoder functions. Some of the buttons, such as the horn button (F2) are momentary buttons that only stay active while we press them.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 164: Loco Functions Keyboard Shortcuts
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'tour_show_keyboard_key:1:400:128',
      'tour_function_set:600:1:true',
      'tour_hide_keyboard_key:800',
      'tour_show_keyboard_key:1:2800:128',
      'tour_function_set:3000:1:false',
      'tour_hide_keyboard_key:3200',
      'tour_show_keyboard_key:2:4000:128',
      'tour_function_set:4200:2:true',
      'tour_hide_keyboard_key:5000',
      'tour_function_set:5200:2:false'
    ],
    onNext: ['tour_hide_keyboard_key'],
    onPrev: ['tour_hide_keyboard_key', 'tour_functions_demo_cleanup'],
    popover: {
      title: 'Keyboard Shortcuts',
      description: "KEYBOARD SHORTCUT: We can also control all the locomotive functions using keyboard shortcuts.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      popoverClass: 'custom-popover-shift-down:20',
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 165: Loco Functions Additional Shortcuts
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'tour_show_keyboard_key:Shift:800:130',
      'tour_hide_keyboard_key:1800',
      'tour_show_keyboard_key:Option:2200:130',
      'tour_hide_keyboard_key:3200',
      'tour_show_keyboard_key:Alt:3600:130',
      'tour_hide_keyboard_key:4600'
    ],
    onNext: ['tour_hide_keyboard_key'],
    onPrev: ['tour_hide_keyboard_key', 'tour_functions_demo_cleanup'],
    popover: {
      title: 'Additional Shortcuts',
      description: "KEYBOARD SHORTCUT: The keys 0-9 control functions F0-F9. The keys 0-9 along with the 'Shift' key control functions F10-F19. And finally, the keys 0-8 along with the 'Option' or 'Alt' key control functions F20-F28.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      popoverClass: 'custom-popover-shift-down:20',
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 166: Loco Functions Compact Mode
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'compact_functions:800',
      'expand_functions:1800',
      'compact_functions:2800',
      'expand_functions:3800'
    ],
    onNext: ['expand_functions'],
    onPrev: ['expand_functions', 'tour_functions_demo_cleanup'],
    popover: {
      title: 'Compact Functions',
      description: "Similar to the other control panels, the 'Compact Functions' button will reduce the function buttons to half their height to save space on smaller displays.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      popoverClass: 'custom-popover-shift-down:20',
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 167: Loco Functions Edit Button
  {
    element: '#tour-edit-functions-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:false',
      'tour_highlight_edit_functions_on'
    ],
    onNext: ['tour_highlight_edit_functions_off', 'tour_edit_functions:0:true'],
    onPrev: ['tour_highlight_edit_functions_off', 'compact_functions'],
    popover: {
      title: 'Configure Functions',
      description: "To configure the DCC decoder functions for our locomotives, as well as how they are displayed in the Loco Functions Panel, click the 'Edit Functions' button.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 168: Locate Edit Loco Functions Panel
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true'
    ],
    onNext: [],
    onPrev: ['tour_edit_functions:0:false'],
    popover: {
      title: 'Edit Locomotive Functions',
      description: "Here we can edit the details for all the DCC functions from F0 to F28 for each of our locomotives. This function information is specific to each locomotive, and stored in the throttle's locomotive roster.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:160',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 169: Function Behaviors & Options
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Function Options',
      description: "In addition to giving each function a name, we can click on checkboxes to specify certain behaviors for each function. These include whether to show the function's button or hide it in the throttle, whether the function should be active for that locomotive when it is in a consist but not in the lead, whether the function is momentary or latching, and whether the function should cycle on and off repeatedly while the button is pressed if we hold it down for more than half a second.",
      side: 'left',
      align: 'center',
      popoverClass: 'custom-popover-shift-down:40',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 170: Highlight Copy Function Config
  {
    element: '#tour-copy-function-config',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true',
      'tour_select_copy_source:600:12'
    ],
    onNext: [
      'tour_select_copy_source:0:'
    ],
    onPrev: [
      'tour_select_copy_source:0:'
    ],
    popover: {
      title: 'Copy Function Settings',
      description: "We can also copy all our function button settings from any other locomotive in the throttle's roster. We just select the locomotive we want to copy the settings from and press the 'Copy' button.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 171: Highlight F0 Color Button
  {
    element: '#tour-f0-color-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true',
      'tour_close_function_color'
    ],
    onNext: ['tour_open_function_color:0:0'],
    onPrev: [],
    popover: {
      title: 'Configure Function Colors',
      description: "Just like with the locomotive preset buttons, we can assign colors to each of our locomotive's function buttons. Assigning colors to the function buttons can help us quickly identify similar functions, such as those related to lighting features, sounds, or speed and braking functions.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 172: Function Button Color Modal
  {
    element: '#tour-loco-color-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true',
      'tour_open_function_color:0:0',
      'set_color_modal_mode_base',
      'set_color_modal_mode_accent:1200',
      'set_color_modal_mode_base:2400',
      'set_color_modal_mode_accent:3600'
    ],
    onNext: ['tour_close_function_color', 'tour_backup_f0_colors', 'tour_set_f0_colors_yellow_red'],
    onPrev: ['tour_close_function_color'],
    popover: {
      title: 'Function Color Options',
      description: "Just as before, we can select a color and opacity for both the button color and its accent. While the accent stripe for the locomotive preset buttons runs along the bottom, the accent stripe for the function buttons runs along the righthand side.",
      side: 'left',
      align: 'center',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 173: Show Function Colors Button
  {
    element: '#tour-show-function-colors-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true',
      'tour_close_function_color',
      'tour_backup_f0_colors',
      'tour_set_f0_colors_yellow_red',
      'tour_highlight_function_colors_on'
    ],
    onNext: ['tour_highlight_function_colors_off', 'show_function_colors_on', 'tour_edit_functions:0:false'],
    onPrev: ['tour_highlight_function_colors_off', 'tour_restore_f0_colors', 'tour_open_function_color:0:0', 'set_color_modal_mode_base'],
    popover: {
      title: 'Show Function Colors',
      description: "To show the function button colors we assigned in the throttle, click the 'Show Function Colors' button.",
      side: 'left',
      align: 'start',
//      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 174: View Function Colors in Throttle
  {
    element: '#tour-function-f0',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_backup_f0_colors',
      'tour_set_f0_colors_yellow_red',
      'show_function_colors_on',
      'tour_edit_functions:0:false'
    ],
    onNext: ['tour_restore_f0_colors', 'show_function_colors_off', 'tour_edit_functions:0:true'],
    onPrev: ['show_function_colors_off', 'tour_edit_functions:0:true'],
    popover: {
      title: 'Function Button Colors',
      description: "The locomotive function buttons that we assigned colors to will now appear in those colors in the throttle.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 175: Hide Function Numbers
  {
    element: '#tour-hide-function-numbers-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_backup_show_numbers'
    ],
    onNext: ['tour_set_show_numbers_off', 'tour_edit_functions:0:false'],
    onPrev: ['tour_restore_show_numbers', 'tour_backup_f0_colors', 'tour_set_f0_colors_yellow_red', 'show_function_colors_on', 'tour_edit_functions:0:false'],
    popover: {
      title: 'Hide Function Numbers',
      description: "We can also decide whether to show the 'F' function number along with the function name in the functions buttons.",
      side: 'left',
      align: 'start',
//      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 176: View Functions with Hidden Numbers
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_backup_show_numbers',
      'tour_set_show_numbers_off',
      'tour_edit_functions:0:false'
    ],
    onNext: ['tour_restore_show_numbers', 'tour_edit_functions:0:true'],
    onPrev: ['tour_restore_show_numbers', 'tour_edit_functions:0:true'],
    popover: {
      title: 'Function Names Only',
      description: "Now only the locomotive function names will appear in the buttons. If we have not assigned a name to a button, the button will be blank.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 177: Hide Function Names
  {
    element: '#tour-hide-function-names-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_edit_functions:0:true',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_backup_show_names'
    ],
    onNext: ['tour_set_show_names_off', 'tour_edit_functions:0:false'],
    onPrev: ['tour_restore_show_names', 'tour_backup_show_numbers', 'tour_set_show_numbers_off', 'tour_edit_functions:0:false'],
    popover: {
      title: 'Hide Function Names',
      description: "Likewise we can decide whether to show the function names we assigned in the functions buttons.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 178: View Functions with Hidden Names
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_backup_show_names',
      'tour_set_show_names_off',
      'tour_edit_functions:0:false'
    ],
    onNext: ['tour_restore_show_names', 'tour_edit_functions:0:true'],
    onPrev: ['tour_restore_show_names', 'tour_edit_functions:0:true'],
    popover: {
      title: 'Function Numbers Only',
      description: "Now only the locomotive function numbers will appear in the buttons, even if we have assigned them names.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 179: Highlight Function Groups Setup Button
  {
    element: '#tour-setup-groups-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:false',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_edit_functions:0:true',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_close_function_groups_modal',
      'tour_highlight_function_groups_on'
    ],
    onNext: ['tour_highlight_function_groups_off', 'tour_open_function_groups_modal'],
    onPrev: ['tour_highlight_function_groups_off', 'tour_backup_show_names', 'tour_set_show_names_off'],
    popover: {
      title: 'Function Groups Setup',
      description: "Finally, we can assign each of our locomotive functions to groups, and use a button to quickly cycle through the groups of functions that we want to use for our locomotive. This can help us keep just the functions we need ready at our fingertips, while holding the rest easily accessible in reserve.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 180: Function Groups Modal
  {
    element: '#tour-function-groups-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal'
    ],
    onNext: [],
    onPrev: ['tour_close_function_groups_modal', 'tour_edit_functions:0:true'],
    popover: {
      title: 'Eight Function Groups',
      description: "There are eight different function groups that we can use.",
      side: 'over',
      align: 'center',
//      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 181: Pre-configured Groups Heading  
  {
    element: '#tour-custom-default-box',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_set_custom_box_style:10:10:235:100',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Pre-configured Groups',
      description: "First there are two pre-configured groups: one that includes all the DCC decoder functions from F0 to F28, and one that includes just the functions for which we checked the 'Show' box in the Edit Functions control panel. This second group is the 'Default' group and is always included as an option.",
      side: 'bottom',
      align: 'start',
      popoverClass: 'custom-popover-shift-right:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 182: Custom Function Groups
  {
    element: '#tour-custom-lighting-box',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_set_custom_box_style:10:20:350:100:lighting',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Defined Function Groups',
      description: 'Next there are six custom groups that we can assign functions to. The first three groups come pre-defined for basic decoder functions, such as lighting, sound, and motor and braking controls, but we can assign any locomotive functions we want to them. The names are just suggestions.',
      side: 'bottom',
      align: 'start',
      popoverClass: 'custom-popover-shift-right:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 183: User Custom Function Groups
  {
    element: '#tour-custom-user-box',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_set_custom_box_style:10:20:360:100:user',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'User Custom Groups',
      description: "Next there are three user custom groups that we can name however we like. Click on the 'User #' label to give that group a name.",
      side: 'bottom',
      align: 'start',
      popoverClass: 'custom-popover-shift-right:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 184: Function Assignment Animation
  {
    element: '#tour-function-groups-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:800:600',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Function Assignments',
      description: "Now we can assign our DCC decoder functions to any of our function groups. We can assign each function to as many groups as we like.",
      side: 'bottom',
      align: 'center',
//      popoverClass: 'custom-popover-shift-down:120',
      sightsFromStep: 161,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 185: Include Function Groups
  {
    element: '#tour-custom-lighting-box',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:0:0',
      'tour_set_custom_box_style:10:10:215:100:lighting',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal',
      'tour_select_lighting_group:500',
      'tour_select_sound_group:1500'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Include Function Groups',
      description: "Next we click 'Include' for any function groups we want to include in the Loco Functions Panel in the throttle.",
      side: 'bottom',
      align: 'center',
//      popoverClass: 'custom-popover-shift-right:20',
      sightsFromStep: 161,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 186: Enable Use Function Groups
  {
    element: '#tour-use-function-groups-toggle-container',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:0:0',
      'tour_select_lighting_group:0',
      'tour_select_sound_group:0',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal',
      'tour_set_use_function_groups:true'
    ],
    onNext: [],
    onPrev: [],
    popover: {
      title: 'Enable Use Function Groups',
      description: "Finally, we'll make sure that the 'Use Function Groups' slider is toggled on.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 187: Close Function Groups Modal
  {
    element: '#tour-function-groups-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:0:0',
      'tour_select_lighting_group:0',
      'tour_select_sound_group:0',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_open_function_groups_modal',
      'tour_set_use_function_groups:true'
    ],
    onNext: ['tour_close_function_groups_modal'],
    onPrev: [],
    popover: {
      title: 'Return to Loco Functions',
      description: "Then we can click the 'Done' button or the 'X' in the upper-right corner of the control panel, and return to the Loco Functions Panel.",
      side: 'over',
      align: 'center',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 188: Close Edit Functions
  {
    element: '#tour-edit-functions-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:0:0',
      'tour_select_lighting_group:0',
      'tour_select_sound_group:0',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:true',
      'tour_close_function_groups_modal',
      'tour_set_use_function_groups:true'
    ],
    onNext: ['tour_edit_functions_off_sequence'],
    onPrev: ['tour_open_function_groups_modal', 'tour_edit_functions_on_sequence'],
    popover: {
      title: 'Close Configuration',
      description: "Now we can close the locomotive functions configuration panel by clicking the 'Edit Functions' button with the gear icon again.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 189: Cycle Function Groups
  {
    element: '#tour-cycle-groups-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:0:0',
      'tour_select_lighting_group:0',
      'tour_select_sound_group:0',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'expand_functions',
      'tour_edit_functions:0:false'
    ],
//    onNext: ['tour_set_active_function_group:0:lighting'],
    onPrev: ['tour_edit_functions_on_sequence'],
    popover: {
      title: 'Cycle Function Groups',
      description: "When we return to the Loco Functions Panel we will see that the 'Cycle Function Groups' button is active with the Default group, and the default locomotive function buttons we selected are shown in the panel below.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 190: Cycle Function Groups - Lighting
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'tour_animate_checking_boxes:0:0',
      'tour_select_lighting_group:0',
      'tour_select_sound_group:0',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'expand_functions',
      'tour_edit_functions:0:false',
      'tour_set_active_function_group:1000:lighting',
      'tour_set_active_function_group:3000:sound',
      'tour_set_active_function_group:5000:default'
    ],
    onNext: [],
    onPrev: ['tour_set_active_function_group:0:default'],
    popover: {
      title: 'Lighting Group',
      description: "We can click the 'Cycle Function Groups' button to cycle through the function groups we just configured for our locomotive.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      showReplay: true,
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 191: Turnouts and Routes Intro
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_functions_enable_override:0:true',
      'expand_functions',
      'tour_edit_functions:0:false',
      'tour_show_functions_panel_sequence'
    ],
    onNext: [],
    onPrev: ['tour_set_active_function_group:0:default'],
    popover: {
      title: 'Turnouts and Routes',
      description: "In addition to controlling our locomotive functions in the Loco Functions Panel, we can also operate our turnouts and routes here.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 192: Routes & Automations Button
  {
    element: '#tour-routes-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_show_routes_panel_sequence'
    ],
    onNext: [],
    onPrev: ['tour_show_functions_panel_sequence'],
    popover: {
      title: 'Routes & Automations',
      description: "The 'Routes & Automations' button will open the Routes & Automations control panel.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:10',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 193: Routes & Automations Panel
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_show_routes_panel_sequence'
    ],
    onNext: [],
    onPrev: ['tour_show_routes_panel_sequence'],
    popover: {
      title: 'Routes & Automations Control Panel',
      description: "Here we will see all the routes and automations configured in our DCC-EX command station. The automations will be listed above, and the routes below. Press any of the buttons to set a route, or trigger an automation and dispatch a locomotive.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 194: Refresh Routes
  {
    element: '#tour-refresh-button',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_show_routes_panel_sequence',
      'tour_highlight_refresh_button_on',
      'tour_refresh_routes:1000'
    ],
    onNext: ['tour_highlight_refresh_button_off'],
    onPrev: ['tour_highlight_refresh_button_off', 'tour_show_routes_panel_sequence'],
    popover: {
      title: 'Refresh Routes',
      description: "Press the 'Refresh Routes' button to update the list from the command station.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 195: Turnouts Button
  {
    element: '#tour-turnouts-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_show_turnouts_panel_sequence',
      'tour_highlight_turnouts_button_on'
    ],
    onNext: ['tour_highlight_turnouts_button_off'],
    onPrev: ['tour_highlight_turnouts_button_off', 'tour_show_routes_panel_sequence'],
    popover: {
      title: 'Turnouts',
      description: "The 'Turnouts' button will open the Turnouts control panel.",
      side: 'left',
      align: 'start',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },

  // Step 196: Turnouts Panel
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_set_use_function_groups:true',
      'tour_use_demo_assignments:true',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_show_turnouts_panel_sequence',
//      'tour_refresh_turnouts:1000'
    ],
    onNext: [],
    onPrev: ['tour_show_turnouts_panel_sequence'],
    popover: {
      title: 'Turnouts Control Panel',
      description: "Here we will see all the turnouts configured in our DCC-EX command station. Press one of the turnout buttons to throw (open) or line (close) the turnout / switch / points. Use the 'Refresh' button just like we did for the routes and automations.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
//      showReplay: true,
      showSightsToggle: true
    }
  },

  // Step 197: Conclusion of Functions Panel Tour
  {
    element: '#functions-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_use_demo_assignments:false',
      'set_mode_emulator',
      'connect_emulator',
      'track_power_on',
      'tour_show_functions_panel_sequence',
      'tour_functions_enable_override:0:true',
      'tour_functions_demo_cleanup',
      'expand_functions',
      'tour_restore_f0_colors',
      'show_function_colors_off',
      'tour_restore_show_numbers',
      'tour_restore_show_names',
      'tour_edit_functions:0:false',
      'tour_close_function_groups_modal'
    ],
    onNext: ['finish_tour'],
    onPrev: ['tour_use_demo_assignments:true', 'tour_show_turnouts_panel_sequence'],
    popover: {
      title: 'Loco Functions Wrap-up',
      description: "We have now looked at how to configure the Loco Functions Panel to control our locomotive DCC decoder functions, as well as operate all our turnouts and routes.",
      side: 'left',
      align: 'start',
      popoverClass: 'custom-popover-shift-down:20',
      sightsFromStep: 161,
      showSightsToggle: true
    }
  },


// ------------- USER CUSTOM SETTINGS ------------- //

  // Step 198: User Custom Settings
  {
    element: '#root',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_stop_restart_cleanup'
    ],
    onNext: [],
    onPrev: ['cancel_to_menu'],
    popover: {
      disableButtons: ['previous'],
      title: 'User Custom Settings',
      description: "As we have seen, the Driver-D Throttle for DCC-EX offers us many different settings that we can customize and configure to determine how we use the throttle to control our trains. To help us keep track of all these settings in one place, and save them for future recall, we can access the User Custom Settings control panel.",
      side: 'over',
      align: 'center',
      sights: settingsSights_AddressPanel,
      popoverClass: 'custom-popover-shift-up:100'
    }
  },

  // Step 199: Open Display Settings
  {
    element: '#tour-display-settings',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'hide_display_settings_sequence',
      'tour_display_settings_highlight_on'
    ],
    onNext: [
      'tour_display_settings_highlight_off',
      'show_display_settings_sequence'
    ],
    onPrev: [
      'tour_display_settings_highlight_off'
    ],
    popover: {
      title: 'Open Display Settings',
      description: "To access the User Custom Settings control panel, first open the 'Display Settings' panel.",
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 200: Highlight User Custom Settings Button
  {
    element: '#tour-user-settings-button',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_display_settings_sequence',
      'highlight_user_settings_on'
    ],
    onNext: [
      'highlight_user_settings_off',
      'show_user_custom_settings_sequence'
    ],
    onPrev: [
      'hide_display_settings_sequence',
      'highlight_user_settings_off'
    ],
    popover: {
      title: 'Open User Custom Settings',
      description: "Then press the 'User Custom Settings' button.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 201: Open and Highlight User Custom Settings Modal
  {
    element: '#tour-user-settings-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'show_road_names_on'
    ],
    onNext: [],
    onPrev: [
      'hide_user_custom_settings_sequence',
      'show_road_names_off',
      'show_display_settings_sequence',
      'highlight_user_settings_on'
    ],
    popover: {
      title: 'User Custom Settings Panel',
      description: "Here we can see all our custom settings in one place.",
      popoverClass: 'custom-popover-shift-down:40',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 202: Highlight turn off all custom settings button
  {
    element: '#tour-turn-off-all-custom-settings-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'tour_turn_off_all_custom_settings_btn_highlight_on'
    ],
    onNext: [
      'tour_turn_off_all_custom_settings_btn_highlight_off',
      'tour_show_memory_autosave_confirm_sequence:1'
    ],
    onPrev: [
      'tour_turn_off_all_custom_settings_btn_highlight_off'
    ],
    popover: {
      title: 'Turn Off All Custom Settings',
      description: "At the top of the control panel is a button to quickly turn off all the user custom settings.",
      side: 'bottom',
      align: 'center',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 203: Open and highlight "Save Settings" modal
  {
    element: '#tour-memory-save-settings-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_show_memory_autosave_confirm_sequence:1',
      'tour_type_memory_save_name:600:Tablet Settings'
    ],
    onNext: [
      'tour_hide_memory_autosave_confirm_sequence',
      'show_user_custom_settings_sequence',
      'show_road_names_off',
      'tour_set_demomemory_1_mismatch'
    ],
    onPrev: [
      'tour_hide_memory_autosave_confirm_sequence',
      'show_user_custom_settings_sequence',
      'tour_turn_off_all_custom_settings_btn_highlight_on'
    ],
    popover: {
      title: 'Save Settings',
      description: "When we turn off all the custom settings, the app will prompt us to save our current settings in one of the eight user settings memory presets. We can give the saved settings a name if we like. For example, if we've configured a group of settings specifically for use on our tablet, we might want to call these our 'Tablet Settings'.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 204: Memory Presets highlighting
  {
    element: '#tour-memory-slots-panel',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'tour_hide_memory_autosave_confirm_sequence',
      'show_user_custom_settings_sequence',
      'show_road_names_off',
      'tour_set_demomemory_1_mismatch'
    ],
    onNext: [
      'show_road_names_off'
    ],
    onPrev: [
      'tour_clear_demomemory_1',
      'tour_show_memory_autosave_confirm_sequence:1',
      'show_road_names_on'
    ],
    popover: {
      title: 'Memory Presets',
      description: "There are eight memory preset buttons that we can use to save and restore our user custom settings.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 205: Highlight preset button 1 (mismatched)
  {
    element: '#tour-memory-slot-1',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'show_road_names_off',
      'tour_set_demomemory_1_mismatch'
    ],
    onNext: [
      'show_road_names_on',
      'tour_set_demomemory_1_match'
    ],
    onPrev: [
      'show_road_names_off',
      'tour_set_demomemory_1_mismatch'
    ],
    popover: {
      title: 'Restore Custom Settings',
      description: "To restore our saved user custom settings, click on the memory preset button.",
//      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 206: Show road names on, highlight user custom settings panel (restored)
  {
    element: '#tour-user-settings-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'show_road_names_on',
      'tour_set_demomemory_1_match'
    ],
    onNext: [
      'show_road_names_on',
      'tour_set_demomemory_1_match'
    ],
    onPrev: [
      'show_road_names_off',
      'tour_set_demomemory_1_mismatch'
    ],
    popover: {
      title: 'Settings Restored',
      description: "Our saved user custom settings have been restored.",
      popoverClass: 'custom-popover-shift-down:40',
      side: 'left',
      align: 'center',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 207: Highlight preset button 1 again (long press info)
  {
    element: '#tour-memory-slot-1',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'show_road_names_on',
      'tour_set_demomemory_1_match'
    ],
    onNext: [
      'tour_show_memory_clear_sequence:1'
    ],
    onPrev: [
      'show_road_names_on',
      'tour_set_demomemory_1_match'
    ],
    popover: {
      title: 'Clear Preset Settings',
      description: "To clear one of our memory preset buttons, long-press on the button.",
//      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 208: Open and highlight the 'Clear Settings' modal
  {
    element: '#tour-memory-clear-confirm-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'tour_set_demomemory_1_match',
      'tour_show_memory_clear_sequence:1',
      'tour_set_memory_clear_mode:0:clear',
      'tour_set_memory_clear_mode:1500:replace',
      'tour_set_memory_clear_mode:3500:clear'
    ],
    onNext: [
      'tour_hide_memory_clear_sequence',
      'tour_clear_demomemory_1',
      'show_user_custom_settings_sequence'
    ],
    onPrev: [
      'tour_hide_memory_clear_sequence',
      'show_user_custom_settings_sequence',
      'show_road_names_on',
      'tour_set_demomemory_1_match'
    ],
    popover: {
      title: 'Clear or Replace Settings',
      description: "When the red trashcan is highlighted, we can press 'Yes' to clear the memory preset, or we can press the green circular arrows and instead replace the contents of the preset with our current custom settings.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true,
      showReplay: true
    }
  },

  // Step 209: Memory cleared, custom settings unchanged
  {
    element: '#tour-user-settings-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'tour_hide_memory_clear_sequence',
      'tour_clear_demomemory_1'
    ],
    onNext: [
      'show_user_custom_settings_sequence',
      'tour_clear_demomemory_1'
    ],
    onPrev: [
      'show_user_custom_settings_sequence',
      'tour_set_demomemory_1_match',
      'tour_show_memory_clear_sequence:1',
      'tour_set_memory_clear_mode:0:clear',
      'tour_set_memory_clear_mode:1500:replace',
      'tour_set_memory_clear_mode:3500:clear'
    ],
    popover: {
      title: 'Preset Cleared',
      description: "Our user custom settings haven't changed, but the memory preset has been cleared.",
      popoverClass: 'custom-popover-shift-down:40',
      side: 'left',
      align: 'center',
      sightsFromStep: 198,
      showSightsToggle: true,
    }
  },

  // Step 210: We can save current settings to empty preset
  {
    element: '#tour-memory-slot-1',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'tour_clear_demomemory_1',
      'tour_hide_memory_autosave_confirm_sequence'
    ],
    onNext: [
      'tour_show_memory_autosave_confirm_sequence:1',
      'tour_type_memory_save_name:600:Phone Settings'
    ],
    onPrev: [
      'show_user_custom_settings_sequence',
      'tour_clear_demomemory_1'
    ],
    popover: {
      title: 'Save to Empty Preset',
      description: "We can also save our user custom settings to an empty memory preset by long-pressing the preset button.",
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 211: Open and highlight the 'Save Settings' modal
  {
    element: '#tour-memory-save-settings-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'tour_clear_demomemory_1',
      'tour_show_memory_autosave_confirm_sequence:1',
      'tour_type_memory_save_name:600:Phone Settings'
    ],
    onNext: [
      'tour_hide_memory_autosave_confirm_sequence',
      'show_user_custom_settings_sequence',
      'tour_set_demomemory_1_match'
    ],
    onPrev: [
      'tour_hide_memory_autosave_confirm_sequence',
      'show_user_custom_settings_sequence',
      'tour_clear_demomemory_1'
    ],
    popover: {
      title: 'Save Settings',
      description: "This will open the same 'Save Settings' window as before.",
      popoverClass: 'custom-popover-shift-down:20',
      side: 'left',
      align: 'start',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 212: Showcase using configurations across situations/devices
  {
    element: '#tour-user-settings-modal',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'show_user_custom_settings_sequence',
      'tour_hide_memory_autosave_confirm_sequence',
      'tour_set_demomemory_1_match'
    ],
    onNext: [
      'hide_user_custom_settings_sequence',
      'edit_presets_on',
      'highlight_export_config_button_on'
    ],
    onPrev: [
      'show_user_custom_settings_sequence',
      'tour_clear_demomemory_1',
      'tour_show_memory_autosave_confirm_sequence:1',
      'tour_type_memory_save_name:600:Phone Settings'
    ],
    popover: {
      title: 'Recall Settings',
      description: "By saving various configurations of our user custom settings in the memory presets, we can easily recall and restore different settings in the throttle to use in different situations, or on different devices.",
      popoverClass: 'custom-popover-shift-down:40',
      side: 'left',
      align: 'center',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 213: Highlight the Export Config button
  {
    element: '#tour-export-config-btn',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
      'hide_user_custom_settings_sequence',
      'edit_presets_on',
      'highlight_export_config_button_on'
    ],
    onNext: [
      'edit_presets_off',
      'highlight_export_config_button_off',
    ],
    onPrev: [
      'edit_presets_off',
      'highlight_export_config_button_off',
      'show_road_names_on',
      'show_user_custom_settings_sequence',
      'tour_set_demomemory_1_match'
    ],
    popover: {
      title: 'Export Configuration',
      description: "All the memory presets for our user custom settings are saved when we export our configuration file using the 'Export Config' button in the Edit Presets controls in the Loco Address Panel.",
      side: 'right',
      align: 'center',
      sightsFromStep: 198,
      showSightsToggle: true
    }
  },

  // Step 214: Tour Conclusion
  {
    element: '#root',
    actionDelay: 400,
    popoverDelay: 400,
    onShow: [
    ],
    onNext: [
      'show_welcome_card'
    ],
    onPrev: [
      'edit_presets_on',
      'highlight_export_config_button_on'
    ],
    popover: {
      title: 'Tour Completed!',
      description: "We have now reached the end of the interactive guided tour of the Driver-D Throttle for DCC-EX. Happy railroading from Driver-D and Scratchy-C! All aboard!  © Driver D. May, 2026",
      side: 'over',
      align: 'center'
    }
  },
];


// ------------- TOUR TERMINATION ACTIONS ------------- //
//
export const tourTerminationActions: string[] = [
  'tour_throttle_speed_set_0',
  'tour_throttle_edit_off',
  'expand_throttle',
  'tour_restore_first_preset',
  'tour_restore_consist_1',
  'disconnect_all',
  'track_power_off',
  'hide_blocks_view',
  'unjoin_blocks',
  'close_block_edit',
  'edit_presets_off',
  'hide_terminal',
  'hide_wifi_advice',
  'hide_display_settings',
  'hide_icon_settings',
  'highlight_user_settings_off',
  'highlight_compact_presets_off',
  'tour_display_settings_highlight_off',
  'turn_off_serial_monitor',
  'set_mode_emulator',
  'show_swipe_animation_off',
  'show_loco_sort_modal_off',
  'close_delete_renumber_modal',
  'close_loco_color_modal',
  'show_roster_modal_off', 
  'show_loco_sort_modal_off',
  'show_hard_limit_modal_off',
  'show_dcc_ex_roster_modal_off',
  'set_loco_details_modal_off',
  'unselect_first_dcc_ex_loco',
  'show_dcc_ex_import_conflict_off',
  'tour_delete_loco_3_variant',
  'tour_hide_consists',
  'tour_highlight_reverse_button_off',
  'tour_highlight_move_up_down_off',
  'tour_highlight_clear_consist_off',
  'tour_highlight_hide_all_consists_off',
  'tour_show_consist_warning_off',
  'tour_show_motion_warning_off',
  'tour_show_advanced_toggles_off',
  'tour_highlight_merge_btn_off',
  'tour_highlight_hide_header_btn_off',
  'tour_highlight_lock_btn_off',
  'tour_set_merge_address_off',
  'tour_set_address_focus_off',
  'expand_presets',
  'expand_throttle',
  'expand_functions',
  'tour_hide_keyboard_key',
  'tour_hide_slider_drag_hand',
  'tour_throttle_enable_override',
  'tour_functions_enable_override',
  'highlight_compact_throttle_off', 
  'highlight_throttle_settings_off',
  'tour_set_throttle_mode_standard',
  'tour_set_speed_scale_steps',
  'tour_set_estop_config_mode',
  'tour_set_stop_as_button:false',
  'tour_set_small_presets_active:false',
  'tour_set_thick_throttle:false',
  'tour_set_throttle_layout:standard',
  'tour_functions_demo_cleanup',
  'tour_functions_enable_override:0:false',
  'tour_edit_functions:0:false',
  'tour_close_function_color',
  'tour_restore_f0_colors',
  'show_function_colors_off',
  'tour_restore_show_numbers',
  'tour_restore_show_names',
  'tour_close_function_groups_modal',
  'tour_show_functions_panel_sequence',
  'hide_user_custom_settings_sequence',
  'tour_turn_off_all_custom_settings_btn_highlight_off',
  'tour_hide_memory_autosave_confirm_sequence',
  'tour_clear_demomemory_1',
  'highlight_export_config_button_off',
  'tour_set_sort_custom:0',
  'tour_remove_loco_1234_colors'
];


