/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, ChangeEvent, Component, ReactNode, ErrorInfo } from 'react';
import { 
  Power, 
  PowerOff, 
  Zap, 
  ZapOff, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Volume2, 
  Lightbulb, 
  Bell, 
  AlertOctagon,
  Settings,
  Save,
  Terminal as TerminalIcon,
  ExternalLink,
  BookOpen,
  Info,
  Send,
  Plus,
  Minus,
  Upload,
  Download,
  FileUp,
  Wifi,
  Globe,
  Image as ImageIcon,
  AlertTriangle,
  Copy,
   Check,
  Trash2,
  CheckCircle2,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Command,
  Option,
  CornerDownLeft,
  RefreshCw,
  XCircle,
  X,
  EyeOff,
  Palette,
  Monitor,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Columns2,
  Link,
  StopCircle,
  Unlink,
  Map,
  Split,
  List,
  Cpu,
  HelpCircle,
  Tag,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  ChevronsLeft,
  ChevronsRight,
  Settings2,
  Play,
  Pointer,
  Gauge,
  Space
} from 'lucide-react';
import { CustomTrainIcon } from './components/CustomTrainIcon';
import { motion, AnimatePresence } from 'motion/react';
import { HexColorPicker } from 'react-colorful';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tourSteps, tourInitializationActions, tourTerminationActions, tourStopsMenu, tourTOC, TOUR_SAVE_DELAY, TOUR_RESTORE_DELAY, tourMacros } from './tourSteps';

// DCC-EX Native Protocol Constants
const DEFAULT_BAUD_RATE = 115200;
const MAX_SPEED = 126;
const THROTTLE_SYNC_COOLDOWN = 800; // ms to ignore incoming throttle status after local command
const ABSOLUTE_MAX_PRESETS = 256;

const FUNCTION_CATEGORIES = [
  { id: 'lighting', label: 'Lighting', icon: Lightbulb, color: 'bg-yellow-500' },
  { id: 'sound', label: 'Sound', icon: Volume2, color: 'bg-blue-500' },
  { id: 'speed', label: 'Speed & Braking', icon: Zap, color: 'bg-orange-500' },
  { id: 'user1', label: 'User 1', icon: Tag, color: 'bg-purple-500' },
  { id: 'user2', label: 'User 2', icon: Tag, color: 'bg-pink-500' },
  { id: 'user3', label: 'User 3', icon: Tag, color: 'bg-cyan-500' },
  { id: 'all', label: 'All Functions', icon: Layers, color: 'bg-emerald-500', noColumn: true }
];

const normalizeTurnoutId = (id: string | number): string => {
  let num = typeof id === 'string' ? parseInt(id) : id;
  if (isNaN(num)) return id.toString();
  if (num < 0) {
    num = 65536 + num;
  }
  return num.toString();
};

const getDccAddress = (id: string | number): number => {
  if (typeof id === 'number') return id;
  if (!id) return 0;
  const s = id.toString();
  if (s.startsWith('#')) {
    const match = s.match(/^#(\d+)(?:\.(\d+))?$/);
    if (match) return parseInt(match[1]);
  }
  const n = parseInt(s);
  return isNaN(n) ? 0 : n;
};

const getNumericAddress = (id: string | number | undefined | null): number => {
  if (id === undefined || id === null) return 0;
  if (typeof id === 'number') return id;
  const s = id.toString();
  if (s.startsWith('#')) {
    const n = parseFloat(s.substring(1));
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const isLocoId = (id: string | number): boolean => {
  return id !== null && id !== undefined && id.toString().startsWith('#');
};

const getDisplayAddress = (id: string | number | undefined | null, forceShowId: boolean = false): string => {
  if (id === undefined || id === null) return '';
  if (forceShowId || id === '') return id.toString();
  const s = id.toString();
  if (s.startsWith('#')) {
    return getDccAddress(id).toString();
  }
  return s;
};

type LogEntry = {
  type: 'in' | 'out' | 'info' | 'error';
  text: string;
  timestamp: Date;
};

type ConsistLoco = {
  address: number;
  cabAddress: number | string;
  isReverse: boolean;
};

type Consist = {
  id: number;
  locos: ConsistLoco[];
  isVisible: boolean;
  isFlipped?: boolean;
};

interface DccExLocoParsedFunction {
  number: number;
  name: string;
  isMomentary: boolean;
}

interface DccExLocoDetails {
  address: string;
  description: string;
  functions: DccExLocoParsedFunction[];
}

type LocoFunctionConfig = {
  name: string;
  visible: boolean;
  momentary: boolean;
  sendToConsist: boolean;
  repeat?: boolean;
  bgColor?: string;
  bgOpacity?: number;
  accentColor?: string;
  accentOpacity?: number;
};

interface TrackBlock {
  letter: string;
  state: string; // PROG, MAIN, MAIN_INV, MAIN A, DC, DCX, NONE
  cab: number;
  power: boolean;
}

export default function App() {
  // Serial State
  const [port, setPort] = useState<SerialPort | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter | null>(null);
  const [readableStreamClosed, setReadableStreamClosed] = useState<Promise<void> | null>(null);
  const [writableStreamClosed, setWritableStreamClosed] = useState<Promise<void> | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSerialSupported, setIsSerialSupported] = useState(true);

  const addLog = useCallback((type: 'in' | 'out' | 'info' | 'error', text: string) => {
    setLogs(prev => [...prev, { type, text, timestamp: new Date() }].slice(-100));
  }, []);
  const [showTerminal, setShowTerminal] = useState(false);

  // TCP Bridge Data Buffering
  const tcpBufferRef = useRef<string>('');
  const longPressFired = useRef(false);

  // DCC-EX State
  const [trackPower, setTrackPower] = useState(false);
  const [isBlocksView, setIsBlocksView] = useState(false);
  const [trackBlocks, setTrackBlocks] = useState<TrackBlock[]>(() => {
    try {
      const saved = localStorage.getItem('dcc_track_blocks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sanitize: ensure unique letters and valid structure
          const seen = new Set<string>();
          return parsed.filter(b => {
            if (!b || typeof b.letter !== 'string' || seen.has(b.letter)) return false;
            seen.add(b.letter);
            // Migrate old "mode" or "type" to "state" if state is missing
            const oldMode = (b as any).mode;
            const oldType = (b as any).type;
            if (!b.state && oldMode) b.state = oldMode;
            if (!b.state && oldType) b.state = oldType;
            if (!b.state) b.state = 'NONE';
            
            // Map "MAIN A" to "MAIN" for consistency
            if (b.state === 'MAIN A') b.state = 'MAIN';

            // Ensure Block B defaults to PROG if it's currently MAIN (migration fix)
            if (b.letter === 'B' && b.state === 'MAIN' && !localStorage.getItem('dcc_block_b_prog_fixed')) {
              b.state = 'PROG';
              localStorage.setItem('dcc_block_b_prog_fixed', 'true');
            }
            return true;
          }).sort((a, b) => a.letter.localeCompare(b.letter));
        }
      }
    } catch (e) {}
    return [
      { letter: 'A', state: 'MAIN', cab: 0, power: false },
      { letter: 'B', state: 'PROG', cab: 0, power: false }
    ];
  });

  // Debounced check for track power inconsistency
  useEffect(() => {
    if (isBlocksView) return;

    const timer = setTimeout(() => {
      const relevantBlocks = trackBlocks.filter(b => b.state === 'MAIN' || b.state === 'PROG');
      if (relevantBlocks.length > 0) {
        const firstPower = relevantBlocks[0].power;
        const inconsistent = relevantBlocks.some(b => b.power !== firstPower);
        if (inconsistent) {
          setIsBlocksView(true);
          addLog('info', 'Detected inconsistent track power states, switching to blocks view');
        }
      }
    }, 500); // 0.5 second delay to allow multiple status updates to arrive

    return () => clearTimeout(timer);
  }, [trackBlocks, isBlocksView, addLog]);

  const [areBlocksJoined, setAreBlocksJoined] = useState(false);
  const [preJoinState, setPreJoinState] = useState<{mainPower: boolean, progPower: boolean} | null>(null);
  const [selectedBlockForEdit, setSelectedBlockForEdit] = useState<string | null>(null);
  const trackPowerRef = useRef(trackPower);
  useEffect(() => { trackPowerRef.current = trackPower; }, [trackPower]);
  const powerStatesRef = useRef<Record<string, boolean>>({});
  const [cabAddress, setCabAddress] = useState<number | string>(3);
  const [pendingCabAddress, setPendingCabAddress] = useState<number | string>(3);
  const cabAddressRef = useRef(cabAddress);
  useEffect(() => { cabAddressRef.current = cabAddress; }, [cabAddress]);
  const [speed, setSpeed] = useState(0);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  const lastThrottleCommandTimeRef = useRef<number>(0);
  const [isForward, setIsForward] = useState(true);
  const isForwardRef = useRef(isForward);
  useEffect(() => { isForwardRef.current = isForward; }, [isForward]);

  const [functions, setFunctions] = useState<Record<number, boolean>>({});
  const functionsRef = useRef(functions);
  useEffect(() => { functionsRef.current = functions; }, [functions]);
  const [statusText, setStatusText] = useState('Disconnected');
  const [isBridgeAvailable, setIsBridgeAvailable] = useState(false);
  useEffect(() => {
    fetch('/api/health')
      .then(res => setIsBridgeAvailable(res.ok))
      .catch(() => setIsBridgeAvailable(false));
  }, []);

  const [connectionMode, setConnectionMode] = useState<'serial' | 'wifi' | 'emulator'>(() => {
    try {
      const saved = localStorage.getItem('dcc_connection_mode');
      return (saved as any) || 'serial';
    } catch (e) {
      return 'serial';
    }
  });
  const [wifiHost, setWifiHost] = useState(() => localStorage.getItem('dcc_wifi_host') || '192.168.1.100');
  const [wifiPort, setWifiPort] = useState(() => {
    const saved = localStorage.getItem('dcc_wifi_port');
    const val = saved ? parseInt(saved) : 2560;
    return isNaN(val) ? 2560 : val;
  });
  const [directWs, setDirectWs] = useState<WebSocket | null>(null);
  const [isWifiConnected, setIsWifiConnected] = useState(false);
  const [isEmulatorConnected, setIsEmulatorConnected] = useState(false);
  const isConnected = !!port || isWifiConnected || isEmulatorConnected;

  // Refs for tour state synchronization
  const portRef = useRef(port);
  const isWifiConnectedRef = useRef(isWifiConnected);
  const isEmulatorConnectedRef = useRef(isEmulatorConnected);
  const connectionModeRef = useRef(connectionMode);
  const writerRef = useRef(writer);
  const readerRef = useRef(reader);
  const readableStreamClosedRef = useRef(readableStreamClosed);
  const writableStreamClosedRef = useRef(writableStreamClosed);
  const directWsRef = useRef(directWs);
  const isBridgeAvailableRef = useRef(isBridgeAvailable);

  useEffect(() => { portRef.current = port; }, [port]);
  useEffect(() => { isWifiConnectedRef.current = isWifiConnected; }, [isWifiConnected]);
  useEffect(() => { isEmulatorConnectedRef.current = isEmulatorConnected; }, [isEmulatorConnected]);
  useEffect(() => { connectionModeRef.current = connectionMode; }, [connectionMode]);
  useEffect(() => { writerRef.current = writer; }, [writer]);
  useEffect(() => { readerRef.current = reader; }, [reader]);
  useEffect(() => { readableStreamClosedRef.current = readableStreamClosed; }, [readableStreamClosed]);
  useEffect(() => { writableStreamClosedRef.current = writableStreamClosed; }, [writableStreamClosed]);
  useEffect(() => { directWsRef.current = directWs; }, [directWs]);
  useEffect(() => { isBridgeAvailableRef.current = isBridgeAvailable; }, [isBridgeAvailable]);

  const [terminalInput, setTerminalInput] = useState('');
  const [showClearLocosConfirm, setShowClearLocosConfirm] = useState(false);
  const [showWifiAdvice, setShowWifiAdvice] = useState(false);
  const [hasSeenWifiAdvice, setHasSeenWifiAdvice] = useState(false);

  // Electron Port Selection State
  useEffect(() => {
    // Show wifi advice if starting in wifi mode
    if (connectionMode === 'wifi' && !hasSeenWifiAdvice) {
      setShowWifiAdvice(true);
      setHasSeenWifiAdvice(true);
    }
  }, []);

  const [electronPorts, setElectronPorts] = useState<any[]>([]);
  const [showElectronPicker, setShowElectronPicker] = useState(false);

  useEffect(() => {
    // Check if we are running in Electron
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      console.log('DCC-EX: Electron API detected');
      
      // Fetch local IP if running in Electron
      if (electronAPI.getLocalIP) {
        electronAPI.getLocalIP().then((ip: string) => {
          console.log('DCC-EX: Detected Local IP:', ip);
          setElectronLocalIP(ip);
        }).catch((err: any) => console.error('Error fetching Local IP:', err));
      }
      
      const removeListener = electronAPI.onSerialPorts((ports: any[]) => {
        console.log('DCC-EX UI: Received serial-port-list from Electron:', ports);
        setElectronPorts(ports);
        setShowElectronPicker(true);
        addLog('info', `Electron found ${ports.length} serial ports`);
      });

      return () => {
        if (typeof removeListener === 'function') removeListener();
      };
    } else {
      console.log('DCC-EX: Running in browser mode (no Electron API)');
    }
  }, [addLog]);

  const handleSelectElectronPort = (portId: string) => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.selectPort(portId);
      setShowElectronPicker(false);
    }
  };
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [isEditingFunctions, setIsEditingFunctions] = useState(false);
  const [isCompactFunctions, setIsCompactFunctions] = useState(() => {
    try {
      return localStorage.getItem('dcc_is_compact_functions') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [routeCompactMode, setRouteCompactMode] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('dcc_route_compact_mode') || '0');
    } catch (e) {
      return 0;
    }
  });
  const [turnoutCompactMode, setTurnoutCompactMode] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('dcc_turnout_compact_mode') || '0');
    } catch (e) {
      return 0;
    }
  });
  const [isCompactThrottle, setIsCompactThrottle] = useState(() => {
    try {
      return localStorage.getItem('dcc_is_compact_throttle') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [throttleLayout, setThrottleLayout] = useState<'standard' | 'vertical' | 'reversed'>(() => {
    try {
      const saved = localStorage.getItem('dcc_throttle_layout');
      if (saved === 'vertical' || saved === 'reversed' || saved === 'standard') return saved as 'standard' | 'vertical' | 'reversed';
      return 'standard';
    } catch (e) {
      return 'standard';
    }
  });
  const [stopLabelActAsButtonMap, setStopLabelActAsButtonMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dcc_stop_label_btn_map');
      return saved ? JSON.parse(saved) : { standard: false, vertical: false, reversed: false };
    } catch (e) {
      return { standard: false, vertical: false, reversed: false };
    }
  });

  const isStopLabelActAsButton = stopLabelActAsButtonMap[throttleLayout] || false;
  const [isCompactLocoPresets, setIsCompactLocoPresets] = useState(() => {
    try {
      return localStorage.getItem('dcc_is_compact_loco_presets') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isLocoAddressMerged, setIsLocoAddressMerged] = useState(() => {
    try {
      return localStorage.getItem('dcc_is_loco_address_merged') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [addressFocusLevel, setAddressFocusLevel] = useState<0 | 1 | 2>(0);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [scrollLockedBeforeEdit, setScrollLockedBeforeEdit] = useState(false);
  const [scrollLockToast, setScrollLockToast] = useState<string | null>(null);
  const [showAdvancedToggles, setShowAdvancedToggles] = useState(false);

  const [estopConfigModeMap, setEstopConfigModeMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dcc_estop_config_mode_map');
      if (saved) return JSON.parse(saved);
      // Migration: try to load the single old value
      const old = localStorage.getItem('dcc_estop_config_mode');
      const base = old ? parseInt(old) : 0;
      return { standard: base, vertical: base, reversed: base };
    } catch (e) {
      return { standard: 0, vertical: 0, reversed: 0 };
    }
  });

  const [estopLabel, setEstopLabel] = useState('EMERGENCY STOP');
  const estopButtonRef = useRef<HTMLButtonElement>(null);
  const throttleCardRef = useRef<HTMLDivElement>(null);
  const [throttleCardWidth, setThrottleCardWidth] = useState(0);

  const estopConfigMode = estopConfigModeMap[throttleLayout] || 0;
  const setEstopConfigMode = (value: number | ((prev: number) => number)) => {
    setEstopConfigModeMap(prev => {
      const current = prev[throttleLayout] || 0;
      const nextValue = typeof value === 'function' ? (value as any)(current) : value;
      return { ...prev, [throttleLayout]: nextValue };
    });
  };
  const [isSmallPresetsActive, setIsSmallPresetsActive] = useState(() => {
    try {
      return localStorage.getItem('dcc_small_presets_active') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isThickThrottle, setIsThickThrottle] = useState(() => {
    try {
      return localStorage.getItem('dcc_thick_throttle') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [disablePhotoSwipe, setDisablePhotoSwipe] = useState(() => {
    try {
      return localStorage.getItem('dcc_disable_photo_swipe') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [useFunctionGroups, setUseFunctionGroups] = useState(() => {
    try {
      return localStorage.getItem('dcc_use_function_groups') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [locoFunctionGroups, setLocoFunctionGroups] = useState<Record<string, Record<string, number[]>>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_function_groups');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [enabledFunctionGroups, setEnabledFunctionGroups] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('dcc_enabled_function_groups');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [userGroupNames, setUserGroupNames] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('dcc_user_group_names');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [activeFunctionGroupId, setActiveFunctionGroupId] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('dcc_active_function_group_id');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [rememberedGroups, setRememberedGroups] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('dcc_remembered_groups');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [showFunctionGroupsModal, setShowFunctionGroupsModal] = useState(false);
  const [showInAppGuide, setShowInAppGuide] = useState(false);
  const [userGuideStepId, setUserGuideStepId] = useState<number>(1);
  const [userGuideSection, setUserGuideSection] = useState<number>(1);
  const [userGuideSectionName, setUserGuideSectionName] = useState<string>("1. Intro & Welcome");
  const [userGuideStepText, setUserGuideStepText] = useState<string>("Page 1 of 27");
  const [userGuideTunerMode, setUserGuideTunerMode] = useState<boolean>(false);
  const [userGuideIsDev, setUserGuideIsDev] = useState<boolean>(false);
  const userGuideIframeRef = useRef<HTMLIFrameElement>(null);

  const getUserGuideUrl = (stepId: number) => {
    return `./userguide/index.html?step=${stepId}`;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'userguide-active-step') {
          setUserGuideStepId(event.data.stepId);
        } else if (event.data.type === 'userguide-state-update') {
          if (event.data.activeSection !== undefined) {
            setUserGuideSection(event.data.activeSection);
          }
          if (event.data.activeSectionName !== undefined) {
            setUserGuideSectionName(event.data.activeSectionName);
          }
          if (event.data.pageText !== undefined) {
            setUserGuideStepText(event.data.pageText);
          }
          if (event.data.builderMode !== undefined) {
            setUserGuideTunerMode(event.data.builderMode);
          }
          if (event.data.isDevEnv !== undefined) {
            setUserGuideIsDev(event.data.isDevEnv);
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const [electronLocalIP, setElectronLocalIP] = useState<string | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const [showTourMenu, setShowTourMenu] = useState(false);
  const [isLocoImageHovered, setIsLocoImageHovered] = useState(false);
  const [isLocoControlsFlashing, setIsLocoControlsFlashing] = useState(false);
  const [isCompactPresetsHighlighted, setIsCompactPresetsHighlighted] = useState(false);
  const [isCompactThrottleHighlighted, setIsCompactThrottleHighlighted] = useState(false);
  const [isThrottleSettingsHighlighted, setIsThrottleSettingsHighlighted] = useState(false);
  const [isEditingPresetsPlusMinusHighlighted, setIsEditingPresetsPlusMinusHighlighted] = useState(false);
  const [isSortPresetsHighlighted, setIsSortPresetsHighlighted] = useState(false);
  const [isExportConfigHighlighted, setIsExportConfigHighlighted] = useState(false);
  const [isRosterButtonHighlighted, setIsRosterButtonHighlighted] = useState(false);
  const [isColorModeButtonHighlighted, setIsColorModeButtonHighlighted] = useState(false);
  const [isReverseOrderButtonHighlighted, setIsReverseOrderButtonHighlighted] = useState(false);
  const [isMoveUpDownHighlighted, setIsMoveUpDownHighlighted] = useState(false);
  const [isClearConsistHighlighted, setIsClearConsistHighlighted] = useState(false);
  const [isHideAllConsistsHighlighted, setIsHideAllConsistsHighlighted] = useState(false);
  const [isMergeAddressHighlighted, setIsMergeAddressHighlighted] = useState(false);
  const [isHideHeaderHighlighted, setIsHideHeaderHighlighted] = useState(false);
  const [isLockScrollHighlighted, setIsLockScrollHighlighted] = useState(false);
  const [isSwipeHandVisible, setIsSwipeHandVisible] = useState(false);
  const [swipeHandSpeed, setSwipeHandSpeed] = useState(1.5);
  const [swipeHandDistance, setSwipeHandDistance] = useState(100);
  const [isKeyboardKeyVisible, setIsKeyboardKeyVisible] = useState(false);
  const [keyboardKeyIcon, setKeyboardKeyIcon] = useState('up');
  const [keyboardKeyOffsetY, setKeyboardKeyOffsetY] = useState(0);

  const [isEditFunctionsHighlighted, setIsEditFunctionsHighlighted] = useState(false);
  const [isFunctionColorsHighlighted, setIsFunctionColorsHighlighted] = useState(false);
  const [isFunctionGroupsHighlighted, setIsFunctionGroupsHighlighted] = useState(false);

  const [isSliderDragHandVisible, setIsSliderDragHandVisible] = useState(false);
  const [isSliderDragHandReversed, setIsSliderDragHandReversed] = useState(false);
  const [sliderDragHandOffsetY, setSliderDragHandOffsetY] = useState(0);
  const [isButtonHandVisible, setIsButtonHandVisible] = useState(false);
  const [buttonHandPosition, setButtonHandPosition] = useState({ x: 0, y: 0 });
  const [buttonHandSelector, setButtonHandSelector] = useState('');
  const [buttonHandOffsetX, setButtonHandOffsetX] = useState(0);
  const [buttonHandOffsetY, setButtonHandOffsetY] = useState(0);

  // Dynamic button hand position tracking
  useEffect(() => {
    if (!isButtonHandVisible || !buttonHandSelector) return;

    let active = true;
    const updatePosition = () => {
      if (!active) return;
      const el = document.querySelector(buttonHandSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setButtonHandPosition({
          x: rect.left + rect.width / 2 + buttonHandOffsetX,
          y: rect.top + rect.height / 2 + buttonHandOffsetY
        });
      }
      requestAnimationFrame(updatePosition);
    };

    updatePosition();
    return () => {
      active = false;
    };
  }, [isButtonHandVisible, buttonHandSelector, buttonHandOffsetX, buttonHandOffsetY]);
  const [isThrottleSliderPlusHighlighted, setIsThrottleSliderPlusHighlighted] = useState(false);
  const [isThrottleSliderMinusHighlighted, setIsThrottleSliderMinusHighlighted] = useState(false);
  const [isThrottleCardHighlighted, setIsThrottleCardHighlighted] = useState(false);
  const [isTourThrottleEnabledOverride, setIsTourThrottleEnabledOverride] = useState(false);
  const [isTourFunctionsEnabledOverride, setIsTourFunctionsEnabledOverride] = useState(false);
  const [isTourF2Pressed, setIsTourF2Pressed] = useState(false);
  const [highlightedPreset, setHighlightedPreset] = useState<number | null>(null);
  const [isMouseDemoVisible, setIsMouseDemoVisible] = useState(false);
  const [mouseDemoPosition, setMouseDemoPosition] = useState({ x: 0, y: 0 });
  const [mouseDemoRadius, setMouseDemoRadius] = useState(30);
  const [mouseDemoDuration, setMouseDemoDuration] = useState(2000);
  const [sliderDragHandProgress, setSliderDragHandProgress] = useState(0); // 0 to 1
  const [sliderDragHandDuration, setSliderDragHandDuration] = useState(2000);
  const [currentTourStepRect, setCurrentTourStepRect] = useState<DOMRect | null>(null);
  const [lastTourStopIndex, setLastTourStopIndex] = useState<number | null>(null);
  const [tourExitStatus, setTourExitStatus] = useState<'completed' | 'canceled' | null>(null);
  const [combinedHighlightBounds, setCombinedHighlightBounds] = useState<{ top: number, height: number, left: number, width: number } | null>(null);
  const [topRowHighlightStyle, setTopRowHighlightStyle] = useState<React.CSSProperties>({ display: 'none' });
  const [tourCustomBoxStyle, setTourCustomBoxStyle] = useState<React.CSSProperties>({
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '320px',
    height: '180px',
    pointerEvents: 'none',
    backgroundColor: 'transparent',
  });
  const [tourCustomLightingBoxStyle, setTourCustomLightingBoxStyle] = useState<React.CSSProperties>({
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '120px',
    height: '110px',
    pointerEvents: 'none',
    backgroundColor: 'transparent',
  });
  const [tourCustomUserBoxStyle, setTourCustomUserBoxStyle] = useState<React.CSSProperties>({
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '120px',
    height: '110px',
    pointerEvents: 'none',
    backgroundColor: 'transparent',
  });
  const [isTourDemoAssignmentActive, setIsTourDemoAssignmentActive] = useState(false);
  const [tourDemoLocoFunctionGroups, setTourDemoLocoFunctionGroups] = useState<Record<string, number[]>>({
    lighting: [],
    sound: [],
    speed: [],
    user1: [],
    user2: [],
    user3: [],
  });
  const [tourDemoEnabledFunctionGroups, setTourDemoEnabledFunctionGroups] = useState<string[]>([]);

  const lastFocusedGroupInfo = useRef<{ id: string, name: string } | null>(null);
  const tourRef = useRef<any>(null);
  const isTourDemoAssignmentActiveRef = useRef(false);
  const swipeOnTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const swipeOffTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  // Debug positions and scroll logic for Loco Functions Setup
  const [paletteRight, setPaletteRight] = useState(0);
  const [showLeft, setShowLeft] = useState(0);
  const [minRowWidth, setMinRowWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const [fixedWidth, setFixedWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isFunctionsScrolled, setIsFunctionsScrolled] = useState(false);
  const paletteRef = useRef<HTMLButtonElement>(null);
  const showRef = useRef<HTMLLabelElement>(null);
  const fixedPartRef = useRef<HTMLDivElement>(null);
  const scrollablePartRef = useRef<HTMLDivElement>(null);
  const functionsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditingFunctions || !functionsListRef.current) return;

    const measure = () => {
      const containerRect = functionsListRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const currentContainerWidth = Math.round(containerRect.width);
      setContainerWidth(currentContainerWidth);

      if (paletteRef.current) {
        const rect = paletteRef.current.getBoundingClientRect();
        // The right edge relative to the container, plus padding
        const newPalRight = Math.round(rect.right - containerRect.left + 16);
        setPaletteRight(newPalRight);
      }
      if (showRef.current) {
        const rect = showRef.current.getBoundingClientRect();
        // The left edge relative to the container
        const newShowLeft = Math.round(rect.left - containerRect.left);
        setShowLeft(newShowLeft);
      }

      if (fixedPartRef.current && scrollablePartRef.current) {
        const input = fixedPartRef.current.querySelector('input');
        const inputWidth = input ? input.offsetWidth : 0;
        const fixedOtherWidth = fixedPartRef.current.offsetWidth - inputWidth;
        // Min width where we avoid overlap = fixed parts + 128px min name + checkboxes + 2px for row borders
        const totalMin = Math.round(fixedOtherWidth + 128 + scrollablePartRef.current.offsetWidth + 2);
        setMinRowWidth(totalMin);
        setFixedWidth(fixedOtherWidth + 128);
        if (functionsListRef.current) {
          setScrollX(functionsListRef.current.scrollLeft);
        }
      }
    };

    const handleScroll = () => {
      if (functionsListRef.current) {
        setIsFunctionsScrolled(functionsListRef.current.scrollLeft > 0);
        setScrollX(functionsListRef.current.scrollLeft);
      }
    };

    if (functionsListRef.current) {
      functionsListRef.current.addEventListener('scroll', handleScroll);
    }

    measure();
    const interval = setInterval(measure, 500); // Periodic check as things might layout late
    
    const observer = new ResizeObserver(measure);
    observer.observe(functionsListRef.current);
    
    return () => {
      clearInterval(interval);
      observer.disconnect();
      if (functionsListRef.current) {
        functionsListRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isEditingFunctions]);

  // Handle global keyboard shortcuts when tour menu is shown
  useEffect(() => {
    localStorage.setItem('dcc_is_compact_functions', isCompactFunctions.toString());
  }, [isCompactFunctions]);

  useEffect(() => {
    localStorage.setItem('dcc_route_compact_mode', routeCompactMode.toString());
  }, [routeCompactMode]);

  useEffect(() => {
    localStorage.setItem('dcc_turnout_compact_mode', turnoutCompactMode.toString());
  }, [turnoutCompactMode]);

  useEffect(() => {
    localStorage.setItem('dcc_estop_config_mode_map', JSON.stringify(estopConfigModeMap));
  }, [estopConfigModeMap]);

  useEffect(() => {
    if (!throttleCardRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setThrottleCardWidth(entry.contentRect.width);
      }
    });
    observer.observe(throttleCardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (scrollLockToast) {
      const timer = setTimeout(() => {
        setScrollLockToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scrollLockToast]);

  useEffect(() => {
    if (!estopButtonRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width < 240) {
          setEstopLabel('E-STOP');
        } else {
          setEstopLabel('EMERGENCY STOP');
        }
      }
    });
    observer.observe(estopButtonRef.current);
    return () => observer.disconnect();
  }, [estopConfigMode]);

  useEffect(() => {
    localStorage.setItem('dcc_small_presets_active', isSmallPresetsActive.toString());
  }, [isSmallPresetsActive]);

  useEffect(() => {
    localStorage.setItem('dcc_thick_throttle', isThickThrottle.toString());
  }, [isThickThrottle]);

  useEffect(() => {
    localStorage.setItem('dcc_disable_photo_swipe', disablePhotoSwipe.toString());
  }, [disablePhotoSwipe]);

  useEffect(() => {
    localStorage.setItem('dcc_use_function_groups', useFunctionGroups.toString());
  }, [useFunctionGroups]);

  useEffect(() => {
    localStorage.setItem('dcc_loco_function_groups', JSON.stringify(locoFunctionGroups));
  }, [locoFunctionGroups]);

  useEffect(() => {
    localStorage.setItem('dcc_enabled_function_groups', JSON.stringify(enabledFunctionGroups));
  }, [enabledFunctionGroups]);

  useEffect(() => {
    localStorage.setItem('dcc_user_group_names', JSON.stringify(userGroupNames));
  }, [userGroupNames]);

  useEffect(() => {
    localStorage.setItem('dcc_active_function_group_id', JSON.stringify(activeFunctionGroupId));
  }, [activeFunctionGroupId]);

  useEffect(() => {
    localStorage.setItem('dcc_remembered_groups', JSON.stringify(rememberedGroups));
  }, [rememberedGroups]);

  useEffect(() => {
    localStorage.setItem('dcc_is_compact_throttle', isCompactThrottle.toString());
  }, [isCompactThrottle]);

  useEffect(() => {
    localStorage.setItem('dcc_throttle_layout', throttleLayout);
  }, [throttleLayout]);

  useEffect(() => {
    localStorage.setItem('dcc_stop_label_btn_map', JSON.stringify(stopLabelActAsButtonMap));
  }, [stopLabelActAsButtonMap]);

  useEffect(() => {
    localStorage.setItem('dcc_is_compact_loco_presets', isCompactLocoPresets.toString());
  }, [isCompactLocoPresets]);

  useEffect(() => {
    localStorage.setItem('dcc_is_loco_address_merged', isLocoAddressMerged.toString());
  }, [isLocoAddressMerged]);

  useEffect(() => {
    if (isScrollLocked) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehaviorY = 'none';
      document.documentElement.style.overscrollBehaviorY = 'none';
      // Also prevent touchmove on the body for older mobile browsers
      const preventDefault = (e: TouchEvent) => {
        if (e.touches.length > 1 || !isScrollLocked) return;
        
        // Allow throttle slider and other inputs to work
        const target = e.target as HTMLElement;
        if (target.closest('.throttle-slider') || target.closest('input[type="range"]')) {
          return;
        }
        
        e.preventDefault();
      };
      document.addEventListener('touchmove', preventDefault, { passive: false });
      return () => document.removeEventListener('touchmove', preventDefault);
    } else {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      document.documentElement.style.overscrollBehaviorY = '';
    }
  }, [isScrollLocked]);

  const [memoryNotification, setMemoryNotification] = useState<{
    id: number;
    name?: string;
    timestamp: number;
  } | null>(null);

  const triggerMemoryNotification = (id: number, timestamp: number, name?: string) => {
    setMemoryNotification({ id, name, timestamp });
    setTimeout(() => {
      setMemoryNotification(null);
    }, 3000);
  };

  const [copySourceAddr, setCopySourceAddr] = useState<string>('');
  const [isEditingThrottle, setIsEditingThrottle] = useState(false);
  const isEditingThrottleRef = useRef(isEditingThrottle);
  useEffect(() => { isEditingThrottleRef.current = isEditingThrottle; }, [isEditingThrottle]);

  const [isHoveringThrottle, setIsHoveringThrottle] = useState(false);
  
  const [uiTheme, setUiTheme] = useState<'midnight' | 'light' | 'industrial' | 'blueprint' | 'retro'>(() => {
    try {
      return (localStorage.getItem('dcc_ui_theme') as any) || 'midnight';
    } catch (e) {
      return 'midnight';
    }
  });
  const [uiDensity, setUiDensity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dcc_ui_density');
      if (saved === 'standard') return 0;
      if (saved === 'compact') return 1;
      return saved ? parseInt(saved) : 0;
    } catch (e) {
      return 0;
    }
  });
  const bp = uiDensity === 0 ? 'xl' : uiDensity === 1 ? 'lg' : uiDensity === 2 ? 'md' : 'sm';
  const gridBase = uiDensity === 0 ? 'xl:grid-cols-12' : uiDensity === 1 ? 'lg:grid-cols-12' : uiDensity === 2 ? 'md:grid-cols-12' : 'sm:grid-cols-12';
  const leftColBase = uiDensity === 0 ? 'xl:col-span-5' : uiDensity === 1 ? 'lg:col-span-5' : uiDensity === 2 ? 'md:col-span-5' : 'sm:col-span-5';
  const rightColBase = uiDensity === 0 ? 'xl:col-span-7' : uiDensity === 1 ? 'lg:col-span-7' : uiDensity === 2 ? 'md:col-span-7' : 'sm:col-span-7';

  // Refined Container Bases to avoid breakpoint conflicts and handle stacking
  const imageContainerBase = uiDensity === 0 
    ? "flex flex-col sm:flex-row xl:flex-col gap-6 items-center sm:items-start xl:items-center"
    : uiDensity === 1
    ? "flex flex-col sm:flex-row lg:flex-col gap-6 items-center sm:items-start lg:items-center"
    : uiDensity === 2
    ? "flex flex-col md:flex-col gap-6 items-center md:items-center"
    : "flex flex-col gap-6 items-center";

  const imageWrapperBase = uiDensity === 0
    ? "relative group shrink-0 w-full sm:w-auto xl:w-full flex justify-center"
    : uiDensity === 1
    ? "relative group shrink-0 w-full sm:w-auto lg:w-full flex justify-center"
    : uiDensity === 2
    ? "relative group shrink-0 w-full md:w-full flex justify-center"
    : "relative group shrink-0 w-full flex justify-center";

  const imageBoxBase = uiDensity === 0
    ? "w-full max-w-[480px] sm:w-[324px] xl:w-full xl:max-w-[480px]"
    : uiDensity === 1
    ? "w-full max-w-[480px] sm:w-[324px] lg:w-full lg:max-w-[480px]"
    : uiDensity === 2
    ? "w-full max-w-[480px] md:w-full md:max-w-[480px]"
    : "w-full max-w-[480px]";

  const functionGridBase = uiDensity === 0 ? 'xl:grid-cols-4' : uiDensity === 1 ? 'lg:grid-cols-4' : uiDensity === 2 ? 'md:grid-cols-4' : 'sm:grid-cols-4';
  const presetGridBase = uiDensity === 0 ? 'grid-cols-3 sm:grid-cols-2 xl:grid-cols-3' : 
                         uiDensity === 1 ? 'grid-cols-3 sm:grid-cols-2 lg:grid-cols-3' :
                         uiDensity === 2 ? 'grid-cols-3 md:grid-cols-3' :
                         'grid-cols-3';
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [displaySettingsStyle, setDisplaySettingsStyle] = useState<React.CSSProperties>({ right: 0, width: '288px' });
  const headerRef = useRef<HTMLElement>(null);
  const paletteButtonRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const calculatePosition = () => {
      if (showDisplaySettings && paletteButtonRef.current && headerRef.current) {
        const buttonRect = paletteButtonRef.current.getBoundingClientRect();
        const headerRect = headerRef.current.getBoundingClientRect();
        const cardWidth = 288;
        
        // Header internal padding based on uiDensity
        let padding = 24; // p-6
        if (uiDensity === 1) padding = 16; // p-4
        if (uiDensity === 2) padding = 12; // p-3
        if (uiDensity === 3) padding = 4;  // p-1
        
        const headerContentLeftBoundary = headerRect.left + padding;
        const cardIdealLeft = buttonRect.right - cardWidth;
        
        if (cardIdealLeft < headerContentLeftBoundary) {
          const shift = headerContentLeftBoundary - cardIdealLeft;
          setDisplaySettingsStyle({ right: `-${shift}px`, width: `${cardWidth}px` });
        } else {
          setDisplaySettingsStyle({ right: 0, width: `${cardWidth}px` });
        }
      }
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [showDisplaySettings, uiDensity]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
    localStorage.setItem('dcc_ui_theme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    localStorage.setItem('dcc_ui_density', uiDensity);
  }, [uiDensity]);

  const [throttleMode, setThrottleMode] = useState<'standard' | 'switching'>(() => {
    try {
      const saved = localStorage.getItem('dcc_throttle_mode');
      return (saved as 'standard' | 'switching') || 'standard';
    } catch (e) {
      console.error('Failed to load throttle mode', e);
      return 'standard';
    }
  });
  const throttleModeRef = useRef(throttleMode);
  useEffect(() => { throttleModeRef.current = throttleMode; }, [throttleMode]);

  const [switchingOrientation, setSwitchingOrientation] = useState<'forward-right' | 'forward-left'>(() => {
    try {
      const saved = localStorage.getItem('dcc_switching_orientation');
      return (saved as 'forward-right' | 'forward-left') || 'forward-right';
    } catch (e) {
      console.error('Failed to load switching orientation', e);
      return 'forward-right';
    }
  });
  const switchingOrientationRef = useRef(switchingOrientation);
  useEffect(() => { switchingOrientationRef.current = switchingOrientation; }, [switchingOrientation]);

  const handleSetThrottleMode = (mode: 'standard' | 'switching') => {
    setThrottleMode(mode);
    const addrStr = cabAddress.toString();
    if (addrStr !== '') {
      setLocoSettings(prev => ({
        ...prev,
        [addrStr]: { 
          mode, 
          orientation: prev[addrStr]?.orientation || switchingOrientation 
        }
      }));
    }
  };

  const handleSetSwitchingOrientation = (orientation: 'forward-right' | 'forward-left') => {
    setSwitchingOrientation(orientation);
    const addrStr = cabAddress.toString();
    if (addrStr !== '') {
      setLocoSettings(prev => ({
        ...prev,
        [addrStr]: { 
          mode: prev[addrStr]?.mode || throttleMode, 
          orientation 
        }
      }));
    }
  };

  const [speedStepIncrement, setSpeedStepIncrement] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dcc_speed_step_increment');
      const val = saved ? parseInt(saved) : 5;
      return isNaN(val) ? 5 : val;
    } catch (e) {
      console.error('Failed to load speed step increment', e);
      return 5;
    }
  });
  const speedStepIncrementRef = useRef(speedStepIncrement);
  useEffect(() => { speedStepIncrementRef.current = speedStepIncrement; }, [speedStepIncrement]);

  const [speedScale, setSpeedScale] = useState<'steps' | 'percent'>(() => {
    try {
      const saved = localStorage.getItem('dcc_speed_scale');
      return (saved as 'steps' | 'percent') || 'steps';
    } catch (e) {
      return 'steps';
    }
  });

  const handleSetSpeedScale = (scale: 'steps' | 'percent') => {
    setSpeedScale(scale);
    localStorage.setItem('dcc_speed_scale', scale);
  };

  const getDisplaySpeed = useCallback((internalSpeed: number) => {
    return speedScale === 'percent' ? Math.round((internalSpeed / MAX_SPEED) * 100) : internalSpeed;
  }, [speedScale]);

  const getInternalSpeed = useCallback((displaySpeed: number) => {
    return speedScale === 'percent' ? Math.round((displaySpeed / 100) * MAX_SPEED) : displaySpeed;
  }, [speedScale]);

  const getDisplayMaxSpeed = useCallback(() => {
    return speedScale === 'percent' ? 100 : MAX_SPEED;
  }, [speedScale]);

  const speedRepeatTimeoutRef = useRef<any>(null);
  const speedRepeatIntervalRef = useRef<any>(null);

  const functionRapidTimeoutRef = useRef<any>(null);
  const functionRapidIntervalRef = useRef<any>(null);
  const waitingForFunctionResponseRef = useRef<{cab: string, fn: number, expectedState: boolean, safetyId?: any} | null>(null);
  const isRapidActiveRef = useRef<boolean>(false);
  const performRapidToggleRef = useRef<(idx: number) => void>(() => {});

  const stopSpeedRepeat = useCallback(() => {
    if (speedRepeatTimeoutRef.current) clearTimeout(speedRepeatTimeoutRef.current);
    if (speedRepeatIntervalRef.current) clearInterval(speedRepeatIntervalRef.current);
    speedRepeatTimeoutRef.current = null;
    speedRepeatIntervalRef.current = null;
  }, []);

  const startSpeedRepeat = useCallback((action: (amount: number) => void) => {
    stopSpeedRepeat();
    speedRepeatTimeoutRef.current = setTimeout(() => {
      speedRepeatIntervalRef.current = setInterval(() => {
        action(1); // 1 speedstep every 120ms as requested
      }, 120);
    }, 500);
  }, [stopSpeedRepeat]);

  const [maxPresets, setMaxPresets] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dcc_max_presets');
      return saved ? parseInt(saved) : 16;
    } catch (e) {
      return 16;
    }
  });

  const [hardLimit, setHardLimit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dcc_hard_limit');
      return saved ? parseInt(saved) : 32;
    } catch (e) {
      return 32;
    }
  });
  const [showHardLimitSelection, setShowHardLimitSelection] = useState(false);

  const [presets, setPresets] = useState<(number | string)[]>(() => {
    const defaultPresets = Array(ABSOLUTE_MAX_PRESETS).fill(3);
    // Some initial variety
    [12, 24, 100].forEach((v, i) => { if (i+1 < defaultPresets.length) defaultPresets[i+1] = v; });

    try {
      const saved = localStorage.getItem('dcc_presets');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure we handle potentially larger rosters
        if (Array.isArray(parsed)) {
           const result = [...parsed];
           while (result.length < ABSOLUTE_MAX_PRESETS) result.push(3);
           return result.slice(0, ABSOLUTE_MAX_PRESETS);
        }
      }
    } catch (e) {
      console.error('Failed to load presets from localStorage', e);
    }
    return defaultPresets;
  });

  const [secretPreset, setSecretPreset] = useState<number | string>(() => {
    try {
      const saved = localStorage.getItem('dcc_secret_preset');
      if (saved) return saved;
    } catch (e) {}
    return '';
  });

  const [visiblePresetsCount, setVisiblePresetsCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dcc_presets_count');
      const val = saved ? parseInt(saved) : 8; // Default to 8
      return isNaN(val) ? 8 : val;
    } catch (e) {
      console.error('Failed to load presets count', e);
      return 8;
    }
  });

  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);

  const consistSpeedsRef = useRef<Record<number, number>>({});
  const allLocoSpeedsRef = useRef<Record<number, number>>({});
  const lastTriggeredPresetIndexRef = useRef<number | null>(null);
  const navigatingPresetsRef = useRef<boolean>(false);
  const syncLongPressTimeoutRef = useRef<any>(null);
  const syncLongPressFiredRef = useRef<boolean>(false);

  const [locoRoadNames, setLocoRoadNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_road_names');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration from old array format
        if (Array.isArray(parsed)) {
          const migrated: Record<string, string> = {};
          // We need the presets to map indices to addresses
          // But presets is also initialized here... this is tricky.
          // Since we can't easily access presets during this init,
          // we'll handle migration in a useEffect or assume the user 
          // might lose some names if they switch right now, 
          // OR we try to load presets from localStorage too.
          const savedPresets = localStorage.getItem('dcc_presets');
          if (savedPresets) {
            const presetsArray = JSON.parse(savedPresets);
            if (Array.isArray(presetsArray)) {
              parsed.forEach((name, idx) => {
                const addr = presetsArray[idx];
                if (name && addr) migrated[addr.toString()] = name;
              });
            }
          }
          return migrated;
        }
        return parsed;
      }
      return {};
    } catch (e) {
      return {};
    }
  });
  const [showRoadNames, setShowRoadNames] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dcc_show_road_names');
      return saved === null ? true : saved === 'true';
    } catch (e) {
      return true;
    }
  });

  const [showLocoColors, setShowLocoColors] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dcc_show_loco_colors');
      return saved === null ? true : saved === 'true';
    } catch (e) {
      return true;
    }
  });

  const [showLocoFunctionColors, setShowLocoFunctionColors] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dcc_show_loco_function_colors');
      return saved === null ? true : saved === 'true';
    } catch (e) {
      return true;
    }
  });


  const [locoSortMode, setLocoSortMode] = useState<'custom' | 'id' | 'roadName'>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_sort_mode');
      return (saved as 'custom' | 'id' | 'roadName') || 'custom';
    } catch (e) {
      return 'custom';
    }
  });
  const [locoSortDirection, setLocoSortDirection] = useState<'asc' | 'desc'>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_sort_direction');
      return (saved as 'asc' | 'desc') || 'asc';
    } catch (e) {
      return 'asc';
    }
  });
  const [locoIdSortDirection, setLocoIdSortDirection] = useState<'asc' | 'desc'>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_id_sort_direction');
      return (saved as 'asc' | 'desc') || 'asc';
    } catch (e) {
      return 'asc';
    }
  });
  const [prevLocoSortMode, setPrevLocoSortMode] = useState<'custom' | 'id'>(() => {
    try {
      const saved = localStorage.getItem('dcc_prev_loco_sort_mode');
      return (saved as 'custom' | 'id') || 'custom';
    } catch (e) {
      return 'custom';
    }
  });
  const [customPresetOrder, setCustomPresetOrder] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('dcc_custom_preset_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const result = [...parsed];
          while (result.length < ABSOLUTE_MAX_PRESETS) result.push(result.length);
          return result.slice(0, ABSOLUTE_MAX_PRESETS);
        }
      }
    } catch (e) {}
    return Array.from({ length: ABSOLUTE_MAX_PRESETS }, (_, i) => i);
  });

  const locoSortModeRef = useRef(locoSortMode);
  const locoSortDirectionRef = useRef(locoSortDirection);
  const locoIdSortDirectionRef = useRef(locoIdSortDirection);
  const prevLocoSortModeRef = useRef(prevLocoSortMode);

  useEffect(() => { locoSortModeRef.current = locoSortMode; }, [locoSortMode]);
  useEffect(() => { locoSortDirectionRef.current = locoSortDirection; }, [locoSortDirection]);
  useEffect(() => { locoIdSortDirectionRef.current = locoIdSortDirection; }, [locoIdSortDirection]);
  useEffect(() => { prevLocoSortModeRef.current = prevLocoSortMode; }, [prevLocoSortMode]);

  const [showLocoSortModal, setShowLocoSortModal] = useState(false);
  const [showDccExRosterModal, setShowDccExRosterModal] = useState(false);
  const [showDccExLocoDetailsModal, setShowDccExLocoDetailsModal] = useState(false);
  const [selectedDccExLocoDetails, setSelectedDccExLocoDetails] = useState<DccExLocoDetails | null>(null);
  
  // Delete/Renumber State
  const [deleteRenumberModal, setDeleteRenumberModal] = useState<{
    isOpen: boolean;
    presetIndex: number | null;
    addr: string;
    newAddr: string;
    lastValidAddr: string;
  }>({
    isOpen: false,
    presetIndex: null,
    addr: '',
    newAddr: '',
    lastValidAddr: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenumberSuccess, setShowRenumberSuccess] = useState<{
    isOpen: boolean;
    oldAddr: string;
    newAddr: string;
    warning: string | null;
  }>({
    isOpen: false,
    oldAddr: '',
    newAddr: '',
    warning: null
  });

  const [renumberAlert, setRenumberAlert] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

  const triggerRenumberAlert = (msg: string) => {
    setRenumberAlert({ show: true, message: msg });
    setTimeout(() => setRenumberAlert({ show: false, message: '' }), 2000);
  };

  const isValidCabAddressFormat = (addr: string): boolean => {
    const s = addr.toString();
    // Case 1: Plain number 1-9999 (No # allowed here)
    if (/^\d+$/.test(s)) {
      const n = parseInt(s);
      return n >= 1 && n <= 9999;
    }
    // Case 2: #n.d format (Must have # and one decimal 1-9)
    const match = s.match(/^#(\d+)\.([1-9])$/);
    if (match) {
      const base = parseInt(match[1]);
      return base >= 1 && base <= 9999;
    }
    return false;
  };

  const sanitizeCabAddress = (input: string): string => {
    let s = input.toString().trim();
    if (!s) return '3';

    // Rule: If it starts with #
    if (s.startsWith('#')) {
      const match = s.match(/^#(\d+)(\.(\d+))?$/);
      if (match) {
        const base = match[1];
        const decimalPart = match[3];
        const decimal = decimalPart ? parseInt(decimalPart) : 0;
        
        if (decimal > 0) {
          // Valid #DCC.decimal (like #3.1)
          return `#${base}.${decimal}`;
        } else {
          // No decimal or .0 -> strip # and treat as base
          return base;
        }
      } else {
        // Just '#' or invalid # format -> strip it
        const numeric = s.replace(/\D/g, '');
        return numeric || '3';
      }
    }

    // Rule: If it contains a dot but no # (User entered 3.1)
    if (s.includes('.') && !s.startsWith('#')) {
       const parts = s.split('.');
       const base = parts[0].replace(/\D/g, '');
       const decimal = parseInt(parts[1]) || 0;
       if (decimal > 0) return `#${base}.${decimal}`;
       return base || '3';
    }

    // Default: Strip anything non-numeric and ensure 1-9999
    const numeric = s.replace(/\D/g, '');
    const val = parseInt(numeric);
    if (isNaN(val) || val < 1) return '3';
    if (val > 9999) return '9999';
    return val.toString();
  };

  const isAddressInUse = (testAddr: string, originalAddr: string) => {
    // 1. Check currently active throttle address (Must block if active in throttle)
    if (testAddr === cabAddress.toString()) return true;

    // 2. Check presets (including the original address itself)
    if (presets.some(p => p.toString() === testAddr)) return true;
    return false;
  };

  const isWaitingForRosterRef = useRef(false);
  const isWaitingForSpecificLocoDetailsRef = useRef<string | null>(null);
  const [dccExRoster, setDccExRoster] = useState<string[]>([]);
  const dccExRosterRef = useRef<string[]>([]);
  useEffect(() => { dccExRosterRef.current = dccExRoster; }, [dccExRoster]);
  const [selectedRosterAddrs, setSelectedRosterAddrs] = useState<Set<string>>(new Set());
  const [locoDetailsCache, setLocoDetailsCache] = useState<Record<string, DccExLocoDetails>>({});

  // Workflow state for Roster Import
  const [importWorkflow, setImportWorkflow] = useState<{
    queue: string[];
    currentIndex: number;
    results: { added: number; skipped: number; hiddenAdded: boolean; maxIndexUsed: number };
    status: 'idle' | 'confirming' | 'processing' | 'finished' | 'full' | 'fetching';
    currentConflictAddr?: string;
  }>({
    queue: [],
    currentIndex: 0,
    results: { added: 0, skipped: 0, hiddenAdded: false, maxIndexUsed: 0 },
    status: 'idle'
  });
  const waitingForAddrRef = useRef<string | null>(null);

  // Roster Import Workflow Logic
  const startImportWorkflow = () => {
    const selected = Array.from(selectedRosterAddrs);
    if (selected.length === 0) return;
    
    setImportWorkflow({
      queue: selected,
      currentIndex: 0,
      results: { added: 0, skipped: 0, hiddenAdded: false, maxIndexUsed: 0 },
      status: 'processing'
    });
  };

  useEffect(() => {
    if (importWorkflow.status === 'processing' || importWorkflow.status === 'fetching') {
      const addr = importWorkflow.queue[importWorkflow.currentIndex];
      if (!addr) {
        setImportWorkflow(prev => ({ ...prev, status: 'finished' }));
        return;
      }

      // Check if we have details
      const details = locoDetailsCache[addr];
      if (!details) {
        if (waitingForAddrRef.current !== addr) {
          waitingForAddrRef.current = addr;
          sendCommand(`JR ${getDccAddress(addr)}`);
          addLog('out', `<JR ${addr}>`);
          addLog('info', `Import: Fetching details for Loco #${addr}...`);
          setImportWorkflow(prev => ({ ...prev, status: 'fetching' }));
        }
        return;
      }

      // Details received!
      waitingForAddrRef.current = null;

      // Check if it exists
      const exists = presets.some(p => p.toString() === addr.toString());
      if (exists) {
        setImportWorkflow(prev => ({ ...prev, status: 'confirming', currentConflictAddr: addr }));
      } else {
        // No conflict, proceed with import
        executeImport(addr, 'add');
      }
    }
  }, [importWorkflow.status, importWorkflow.currentIndex, locoDetailsCache]);
  
  const getNextAvailableCabAddress = (addr: string): string => {
    const parts = getAddrParts(addr);
    const base = parts.base;
    
    // Check base address first (e.g. "3")
    const baseStr = base.toString();
    if (isValidCabAddressFormat(baseStr) && !isAddressInUse(baseStr, addr)) {
      return baseStr;
    }

    // Try suffixes .1 ... .9
    for (let suffix = 1; suffix <= 9; suffix++) {
      const candidate = `#${base}.${suffix}`;
      if (!isAddressInUse(candidate, addr)) {
        return candidate;
      }
    }
    return addr; // Fallback
  };

  const getAddrParts = (addr: string): { base: number, suffix: number } => {
    const match = addr.toString().match(/#?(\d+)(\.(\d+))?/);
    if (!match) return { base: 3, suffix: 0 };
    const base = parseInt(match[1]);
    const suffix = match[3] ? parseInt(match[3]) : 0;
    return { base, suffix };
  };

  const handleAdjustRenumberAddr = (amount: number) => {
    const parts = getAddrParts(deleteRenumberModal.newAddr);
    const base = parts.base;
    let currentIdx = parts.suffix;

    // Cycle through 0 (base), 1 (.1), 2 (.2) ... 9 (.9)
    let testIdx = currentIdx;
    for (let i = 0; i < 10; i++) {
      testIdx += amount;
      if (testIdx < 0) testIdx = 9;
      if (testIdx > 9) testIdx = 0;

      const candidate = testIdx === 0 ? base.toString() : `#${base}.${testIdx}`;
      
      if (isValidCabAddressFormat(candidate) && !isAddressInUse(candidate, deleteRenumberModal.addr)) {
        setDeleteRenumberModal(prev => ({ ...prev, newAddr: candidate, lastValidAddr: candidate }));
        break;
      }
    }
  };

  const executeDeleteRosterEntry = () => {
    const { addr, presetIndex } = deleteRenumberModal;
    if (presetIndex === null) return;

    // 1. Update presets list (reset to 3)
    setPresets(prev => {
      const next = [...prev];
      next[presetIndex] = '3';
      return next;
    });

    // 2. Clear relevant data keys
    const clearKey = (setter: React.Dispatch<React.SetStateAction<any>>, addrKey: string) => {
      setter((prev: any) => {
        const next = { ...prev };
        delete next[addrKey];
        return next;
      });
    };

    clearKey(setLocoRoadNames, addr);
    clearKey(setLocoColors, addr);
    clearKey(setLocoOpacity, addr);
    clearKey(setLocoAccentColors, addr);
    clearKey(setLocoAccentOpacity, addr);
    clearKey(setLocoSettings, addr);
    clearKey(setLocoImages, addr);
    clearKey(setLocoPlaceholders, addr);
    clearKey(setLocoFunctionConfigs, addr);
    clearKey(setAllLocoFunctions, addr);

    addLog('info', `Roster entry for Loco ${addr} deleted.`);
    
    // Close modals
    setShowDeleteConfirm(false);
    setDeleteRenumberModal(prev => ({ ...prev, isOpen: false }));
  };

  const executeRenumberRosterEntry = () => {
    const { addr, presetIndex } = deleteRenumberModal;
    const newAddr = sanitizeCabAddress(deleteRenumberModal.newAddr);

    if (presetIndex === null) return;

    if (newAddr === addr) {
       const next = getNextAvailableCabAddress(newAddr);
       setDeleteRenumberModal(prev => ({ ...prev, newAddr: next, lastValidAddr: next }));
       triggerRenumberAlert("Please enter a new address to renumber.");
       return;
    }

    // Check conflict or validity
    if (!isValidCabAddressFormat(newAddr)) {
      triggerRenumberAlert("Invalid format. Use 1-9999 or #DCC.decimal");
      return;
    }

    if (isAddressInUse(newAddr, addr)) {
      const next = getNextAvailableCabAddress(newAddr);
      if (next === newAddr) {
        triggerRenumberAlert("Selected address already in use. Choose another.");
      } else {
        setDeleteRenumberModal(prev => ({ ...prev, newAddr: next, lastValidAddr: next }));
        triggerRenumberAlert("Selected address already in use. Showing next available.");
      }
      return; // Do not proceed, user must press renumber again
    }

    // Renumbering logic
    // 1. Update presets list
    setPresets(prev => {
      const next = [...prev];
      next[presetIndex] = newAddr;
      return next;
    });

    // 2. Transfer data
    const transferData = (setter: React.Dispatch<React.SetStateAction<any>>, oldKey: string, newKey: string) => {
      setter((prev: any) => {
        if (!prev[oldKey]) return prev;
        const next = { ...prev };
        next[newKey] = next[oldKey];
        delete next[oldKey];
        return next;
      });
    };

    transferData(setLocoRoadNames, addr, newAddr);
    transferData(setLocoColors, addr, newAddr);
    transferData(setLocoOpacity, addr, newAddr);
    transferData(setLocoAccentColors, addr, newAddr);
    transferData(setLocoAccentOpacity, addr, newAddr);
    transferData(setLocoSettings, addr, newAddr);
    transferData(setLocoImages, addr, newAddr);
    transferData(setLocoPlaceholders, addr, newAddr);
    transferData(setLocoFunctionConfigs, addr, newAddr);
    transferData(setAllLocoFunctions, addr, newAddr);

    // Warning check
    const oldDcc = getDccAddress(addr);
    const newDcc = getDccAddress(newAddr);
    let warning = null;
    if (newDcc !== oldDcc) {
      warning = "Note! New roster entry DCC address does not match previous locomotive DCC address. Locomotives will not respond to this throttle entry unless DCC addresses match. Proceed with caution.";
    }

    setShowRenumberSuccess({
      isOpen: true,
      oldAddr: addr,
      newAddr: newAddr,
      warning: warning
    });

    addLog('info', `Roster entry renumbered from ${addr} to ${newAddr}.`);
    setDeleteRenumberModal(prev => ({ ...prev, isOpen: false }));
  };

  const executeImport = (addr: string, mode: 'add' | 'replace' | 'createNew', detailsOverride?: DccExLocoDetails) => {
    const details = detailsOverride || locoDetailsCache[addr];
    if (!details) {
      // Should not happen now with fetching logic
      setImportWorkflow(prev => ({ 
        ...prev, 
        results: { ...prev.results, skipped: prev.results.skipped + 1 },
        currentIndex: prev.currentIndex + 1,
        status: 'processing'
      }));
      return;
    }

    let finalAddr: string = addr;
    let targetIndex = -1;

    if (mode === 'replace') {
      targetIndex = presets.findIndex(p => p.toString() === addr.toString());
    } else if (mode === 'createNew') {
      finalAddr = getNextAvailableCabAddress(addr);
      // Find first "empty" preset (ID = 3)
      targetIndex = presets.findIndex(p => p.toString() === '3');
    } else {
      // mode === 'add'
      // Find first "empty" preset (ID = 3)
      targetIndex = presets.findIndex(p => p.toString() === '3');
    }

    if (targetIndex === -1) {
      // No space!
      setImportWorkflow(prev => ({ ...prev, status: 'full' }));
      return;
    }

    // Extract Road Name
    let roadName = '';
    const roadNameMatch = details.description.match(new RegExp(`^(.{1,8})\\s+${addr}$`));
    if (roadNameMatch) {
      roadName = roadNameMatch[1];
    }

    // Update presets
    setPresets(prev => {
      const next = [...prev];
      next[targetIndex] = finalAddr;
      return next;
    });

    // Update road names
    if (roadName) {
      setLocoRoadNames(prev => ({ ...prev, [finalAddr]: roadName }));
    }

    // Update function configs
    const newConfigs: LocoFunctionConfig[] = details.functions.map(f => ({
      name: f.name,
      visible: true,
      momentary: f.isMomentary,
      sendToConsist: f.number === 0
    }));
    setLocoFunctionConfigs(prev => ({ ...prev, [finalAddr]: newConfigs }));

    // Uncheck in roster
    setSelectedRosterAddrs(prev => {
      const next = new Set(prev);
      next.delete(addr);
      return next;
    });

    // Check if hidden
    const isHidden = targetIndex >= visiblePresetsCount;

    setImportWorkflow(prev => ({
      ...prev,
      results: { 
        added: prev.results.added + 1, 
        skipped: prev.results.skipped,
        hiddenAdded: prev.results.hiddenAdded || isHidden,
        maxIndexUsed: Math.max(prev.results.maxIndexUsed, targetIndex)
      },
      currentIndex: prev.currentIndex + 1,
      status: 'processing'
    }));
  };

  const skipImport = () => {
    setImportWorkflow(prev => ({
      ...prev,
      results: { ...prev.results, skipped: prev.results.skipped + 1 },
      currentIndex: prev.currentIndex + 1,
      status: 'processing'
    }));
  };

  const finishImport = () => {
    if (importWorkflow.results.added === importWorkflow.queue.length && importWorkflow.queue.length > 0) {
      setShowDccExRosterModal(false);
    }
    setImportWorkflow(prev => ({ ...prev, status: 'idle' }));
  };

  const [showLocoColorModal, setShowLocoColorModal] = useState<number | null>(null);
  const [editingFunctionColor, setEditingFunctionColor] = useState<{ locoAddr: string; functionIdx: number } | null>(null);

  useEffect(() => {
    if (importWorkflow.status === 'finished') {
      if (importWorkflow.results.added === importWorkflow.queue.length && !importWorkflow.results.hiddenAdded) {
        setShowDccExRosterModal(false);
      }
    }
  }, [importWorkflow.status, importWorkflow.results.added, importWorkflow.queue.length, importWorkflow.results.hiddenAdded]);

  const [locoColors, setLocoColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_colors');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [locoOpacity, setLocoOpacity] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_opacity');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [locoAccentColors, setLocoAccentColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_accent_colors');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [locoAccentOpacity, setLocoAccentOpacity] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_accent_opacity');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingAddress && addressInputRef.current) {
      addressInputRef.current.focus();
    }
  }, [isEditingAddress]);

  const [activePickerColor, setActivePickerColor] = useState<string>('#2563eb');
  const [activePickerOpacity, setActivePickerOpacity] = useState<number>(50);
  const [activePickerAccentColor, setActivePickerAccentColor] = useState<string>('none');
  const [activePickerAccentOpacity, setActivePickerAccentOpacity] = useState<number>(50);
  const [colorModalMode, setColorModalMode] = useState<'base' | 'accent'>('base');
  const [showPresetSliderModal, setShowPresetSliderModal] = useState(false);
  const [presetSnapshot, setPresetSnapshot] = useState<{max: number, visible: number} | null>(null);

  const handleCancelPresets = () => {
    if (presetSnapshot) {
      setMaxPresets(presetSnapshot.max);
      setVisiblePresetsCount(presetSnapshot.visible);
    }
    setShowPresetSliderModal(false);
  };

  const [locoIncludedInSort, setLocoIncludedInSort] = useState<boolean[]>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_included_in_sort');
      const defaultVal = Array(ABSOLUTE_MAX_PRESETS).fill(true);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const result = [...parsed];
          while (result.length < ABSOLUTE_MAX_PRESETS) result.push(true);
          return result.slice(0, ABSOLUTE_MAX_PRESETS);
        }
      }
      return defaultVal;
    } catch (e) {
      return Array(ABSOLUTE_MAX_PRESETS).fill(true);
    }
  });

  useEffect(() => {
    localStorage.setItem('dcc_max_presets', maxPresets.toString());
  }, [maxPresets]);

  useEffect(() => {
    localStorage.setItem('dcc_presets_count', visiblePresetsCount.toString());
  }, [visiblePresetsCount]);

  useEffect(() => {
    localStorage.setItem('dcc_show_loco_function_colors', showLocoFunctionColors.toString());
  }, [showLocoFunctionColors]);

  const getSortedIndices = useCallback(() => {
    const baseIndices = Array.from({ length: maxPresets }, (_, i) => i);
    let masterList = [...baseIndices];
    
    if (locoSortMode === 'custom') {
      masterList = customPresetOrder.filter(i => i < maxPresets);
    } else if (locoSortMode === 'id') {
      masterList.sort((a, b) => {
        const addrA = getNumericAddress(presets[a]);
        const addrB = getNumericAddress(presets[b]);
        return locoIdSortDirection === 'asc' ? addrA - addrB : addrB - addrA;
      });
    } else if (locoSortMode === 'roadName') {
      masterList.sort((a, b) => {
        // Primary: Road Name
        const addrAVal = getNumericAddress(presets[a]);
        const addrBVal = getNumericAddress(presets[b]);
        const nameA = (locoRoadNames[presets[a]?.toString() || ''] || '').toLowerCase();
        const nameB = (locoRoadNames[presets[b]?.toString() || ''] || '').toLowerCase();
        
        if (nameA !== nameB) {
          if (locoSortDirection === 'asc') {
            return nameA < nameB ? -1 : 1;
          } else {
            return nameA < nameB ? 1 : -1;
          }
        }
        
        // Secondary: ID
        const addrA = getNumericAddress(presets[a]);
        const addrB = getNumericAddress(presets[b]);
        return locoIdSortDirection === 'asc' ? addrA - addrB : addrB - addrA;
      });
    }

    // Always keep included items at the top
    const sortedIncluded = masterList.filter(idx => locoIncludedInSort[idx]);
    const sortedExcluded = masterList.filter(idx => !locoIncludedInSort[idx]);
    
    return [...sortedIncluded, ...sortedExcluded];
  }, [maxPresets, locoSortMode, locoSortDirection, locoIdSortDirection, customPresetOrder, presets, locoRoadNames, locoIncludedInSort]);

  const [locoSettings, setLocoSettings] = useState<Record<string, { 
    mode: 'standard' | 'switching', 
    orientation: 'forward-right' | 'forward-left',
    showNumbers?: boolean,
    showNames?: boolean
  }>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_settings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load loco settings', e);
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('dcc_loco_settings', JSON.stringify(locoSettings));
  }, [locoSettings]);

  const [locoImages, setLocoImages] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_images');
      if (saved) {
        const parsed = JSON.parse(saved);
        return (parsed && typeof parsed === 'object') ? parsed : {};
      }
    } catch (e) {
      console.error('Failed to load loco images from localStorage', e);
    }
    return {};
  });

  const [locoPlaceholders, setLocoPlaceholders] = useState<Record<string, 'steam' | 'diesel' | null>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_placeholders');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('dcc_loco_placeholders', JSON.stringify(locoPlaceholders));
  }, [locoPlaceholders]);

  const [locoFunctionConfigs, setLocoFunctionConfigs] = useState<Record<string, LocoFunctionConfig[]>>(() => {
    try {
      const saved = localStorage.getItem('dcc_loco_functions');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: ensure sendToConsist exists, migrate rapid to repeat
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(addr => {
            parsed[addr] = parsed[addr].map((f: any, i: number) => {
              const repeatVal = f.repeat !== undefined ? f.repeat : (f.rapid !== undefined ? f.rapid : false);
              const { rapid, ...rest } = f;
              return {
                ...rest,
                sendToConsist: f.sendToConsist !== undefined ? f.sendToConsist : (i === 0),
                repeat: repeatVal
              };
            });
          });
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load loco functions from localStorage', e);
    }
    return {};
  });

  useEffect(() => {
    safeSetItem('dcc_loco_functions', JSON.stringify(locoFunctionConfigs));
  }, [locoFunctionConfigs]);

  const [allLocoFunctions, setAllLocoFunctions] = useState<Record<string, Record<number, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('dcc_all_loco_functions');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const getLocoFunctionConfig = useCallback((address: string | number) => {
    const addrStr = address.toString();
    if (locoFunctionConfigs[addrStr]) return locoFunctionConfigs[addrStr];
    
    // Default config
    const defaultConfig: LocoFunctionConfig[] = Array.from({ length: 29 }, (_, i) => ({
      name: i === 0 ? 'Light' : i === 1 ? 'Bell' : i === 2 ? 'Horn' : i === 3 ? 'Short Horn' : i === 4 ? 'Brake' : `F${i}`,
      visible: i <= 12,
      momentary: i === 2, // Horn is momentary by default
      sendToConsist: i === 0, // F0 headlight is sent to all locos by default
      repeat: false
    }));
    return defaultConfig;
  }, [locoFunctionConfigs]);

  // Consist State
  const [isConsistSetupMode, setIsConsistSetupMode] = useState(false);

  useEffect(() => {
    if (!isTourActive) {
      setCombinedHighlightBounds(null);
      return;
    }
    
    const calculateBounds = () => {
      const headerEl = document.getElementById('tour-loco-card-header');
      const boxEl = document.getElementById('tour-loco-address-box');
      const cardEl = document.getElementById('tour-loco-address');
      
      if (headerEl && boxEl && cardEl) {
        const headerRect = headerEl.getBoundingClientRect();
        const boxRect = boxEl.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        
        const top = headerRect.top - cardRect.top;
        const height = boxRect.bottom - headerRect.top;
        const left = headerRect.left - cardRect.left;
        const width = headerRect.width;
        
        setCombinedHighlightBounds({
          top: Math.max(0, top),
          height: Math.max(50, height),
          left: Math.max(0, left),
          width: Math.max(100, width)
        });
      }
    };
    
    // Calculate initially and after tiny delay for layout stabilization
    calculateBounds();
    const timer = setTimeout(calculateBounds, 100);
    
    window.addEventListener('resize', calculateBounds);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateBounds);
    };
  }, [isTourActive, lastTourStopIndex, uiDensity, isLocoAddressMerged, showLocoSortModal, isConsistSetupMode]);

  const [selectedConsistId, setSelectedConsistId] = useState<number | null>(null);
  const [activeConsistId, setActiveConsistId] = useState<number | null>(null);
  const activeConsistIdRef = useRef(activeConsistId);
  useEffect(() => { activeConsistIdRef.current = activeConsistId; }, [activeConsistId]);

  useEffect(() => {
    if (!navigatingPresetsRef.current) {
      lastTriggeredPresetIndexRef.current = null;
    }
  }, [activePresetIndex, cabAddress, activeConsistId]);
  const [activeConsistTempReverse, setActiveConsistTempReverse] = useState(false);
  const [isRoutesView, setIsRoutesView] = useState(false);
  const [isTurnoutsView, setIsTurnoutsView] = useState(false);
  const [routes, setRoutes] = useState<{ id: string; name: string; description: string }[]>([]);
  const [turnouts, setTurnouts] = useState<{ id: string; name: string; state: 'C' | 'T' | 'X' }[]>([]);
  const [allRouteIds, setAllRouteIds] = useState<string[]>([]);
  const [allTurnoutIds, setAllTurnoutIds] = useState<string[]>([]);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [areRouteRetriesEnabled, setAreRouteRetriesEnabled] = useState(false);
  const [areTurnoutRetriesEnabled, setAreTurnoutRetriesEnabled] = useState(false);
  const [turnoutsLoaded, setTurnoutsLoaded] = useState(false);
  const [showRouteConsistConfirm, setShowRouteConsistConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!isTourActive) {
      setTopRowHighlightStyle({ display: 'none' });
      return;
    }

    const updateTopRowBounds = () => {
      const f0 = document.getElementById('tour-function-f0');
      const f2 = document.getElementById('tour-function-f2');
      const panel = document.getElementById('functions-panel');

      if (f0 && f2 && panel) {
        const rectF0 = f0.getBoundingClientRect();
        const rectF2 = f2.getBoundingClientRect();
        const rectPanel = panel.getBoundingClientRect();

        const top = rectF0.top - rectPanel.top;
        const left = rectF0.left - rectPanel.left;
        const width = rectF2.right - rectF0.left;
        const height = Math.max(rectF0.height, rectF2.height);

        setTopRowHighlightStyle({
          position: 'absolute',
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
          zIndex: 10,
          pointerEvents: 'none'
        });
      } else {
        setTopRowHighlightStyle({ display: 'none' });
      }
    };

    updateTopRowBounds();
    const timer = setTimeout(updateTopRowBounds, 200);
    window.addEventListener('resize', updateTopRowBounds);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTopRowBounds);
    };
  }, [isTourActive, isCompactFunctions, cabAddress, lastTourStopIndex, isEditingFunctions, isRoutesView, isTurnoutsView, uiDensity]);
  const sendCommandRef = useRef<((cmd: string) => Promise<void>) | null>(null);
  const [hideAllConsists, setHideAllConsists] = useState(() => {
    try {
      return localStorage.getItem('dcc_hide_all_consists') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [consists, setConsists] = useState<Consist[]>(() => {
    try {
      const saved = localStorage.getItem('dcc_consists');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load consists', e);
    }
    return Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      locos: [],
      isVisible: false,
      isFlipped: false
    }));
  });
  const consistsRef = useRef(consists);
  useEffect(() => { consistsRef.current = consists; }, [consists]);

  useEffect(() => {
    if (!isTourActive) {
      localStorage.setItem('dcc_consists', JSON.stringify(consists));
    }
  }, [consists, isTourActive]);

  useEffect(() => {
    localStorage.setItem('dcc_max_presets', maxPresets.toString());
  }, [maxPresets]);

  const [customAppIcon, setCustomAppIcon] = useState<string | null>(() => localStorage.getItem('dcc_custom_app_icon'));
  const [customAppIconEnabled, setCustomAppIconEnabled] = useState<boolean>(() => localStorage.getItem('dcc_custom_app_icon_enabled') !== 'false');
  const [customAppIconType, setCustomAppIconType] = useState<'svg' | 'image' | null>(() => (localStorage.getItem('dcc_custom_app_icon_type') as any) || 'svg');
  const [customAppIconSizeConfigs, setCustomAppIconSizeConfigs] = useState<Record<string, { active: boolean, value: number, useTheme: boolean, large: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('dcc_custom_app_icon_size_configs');
      const defaultState = { 
        header: { active: true, value: 20, useTheme: true, large: true }, 
        presets: { active: true, value: 20, useTheme: true, large: true }, 
        throttle: { active: true, value: 20, useTheme: true, large: true } 
      };
      if (!saved) return defaultState;
      const parsed = JSON.parse(saved);
      
      // Migrate if needed - ensure all fields exist
      ['header', 'presets', 'throttle'].forEach(key => {
        if (!parsed[key]) {
          parsed[key] = { ...defaultState[key as keyof typeof defaultState] };
        }
        if (parsed[key].useTheme === undefined) {
          parsed[key].useTheme = localStorage.getItem('dcc_custom_app_icon_use_theme') !== 'false';
        }
        if (parsed[key].large === undefined) {
          parsed[key].large = localStorage.getItem('dcc_custom_app_icon_large') !== 'false';
        }
      });
      return parsed;
    } catch (e) {
      return { 
        header: { active: true, value: 20, useTheme: true, large: true }, 
        presets: { active: true, value: 20, useTheme: true, large: true }, 
        throttle: { active: true, value: 20, useTheme: true, large: true } 
      };
    }
  });

  const [defaultAppIconSizeConfigs, setDefaultAppIconSizeConfigs] = useState<Record<string, { active: boolean, value: number, useTheme: boolean, large: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('dcc_default_app_icon_size_configs');
      const defaultState = { 
        header: { active: true, value: 20, useTheme: true, large: true }, 
        presets: { active: true, value: 20, useTheme: true, large: true }, 
        throttle: { active: true, value: 20, useTheme: true, large: true } 
      };
      if (!saved) return defaultState;
      return JSON.parse(saved);
    } catch (e) {
      return { 
        header: { active: true, value: 20, useTheme: true, large: true }, 
        presets: { active: true, value: 20, useTheme: true, large: true }, 
        throttle: { active: true, value: 20, useTheme: true, large: true } 
      };
    }
  });

  const [iconSettingsMode, setIconSettingsMode] = useState<'custom' | 'default'>('custom');

  useEffect(() => {
    localStorage.setItem('dcc_custom_app_icon_size_configs', JSON.stringify(customAppIconSizeConfigs));
  }, [customAppIconSizeConfigs]);

  useEffect(() => {
    localStorage.setItem('dcc_default_app_icon_size_configs', JSON.stringify(defaultAppIconSizeConfigs));
  }, [defaultAppIconSizeConfigs]);

  // Standalone App Icon Management (Dynamic Favicon/Manifest)
  useEffect(() => {
    let manifestURL: string | null = null;
    
    const updateIcons = () => {
      let iconUri = '';
      
      const configs = (customAppIcon && customAppIconEnabled) ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
      const themeEnabled = configs.header?.useTheme ?? true;
      const effectiveIcon = customAppIconEnabled ? customAppIcon : null;

      if (effectiveIcon) {
        if (customAppIconType === 'svg') {
          let svg = effectiveIcon;
          if (!svg.includes('xmlns=')) {
            svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
          }
          // If we're using theme colors in the app, the PWA icon shouldn't be invisible "currentColor"
          // We'll force it to be white or primary blue for the OS level icons
          if (themeEnabled) {
            svg = svg.replace(/currentColor/g, '#2563eb');
          }
          iconUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        } else {
          iconUri = customAppIcon;
        }
      } else {
        // Use user-provided PNG as default fallback
        iconUri = '/throttleiconbydriverd.png';
      }

      // Update basic links
      ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(rel => {
        let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
        if (!link && rel === 'icon') {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        if (link) link.href = iconUri;
      });

      // Update PWA Manifest
      const manifest = {
        name: "@DriverD Throttle for DCC-EX",
        short_name: "Throttle",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#2563eb",
        icons: [
          {
            src: iconUri,
            sizes: "any",
            type: iconUri.startsWith('data:image/svg+xml') ? "image/svg+xml" : "image/png",
            purpose: "any maskable"
          }
        ]
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      manifestURL = URL.createObjectURL(blob);
      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (manifestLink) manifestLink.href = manifestURL;
    };

    updateIcons();
    
    return () => {
      if (manifestURL) URL.revokeObjectURL(manifestURL);
    };
  }, [customAppIcon, customAppIconEnabled, customAppIconType, customAppIconSizeConfigs.header?.useTheme, defaultAppIconSizeConfigs.header?.useTheme]);
  const [showIconSettingsModal, setShowIconSettingsModal] = useState(false);
  const [showUserCustomSettingsModal, setShowUserCustomSettingsModal] = useState(false);
  const [memorySlots, setMemorySlots] = useState<Record<number, any>>(() => {
    try {
      const saved = localStorage.getItem('dcc_settings_memory');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [tourMemorySlot, setTourMemorySlot] = useState<any>(null);
  const [tourFirstPresetBackup, setTourFirstPresetBackup] = useState<any>(null);
  const tourFirstPresetBackupRef = useRef<any>(null);
  const [tourConsist1Backup, setTourConsist1Backup] = useState<Consist | null>(null);
  const tourConsist1BackupRef = useRef<Consist | null>(null);
  const tourConsist1SpeedBackupRef = useRef<number | null>(null);
  const tourF0ColorBackupRef = useRef<{ locoAddr: string; bgColor?: string; bgOpacity?: number; accentColor?: string; accentOpacity?: number } | null>(null);
  const tourShowNumbersBackupRef = useRef<{ locoAddr: string; showNumbers: boolean } | null>(null);
  const tourShowNamesBackupRef = useRef<{ locoAddr: string; showNames: boolean } | null>(null);
  const tourMemorySlot1BackupRef = useRef<any>(null);
  const tourScheduledTimeoutsRef = useRef<any[]>([]);
  const [tourMemoryStatus, setTourMemoryStatus] = useState<'saving' | 'restoring' | null>(null);
  const [tourMemorySlot1MatchedForce, setTourMemorySlot1MatchedForce] = useState<boolean>(false);
  const [tourMemorySlot1MutedForce, setTourMemorySlot1MutedForce] = useState<boolean>(false);

  const saveTourSettings = () => {
    const snapshot = {
      customAppIconEnabled,
      customAppIconSizeConfigs,
      defaultAppIconSizeConfigs,
      hideAllConsists,
      isCompactLocoPresets,
      showRoadNames,
      showLocoColors,
      isBlocksView,
      isCompactThrottle,
      throttleLayout,
      isSmallPresetsActive,
      estopConfigModeMap,
      isCompactFunctions,
      showLocoFunctionColors,
      locoSettings,
      routeCompactMode,
      turnoutCompactMode,
      stopLabelActAsButtonMap,
      isThickThrottle,
      useFunctionGroups,
      uiDensity,
      uiTheme,
      disablePhotoSwipe,
      isLocoAddressMerged,
      showAdvancedToggles
    };
    setTourMemorySlot(snapshot);
    handleTurnOffAllCustomSettings();
  };

  const restoreTourSettings = () => {
    if (!tourMemorySlot) return;
    const data = tourMemorySlot;
    
    if (data.customAppIconEnabled !== undefined) setCustomAppIconEnabled(data.customAppIconEnabled);
    if (data.customAppIconSizeConfigs !== undefined) setCustomAppIconSizeConfigs(data.customAppIconSizeConfigs);
    if (data.defaultAppIconSizeConfigs !== undefined) setDefaultAppIconSizeConfigs(data.defaultAppIconSizeConfigs);
    if (data.hideAllConsists !== undefined) setHideAllConsists(data.hideAllConsists);
    if (data.isCompactLocoPresets !== undefined) setIsCompactLocoPresets(data.isCompactLocoPresets);
    if (data.showRoadNames !== undefined) setShowRoadNames(data.showRoadNames);
    if (data.showLocoColors !== undefined) setShowLocoColors(data.showLocoColors);
    if (data.isBlocksView !== undefined) setIsBlocksView(data.isBlocksView);
    if (data.isCompactThrottle !== undefined) setIsCompactThrottle(data.isCompactThrottle);
    if (data.throttleLayout !== undefined) setThrottleLayout(data.throttleLayout);
    if (data.isSmallPresetsActive !== undefined) setIsSmallPresetsActive(data.isSmallPresetsActive);
    if (data.estopConfigModeMap !== undefined) setEstopConfigModeMap(data.estopConfigModeMap);
    if (data.isCompactFunctions !== undefined) setIsCompactFunctions(data.isCompactFunctions);
    if (data.showLocoFunctionColors !== undefined) setShowLocoFunctionColors(data.showLocoFunctionColors);
    if (data.locoSettings !== undefined) setLocoSettings(data.locoSettings);
    if (data.routeCompactMode !== undefined) setRouteCompactMode(data.routeCompactMode);
    if (data.turnoutCompactMode !== undefined) setTurnoutCompactMode(data.turnoutCompactMode);
    if (data.stopLabelActAsButtonMap !== undefined) setStopLabelActAsButtonMap(data.stopLabelActAsButtonMap);
    if (data.isThickThrottle !== undefined) setIsThickThrottle(data.isThickThrottle);
    if (data.useFunctionGroups !== undefined) setUseFunctionGroups(data.useFunctionGroups);
    if (data.uiDensity !== undefined) setUiDensity(data.uiDensity);
    if (data.uiTheme !== undefined) setUiTheme(data.uiTheme);
    if (data.disablePhotoSwipe !== undefined) setDisablePhotoSwipe(data.disablePhotoSwipe);
    if (data.isLocoAddressMerged !== undefined) setIsLocoAddressMerged(data.isLocoAddressMerged);
    if (data.showAdvancedToggles !== undefined) setShowAdvancedToggles(data.showAdvancedToggles);

    setTourMemorySlot(null);
  };

  const [flashingSlot, setFlashingSlot] = useState<{ id: number, color: string } | null>(null);
  const [pendingMemorySlot, setPendingMemorySlot] = useState<number | null>(null);
  const [pendingMemoryName, setPendingMemoryName] = useState<string>('');
  const [showMemoryOverwriteConfirm, setShowMemoryOverwriteConfirm] = useState(false);
  const [showMemoryClearConfirm, setShowMemoryClearConfirm] = useState(false);
  const [memoryModalMode, setMemoryModalMode] = useState<'clear' | 'replace'>('clear');
  const [showMemoryAutoSaveConfirm, setShowMemoryAutoSaveConfirm] = useState(false);
  const [autoSaveIncludesReset, setAutoSaveIncludesReset] = useState(false);
  const [showMemoryClearSuccess, setShowMemoryClearSuccess] = useState(false);
  const [showMemoryLongPressInfo, setShowMemoryLongPressInfo] = useState(false);
  const memoryHoldTimer = useRef<NodeJS.Timeout | null>(null);

  const saveMemorySlot = (slotId: number, name?: string) => {
    const addr = cabAddress.toString();
    const snapshot = {
      timestamp: Date.now(),
      name: name || '',
      data: {
        customAppIconEnabled,
        customAppIconSizeConfigs,
        defaultAppIconSizeConfigs,
        hideAllConsists,
        isCompactLocoPresets,
        showRoadNames,
        showLocoColors,
        isBlocksView,
        isCompactThrottle,
        throttleLayout,
        isSmallPresetsActive,
        estopConfigModeMap,
        isCompactFunctions,
        showLocoFunctionColors,
        locoSettings,
        routeCompactMode,
        turnoutCompactMode,
        stopLabelActAsButtonMap,
        isThickThrottle,
        useFunctionGroups,
        uiDensity,
        uiTheme,
        disablePhotoSwipe,
        isLocoAddressMerged,
        showAdvancedToggles,
        speedScale
      }
    };

    const newMemory = { ...memorySlots, [slotId]: snapshot };
    setMemorySlots(newMemory);
    localStorage.setItem('dcc_settings_memory', JSON.stringify(newMemory));

    // Flash green
    setFlashingSlot({ id: slotId, color: 'success' });
    setTimeout(() => setFlashingSlot(null), 750);
  };

  const loadMemorySlot = (slotId: number) => {
    const slot = memorySlots[slotId];
    if (!slot || !slot.data) return;

    const { data } = slot;
    
    // Apply all settings from snapshot
    if (data.customAppIconEnabled !== undefined) setCustomAppIconEnabled(data.customAppIconEnabled);
    if (data.customAppIconSizeConfigs !== undefined) setCustomAppIconSizeConfigs(data.customAppIconSizeConfigs);
    if (data.defaultAppIconSizeConfigs !== undefined) setDefaultAppIconSizeConfigs(data.defaultAppIconSizeConfigs);
    if (data.hideAllConsists !== undefined) setHideAllConsists(data.hideAllConsists);
    if (data.isCompactLocoPresets !== undefined) setIsCompactLocoPresets(data.isCompactLocoPresets);
    if (data.showRoadNames !== undefined) setShowRoadNames(data.showRoadNames);
    if (data.showLocoColors !== undefined) setShowLocoColors(data.showLocoColors);
    if (data.isBlocksView !== undefined) setIsBlocksView(data.isBlocksView);
    if (data.isCompactThrottle !== undefined) setIsCompactThrottle(data.isCompactThrottle);
    if (data.throttleLayout !== undefined) setThrottleLayout(data.throttleLayout);
    if (data.isSmallPresetsActive !== undefined) setIsSmallPresetsActive(data.isSmallPresetsActive);
    if (data.estopConfigModeMap !== undefined) setEstopConfigModeMap(data.estopConfigModeMap);
    else if (data.estopConfigMode !== undefined) {
      // Migrate from single value to map
      setEstopConfigModeMap({
        standard: data.estopConfigMode,
        vertical: data.estopConfigMode,
        reversed: data.estopConfigMode
      });
    }
    if (data.isCompactFunctions !== undefined) setIsCompactFunctions(data.isCompactFunctions);
    if (data.showLocoFunctionColors !== undefined) setShowLocoFunctionColors(data.showLocoFunctionColors);
    if (data.locoSettings !== undefined) setLocoSettings(data.locoSettings);
    if (data.routeCompactMode !== undefined) setRouteCompactMode(data.routeCompactMode);
    if (data.turnoutCompactMode !== undefined) setTurnoutCompactMode(data.turnoutCompactMode);
    if (data.stopLabelActAsButtonMap !== undefined) setStopLabelActAsButtonMap(data.stopLabelActAsButtonMap);
    if (data.isThickThrottle !== undefined) setIsThickThrottle(data.isThickThrottle);
    if (data.useFunctionGroups !== undefined) setUseFunctionGroups(data.useFunctionGroups);
    if (data.uiDensity !== undefined) setUiDensity(data.uiDensity);
    if (data.uiTheme !== undefined) setUiTheme(data.uiTheme);
    if (data.disablePhotoSwipe !== undefined) setDisablePhotoSwipe(data.disablePhotoSwipe);
    if (data.isLocoAddressMerged !== undefined) setIsLocoAddressMerged(data.isLocoAddressMerged);
    if (data.showAdvancedToggles !== undefined) setShowAdvancedToggles(data.showAdvancedToggles);
    else if (data.isStopLabelActAsButton !== undefined) {
      // Migrate old single boolean setting to all layouts
      setStopLabelActAsButtonMap({
        standard: data.isStopLabelActAsButton,
        vertical: data.isStopLabelActAsButton,
        reversed: data.isStopLabelActAsButton
      });
    }

    if (data.speedScale !== undefined) {
      setSpeedScale(data.speedScale);
      localStorage.setItem('dcc_speed_scale', data.speedScale);
    } else {
      setSpeedScale('steps');
      localStorage.setItem('dcc_speed_scale', 'steps');
    }

    // Flash blue/info color to indicate load
    setFlashingSlot({ id: slotId, color: 'info' });
    setTimeout(() => setFlashingSlot(null), 750);
    
    // Trigger notification
    triggerMemoryNotification(slotId, slot.timestamp, slot.name);
    
    addLog('info', `Memory Slot ${slotId} Loaded`);
  };

  const clearMemorySlot = (slotId: number) => {
    const newMemory = { ...memorySlots };
    delete newMemory[slotId];
    setMemorySlots(newMemory);
    localStorage.setItem('dcc_settings_memory', JSON.stringify(newMemory));

    // Flash Limon
    setFlashingSlot({ id: slotId, color: 'lemony' });
    setTimeout(() => {
      setFlashingSlot(null);
      setShowMemoryClearSuccess(true);
    }, 750);
  };

  const isMemorySlotMatching = (slotId: number) => {
    if (slotId === 1 && tourMemorySlot1MutedForce && isTourActive) return false;
    if (slotId === 1 && tourMemorySlot1MatchedForce) return true;
    const slot = memorySlots[slotId];
    if (!slot || !slot.data) return false;
    
    const { data } = slot;
    
    // Check all fields saved in saveMemorySlot using JSON.stringify for complex objects
    // and simple comparison for primitives
    return (
      customAppIconEnabled === data.customAppIconEnabled &&
      JSON.stringify(customAppIconSizeConfigs) === JSON.stringify(data.customAppIconSizeConfigs) &&
      JSON.stringify(defaultAppIconSizeConfigs) === JSON.stringify(data.defaultAppIconSizeConfigs) &&
      hideAllConsists === data.hideAllConsists &&
      isCompactLocoPresets === data.isCompactLocoPresets &&
      showRoadNames === data.showRoadNames &&
      showLocoColors === data.showLocoColors &&
      isBlocksView === data.isBlocksView &&
      isCompactThrottle === data.isCompactThrottle &&
      throttleLayout === data.throttleLayout &&
      isSmallPresetsActive === data.isSmallPresetsActive &&
      JSON.stringify(estopConfigModeMap) === JSON.stringify(data.estopConfigModeMap || {}) &&
      isCompactFunctions === data.isCompactFunctions &&
      showLocoFunctionColors === data.showLocoFunctionColors &&
      JSON.stringify(locoSettings) === JSON.stringify(data.locoSettings) &&
      routeCompactMode === data.routeCompactMode &&
      turnoutCompactMode === data.turnoutCompactMode &&
      JSON.stringify(stopLabelActAsButtonMap) === JSON.stringify(data.stopLabelActAsButtonMap) &&
      isThickThrottle === data.isThickThrottle &&
      useFunctionGroups === data.useFunctionGroups &&
      uiDensity === data.uiDensity &&
      uiTheme === data.uiTheme &&
      disablePhotoSwipe === data.disablePhotoSwipe &&
      isLocoAddressMerged === data.isLocoAddressMerged &&
      showAdvancedToggles === data.showAdvancedToggles &&
      speedScale === (data.speedScale || 'steps')
    );
  };

  const handleTurnOffAllCustomSettings = () => {
    const addr = cabAddress.toString();
    setCustomAppIconEnabled(false);
    
    // Determine which icons were active
    const currentIcons = customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
    const resetIcons = { ...currentIcons };
    Object.keys(resetIcons).forEach(k => resetIcons[k] = { ...resetIcons[k], active: true, useTheme: true, large: false });
    
    setCustomAppIconSizeConfigs(resetIcons);
    setDefaultAppIconSizeConfigs(resetIcons);

    setHideAllConsists(true);
    setIsCompactLocoPresets(false);
    setShowRoadNames(false);
    setShowLocoColors(false);
    setIsBlocksView(false);
    setIsCompactThrottle(false);
    setThrottleLayout('standard');
    setIsSmallPresetsActive(false);
    setEstopConfigMode(0);
    setStopLabelActAsButtonMap({ standard: false, vertical: false, reversed: false });
    setIsCompactFunctions(false);
    setShowLocoFunctionColors(false);
    setIsThickThrottle(false);
    setUseFunctionGroups(false);
    setIsLocoAddressMerged(false);
    setShowAdvancedToggles(false);

    setLocoSettings(prev => ({
      ...prev,
      [addr]: { ...prev[addr], showNumbers: true }
    }));
    setRouteCompactMode(0);
    setTurnoutCompactMode(0);
    handleSetSpeedScale('steps');
  };
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addLog('error', 'Icon image too large. Max 2MB.');
        return;
      }
      
      const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCustomAppIcon(result);
        const type = isSvg ? 'svg' : 'image';
        setCustomAppIconType(type);
        localStorage.setItem('dcc_custom_app_icon', result);
        localStorage.setItem('dcc_custom_app_icon_type', type);
        localStorage.setItem('dcc_custom_app_icon_enabled', 'true');
        setShowIconSettingsModal(true);
        addLog('info', `Custom ${type === 'svg' ? 'SVG' : 'image'} icon assembled!`);
      };

      if (isSvg) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
  };

  const handleResetIcon = () => {
    setCustomAppIcon(null);
    setCustomAppIconEnabled(false);
    setCustomAppIconType(null);
    localStorage.setItem('dcc_custom_app_icon', '');
    localStorage.setItem('dcc_custom_app_icon_enabled', 'false');
    addLog('info', 'Application icon set to default.');
  };

  const handleUseCustomIcon = () => {
    const storedIcon = localStorage.getItem('dcc_custom_app_icon');
    const storedType = localStorage.getItem('dcc_custom_app_icon_type') as 'svg' | 'image' | null;
    if (storedIcon) {
      setCustomAppIcon(storedIcon);
      setCustomAppIconEnabled(true);
      setCustomAppIconType(storedType || 'svg');
      
      localStorage.setItem('dcc_custom_app_icon_enabled', 'true');
      addLog('info', 'Switched to previously uploaded custom icon.');
    }
  };

  useEffect(() => {
    localStorage.setItem('dcc_custom_app_icon_enabled', customAppIconEnabled.toString());
  }, [customAppIconEnabled]);

  const updateIconConfig = (part: string, field: 'active' | 'value' | 'useTheme' | 'large', val: any) => {
    if (iconSettingsMode === 'custom') {
      const next = { 
        ...customAppIconSizeConfigs, 
        [part]: { ...customAppIconSizeConfigs[part], [field]: val } 
      };
      setCustomAppIconSizeConfigs(next);
    } else {
      const next = { 
        ...defaultAppIconSizeConfigs, 
        [part]: { ...defaultAppIconSizeConfigs[part], [field]: val } 
      };
      setDefaultAppIconSizeConfigs(next);
    }
  };

  const isThrottleActive = areBlocksJoined || trackBlocks.some(b => b.power && b.state !== 'PROG' && b.state !== 'NONE');

  const getEffectiveIconConfig = (zone: 'header' | 'presets' | 'throttle') => {
    return (customAppIcon && customAppIconEnabled) ? customAppIconSizeConfigs[zone] : defaultAppIconSizeConfigs[zone];
  };
  const [locoInConsistWarning, setLocoInConsistWarning] = useState<{ locoAddr: number, consistId: number, presetIndex?: number } | null>(null);
  const [consistConflictWarning, setConsistConflictWarning] = useState<{ selectedConsistId: number, selectedConsistSpeed: number, conflicts: { locoAddr: number, otherConsistId: number, speed: number }[], individualConflicts?: { locoAddr: number, speed: number }[] } | null>(null);
  const [locoIndividuallyMovingWarning, setLocoIndividuallyMovingWarning] = useState<{ selectedConsistId: number, conflicts: { locoAddr: number, speed: number }[], leadLocoAddr: number } | null>(null);
  const [consistSpeedMismatchWarning, setConsistSpeedMismatchWarning] = useState<{ selectedConsistId: number, consistSpeed: number, locoSpeeds: { locoAddr: number, speed: number }[] } | null>(null);

  const handleToggleBlocksView = () => {
    const nextView = !isBlocksView;
    if (nextView) {
      // Switching to blocks view
      setIsBlocksView(true);
    } else {
      // Switching back to unified view
      // If the only blocks that have power at the time are PROG or NONE blocks, turn the power to all blocks off. Otherwise turn the power to all blocks on.
      if (!areBlocksJoined) {
        const poweredBlocks = trackBlocks.filter(b => b.power);
        const onlyProgOrNonePowered = poweredBlocks.every(b => b.state === 'PROG' || b.state === 'NONE');
        
        const nextGlobalPower = !onlyProgOrNonePowered;
        
        const wasOff = !trackPower;
        // Apply new global power
        setTrackPower(nextGlobalPower);
        if (nextGlobalPower && wasOff && activeConsistId !== null) {
          checkConsistSpeedOnPowerOn(activeConsistId);
        }
        sendCommand(nextGlobalPower ? '1' : '0');
        
        // Update all blocks to nextGlobalPower
        setTrackBlocks(prev => prev.map(b => {
          powerStatesRef.current[b.letter] = nextGlobalPower;
          return { ...b, power: nextGlobalPower };
        }));
      }
      
      setIsBlocksView(false);
    }
    // Request track status to be sure
    setTrackBlocks([]);
    setTimeout(() => sendCommand(' = '), 200);
  };
  
  const navigatePresets = useCallback((direction: 'next' | 'prev') => {
    navigatingPresetsRef.current = true;
    const sortedIndices = getSortedIndices();
    const visibleIndices = sortedIndices.slice(0, visiblePresetsCount);
    
    const validAddresses: string[] = [];
    const validIndices: (number | null)[] = [];
    let activePos = -1;
    
    visibleIndices.forEach(idx => {
      const addr = presets[idx]?.toString() || '';
      if (addr !== '') {
        if (idx === activePresetIndex) {
          activePos = validAddresses.length;
        }
        validAddresses.push(addr);
        validIndices.push(idx);
      }
    });

    // Add secret preset to the list if it exists and isn't already a visible preset
    const secretAddrStr = secretPreset?.toString() || '';
    if (secretAddrStr !== '' && !validAddresses.includes(secretAddrStr)) {
      validAddresses.push(secretAddrStr);
      validIndices.push(null);
    }

    if (validAddresses.length === 0) return;

    // Check if we have a remembered preset index that triggered this navigation before
    if (lastTriggeredPresetIndexRef.current !== null) {
      const idxInValid = validIndices.indexOf(lastTriggeredPresetIndexRef.current);
      if (idxInValid !== -1) {
        activePos = idxInValid;
      }
    }

    // Fallback to address search if activePos is -1 (e.g. manual entry or secret preset selected)
    if (activePos === -1) {
      activePos = validAddresses.indexOf(cabAddress.toString());
    }

    let nextIndex;
    if (activePos === -1) {
      nextIndex = direction === 'next' ? 0 : validAddresses.length - 1;
    } else {
      if (direction === 'next') {
        nextIndex = (activePos + 1) % validAddresses.length;
      } else {
        nextIndex = (activePos - 1 + validAddresses.length) % validAddresses.length;
      }
    }

    const nextAddr = validAddresses[nextIndex];
    const nextPresetIdx = validIndices[nextIndex];

    let consistMotionMatched = false;
    if (nextAddr !== '' && !isConsistSetupMode) {
      const addrNum = parseInt(nextAddr) || 0;
      const matchedConsist = consistsRef.current.find(c => 
        c.locos.some(l => l.address === addrNum) && (consistSpeedsRef.current[c.id] || 0) > 0
      );
      
      if (matchedConsist) {
        const consistSpeed = consistSpeedsRef.current[matchedConsist.id] || 0;
        if (consistSpeed > 0) {
          consistMotionMatched = true;
          
          handleConsistPresetClick(matchedConsist.id);
          
          // Remember which preset index triggered this
          lastTriggeredPresetIndexRef.current = nextPresetIdx;
        }
      }
    }

    if (!consistMotionMatched) {
      setActivePresetIndex(nextPresetIdx);
      setCabAddress(nextAddr);
      setPendingCabAddress(nextAddr);
      setIsEditingAddress(false);
      if (!isConsistSetupMode) {
        setActiveConsistId(null);
        setSelectedConsistId(null);
      }
      // Reset remembered index because we completed a clean preset selection
      lastTriggeredPresetIndexRef.current = null;
    }

    setTimeout(() => {
      navigatingPresetsRef.current = false;
    }, 0);
  }, [getSortedIndices, visiblePresetsCount, presets, cabAddress, isConsistSetupMode, secretPreset, activePresetIndex, consists]);

  const handleAddressSubmit = useCallback((finalAddr: string) => {
    const changed = finalAddr !== cabAddress.toString();
    
    if (changed && finalAddr !== '') {
      const sortedIndices = getSortedIndices();
      const visibleIndices = sortedIndices.slice(0, visiblePresetsCount);
      const visibleAddresses = visibleIndices.map(idx => {
        return presets[idx]?.toString() || '';
      }).filter(a => a !== '');
      
      const isPreset = visibleAddresses.includes(finalAddr.toString());
      
      if (!isPreset) {
        setSecretPreset(finalAddr);
      }
    }

    let consistMotionMatched = false;
    if (finalAddr !== '' && !isConsistSetupMode) {
      const addrNum = parseInt(finalAddr) || 0;
      const matchedConsist = consistsRef.current.find(c => 
        c.locos.some(l => l.address === addrNum) && (consistSpeedsRef.current[c.id] || 0) > 0
      );
      
      if (matchedConsist) {
        const consistSpeed = consistSpeedsRef.current[matchedConsist.id] || 0;
        if (consistSpeed > 0) {
          consistMotionMatched = true;
          handleConsistPresetClick(matchedConsist.id);
        }
      }
    }

    if (!consistMotionMatched) {
      setActivePresetIndex(null);
      setCabAddress(finalAddr);
      setPendingCabAddress(finalAddr);
      if (!isConsistSetupMode && changed) {
        setActiveConsistId(null);
        setSelectedConsistId(null);
      }
    }
    setIsEditingAddress(false);
  }, [cabAddress, getSortedIndices, visiblePresetsCount, presets, isConsistSetupMode]);

  useEffect(() => {
    localStorage.setItem('dcc_is_blocks_view', isBlocksView.toString());
    localStorage.setItem('dcc_track_blocks', JSON.stringify(trackBlocks));
  }, [isBlocksView, trackBlocks]);
  useEffect(() => {
    if (isConsistSetupMode && selectedConsistId !== null) {
      const consist = consists.find(c => c.id === selectedConsistId);
      if (consist && consist.locos.length > 0) {
        const leadLoco = consist.locos[0];
        const leadAddr = leadLoco.address;
        const leadDir = !leadLoco.isReverse;
        if (cabAddress !== leadAddr || isForward !== leadDir) {
          setCabAddress(leadAddr);
          setPendingCabAddress(leadAddr);
          setIsForward(leadDir);
        }
      } else {
        if (cabAddress !== '') {
          setCabAddress('');
          setPendingCabAddress('');
        }
      }
    }
  }, [isConsistSetupMode, selectedConsistId, consists, cabAddress, isForward]);

  // Sync loco settings when cab address changes
  useEffect(() => {
    const addrStr = cabAddress.toString();
    if (addrStr === '') {
      setFunctions({});
      return;
    }
    
    if (locoSettings[addrStr]) {
      setThrottleMode(locoSettings[addrStr].mode);
      setSwitchingOrientation(locoSettings[addrStr].orientation);
    } else {
      // If no settings for this loco, save current ones as initial
      setLocoSettings(prev => ({
        ...prev,
        [addrStr]: { mode: throttleMode, orientation: switchingOrientation }
      }));
    }

    // Sync functions
    setFunctions(allLocoFunctions[getDccAddress(addrStr).toString()] || {});
  }, [cabAddress, locoSettings, allLocoFunctions]);

  const handleConsistPresetClick = (id: number, bypassWarning = false, syncTargetSpeed?: number) => {
    if (isConsistSetupMode) {
      setSelectedConsistId(id);
      // Mark as visible when selected in setup mode
      setConsists(prev => prev.map(c => c.id === id ? { ...c, isVisible: true } : c));
    } else {
      if (!bypassWarning && activeConsistId !== id) {
        const selectedConsist = consistsRef.current.find(c => c.id === id);
        if (selectedConsist) {
           const conflicts: { locoAddr: number, otherConsistId: number, speed: number }[] = [];
           selectedConsist.locos.forEach(l => {
              const otherMovingConsist = consistsRef.current.find(c =>
                 c.id !== id &&
                 c.locos.some(otherL => otherL.address === l.address) &&
                 (consistSpeedsRef.current[c.id] || 0) > 0
              );
              if (otherMovingConsist) {
                 const speed = allLocoSpeedsRef.current[getDccAddress(l.address)] || 0;
                 conflicts.push({ locoAddr: l.address, otherConsistId: otherMovingConsist.id, speed });
              }
           });
           if (conflicts.length > 0) {
              const individualConflicts: { locoAddr: number, speed: number }[] = [];
              selectedConsist.locos.forEach(l => {
                 if (!conflicts.some(c => c.locoAddr === l.address)) {
                    const s = allLocoSpeedsRef.current[getDccAddress(l.address)] || 0;
                    if (s > 0) {
                       individualConflicts.push({ locoAddr: l.address, speed: s });
                    }
                 }
              });
              setConsistConflictWarning({ 
                selectedConsistId: id, 
                selectedConsistSpeed: consistSpeedsRef.current[id] || 0,
                conflicts, 
                individualConflicts: individualConflicts.length > 0 ? individualConflicts : undefined 
              });
              return;
           }

           if ((consistSpeedsRef.current[id] || 0) === 0) {
             const indivConflicts: { locoAddr: number, speed: number }[] = [];
             let hasMoving = false;
             selectedConsist.locos.forEach(l => {
               const s = allLocoSpeedsRef.current[getDccAddress(l.address)] || 0;
               if (s > 0) hasMoving = true;
               indivConflicts.push({ locoAddr: l.address, speed: s });
             });
             if (hasMoving) {
               setLocoIndividuallyMovingWarning({
                 selectedConsistId: id,
                 conflicts: indivConflicts,
                 leadLocoAddr: selectedConsist.locos[0]?.address || 3
               });
               return;
             }
           } else {
             const consistSpeed = consistSpeedsRef.current[id] || 0;
             const locoSpeeds: { locoAddr: number, speed: number }[] = [];
             let hasMismatch = false;
             selectedConsist.locos.forEach(l => {
               const s = allLocoSpeedsRef.current[getDccAddress(l.address)] || 0;
               if (s !== consistSpeed) hasMismatch = true;
               locoSpeeds.push({ locoAddr: l.address, speed: s });
             });
             if (hasMismatch) {
               setConsistSpeedMismatchWarning({
                 selectedConsistId: id,
                 consistSpeed,
                 locoSpeeds
               });
               return;
             }
           }
        }
      }

      if (activeConsistId === id) {
        // Permanently toggle consist orientation
        setConsists(prev => prev.map(c => {
          if (c.id !== id) return c;
          if (c.locos.length === 0) return c;
          
          const flippedLocos = [...c.locos].reverse().map(l => ({
             ...l,
             isReverse: !l.isReverse
          }));
          
          return { ...c, locos: flippedLocos, isFlipped: !c.isFlipped };
        }));

        // After setting state, we need to refresh the cab address and direction
        const consist = consists.find(c => c.id === id);
        if (consist && consist.locos.length > 0) {
          const flippedLocos = [...consist.locos].reverse().map(l => ({ ...l, isReverse: !l.isReverse }));
          const newLead = flippedLocos[0];
          setCabAddress(newLead.address);
          setPendingCabAddress(newLead.address);
          const pIndex = presets.findIndex(p => p.toString() === newLead.address.toString());
          setActivePresetIndex(pIndex !== -1 && pIndex < visiblePresetsCount ? pIndex : null);
          
          // Re-send throttle command for the flipped consist if moving
          const newDir = !newLead.isReverse;
          const consistSpeed = consistSpeedsRef.current[id] || 0;
          if (consistSpeed > 0) {
            // Need to manually send commands for all locos because setConsists is async
            const consistDir = newLead.isReverse ? !newDir : newDir;
            flippedLocos.forEach(l => {
              const actualDir = consistDir ? (l.isReverse ? 0 : 1) : (l.isReverse ? 1 : 0);
              sendCommand(`t 1 ${getDccAddress(l.address)} ${consistSpeed} ${actualDir}`);
            });
          }
          setIsForward(newDir);
          
          setActiveConsistTempReverse(false);
        }
      } else {
        setActiveConsistId(id);
        setActiveConsistTempReverse(false);
        const consist = consists.find(c => c.id === id);
        if (consist && consist.locos.length > 0) {
          const leadLoco = consist.locos[0];
          setCabAddress(leadLoco.address);
          setPendingCabAddress(leadLoco.address);
          const pIndex = presets.findIndex(p => p.toString() === leadLoco.address.toString());
          setActivePresetIndex(pIndex !== -1 && pIndex < visiblePresetsCount ? pIndex : null);
          setIsForward(!leadLoco.isReverse);
          
          if (syncTargetSpeed !== undefined) {
             consistSpeedsRef.current[id] = syncTargetSpeed;
             setSpeed(syncTargetSpeed);
             const consistDir = true; // By default, selecting a consist makes it go Forward relative to its setup
             consist.locos.forEach(l => {
               const actualDir = consistDir ? (l.isReverse ? 0 : 1) : (l.isReverse ? 1 : 0);
               sendCommand(`t 1 ${getDccAddress(l.address)} ${syncTargetSpeed} ${actualDir}`);
             });
             lastThrottleCommandTimeRef.current = Date.now();
          } else {
             const consistSpeed = consistSpeedsRef.current[id] || 0;
             setSpeed(consistSpeed);
          }
        }
      }
    }
  };

  const checkConsistSpeedOnPowerOn = (consistId: number) => {
    const consist = consistsRef.current.find(c => c.id === consistId);
    if (!consist) return;
    
    const consistSpeed = consistSpeedsRef.current[consistId] || 0;
    const locoSpeeds: { locoAddr: number, speed: number }[] = [];
    let hasMismatch = false;
    
    consist.locos.forEach(l => {
      const s = allLocoSpeedsRef.current[getDccAddress(l.address)] || 0;
      if (s !== consistSpeed) hasMismatch = true;
      locoSpeeds.push({ locoAddr: l.address, speed: s });
    });
    
    if (hasMismatch) {
      setConsistSpeedMismatchWarning({
        selectedConsistId: consistId,
        consistSpeed,
        locoSpeeds
      });
    } else {
      setSpeed(consistSpeed);
    }
  };

  const toggleLocoInConsist = (locoAddr: number, cabAddress: string | number) => {
    if (!selectedConsistId) return;
    
    setConsists(prev => prev.map(c => {
      if (c.id !== selectedConsistId) return c;
      
      const existingIndex = c.locos.findIndex(l => l.address === locoAddr);
      if (existingIndex === -1) {
        // Add new
        return { ...c, locos: [...c.locos, { address: locoAddr, cabAddress: cabAddress, isReverse: false }] };
      } else {
        // Toggle direction
        const newLocos = [...c.locos];
        newLocos[existingIndex] = { ...newLocos[existingIndex], isReverse: !newLocos[existingIndex].isReverse };
        return { ...c, locos: newLocos };
      }
    }));
  };

  const removeLocoFromConsist = (locoAddr: number) => {
    if (!selectedConsistId) return;
    setConsists(prev => prev.map(c => {
      if (c.id !== selectedConsistId) return c;
      return { ...c, locos: c.locos.filter(l => l.address !== locoAddr) };
    }));
  };

  const clearConsist = (id: number) => {
    setConsists(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, locos: [], isVisible: false, isFlipped: false };
    }));
    if (activeConsistId === id) setActiveConsistId(null);
  };

  const reverseConsistOrder = (id: number) => {
    setConsists(prev => prev.map(c => {
      if (c.id !== id) return c;
      // Reverse order and flip relative directions
      const reversedLocos = [...c.locos].reverse().map(l => ({
        ...l,
        isReverse: !l.isReverse
      }));
      return { ...c, locos: reversedLocos, isFlipped: !c.isFlipped };
    }));
  };

  const moveConsistPreset = (id: number, direction: 'up' | 'down') => {
    setConsists(prev => {
      const index = prev.findIndex(c => c.id === id);
      if (index === -1) return prev;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newConsists = [...prev];
      const current = { ...newConsists[index] };
      const target = { ...newConsists[newIndex] };
      
      // Swap locos and isVisible, but keep the IDs of the slots
      newConsists[index] = { ...current, locos: target.locos, isVisible: target.isVisible };
      newConsists[newIndex] = { ...target, locos: current.locos, isVisible: current.isVisible };
      
      // Update selection if we are moving the selected one
      if (selectedConsistId === id) {
        setSelectedConsistId(newConsists[newIndex].id);
      } else if (selectedConsistId === target.id) {
        setSelectedConsistId(newConsists[index].id);
      }
      
      return newConsists;
    });
  };

  const handleAddPresets = () => {
    if (visiblePresetsCount < maxPresets) {
      setVisiblePresetsCount(prev => {
        const next = Math.min(maxPresets, prev + 1);
        return next;
      });
    }
  };

  const handleRemovePresets = () => {
    if (visiblePresetsCount > 1) {
      setVisiblePresetsCount(prev => {
        const next = Math.max(1, prev - 1);
        return next;
      });
    }
  };

  const editingPresetValue = useRef<number | string | null>(null);
  const longPressRemovalRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showInlinePicker, setShowInlinePicker] = useState(false);
  const LOCO_PRESET_COLORS = [
    '#f87171', '#ef4444', '#b91c1c', '#7f1d1d', // Reds
    '#fb923c', '#f97316', '#c2410c', '#7c2d12', // Oranges
    '#fbbf24', '#f59e0b', '#b45309', '#78350f', // Ambers/Yellows
    '#4ade80', '#22c55e', '#15803d', '#064e3b', // Greens
    '#60a5fa', '#3b82f6', '#1d4ed8', '#1e3a8a', // Blues
    '#a78bfa', '#8b5cf6', '#6d28d9', '#4c1d95', // Purples
    '#94a3b8', '#64748b', '#334155', '#0f172a', // Grays/Slate
    '#a8a29e', '#78716c', '#44403c', '#1c1917'  // Stones/Earth
  ];

  // Global Error Handling
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      addLog('error', `Uncaught Error: ${event.message}`);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog('error', `Unhandled Rejection: ${event.reason}`);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addLog]);

  useEffect(() => {
    if (!('serial' in navigator)) {
      setIsSerialSupported(false);
      setConnectionMode('wifi');
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const currentCab = cabAddressRef.current;
    if (file && currentCab) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setLocoImages(prev => {
            const next = {
              ...prev,
              [currentCab.toString()]: base64String
            };
            safeSetItem('dcc_loco_images', JSON.stringify(next));
            return next;
          });
        };
        reader.onerror = () => {
          addLog('error', 'Failed to read image file');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        addLog('error', `Image upload error: ${err}`);
      }
    }
  };

  const handleRemoveImage = () => {
    const currentCab = cabAddress.toString();
    if (currentCab) {
      setLocoImages(prev => {
        const next = { ...prev };
        delete next[currentCab];
        safeSetItem('dcc_loco_images', JSON.stringify(next));
        return next;
      });
    }
  };

  const handleSetPlaceholder = (type: 'steam' | 'diesel') => {
    const currentCab = cabAddress.toString();
    if (currentCab) {
      setLocoPlaceholders(prev => {
        const current = prev[currentCab];
        const next = { ...prev };
        if (current === type) {
          delete next[currentCab];
        } else {
          next[currentCab] = type;
        }
        return next;
      });
    }
  };

  const moveCustomOrder = (currentIndex: number, direction: 'up' | 'down') => {
    const sortedIndices = getSortedIndices();
    const newOrder = [...sortedIndices];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < maxPresets) {
      [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
      setCustomPresetOrder(newOrder);
      localStorage.setItem('dcc_custom_preset_order', JSON.stringify(newOrder));
      
      // When moving manually, we always switch to 'custom' baseline
      if (locoSortMode !== 'custom') {
        setLocoSortMode('custom');
        setPrevLocoSortMode('custom');
        localStorage.setItem('dcc_loco_sort_mode', 'custom');
        localStorage.setItem('dcc_prev_loco_sort_mode', 'custom');
        addLog('info', 'Switched to custom sort order.');
      }
    }
  };

  const handleExportConfig = () => {
    const config = {
      presets,
      maxPresets,
      visiblePresetsCount,
      locoImages,
      locoFunctionConfigs,
      locoFunctionGroups,
      enabledFunctionGroups,
      userGroupNames,
      activeFunctionGroupId,
      useFunctionGroups,
      rememberedGroups,
      speedStepIncrement,
      throttleMode,
      switchingOrientation,
      connectionMode,
      wifiHost,
      wifiPort,
      locoSettings,
      consists,
      hideAllConsists,
      allLocoFunctions,
      locoRoadNames,
      showRoadNames,
      locoSortMode,
      locoSortDirection,
      locoIdSortDirection,
      prevLocoSortMode,
      locoIncludedInSort,
      customPresetOrder,
      locoColors,
      locoOpacity,
      locoAccentColors,
      locoAccentOpacity,
      showLocoColors,
      uiTheme,
      uiDensity,
      customAppIcon: localStorage.getItem('dcc_custom_app_icon'),
      customAppIconType,
      customAppIconSizeConfigs,
      customAppIconEnabled: localStorage.getItem('dcc_custom_app_icon_enabled') !== 'false',
      memorySlots,
      locoPlaceholders,
      version: '1.2.1',
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    a.download = `DriverD_throttle_config_${yy}-${mm}-${dd}_${hh}${min}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('info', 'Configuration exported successfully.');
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const config = JSON.parse(reader.result as string);
          if (config.presets) {
            setPresets(config.presets);
          }
          if (config.maxPresets) {
            setMaxPresets(config.maxPresets);
          }
          if (config.visiblePresetsCount) {
            setVisiblePresetsCount(config.visiblePresetsCount);
          }
          if (config.locoImages) {
            setLocoImages(config.locoImages);
            safeSetItem('dcc_loco_images', JSON.stringify(config.locoImages));
          }
          if (config.locoFunctionConfigs) {
            setLocoFunctionConfigs(config.locoFunctionConfigs);
            safeSetItem('dcc_loco_functions', JSON.stringify(config.locoFunctionConfigs));
          }
          if (config.locoFunctionGroups) {
            setLocoFunctionGroups(config.locoFunctionGroups);
            safeSetItem('dcc_loco_function_groups', JSON.stringify(config.locoFunctionGroups));
          }
          if (config.enabledFunctionGroups) {
            setEnabledFunctionGroups(config.enabledFunctionGroups);
            safeSetItem('dcc_enabled_function_groups', JSON.stringify(config.enabledFunctionGroups));
          }
          if (config.userGroupNames) {
            setUserGroupNames(config.userGroupNames);
            safeSetItem('dcc_user_group_names', JSON.stringify(config.userGroupNames));
          }
          if (config.activeFunctionGroupId) {
            setActiveFunctionGroupId(config.activeFunctionGroupId);
            safeSetItem('dcc_active_function_group_id', JSON.stringify(config.activeFunctionGroupId));
          }
          if (config.useFunctionGroups !== undefined) {
            setUseFunctionGroups(config.useFunctionGroups);
            safeSetItem('dcc_use_function_groups', config.useFunctionGroups.toString());
          }
          if (config.rememberedGroups) {
            setRememberedGroups(config.rememberedGroups);
            safeSetItem('dcc_remembered_groups', JSON.stringify(config.rememberedGroups));
          }
          if (config.locoPlaceholders) {
            setLocoPlaceholders(config.locoPlaceholders);
            safeSetItem('dcc_loco_placeholders', JSON.stringify(config.locoPlaceholders));
          }
          if (config.speedStepIncrement) {
            setSpeedStepIncrement(config.speedStepIncrement);
            safeSetItem('dcc_speed_step_increment', config.speedStepIncrement.toString());
          }
          if (config.throttleMode) {
            setThrottleMode(config.throttleMode);
            safeSetItem('dcc_throttle_mode', config.throttleMode);
          }
          if (config.switchingOrientation) {
            setSwitchingOrientation(config.switchingOrientation);
            safeSetItem('dcc_switching_orientation', config.switchingOrientation);
          }
          if (config.connectionMode) {
            setConnectionMode(config.connectionMode);
            safeSetItem('dcc_connection_mode', config.connectionMode);
          }
          if (config.wifiHost) {
            setWifiHost(config.wifiHost);
            safeSetItem('dcc_wifi_host', config.wifiHost);
          }
          if (config.wifiPort) {
            setWifiPort(config.wifiPort);
            safeSetItem('dcc_wifi_port', config.wifiPort.toString());
          }
          if (config.locoSettings) {
            setLocoSettings(config.locoSettings);
            safeSetItem('dcc_loco_settings', JSON.stringify(config.locoSettings));
          }
          if (config.consists) {
            setConsists(config.consists);
            safeSetItem('dcc_consists', JSON.stringify(config.consists));
          }
          if (config.hideAllConsists !== undefined) {
            setHideAllConsists(config.hideAllConsists);
            safeSetItem('dcc_hide_all_consists', JSON.stringify(config.hideAllConsists));
          }
          if (config.allLocoFunctions) {
            setAllLocoFunctions(config.allLocoFunctions);
            safeSetItem('dcc_all_loco_functions', JSON.stringify(config.allLocoFunctions));
          }
          if (config.locoRoadNames) {
            setLocoRoadNames(config.locoRoadNames);
            safeSetItem('dcc_loco_road_names', JSON.stringify(config.locoRoadNames));
          }
          if (config.showRoadNames !== undefined) {
            setShowRoadNames(config.showRoadNames);
            safeSetItem('dcc_show_road_names', config.showRoadNames.toString());
          }
          if (config.locoSortMode) {
            setLocoSortMode(config.locoSortMode);
            safeSetItem('dcc_loco_sort_mode', config.locoSortMode);
          }
          if (config.locoSortDirection) {
            setLocoSortDirection(config.locoSortDirection);
            safeSetItem('dcc_loco_sort_direction', config.locoSortDirection);
          }
          if (config.locoIdSortDirection) {
            setLocoIdSortDirection(config.locoIdSortDirection);
            safeSetItem('dcc_loco_id_sort_direction', config.locoIdSortDirection);
          }
          if (config.prevLocoSortMode) {
            setPrevLocoSortMode(config.prevLocoSortMode);
            safeSetItem('dcc_prev_loco_sort_mode', config.prevLocoSortMode);
          }
          if (config.locoIncludedInSort) {
            setLocoIncludedInSort(config.locoIncludedInSort);
            safeSetItem('dcc_loco_included_in_sort', JSON.stringify(config.locoIncludedInSort));
          }
          if (config.customPresetOrder) {
            setCustomPresetOrder(config.customPresetOrder);
            safeSetItem('dcc_custom_preset_order', JSON.stringify(config.customPresetOrder));
          }
          if (config.locoColors) {
            setLocoColors(config.locoColors);
            safeSetItem('dcc_loco_colors', JSON.stringify(config.locoColors));
          }
          if (config.locoOpacity) {
            setLocoOpacity(config.locoOpacity);
            safeSetItem('dcc_loco_opacity', JSON.stringify(config.locoOpacity));
          }
          if (config.locoAccentColors) {
            setLocoAccentColors(config.locoAccentColors);
            safeSetItem('dcc_loco_accent_colors', JSON.stringify(config.locoAccentColors));
          }
          if (config.locoAccentOpacity) {
            setLocoAccentOpacity(config.locoAccentOpacity);
            safeSetItem('dcc_loco_accent_opacity', JSON.stringify(config.locoAccentOpacity));
          }
          if (config.showLocoColors !== undefined) {
            setShowLocoColors(config.showLocoColors);
            safeSetItem('dcc_show_loco_colors', config.showLocoColors.toString());
          }
          if (config.uiTheme) {
            setUiTheme(config.uiTheme);
            safeSetItem('dcc_ui_theme', config.uiTheme);
          }
          if (config.uiDensity !== undefined) {
            let d = config.uiDensity;
            if (d === 'standard') d = 0;
            else if (d === 'compact') d = 1;
            else d = parseInt(d) || 0;
            setUiDensity(d);
            safeSetItem('dcc_ui_density', d.toString());
          }

          if (config.customAppIcon !== undefined) {
            safeSetItem('dcc_custom_app_icon', config.customAppIcon || '');
          }
          if (config.customAppIconType) {
            setCustomAppIconType(config.customAppIconType);
            safeSetItem('dcc_custom_app_icon_type', config.customAppIconType);
          }
          if (config.customAppIconSizeConfigs) {
            setCustomAppIconSizeConfigs(config.customAppIconSizeConfigs);
            safeSetItem('dcc_custom_app_icon_size_configs', JSON.stringify(config.customAppIconSizeConfigs));
          }
          if (config.customAppIconEnabled !== undefined) {
            safeSetItem('dcc_custom_app_icon_enabled', config.customAppIconEnabled.toString());
          }

          if (config.memorySlots) {
            setMemorySlots(config.memorySlots);
            safeSetItem('dcc_settings_memory', JSON.stringify(config.memorySlots));
          }
          
          addLog('info', 'Configuration imported successfully.');
          setTimeout(() => window.location.reload(), 500); // Small delay to ensure logs are seen
        } catch (err) {
          addLog('error', 'Failed to import configuration: Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const parseDCCMessage = useCallback((cleanPart: string) => {
    // Track Power: <p1> or <p0> (Global)
    if (cleanPart === 'p1') {
      setTrackPower(true);
      setTrackBlocks(prev => prev.map(b => b.state !== 'NONE' ? { ...b, power: true } : b));
    }
    if (cleanPart === 'p0') {
      setTrackPower(false);
      setTrackBlocks(prev => prev.map(b => ({ ...b, power: false })));
    }

    // Per-Block/Named Power: <p1 LETTER/NAME> or <p0 LETTER/NAME>
    // Handles <p1 MAIN>, <p1 PROG>, <p0 MAIN>, <p0 PROG>, <p1 JOIN>, <p1 A>, etc.
    const pBlockMatch = cleanPart.match(/^p([01])\s+(.+)$/i);
    if (pBlockMatch) {
      const isOn = pBlockMatch[1] === '1';
      const target = pBlockMatch[2].toUpperCase();
      
      if (target === 'JOIN') {
        if (isOn) {
          setAreBlocksJoined(true);
          setTrackBlocks(prev => prev.map(b => (b.state === 'MAIN' || b.state === 'PROG') ? { ...b, power: true } : b));
          setTrackPower(true);
        }
      } else if (target === 'MAIN' || target === 'PROG') {
        // Named track power messages imply unjoined state per user request
        setAreBlocksJoined(false);
        setTrackBlocks(prev => {
          const next = prev.map(b => b.state === target ? { ...b, power: isOn } : b);
          return next;
        });
        if (target === 'MAIN') setTrackPower(isOn);
      } else if (target.length === 1) {
        // Single letter block (e.g. <p1 A>)
        // IMPORTANT: <p1 A> does NOT provide indication of joined status
        setTrackBlocks(prev => {
          const next = prev.map(b => b.letter === target ? { ...b, power: isOn } : b);
          const block = next.find(b => b.letter === target);
          
          if (block && block.state === 'MAIN') {
            setTrackPower(isOn);
          }

          return next;
        });
      }
    }

    // Track Manager Status: <= LETTER STATE CAB>
    // Example: <= A MAIN 0>
    if (cleanPart.startsWith('=')) {
      const match = cleanPart.match(/^=\s*([A-H])\s+(.*?)(?:\s+(\d+))?$/);
      if (match) {
        let [_, letter, state, cab] = match;
        const cabNum = cab ? parseInt(cab) : 0;
        
        // Normalize "MAIN A" to "MAIN"
        state = state.trim();
        if (state === 'MAIN A') state = 'MAIN';
        
        setTrackBlocks(prev => {
          const newBlock = { letter, state, cab: cabNum, power: powerStatesRef.current[letter] || false };
          // If this is the first block we've parsed for this sync, replace the list
          // We can use a flag or just clear the list on the first '=' message
          // A better way is to collect all blocks and set the state once
          return [...prev.filter(b => b.letter !== letter), newBlock].sort((a, b) => a.letter.localeCompare(b.letter));
        });
      }
    }

    // Joined Status: <JOINED> or <UNJOINED>
    if (cleanPart === 'JOINED') setAreBlocksJoined(true);
    if (cleanPart === 'UNJOINED') setAreBlocksJoined(false);

    // Throttle Status: <T REGISTER SPEED DIRECTION>
    if (cleanPart.startsWith('T ')) {
      const match = cleanPart.match(/^T\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        const [_, reg, s, d] = match;
        // Only update UI from T messages if NOT in a consist
        // In a consist, multiple locos on the same register cause flickering
        // Also ignore if we just sent a command locally to avoid UI jumping
        const now = Date.now();
        if (parseInt(reg) === 1 && activeConsistIdRef.current === null && (now - lastThrottleCommandTimeRef.current > THROTTLE_SYNC_COOLDOWN)) {
          setSpeed(parseInt(s) || 0);
          setIsForward(parseInt(d) === 1);
        }
      }
    }

    // Loco Status: <l cab reg speedByte functMap>
    if (cleanPart.startsWith('l ')) {
      const match = cleanPart.match(/^l\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)/);
      if (match) {
        const [_, cab, reg, speedByte, functMap] = match;
        const cabNum = parseInt(cab);
        const currentDccAddr = getDccAddress(cabAddressRef.current);
        const sb = parseInt(speedByte);
        const fm = parseInt(functMap);

        // Check for rapid press wait using loco update (verifying specific function state)
        if (waitingForFunctionResponseRef.current && 
            waitingForFunctionResponseRef.current.cab === cab) {
          
          const fnIdx = waitingForFunctionResponseRef.current.fn;
          const expected = waitingForFunctionResponseRef.current.expectedState;
          const actualState = (fm & (1 << fnIdx)) !== 0;

          if (actualState === expected) {
            if (waitingForFunctionResponseRef.current.safetyId) {
              clearTimeout(waitingForFunctionResponseRef.current.safetyId);
            }
            waitingForFunctionResponseRef.current = null;
            
            // Trigger next step
            if (isRapidActiveRef.current) {
              if (functionRapidIntervalRef.current) clearTimeout(functionRapidIntervalRef.current);
              functionRapidIntervalRef.current = setTimeout(() => {
                performRapidToggleRef.current(fnIdx);
              }, 265);
            }
          }
        }

        // Update canonical functions for this loco address
        const newLocoFunctions: Record<number, boolean> = {};
        for (let i = 0; i <= 28; i++) {
          newLocoFunctions[i] = (fm & (1 << i)) !== 0;
        }
        
        setAllLocoFunctions(prev => ({
          ...prev,
          [cabNum.toString()]: newLocoFunctions
        }));

        let parsedSpeed = 0;
        if (sb >= 128) {
          if (sb !== 128 && sb !== 129) {
            parsedSpeed = sb - 129;
          }
        } else {
          if (sb !== 0 && sb !== 1) {
            parsedSpeed = sb - 1;
          }
        }
        allLocoSpeedsRef.current[cabNum] = parsedSpeed;

        // Only update UI speed/direction/functions if this matches lead/current cab address
        if (cabNum === currentDccAddr) {
          const now = Date.now();
          const isCoolingDown = (now - lastThrottleCommandTimeRef.current < THROTTLE_SYNC_COOLDOWN);
          
          let s = 0;
          let d = true;

          if (sb >= 128) {
            d = true;
            if (sb === 128 || sb === 129) {
              s = 0;
              if (sb === 129) setStatusText('EMERGENCY STOP');
            } else {
              s = sb - 129;
            }
          } else {
            d = false;
            if (sb === 0 || sb === 1) {
              s = 0;
              if (sb === 1) setStatusText('EMERGENCY STOP');
            } else {
              s = sb - 1;
            }
          }

          if (!isCoolingDown && activeConsistIdRef.current === null) {
            setSpeed(s);
            setIsForward(d);
          }
          setFunctions(newLocoFunctions);
          
          if (!isCoolingDown && activeConsistIdRef.current === null) {
            addLog('info', `Synced Cab ${cab}: Speed ${s}, Dir ${d ? 'F' : 'R'}`);
          }
        }
      }
    }

    // Route/Automation Status: <ja ID1 ID2 ...> or <ja ID type "desc">
    const lowerPart = cleanPart.toLowerCase();
    if (lowerPart.startsWith('ja')) {
      // Check if it's a detail message: <ja ID type "desc">
      if (cleanPart.includes('"')) {
        const detailMatch = cleanPart.match(/^ja\s+(-?\d+)\s+([RA])\s+"([^"]*)"/i);
        if (detailMatch) {
          const [_, id, type, name] = detailMatch;
          setRoutes(prev => {
            const exists = prev.some(r => r.id === id);
            const description = type === 'R' ? 'Route' : 'Automation';
            if (exists) {
              return prev.map(r => r.id === id ? { id, name, description } : r);
            }
            return [...prev, { id, name, description }].sort((a, b) => parseInt(a.id) - parseInt(b.id));
          });
        }
      } else if (cleanPart.match(/\s+X$/i)) {
        // Fail response: <ja ID X>
        const failMatch = cleanPart.match(/^ja\s+(-?\d+)\s+X/i);
        if (failMatch) {
          const [_, id] = failMatch;
          setAllRouteIds(prev => prev.filter(rid => rid !== id));
        }
      } else {
        // List of IDs: <ja ID1 ID2 ...>
        const parts = cleanPart.split(/\s+/);
        const ids = parts.slice(1).filter(id => /^-?\d+$/.test(id));
        if (ids.length > 0) {
          setAllRouteIds(ids);
          ids.forEach((id, index) => {
            setTimeout(() => {
              if (sendCommandRef.current) sendCommandRef.current(`JA ${id}`);
            }, index * 100);
          });
        }
      }
    }

    // Turnout Status: <jT ID1 ID2 ...> or <jT ID state "desc">
    if (lowerPart.startsWith('jt')) {
      if (cleanPart.includes('"')) {
        const detailMatch = cleanPart.match(/^jt\s+(-?\d+)\s+([CTX])\s+"([^"]*)"/i);
        if (detailMatch) {
          const [_, rawId, state, name] = detailMatch;
          const id = normalizeTurnoutId(rawId);
          setTurnouts(prev => {
            const exists = prev.some(t => t.id === id);
            const s = state.toUpperCase() as 'C' | 'T' | 'X';
            if (exists) {
              return prev.map(t => t.id === id ? { id, name, state: s } : t);
            }
            return [...prev, { id, name, state: s }].sort((a, b) => parseInt(a.id) - parseInt(b.id));
          });
        }
      } else {
        const parts = cleanPart.split(/\s+/);
        const ids = parts.slice(1).filter(id => /^-?\d+$/.test(id)).map(id => normalizeTurnoutId(id));
        if (ids.length > 0) {
          setAllTurnoutIds(ids);
          ids.forEach((id, index) => {
            setTimeout(() => {
              if (sendCommandRef.current) sendCommandRef.current(`JT ${id}`);
            }, index * 100);
          });
        }
      }
    }

    // Turnout Change Confirmation: <H id state>
    if (cleanPart.startsWith('H ')) {
      const match = cleanPart.match(/^H\s+(-?\d+)\s+([01])/);
      if (match) {
        const [_, rawId, state] = match;
        const id = normalizeTurnoutId(rawId);
        const newState = state === '1' ? 'T' : 'C';
        setTurnouts(prev => prev.map(t => t.id === id ? { ...t, state: newState } : t));
      }
    }
    
    // Roster Status: <jR ID1 ID2 ...> or <jR CAB "DESC" "FNLIST">
    if (lowerPart.startsWith('jr')) {
      if (cleanPart.includes('"')) {
        // Detailed response: <jR CAB "DESC" "FNLIST">
        const detailMatch = cleanPart.match(/^jR\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"/i);
        if (detailMatch) {
          const [_, cab, desc, fnList] = detailMatch;
          
          // Parse fnList: "F0 Headlight /F1 Bell //F3 Horn /"
          const segments = fnList.split('/');
          const parsedFunctions: DccExLocoParsedFunction[] = [];
          
          segments.forEach((seg) => {
            const trimmed = seg.trim();
            if (!trimmed) return;
            
            // Format: [*]F[num] [name]
            const fnMatch = trimmed.match(/^(\*)?F(\d+)\s+(.+)$/i);
            if (fnMatch) {
              const [__, star, num, name] = fnMatch;
              parsedFunctions.push({
                number: parseInt(num),
                name: name.trim(),
                isMomentary: !!star
              });
            }
          });

          const details: DccExLocoDetails = {
            address: cab,
            description: desc,
            functions: parsedFunctions
          };
          
          setLocoDetailsCache(prev => ({ ...prev, [cab]: details }));
          
          // Only show modal if we explicitly requested it via button click (not during bulk import)
          if (isWaitingForSpecificLocoDetailsRef.current === cab) {
            setSelectedDccExLocoDetails(details);
            setShowDccExLocoDetailsModal(true);
            isWaitingForSpecificLocoDetailsRef.current = null;
          }
          addLog('info', `Received details for Loco #${cab}: ${desc}`);
        }
      } else {
        const parts = cleanPart.split(/\s+/);
        const ids = parts.slice(1).filter(id => /^\d+$/.test(id));
        if (ids.length > 0) {
          setDccExRoster(ids);
          if (isWaitingForRosterRef.current) {
            setShowDccExRosterModal(true);
            isWaitingForRosterRef.current = false;
          }
          addLog('info', `Identified ${ids.length} locomotives in DCC-EX roster.`);
        } else {
          if (isWaitingForRosterRef.current) {
            setShowDccExRosterModal(true); // Still open so user can see "no locos found"
            isWaitingForRosterRef.current = false;
          }
          addLog('info', 'DCC-EX roster is empty.');
        }
      }
    }
  }, [addLog]);

  // Emulator State
  const emulatorStateRef = useRef({
    power: false,
    locos: {} as Record<string, { speed: number, dir: number, functions: Record<number, boolean> }>,
    turnouts: {
      '10': 0,
      '11': 1
    } as Record<string, number>,
    routes: [
      { id: '1', name: 'Main Loop', description: 'Sets switches for the perimeter' },
      { id: '2', name: 'Siding A', description: 'Access to industrial zone' }
    ],
    turnoutConfigs: [
      { id: '10', name: 'Switch 10', state: 'C' },
      { id: '11', name: 'Switch 11', state: 'T' }
    ],
    blocks: [
      { letter: 'A', state: 'MAIN', cab: 0 },
      { letter: 'B', state: 'PROG', cab: 0 }
    ]
  });

  const processEmulatorCommand = useCallback((cmd: string) => {
    // Standardize command - remove brackets if present
    const cleanCmd = cmd.replace(/[<>]/g, '').trim();
    if (!cleanCmd) return;
    
    const parts = cleanCmd.split(/\s+/);
    const op = parts[0];

    const respond = (msg: string) => {
      addLog('in', `<${msg}>`);
      parseDCCMessageRef.current(msg);
    };

    const getLocoStatusMsg = (cab: string) => {
      const loco = emulatorStateRef.current.locos[cab] || { speed: 0, dir: 1, functions: {} };
      const speed = loco.speed || 0;
      const dir = loco.dir !== undefined ? loco.dir : 1;
      const sb = dir === 1 ? (speed === 0 ? 128 : speed + 129) : (speed === 0 ? 0 : speed + 1);
      let fm = 0;
      const fns = loco.functions || {};
      for (let i = 0; i <= 28; i++) {
        if (fns[i]) fm |= (1 << i);
      }
      return `l ${cab} 0 ${sb} ${fm}`;
    };

    // Simulate small delay like real hardware
    setTimeout(() => {
      switch (op) {
        case '1': // Power ON
          emulatorStateRef.current.power = true;
          if (parts[1]) {
            respond(`p1 ${parts[1]}`);
          } else {
            respond('p1');
          }
          break;
        case '0': // Power OFF
          emulatorStateRef.current.power = false;
          if (parts[1]) {
            respond(`p0 ${parts[1]}`);
          } else {
            respond('p0');
          }
          break;
        case 'T': // Turnout
          if (parts.length >= 3) {
            const id = parts[1];
            const state = parseInt(parts[2]);
            emulatorStateRef.current.turnouts[id] = state;
            respond(`H ${id} ${state}`);
          }
          break;
        case 't': // Throttle
          if (parts.length >= 5) {
            const cab = parts[2];
            const speed = parseInt(parts[3]);
            const dir = parseInt(parts[4]);
            emulatorStateRef.current.locos[cab] = { speed, dir, functions: emulatorStateRef.current.locos[cab]?.functions || {} };
            respond(getLocoStatusMsg(cab));
          } else if (parts.length === 2) {
             // Requesting loco status <t CAB>
             const cab = parts[1];
             respond(getLocoStatusMsg(cab));
          }
          break;
        case 'F': // Functions
          if (parts.length >= 4) {
             const cab = parts[1];
             const fn = parseInt(parts[2]);
             const state = parseInt(parts[3]);
             if (!emulatorStateRef.current.locos[cab]) emulatorStateRef.current.locos[cab] = { speed: 0, dir: 1, functions: {} };
             emulatorStateRef.current.locos[cab].functions[fn] = state === 1;
             respond(getLocoStatusMsg(cab));
          }
          break;
        case 'S': // Status
          respond('iDCC-EX V-V3.2.0 / MEGA / G-8472834');
          respond('v0'); // Placeholder for version
          break;
        case '=': // Track Manager
          emulatorStateRef.current.blocks.forEach(b => {
             respond(`= ${b.letter} ${b.state} ${b.cab}`);
          });
          break;
        case 'JA': // List Routes
          if (parts.length > 1) {
            if (parts[1] === '10') {
              respond('jA 10 A "Roll Out!"');
            } else if (parts[1] === '201') {
              respond('jA 201 A "Spot Cars"');
            } else if (parts[1] === '202') {
              respond('jA 202 A "Switch Cars"');
            } else if (parts[1] === '13101') {
              respond('jA 13101 R "Main Line"');
            } else if (parts[1] === '13102') {
              respond('jA 13102 R "Branch Line"');
            }
          } else {
            respond('jA 10 201 202 13101 13102');
          }
          break;
        case 'JT': // List Turnouts
          emulatorStateRef.current.turnoutConfigs.forEach(t => {
             respond(`jt ${t.id} ${t.state} "${t.name}"`);
          });
          break;
        case 'JR': // List Roster
          if (parts.length > 1 && parts[1] === '3') {
            respond('jR 3 "SC 3" "F0 Headlight /F1 Bell /*F2 Whistle /F3 Short Whistle /F4 Brake/F5 Class Lights //*F7 Chatter /F8 Mute //F10 Half Speed ///////////////////"');
          } else {
            respond('jR 3 643 1234 7623');
          }
          break;
      }
    }, 50);
  }, [addLog]);


  const parseDCCMessageRef = useRef(parseDCCMessage);
  useEffect(() => { parseDCCMessageRef.current = parseDCCMessage; }, [parseDCCMessage]);

  // WiFi Connection Management
  useEffect(() => {
    if (connectionMode !== 'wifi') {
      setIsWifiConnected(false);
    }
  }, [connectionMode]);

  const sendCommand = useCallback(async (cmd: string) => {
    const formattedCmd = cmd.startsWith('<') ? cmd : `<${cmd}>`;
    
    if (connectionModeRef.current === 'serial') {
      if (!writerRef.current) return;
      try {
        await writerRef.current.write(formattedCmd);
        addLog('out', formattedCmd);
      } catch (err) {
        addLog('error', `Serial Send error: ${err}`);
      }
    } else if (connectionModeRef.current === 'wifi') {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && !isBridgeAvailable && isWifiConnectedRef.current) {
        electronAPI.tcpSend(formattedCmd);
        addLog('out', formattedCmd);
        return;
      }

      if (!directWs || directWs.readyState !== WebSocket.OPEN) {
        addLog('error', 'WiFi not connected');
        return;
      }
      directWs.send(formattedCmd);
      addLog('out', formattedCmd);
    } else if (connectionModeRef.current === 'emulator') {
      if (!isEmulatorConnectedRef.current) {
        addLog('error', 'Emulator not connected');
        return;
      }
      addLog('out', formattedCmd);
      processEmulatorCommand(formattedCmd);
    }
  }, [addLog, processEmulatorCommand, isBridgeAvailable, directWs]);

  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  // Route Detail Retry Logic
  useEffect(() => {
    if (!isRoutesView || !areRouteRetriesEnabled || allRouteIds.length === 0) return;

    const timer = setInterval(() => {
      const loadedIds = new Set(routes.map(r => r.id));
      const missingIds = allRouteIds.filter(id => !loadedIds.has(id));

      if (missingIds.length > 0 && sendCommandRef.current) {
        // Only retry a few at a time to avoid flooding, with small delay between
        missingIds.slice(0, 10).forEach((id, index) => {
          setTimeout(() => {
            if (sendCommandRef.current) sendCommandRef.current(`JA ${id}`);
          }, index * 300);
        });
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isRoutesView, allRouteIds, routes, areRouteRetriesEnabled]);

  // Command Handlers
  const togglePower = () => {
    if (areBlocksJoined) {
      setAreBlocksJoined(false);
      sendCommand('0');
      setTrackPower(false);
      setTrackBlocks(prev => prev.map(b => {
        powerStatesRef.current[b.letter] = false;
        return { ...b, power: false };
      }));
      addLog('info', 'Power OFF. Unjoined (local).');
      return;
    }
    const nextPower = !trackPower;
    // <1> and <0> are the standard power commands (global)
    sendCommand(nextPower ? '1' : '0');
    setTrackPower(nextPower);
    
    if (nextPower && activeConsistId !== null) {
      checkConsistSpeedOnPowerOn(activeConsistId);
    }
    
    setTrackBlocks(prev => prev.map(b => {
      // If joined, all blocks are affected. If not joined, only MAIN and PROG are affected.
      if (areBlocksJoined || b.state === 'MAIN' || b.state === 'PROG') {
        powerStatesRef.current[b.letter] = nextPower;
        return { ...b, power: nextPower };
      }
      return b;
    }));
    setStatusText(nextPower ? 'Track Power ON' : 'Track Power OFF');
  };

  const toggleBlockPower = (letter: string) => {
    const block = trackBlocks.find(b => b.letter === letter);
    if (!block) return;

    if (areBlocksJoined && (block.state === 'MAIN' || block.state === 'PROG')) {
      const otherBlock = trackBlocks.find(b => (block.state === 'MAIN' ? b.state === 'PROG' : b.state === 'MAIN'));
      
      if (otherBlock) {
        // Turn off pressed block
        sendCommand(`0 ${block.letter}`);
        // Turn on other block
        sendCommand(`1 ${otherBlock.letter}`);
        // Turn off JOIN (local only)
        setAreBlocksJoined(false);
        
        // Update local state
        setTrackBlocks(prev => prev.map(b => {
          if (b.letter === block.letter) return { ...b, power: false };
          if (b.letter === otherBlock.letter) return { ...b, power: true };
          return b;
        }));
        
        addLog('info', `Switched power: ${block.letter} OFF, ${otherBlock.letter} ON. Unjoined (local).`);
        return;
      }
    }

    const nextPower = !block.power;
    
    powerStatesRef.current[letter] = nextPower;
    sendCommand(`${nextPower ? '1' : '0'} ${letter}`);
    // Local update for immediate feedback
    setTrackBlocks(prev => prev.map(b => b.letter === letter ? { ...b, power: nextPower } : b));
    
    // If we turned on a MAIN block, ensure global trackPower is true
    if (nextPower && block.state.startsWith('MAIN')) {
      const wasGlobalOff = !trackPower;
      setTrackPower(true);
      if (wasGlobalOff && activeConsistId !== null) {
        checkConsistSpeedOnPowerOn(activeConsistId);
      }
    }
  };

  const assignBlock = (letter: string, state: string, cab: number = 0) => {
    // If blocks are joined, unjoin them when changing track type
    if (areBlocksJoined) {
      setAreBlocksJoined(false);
      addLog('info', 'Blocks unjoined due to track type change');
    }

    // <= trackletter mode [cab]>
    // The cab is only included and required when the block type is DC or DC_INV / DCX.
    const isDC = state === 'DC' || state === 'DC_INV' || state === 'DCX';
    const cmd = `= ${letter} ${state}${isDC ? ` ${cab}` : ''}`;
    sendCommand(cmd);
    addLog('info', `Assigning Block ${letter} to ${state}${isDC ? ` (Cab ${cab})` : ''}`);
    
    // Immediate local update for feedback
    setTrackBlocks(prev => prev.map(b => b.letter === letter ? { ...b, state, cab } : b));
    
    setSelectedBlockForEdit(null);
    // Request status to confirm
    setTimeout(() => sendCommand(' = '), 300);
  };

  const toggleJoin = () => {
    if (!areBlocksJoined) {
      // Joining
      const blockMain = trackBlocks.find(b => b.state === 'MAIN');
      const blockProg = trackBlocks.find(b => b.state === 'PROG');
      
      // Save current power state
      setPreJoinState({
        mainPower: blockMain?.power ?? false,
        progPower: blockProg?.power ?? false
      });

      sendCommand('1 JOIN');
      addLog('info', 'Joining blocks');
      setAreBlocksJoined(true);
      
      // Temporarily set display to ON
      setTrackBlocks(prev => prev.map(b => (b.state === 'MAIN' || b.state === 'PROG') ? { ...b, power: true } : b));
    } else {
      // Unjoining
      if (preJoinState) {
        // Restore previous status
        sendCommand(`${preJoinState.mainPower ? '1' : '0'} MAIN`);
        sendCommand(`${preJoinState.progPower ? '1' : '0'} PROG`);
        
        // Update internal registers
        setTrackBlocks(prev => prev.map(b => {
          if (b.state === 'MAIN') return { ...b, power: preJoinState.mainPower };
          if (b.state === 'PROG') return { ...b, power: preJoinState.progPower };
          return b;
        }));
        
        addLog('info', 'Unjoining blocks (Restoring previous status)');
      } else {
        // Fallback
        sendCommand('0 MAIN');
        sendCommand('0 PROG');
        addLog('info', 'Unjoining blocks (Restoring defaults)');
      }
      if (!isBlocksView) {
        const poweredBlocks = trackBlocks.filter(b => b.power);
        const onlyProgOrNonePowered = poweredBlocks.every(b => b.state === 'PROG' || b.state === 'NONE');
        
        const nextGlobalPower = !onlyProgOrNonePowered;
        
        const wasOff = !trackPower;
        // Apply new global power
        setTrackPower(nextGlobalPower);
        if (nextGlobalPower && wasOff && activeConsistId !== null) {
          checkConsistSpeedOnPowerOn(activeConsistId);
        }
        sendCommand(nextGlobalPower ? '1' : '0');
        
        // Update all blocks to nextGlobalPower
        setTrackBlocks(prev => prev.map(b => {
          powerStatesRef.current[b.letter] = nextGlobalPower;
          return { ...b, power: nextGlobalPower };
        }));
      }
      
      sendCommand('0 JOIN');
      setAreBlocksJoined(false);
    }
    // Request status to confirm
    setTimeout(() => sendCommand(' = '), 600);
  };

  const getStationStatus = useCallback(() => {
    // Sync track status
    setTrackBlocks([]); // Clear existing blocks
    sendCommand(' = ');

    // Collect all unique active locomotive addresses
    const activeLocos = new Set<number | string>();
    
    // 1. Current Cab
    if (cabAddressRef.current !== '') {
      activeLocos.add(cabAddressRef.current);
    }
    
    // 2. Active Consist
    if (activeConsistIdRef.current !== null) {
      const consist = consistsRef.current.find(c => c.id === activeConsistIdRef.current);
      if (consist) {
        consist.locos.forEach(l => activeLocos.add(l.address));
      }
    }
    
    // Send <t CAB> for each unique address to query current speed/direction/functions
    activeLocos.forEach(addr => {
      sendCommand(`t ${getDccAddress(addr)}`);
    });

    if (activeLocos.size > 0) {
      addLog('info', `Syncing status for ${activeLocos.size} active locomotives...`);
    } else {
      addLog('info', 'No active locomotives to sync.');
    }
  }, [sendCommand, addLog]);

  const getLocoStatus = useCallback((cab: number | string) => {
    if (cab === '') return;
    // <t CAB> is the command for obtaining the current status of a locomotive
    sendCommand(`t ${getDccAddress(cab)}`);
  }, [sendCommand]);

  const getRoadNameForAddr = useCallback((addr: number | string) => {
    if (addr === '') return '';
    return locoRoadNames[addr.toString()] || '';
  }, [locoRoadNames]);

  const updateThrottle = useCallback((newSpeed: number, newDir: boolean) => {
    if (activeConsistId !== null) {
      consistSpeedsRef.current[activeConsistId] = newSpeed;
      const consist = consists.find(c => c.id === activeConsistId);
      if (consist) {
        const locosToControl = activeConsistTempReverse 
          ? [...consist.locos].reverse().map(l => ({ ...l, isReverse: !l.isReverse })) 
          : consist.locos;
        
        const leadLoco = locosToControl[0];
        // newDir is the desired direction for the lead loco
        // consistDir is the direction the consist must move to achieve newDir for lead loco
        const consistDir = leadLoco.isReverse ? !newDir : newDir;

        locosToControl.forEach(l => {
          const actualDir = consistDir ? (l.isReverse ? 0 : 1) : (l.isReverse ? 1 : 0);
          sendCommand(`t 1 ${getDccAddress(l.address)} ${newSpeed} ${actualDir}`);
        });
        lastThrottleCommandTimeRef.current = Date.now();
        setSpeed(newSpeed);
        setIsForward(newDir); // UI shows lead loco direction
        setStatusText(`Consist ${activeConsistId}: Speed ${newSpeed}, Lead Loco ${newDir ? 'Forward' : 'Reverse'}`);
        return;
      }
    }

    const currentCab = cabAddressRef.current;
    if (currentCab === '') return;
    // <t REGISTER CAB SPEED DIRECTION> - 't' must be lowercase
    // Register 1 is commonly used for active throttle
    sendCommand(`t 1 ${getDccAddress(currentCab)} ${newSpeed} ${newDir ? 1 : 0}`);
    lastThrottleCommandTimeRef.current = Date.now();
    setSpeed(newSpeed);
    setIsForward(newDir);
    setStatusText(`Loco ${getDisplayAddress(currentCab)}: Speed ${newSpeed}, ${newDir ? 'Forward' : 'Reverse'}`);
  }, [sendCommand, activeConsistId, consists, activeConsistTempReverse]);

  const handleSwitchingThrottleChange = useCallback((val: number) => {
    let newDisplaySpeed = Math.abs(val);
    let newDir = isForwardRef.current;

    if (val === 0) {
      newDisplaySpeed = 0;
    } else if (switchingOrientationRef.current === 'forward-right') {
      newDir = val > 0;
    } else {
      newDir = val < 0;
    }

    updateThrottle(getInternalSpeed(newDisplaySpeed), newDir);
  }, [updateThrottle, getInternalSpeed]);

  const handleThrottleHorizontalLeft = useCallback((amount: number) => {
    const displayMax = getDisplayMaxSpeed();
    if (throttleModeRef.current === 'standard') {
      const orientationMultiplier = switchingOrientationRef.current === 'forward-right' ? 1 : -1;
      const increment = -amount * orientationMultiplier;
      const currentDisplay = getDisplaySpeed(speedRef.current);
      const nextDisplaySpeed = Math.max(0, Math.min(displayMax, currentDisplay + increment));
      updateThrottle(getInternalSpeed(nextDisplaySpeed), isForwardRef.current);
    } else {
      const currentDisplayVal = isForwardRef.current 
        ? (switchingOrientationRef.current === 'forward-right' ? getDisplaySpeed(speedRef.current) : -getDisplaySpeed(speedRef.current))
        : (switchingOrientationRef.current === 'forward-right' ? -getDisplaySpeed(speedRef.current) : getDisplaySpeed(speedRef.current));
      const nextDisplayVal = Math.max(-displayMax, currentDisplayVal - amount);
      handleSwitchingThrottleChange(nextDisplayVal);
    }
  }, [updateThrottle, handleSwitchingThrottleChange, getDisplaySpeed, getInternalSpeed, getDisplayMaxSpeed]);

  const handleThrottleHorizontalRight = useCallback((amount: number) => {
    const displayMax = getDisplayMaxSpeed();
    if (throttleModeRef.current === 'standard') {
      const orientationMultiplier = switchingOrientationRef.current === 'forward-right' ? 1 : -1;
      const increment = amount * orientationMultiplier;
      const currentDisplay = getDisplaySpeed(speedRef.current);
      const nextDisplaySpeed = Math.max(0, Math.min(displayMax, currentDisplay + increment));
      updateThrottle(getInternalSpeed(nextDisplaySpeed), isForwardRef.current);
    } else {
      const currentDisplayVal = isForwardRef.current 
        ? (switchingOrientationRef.current === 'forward-right' ? getDisplaySpeed(speedRef.current) : -getDisplaySpeed(speedRef.current))
        : (switchingOrientationRef.current === 'forward-right' ? -getDisplaySpeed(speedRef.current) : getDisplaySpeed(speedRef.current));
      const nextDisplayVal = Math.min(displayMax, currentDisplayVal + amount);
      handleSwitchingThrottleChange(nextDisplayVal);
    }
  }, [updateThrottle, handleSwitchingThrottleChange, getDisplaySpeed, getInternalSpeed, getDisplayMaxSpeed]);

  const handleThrottleVerticalTop = useCallback((amount: number) => {
    const displayMax = getDisplayMaxSpeed();
    const currentDisplay = getDisplaySpeed(speedRef.current);
    if (throttleModeRef.current === 'standard') {
      const nextDisplaySpeed = Math.min(displayMax, currentDisplay + amount);
      updateThrottle(getInternalSpeed(nextDisplaySpeed), isForwardRef.current);
    } else {
      const currentDisplayVal = isForwardRef.current ? currentDisplay : -currentDisplay;
      const nextDisplayVal = Math.min(displayMax, currentDisplayVal + amount);
      if (nextDisplayVal >= 0) {
        updateThrottle(getInternalSpeed(nextDisplayVal), true);
      } else {
        updateThrottle(getInternalSpeed(Math.abs(nextDisplayVal)), false);
      }
    }
  }, [updateThrottle, getDisplaySpeed, getInternalSpeed, getDisplayMaxSpeed]);

  const handleThrottleVerticalBottom = useCallback((amount: number) => {
    const displayMax = getDisplayMaxSpeed();
    const currentDisplay = getDisplaySpeed(speedRef.current);
    if (throttleModeRef.current === 'standard') {
      const nextDisplaySpeed = Math.max(0, currentDisplay - amount);
      updateThrottle(getInternalSpeed(nextDisplaySpeed), isForwardRef.current);
    } else {
      const currentDisplayVal = isForwardRef.current ? currentDisplay : -currentDisplay;
      const nextDisplayVal = Math.max(-displayMax, currentDisplayVal - amount);
      if (nextDisplayVal >= 0) {
        updateThrottle(getInternalSpeed(nextDisplayVal), true);
      } else {
        updateThrottle(getInternalSpeed(Math.abs(nextDisplayVal)), false);
      }
    }
  }, [updateThrottle, getDisplaySpeed, getInternalSpeed, getDisplayMaxSpeed]);

  const toggleFunction = useCallback((fn: number) => {
    const currentCab = cabAddressRef.current;
    if (currentCab === '') return;
    
    const nextState = !functionsRef.current[fn];
    
    if (activeConsistId !== null) {
      const consist = consists.find(c => c.id === activeConsistId);
      if (consist) {
        const locosToControl = activeConsistTempReverse 
          ? [...consist.locos].reverse().map(l => ({ ...l, isReverse: !l.isReverse })) 
          : consist.locos;
        
        locosToControl.forEach((l, index) => {
          const isLead = index === 0;
          const config = getLocoFunctionConfig(l.address);
          const shouldSend = isLead || config[fn]?.sendToConsist;
          
          if (shouldSend) {
            sendCommand(`F ${getDccAddress(l.address)} ${fn} ${nextState ? 1 : 0}`);
          }
        });
        
        // Update all affected locos in allLocoFunctions
        setAllLocoFunctions(prev => {
          const next = { ...prev };
          locosToControl.forEach((l, index) => {
            const isLead = index === 0;
            const config = getLocoFunctionConfig(l.address);
            if (isLead || config[fn]?.sendToConsist) {
              const dccAddrStr = getDccAddress(l.address).toString();
              next[dccAddrStr] = { ...(next[dccAddrStr] || {}), [fn]: nextState };
            }
          });
          return next;
        });
        return;
      }
    }

    // <F CAB FUNCTION STATE> - 'F' must be uppercase (deprecated 'f')
    sendCommand(`F ${getDccAddress(currentCab)} ${fn} ${nextState ? 1 : 0}`);
    setAllLocoFunctions(prev => {
      const dccAddrStr = getDccAddress(currentCab).toString();
      return {
        ...prev,
        [dccAddrStr]: { ...(prev[dccAddrStr] || {}), [fn]: nextState }
      };
    });
  }, [functions, sendCommand, activeConsistId, consists, activeConsistTempReverse, getLocoFunctionConfig]);

  const setFunctionState = useCallback((fn: number, state: boolean) => {
    const currentCab = cabAddressRef.current;
    if (currentCab === '') return;

    if (activeConsistId !== null) {
      const consist = consists.find(c => c.id === activeConsistId);
      if (consist) {
        const locosToControl = activeConsistTempReverse 
          ? [...consist.locos].reverse().map(l => ({ ...l, isReverse: !l.isReverse })) 
          : consist.locos;
        
        locosToControl.forEach((l, index) => {
          const isLead = index === 0;
          const config = getLocoFunctionConfig(l.address);
          const shouldSend = isLead || config[fn]?.sendToConsist;
          
          if (shouldSend) {
            sendCommand(`F ${getDccAddress(l.address)} ${fn} ${state ? 1 : 0}`);
          }
        });

        setAllLocoFunctions(prev => {
          const next = { ...prev };
          locosToControl.forEach((l, index) => {
            const isLead = index === 0;
            const config = getLocoFunctionConfig(l.address);
            if (isLead || config[fn]?.sendToConsist) {
              const dccAddrStr = getDccAddress(l.address).toString();
              next[dccAddrStr] = { ...(next[dccAddrStr] || {}), [fn]: state };
            }
          });
          return next;
        });
        return;
      }
    }

    sendCommand(`F ${getDccAddress(currentCab)} ${fn} ${state ? 1 : 0}`);
    setAllLocoFunctions(prev => {
      const dccAddrStr = getDccAddress(currentCab).toString();
      return {
        ...prev,
        [dccAddrStr]: { ...(prev[dccAddrStr] || {}), [fn]: state }
      };
    });
  }, [sendCommand, activeConsistId, consists, activeConsistTempReverse, getLocoFunctionConfig]);

  const stopFunctionRapid = useCallback(() => {
    if (functionRapidTimeoutRef.current) clearTimeout(functionRapidTimeoutRef.current);
    if (functionRapidIntervalRef.current) clearTimeout(functionRapidIntervalRef.current);
    if (waitingForFunctionResponseRef.current?.safetyId) {
      clearTimeout(waitingForFunctionResponseRef.current.safetyId);
    }
    functionRapidTimeoutRef.current = null;
    functionRapidIntervalRef.current = null;
    waitingForFunctionResponseRef.current = null;
    isRapidActiveRef.current = false;
  }, []);

  const performRapidToggle = useCallback((idx: number) => {
    if (!isRapidActiveRef.current) return;
    
    // Safety check: if somehow already waiting, don't trigger another toggle
    if (waitingForFunctionResponseRef.current) return;

    const currentCab = cabAddressRef.current;
    if (currentCab === '') return;
    
    // Determine expected state after toggle
    const currentState = functionsRef.current[idx];
    const expectedState = !currentState;
    
    const cabAddrString = getDccAddress(currentCab).toString();
    
    // Set wait state - parseDCCMessage will clear this when <l CAB ...> arrives with expectedState
    waitingForFunctionResponseRef.current = { cab: cabAddrString, fn: idx, expectedState };
    
    // Safety timeout: 1.5s - if DCC-EX doesn't respond, we force progress to avoid getting stuck
    const safetyId = setTimeout(() => {
      if (waitingForFunctionResponseRef.current?.fn === idx) {
        waitingForFunctionResponseRef.current = null;
        if (isRapidActiveRef.current) {
          if (functionRapidIntervalRef.current) clearTimeout(functionRapidIntervalRef.current);
          functionRapidIntervalRef.current = setTimeout(() => performRapidToggleRef.current(idx), 365);
        }
      }
    }, 1500);
    
    waitingForFunctionResponseRef.current.safetyId = safetyId;
    
    toggleFunction(idx);
  }, [toggleFunction]);

  // Keep ref in sync for parseDCCMessage to use
  useEffect(() => {
    performRapidToggleRef.current = performRapidToggle;
  }, [performRapidToggle]);

  const startFunctionRapid = useCallback((idx: number) => {
    stopFunctionRapid();
    isRapidActiveRef.current = true;
    functionRapidTimeoutRef.current = setTimeout(() => {
      performRapidToggle(idx);
    }, 300);
  }, [stopFunctionRapid, performRapidToggle]);

  // Turnout Detail Retry Logic
  useEffect(() => {
    if (!isTurnoutsView || !areTurnoutRetriesEnabled || allTurnoutIds.length === 0) return;

    const timer = setInterval(() => {
      const loadedIds = new Set(turnouts.map(t => t.id));
      const missingIds = allTurnoutIds.filter(id => !loadedIds.has(id));

      if (missingIds.length > 0 && sendCommandRef.current) {
        // Only retry a few at a time to avoid flooding, with small delay between
        missingIds.slice(0, 10).forEach((id, index) => {
          setTimeout(() => {
            if (sendCommandRef.current) sendCommandRef.current(`JT ${id}`);
          }, index * 300);
        });
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isTurnoutsView, areTurnoutRetriesEnabled, allTurnoutIds, turnouts]);

  const toggleTurnout = (id: string, currentState: 'C' | 'T' | 'X') => {
    const nextState = currentState === 'T' ? 'C' : 'T';
    sendCommand(`T ${id} ${nextState}`);
    // Local update for immediate feedback
    setTurnouts(prev => prev.map(t => t.id === id ? { ...t, state: nextState } : t));
  };

  const handleRouteClick = (route: { id: string; name: string }) => {
    const activeConsist = activeConsistId !== null ? consists.find(c => c.id === activeConsistId) : null;
    const leadCab = activeConsist ? (activeConsistTempReverse ? activeConsist.locos[activeConsist.locos.length - 1]?.address : activeConsist.locos[0]?.address) : undefined;
    
    if (activeConsistId !== null && leadCab !== undefined) {
      setShowRouteConsistConfirm({ id: route.id, name: route.name });
    } else {
      if (cabAddress === '') {
        addLog('error', 'No locomotive address selected');
        return;
      }
      sendCommand(`/ START ${cabAddress} ${route.id}`);
      addLog('info', `Started Route ${route.id} (${route.name}) for Cab ${cabAddress}`);
    }
  };

  const emergencyStop = useCallback(() => {
    // Global emergency stop command for DCC-EX
    sendCommand('!');
    lastThrottleCommandTimeRef.current = Date.now();
    setSpeed(0);
    consistSpeedsRef.current = {};
    setStatusText('EMERGENCY STOP');
  }, [sendCommand]);

  const connect = async (modeOverride?: 'serial' | 'wifi' | 'emulator' | React.MouseEvent | React.KeyboardEvent) => {
    const activeMode = (modeOverride && typeof modeOverride === 'string') ? modeOverride : connectionModeRef.current;
    if (activeMode === 'serial') {
      try {
        if (portRef.current) {
          addLog('info', 'Port already open, attempting to reset...');
          await disconnect();
        }

        const selectedPort = await navigator.serial.requestPort();
        await selectedPort.open({ baudRate: DEFAULT_BAUD_RATE });
        
        setPort(selectedPort);
        addLog('info', `Connected to DCC-EX at ${DEFAULT_BAUD_RATE} baud`);
        setStatusText('Connected');
        setRoutesLoaded(false);

        const textDecoder = new TextDecoderStream();
        const readablePromise = selectedPort.readable?.pipeTo(textDecoder.writable).catch(err => {
          console.error('Readable stream error:', err);
        });
        setReadableStreamClosed(readablePromise || null);
        const readerInstance = textDecoder.readable.getReader();
        setReader(readerInstance);

        const textEncoder = new TextEncoderStream();
        if (!selectedPort.writable) throw new Error('Port writable stream is not available');
        const writablePromise = textEncoder.readable.pipeTo(selectedPort.writable).catch(err => {
          console.error('Writable stream error:', err);
        });
        setWritableStreamClosed(writablePromise || null);
        const writerInstance = textEncoder.writable.getWriter();
        setWriter(writerInstance);

        // Send initial status requests
        setTrackBlocks([]);
        const powerCmd = `<S>`;
        await writerInstance.write(powerCmd);
        addLog('out', powerCmd);

        const trackCmd = `< = >`;
        await writerInstance.write(trackCmd);
        addLog('out', trackCmd);
        
        if (cabAddress !== '') {
          const locoCmd = `<t ${getDccAddress(cabAddress)}>`;
          await writerInstance.write(locoCmd);
          addLog('out', locoCmd);
        }

        // Read loop
        (async () => {
          try {
            let buffer = '';
            while (true) {
              const { value, done } = await readerInstance.read();
              if (done) break;
              if (value) {
                buffer += value;
                const parts = buffer.split('>');
                buffer = parts.pop() || '';
                for (const part of parts) {
                  const cleanPart = part.replace('<', '').trim();
                  if (cleanPart) {
                    addLog('in', `<${cleanPart}>`);
                    parseDCCMessageRef.current(cleanPart);
                  }
                }
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              addLog('info', 'Reader aborted');
            } else {
              addLog('error', `Read error: ${error}`);
            }
          } finally {
            readerInstance.releaseLock();
          }
        })().catch(err => {
          console.error('Unhandled error in read loop:', err);
          addLog('error', `Read loop failed: ${err}`);
        });

      } catch (err) {
        const isCancellation = err instanceof Error && (err.name === 'NotFoundError' || err.message.includes('No port selected'));
        
        if (!isCancellation) {
          console.error(err);
        }

        if (err instanceof Error && err.name === 'SecurityError') {
          addLog('error', 'Permissions Policy Error: Access to serial ports is blocked.');
        } else if (err instanceof Error && err.message.includes('already open')) {
          addLog('error', 'The port is already open. Please refresh the page or try disconnecting first.');
        } else if (isCancellation) {
          addLog('info', 'Connection cancelled by user');
        } else {
          addLog('error', `Connection failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        setPort(null);
      }
    } else if (activeMode === 'wifi') {
      try {
        const electronAPI = (window as any).electronAPI;

        if (electronAPI && !isBridgeAvailable) {
          // Use Electron TCP Bridge for standalone production build
          addLog('info', `Connecting via Electron TCP Bridge: ${wifiHost}:${wifiPort}...`);
          
          tcpBufferRef.current = ''; // Reset buffer

          electronAPI.onTcpData((data: string) => {
            console.log('TCP Bridge Data Received:', data);
            tcpBufferRef.current += data;
            
            // Process all complete messages in the buffer
            let startIndex = tcpBufferRef.current.indexOf('<');
            let endIndex = tcpBufferRef.current.indexOf('>');

            while (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
              const fullMessage = tcpBufferRef.current.substring(startIndex, endIndex + 1);
              const innerContent = tcpBufferRef.current.substring(startIndex + 1, endIndex).trim();
              
              if (innerContent) {
                addLog('in', fullMessage);
                parseDCCMessageRef.current(innerContent);
              }

              // Remove processed message from buffer
              tcpBufferRef.current = tcpBufferRef.current.substring(endIndex + 1);
              
              // Search for next message
              startIndex = tcpBufferRef.current.indexOf('<');
              endIndex = tcpBufferRef.current.indexOf('>');
            }
          });

          electronAPI.onTcpConnected(() => {
            console.log('TCP Bridge Connected');
            setIsWifiConnected(true);
            setStatusText('Connected (WiFi Bridge)');
            addLog('info', 'Electron TCP Bridge Connected');
            electronAPI.tcpSend('<S>');
            electronAPI.tcpSend('< = >');
            setRoutesLoaded(false);
            setTurnoutsLoaded(false);
          });

          electronAPI.onTcpError((err: string) => {
            addLog('error', `TCP Bridge Error: ${err}`);
            setIsWifiConnected(false);
            setStatusText('Disconnected');
          });

          electronAPI.onTcpClose(() => {
            addLog('info', 'TCP Bridge Disconnected');
            setIsWifiConnected(false);
            setStatusText('Disconnected');
          });

          electronAPI.tcpConnect(wifiHost, wifiPort);
          return;
        }

        const wsUrl = isBridgeAvailable 
          ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/bridge?host=${wifiHost}&port=${wifiPort}`
          : `ws://${wifiHost}:${wifiPort}`;

        addLog('info', `Connecting via ${isBridgeAvailable ? 'Bridge' : 'Direct WebSocket'}: ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          setIsWifiConnected(true);
          setStatusText(`Connected (${isBridgeAvailable ? 'Bridge' : 'WiFi'})`);
          addLog('info', `${isBridgeAvailable ? 'TCP Bridge' : 'WiFi WebSocket'} Connected`);
          // Initial status
          ws.send('<S>');
          ws.send('< = >');
          setRoutesLoaded(false);
          setTurnoutsLoaded(false);
        };

          ws.onmessage = (event) => {
            const data = event.data;
            if (typeof data === 'string') {
              const parts = data.split('>');
              for (const part of parts) {
                const cleanPart = part.replace('<', '').trim();
                if (cleanPart) {
                  addLog('in', `<${cleanPart}>`);
                  parseDCCMessageRef.current(cleanPart);
                }
              }
            }
          };

          ws.onclose = () => {
            setIsWifiConnected(false);
            setDirectWs(null);
            setStatusText('Disconnected');
            addLog('info', 'Direct WebSocket Disconnected');
          };

          ws.onerror = (err) => {
            if (isBridgeAvailable) {
              addLog('error', 'Bridge Connection Error. Ensure the target IP/Port are correct and reachable by the server.');
            } else {
              addLog('error', 'Direct Connection Error. Standalone apps cannot connect to raw TCP. You need to run the Node.js bridge for raw TCP support.');
            }
            console.error('WebSocket Error:', err);
          };

          setDirectWs(ws);
        } catch (err) {
          addLog('error', `Direct connection failed: ${err}`);
        }
      } else if (activeMode === 'emulator') {
      setIsEmulatorConnected(true);
      setStatusText('Connected (Emulator)');
      addLog('info', 'DCC-EX Emulator started');
      setTrackBlocks([]);
      setRoutesLoaded(false);
      setTurnoutsLoaded(false);
      // Trigger initial status
      setTimeout(() => {
        processEmulatorCommand('<S>');
        processEmulatorCommand('< = >');
        processEmulatorCommand('<JA>');
        processEmulatorCommand('<JT>');
      }, 300);
    }
  };

  const disconnect = async (modeOverride?: 'serial' | 'wifi' | 'emulator' | React.MouseEvent | React.KeyboardEvent) => {
    const activeMode = (modeOverride && typeof modeOverride === 'string') ? modeOverride : connectionModeRef.current;
    if (activeMode === 'serial') {
      addLog('info', 'Disconnecting...');
      try {
        if (readerRef.current) {
          await readerRef.current.cancel();
          setReader(null);
        }
        
        if (writerRef.current) {
          await writerRef.current.close();
          setWriter(null);
        }

        if (readableStreamClosedRef.current) {
          await readableStreamClosedRef.current.catch(() => {});
          setReadableStreamClosed(null);
        }
        
        if (writableStreamClosedRef.current) {
          await writableStreamClosedRef.current.catch(() => {});
          setWritableStreamClosed(null);
        }

        if (portRef.current) {
          await portRef.current.close();
        }
      } catch (err) {
        console.error('Error during disconnect:', err);
        addLog('error', `Disconnect warning: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setPort(null);
        setReader(null);
        setWriter(null);
        setReadableStreamClosed(null);
        setWritableStreamClosed(null);
        setTrackPower(false);
        setSpeed(0);
        setFunctions({});
        setStatusText('Disconnected');
        addLog('info', 'Disconnected');
      }
    } else if (activeMode === 'wifi') {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && !isBridgeAvailableRef.current) {
        electronAPI.tcpDisconnect();
      }

      if (directWsRef.current) {
        directWsRef.current.close();
      }
      setIsWifiConnected(false);
      setDirectWs(null);
      setStatusText('Disconnected');
      setTrackPower(false);
      setSpeed(0);
      setFunctions({});
      addLog('info', 'Disconnected');
    } else if (activeMode === 'emulator') {
      setIsEmulatorConnected(false);
      setStatusText('Disconnected');
      addLog('info', 'Emulator stopped');
      setTrackPower(false);
      setSpeed(0);
      setFunctions({});
    }
  };

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error(`Failed to save ${key} to localStorage`, e);
    }
  };

  useEffect(() => {
    safeSetItem('dcc_presets', JSON.stringify(presets));
    safeSetItem('dcc_secret_preset', secretPreset.toString());
    safeSetItem('dcc_presets_count', visiblePresetsCount.toString());
    safeSetItem('dcc_loco_images', JSON.stringify(locoImages));
    safeSetItem('dcc_loco_functions', JSON.stringify(locoFunctionConfigs));
    safeSetItem('dcc_speed_step_increment', speedStepIncrement.toString());
    safeSetItem('dcc_throttle_mode', throttleMode);
    safeSetItem('dcc_switching_orientation', switchingOrientation);
    safeSetItem('dcc_connection_mode', connectionMode);
    safeSetItem('dcc_wifi_host', wifiHost);
    safeSetItem('dcc_wifi_port', wifiPort.toString());
    safeSetItem('dcc_loco_settings', JSON.stringify(locoSettings));
    safeSetItem('dcc_consists', JSON.stringify(consists));
    safeSetItem('dcc_hide_all_consists', JSON.stringify(hideAllConsists));
    safeSetItem('dcc_all_loco_functions', JSON.stringify(allLocoFunctions));
    safeSetItem('dcc_ui_theme', uiTheme);
    safeSetItem('dcc_ui_density', uiDensity.toString());
    safeSetItem('dcc_loco_colors', JSON.stringify(locoColors));
    safeSetItem('dcc_loco_opacity', JSON.stringify(locoOpacity));
    safeSetItem('dcc_loco_accent_colors', JSON.stringify(locoAccentColors));
    safeSetItem('dcc_loco_accent_opacity', JSON.stringify(locoAccentOpacity));
    safeSetItem('dcc_loco_road_names', JSON.stringify(locoRoadNames));
    safeSetItem('dcc_show_road_names', showRoadNames.toString());
    safeSetItem('dcc_show_loco_colors', showLocoColors.toString());
    safeSetItem('dcc_loco_placeholders', JSON.stringify(locoPlaceholders));
  }, [presets, visiblePresetsCount, locoImages, locoFunctionConfigs, speedStepIncrement, throttleMode, switchingOrientation, connectionMode, wifiHost, wifiPort, locoSettings, consists, hideAllConsists, allLocoFunctions, uiTheme, uiDensity, locoColors, locoOpacity, locoAccentColors, locoAccentOpacity, locoRoadNames, showRoadNames, showLocoColors, locoPlaceholders]);

  // Keyboard & Mouse Wheel Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't trigger if track power is OFF
      if (!trackPowerRef.current) {
        return;
      }

      // Ignore key repeats for all keys except left and right arrows
      if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        return;
      }

      // Emergency Stop (Escape or /)
      if (e.key === 'Escape' || e.key === '/') {
        if (e.cancelable) e.preventDefault();
        emergencyStop();
        return;
      }

      // Stop (Space)
      if (e.key === ' ') {
        if (e.cancelable) e.preventDefault();
        updateThrottle(0, isForwardRef.current);
        return;
      }

      // Direction (Up/Down)
      if (throttleModeRef.current === 'standard') {
        if (e.key === 'ArrowUp') {
          if (e.cancelable) e.preventDefault();
          updateThrottle(speedRef.current, true);
        } else if (e.key === 'ArrowDown') {
          if (e.cancelable) e.preventDefault();
          updateThrottle(speedRef.current, false);
        }
      }

      // Speed Control (+, -, Left, Right)
      const isPlus = e.key === '+' || e.key === '=';
      const isMinus = e.key === '-' || e.key === '_';
      const isRight = e.key === 'ArrowRight';
      const isLeft = e.key === 'ArrowLeft';

      if (isPlus || isMinus || isRight || isLeft) {
        if (e.cancelable) e.preventDefault();
        
        const displayMax = getDisplayMaxSpeed();
        const currentDisplay = getDisplaySpeed(speedRef.current);

        if (throttleModeRef.current === 'standard') {
          const orientationMultiplier = switchingOrientationRef.current === 'forward-right' ? 1 : -1;
          let displayIncrement = 0;
          
          if (isPlus) {
            displayIncrement = speedStepIncrementRef.current;
          } else if (isMinus) {
            displayIncrement = -speedStepIncrementRef.current;
          } else if (isRight) {
            displayIncrement = speedStepIncrementRef.current * orientationMultiplier;
          } else if (isLeft) {
            displayIncrement = -speedStepIncrementRef.current * orientationMultiplier;
          }
          
          const nextDisplaySpeed = Math.max(0, Math.min(displayMax, currentDisplay + displayIncrement));
          updateThrottle(getInternalSpeed(nextDisplaySpeed), isForwardRef.current);
        } else {
          const directionMultiplier = switchingOrientationRef.current === 'forward-right' ? 1 : -1;
          let displayIncrement = 0;
          
          if (isRight) {
            displayIncrement = speedStepIncrementRef.current;
          } else if (isLeft) {
            displayIncrement = -speedStepIncrementRef.current;
          } else if (isPlus) {
            displayIncrement = speedStepIncrementRef.current * directionMultiplier;
          } else if (isMinus) {
            displayIncrement = -speedStepIncrementRef.current * directionMultiplier;
          }

          const currentDisplayVal = isForwardRef.current 
            ? (switchingOrientationRef.current === 'forward-right' ? currentDisplay : -currentDisplay)
            : (switchingOrientationRef.current === 'forward-right' ? -currentDisplay : currentDisplay);
          const nextDisplayVal = Math.max(-displayMax, Math.min(displayMax, currentDisplayVal + displayIncrement));
          handleSwitchingThrottleChange(nextDisplayVal);
        }
      }

      // Function Controls (0-9)
      if (/^[0-9]$/.test(e.key)) {
        if (e.cancelable) e.preventDefault();
        const num = parseInt(e.key);
        let fn = num;
        if (e.shiftKey) {
          fn = num + 10;
        } else if (e.altKey) {
          fn = num + 20;
          if (fn > 28) return; // Only F20-F28
        }
        
        const config = getLocoFunctionConfig(cabAddressRef.current);
        const isMomentary = config[fn]?.momentary;
        
        if (isMomentary) {
          setFunctionState(fn, true);
        } else {
          toggleFunction(fn);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or track power is OFF
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || !trackPowerRef.current) {
        return;
      }

      // Function Controls (0-9)
      if (/^[0-9]$/.test(e.key)) {
        const num = parseInt(e.key);
        let fn = num;
        if (e.shiftKey) {
          fn = num + 10;
        } else if (e.altKey) {
          fn = num + 20;
          if (fn > 28) return;
        }
        
        const config = getLocoFunctionConfig(cabAddressRef.current);
        const isMomentary = config[fn]?.momentary;
        
        if (isMomentary) {
          if (e.cancelable) e.preventDefault();
          setFunctionState(fn, false);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Only if not in edit mode and track power is ON
      if (isEditingThrottleRef.current || !trackPowerRef.current) return;

      // Only if mouse is over the throttle card
      const throttleCard = document.getElementById('throttle-control-card');
      if (!throttleCard || !throttleCard.contains(e.target as Node)) return;

      if (e.cancelable) e.preventDefault();
      const isScrollUp = e.deltaY < 0;

      const displayMax = getDisplayMaxSpeed();
      const currentDisplay = getDisplaySpeed(speedRef.current);

      if (throttleModeRef.current === 'standard') {
        const displayIncrement = isScrollUp ? speedStepIncrementRef.current : -speedStepIncrementRef.current;
        const nextDisplaySpeed = Math.max(0, Math.min(displayMax, currentDisplay + displayIncrement));
        updateThrottle(getInternalSpeed(nextDisplaySpeed), isForwardRef.current);
      } else {
        // Up always moves towards Forward
        const directionMultiplier = switchingOrientationRef.current === 'forward-right' ? 1 : -1;
        const displayIncrement = isScrollUp ? (speedStepIncrementRef.current * directionMultiplier) : (-speedStepIncrementRef.current * directionMultiplier);
        
        const currentDisplayVal = isForwardRef.current 
          ? (switchingOrientationRef.current === 'forward-right' ? currentDisplay : -currentDisplay)
          : (switchingOrientationRef.current === 'forward-right' ? -currentDisplay : currentDisplay);
        const nextDisplayVal = Math.max(-displayMax, Math.min(displayMax, currentDisplayVal + displayIncrement));
        handleSwitchingThrottleChange(nextDisplayVal);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [updateThrottle, handleSwitchingThrottleChange, toggleFunction, setFunctionState, getLocoFunctionConfig, emergencyStop]);

  // Sync on Loco Change
  useEffect(() => {
    if (isConnected && cabAddress !== '' && (isLocoId(cabAddress) || !isNaN(Number(cabAddress)))) {
      if (activeConsistId === null && !isConsistSetupMode) {
        // Reset local state for new loco while waiting for sync
        setSpeed(0);
        setFunctions({});
        
        // Request status for the specific loco
        getLocoStatus(cabAddress);
        
        addLog('info', `Switched to Cab ${getDisplayAddress(cabAddress)}. Syncing...`);
      } else if (activeConsistId !== null) {
        // For consists, don't send commands or reset speed/functions.
        // We use our internal knowledge of the consist speed.
        addLog('info', `Switched to Consist ${activeConsistId} (Lead Cab ${getDisplayAddress(cabAddress)}).`);
      }
    }
  }, [cabAddress, isConnected, getLocoStatus, activeConsistId, isConsistSetupMode]);

  const handleTourActions = useCallback(async (actions?: string[], driverInstance?: any, direction?: 'next' | 'prev' | 'show', customStep?: any) => {
    if (!actions || actions.length === 0) return false;
    let intercepted = false;
    const delay = customStep?.actionDelay || 100;

    for (const rawAction of actions) {
      const [action, ...args] = rawAction.split(':');

      // Check for composite actions/macros defined in tourSteps.ts
      if (tourMacros[action]) {
        await handleTourActions(tourMacros[action], driverInstance, direction, customStep);
        continue;
      }

      switch (action) {
        case 'tour_backup_first_preset':
          {
            const sortedIndices = getSortedIndices();
            if (sortedIndices && sortedIndices.length > 0) {
              const firstIdx = sortedIndices[0];
              const firstPreset = presets[firstIdx];
              if (firstPreset !== undefined) {
                const addrStr = firstPreset.toString();
                const backupObj = {
                  index: firstIdx,
                  address: firstPreset,
                  roadName: locoRoadNames[addrStr],
                  color: locoColors[addrStr],
                  opacity: locoOpacity[addrStr],
                  accentColor: locoAccentColors[addrStr],
                  accentOpacity: locoAccentOpacity[addrStr],
                  settings: locoSettings[addrStr],
                  image: locoImages[addrStr],
                  placeholder: locoPlaceholders[addrStr],
                  functionConfig: locoFunctionConfigs[addrStr],
                  allFunctions: allLocoFunctions[addrStr]
                };
                tourFirstPresetBackupRef.current = backupObj;
                setTourFirstPresetBackup(backupObj);
              }
            }
          }
          break;
        case 'tour_restore_first_preset':
          {
            const backup = tourFirstPresetBackupRef.current || tourFirstPresetBackup;
            if (backup) {
              const targetIdx = backup.index !== undefined ? backup.index : 0;
              const addrStr = backup.address.toString();

              // 1. Restore address to presets list (at targetIdx)
              setPresets(prev => {
                if (prev.length === 0) return [backup.address];
                const next = [...prev];
                next[targetIdx] = backup.address;
                return next;
              });

              // 2. Restore individual maps
              const restoreKey = (setter: React.Dispatch<React.SetStateAction<any>>, val: any) => {
                setter((prev: any) => {
                  const next = { ...prev };
                  if (val !== undefined) {
                    next[addrStr] = val;
                  } else {
                    delete next[addrStr];
                  }
                  return next;
                });
              };

              restoreKey(setLocoRoadNames, backup.roadName);
              restoreKey(setLocoColors, backup.color);
              restoreKey(setLocoOpacity, backup.opacity);
              restoreKey(setLocoAccentColors, backup.accentColor);
              restoreKey(setLocoAccentOpacity, backup.accentOpacity);
              restoreKey(setLocoSettings, backup.settings);
              restoreKey(setLocoImages, backup.image);
              restoreKey(setLocoPlaceholders, backup.placeholder);
              restoreKey(setLocoFunctionConfigs, backup.functionConfig);
              restoreKey(setAllLocoFunctions, backup.allFunctions);
            }
          }
          break;
        case 'set_mode_wifi': setConnectionMode('wifi'); setShowWifiAdvice(false); break;
        case 'set_mode_serial': setConnectionMode('serial'); break;
        case 'set_mode_emulator': setConnectionMode('emulator'); break;
        case 'finish_tour':
          intercepted = true;
          if (driverInstance) {
            driverInstance.destroy();
          }
          await handleTourActions(tourTerminationActions);
          setTourExitStatus('completed');
          setIsTourActive(false);
          
          setShowTourMenu(true);
          break;
        case 'cancel_to_menu':
          intercepted = true;
          if (driverInstance) {
            const activeIndex = driverInstance.getActiveIndex();
            const isFirstStepOfStop = tourStopsMenu.some(s => s.targetStep === activeIndex + 1);
            driverInstance.destroy();
            await handleTourActions(tourTerminationActions);
            if (isFirstStepOfStop) {
              setTourExitStatus('completed');
              setLastTourStopIndex(activeIndex - 1);
            } else {
              setTourExitStatus('canceled');
              if (activeIndex === 0) setLastTourStopIndex(null);
            }
            setIsTourActive(false);
            setShowTourMenu(true);
          }
          break;
        case 'show_welcome_card':
          intercepted = true;
          if (driverInstance) {
            driverInstance.destroy();
          }
          await handleTourActions(tourTerminationActions);
          setTourExitStatus('completed');
          setShowTourMenu(true);
          // setIsTourActive(true) remains true
          break;
        case 'show_wifi_advice_async':
          setShowWifiAdvice(true);
          intercepted = true;
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          break;
        case 'hide_wifi_advice': setShowWifiAdvice(false); break;
        case 'show_terminal': setShowTerminal(true); break;
        case 'hide_terminal': setShowTerminal(false); break;
        case 'sync_status': getStationStatus(); break;
        case 'show_terminal_sequence':
          intercepted = true;
          setShowTerminal(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'hide_terminal_sequence':
          intercepted = true;
          setShowTerminal(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'connect_emulator_sequence':
          intercepted = true;
          setConnectionMode('emulator');
          setShowTerminal(true);
          setTimeout(async () => {
            await disconnect('serial');
            await disconnect('wifi');
            if (!isEmulatorConnectedRef.current) connect('emulator');
//            setTimeout(() => driverInstance?.moveNext(), delay);
          }, 100);
          break;
        case 'tour_set_custom_box_style':
          {
            const topVal = args[0] !== undefined ? (args[0].endsWith('px') || args[0].endsWith('%') ? args[0] : `${args[0]}px`) : '0px';
            const leftVal = args[1] !== undefined ? (args[1].endsWith('px') || args[1].endsWith('%') ? args[1] : `${args[1]}px`) : '0px';
            const widthVal = args[2] !== undefined ? (args[2].endsWith('px') || args[2].endsWith('%') ? args[2] : `${args[2]}px`) : '320px';
            const heightVal = args[3] !== undefined ? (args[3].endsWith('px') || args[3].endsWith('%') ? args[3] : `${args[3]}px`) : '180px';
            const target = args[4] !== undefined ? args[4] : 'default';
            
            if (target === 'lighting' || target === 'tour-custom-lighting-box') {
              setTourCustomLightingBoxStyle({
                position: 'absolute',
                top: topVal,
                left: leftVal,
                width: widthVal,
                height: heightVal,
                pointerEvents: 'none',
                backgroundColor: 'transparent',
              });
            } else if (target === 'user' || target === 'tour-custom-user-box') {
              setTourCustomUserBoxStyle({
                position: 'absolute',
                top: topVal,
                left: leftVal,
                width: widthVal,
                height: heightVal,
                pointerEvents: 'none',
                backgroundColor: 'transparent',
              });
            } else {
              setTourCustomBoxStyle({
                position: 'absolute',
                top: topVal,
                left: leftVal,
                width: widthVal,
                height: heightVal,
                pointerEvents: 'none',
                backgroundColor: 'transparent',
              });
            }
          }
          break;
        case 'tour_use_demo_assignments':
          {
            const enable = args[0] === 'true';
            isTourDemoAssignmentActiveRef.current = enable;
            setIsTourDemoAssignmentActive(enable);
            if (enable) {
              setTourDemoLocoFunctionGroups({
                lighting: [],
                sound: [],
                speed: [],
                user1: [],
                user2: [],
                user3: [],
              });
              setTourDemoEnabledFunctionGroups([]);
            }
          }
          break;
        case 'tour_select_function_group':
          {
            const groupId = args[0];
            const delayTime = args[1] ? parseInt(args[1], 10) : 0;
            const toggleGroup = () => {
              if (isTourDemoAssignmentActiveRef.current) {
                setTourDemoEnabledFunctionGroups(prev => 
                  prev.includes(groupId) ? prev : [...prev, groupId]
                );
              } else {
                const currentLocoAddr = cabAddress.toString();
                setEnabledFunctionGroups(prev => {
                  const current = prev[currentLocoAddr] || [];
                  const next = current.includes(groupId) ? current : [...current, groupId];
                  setUseFunctionGroups(true);
                  return { ...prev, [currentLocoAddr]: next };
                });
              }
              addLog('info', `DCC: Included ${groupId} group`);
            };
            if (delayTime > 0) setTimeout(toggleGroup, delayTime);
            else toggleGroup();
          }
          break;
        case 'tour_show_routes_panel':
          {
            const actionDelay = args[0] ? parseInt(args[0], 10) : 0;
            const runAction = () => {
              setIsRoutesView(true);
              setIsTurnoutsView(false);
              setIsEditingFunctions(false);
            };
            if (actionDelay > 0) setTimeout(runAction, actionDelay);
            else runAction();
          }
          break;
        case 'tour_show_functions_panel_sequence':
          intercepted = true;
          setIsRoutesView(false);
          setIsTurnoutsView(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_show_routes_panel_sequence':
          intercepted = true;
          setIsRoutesView(true);
          setIsTurnoutsView(false);
          setIsEditingFunctions(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_show_turnouts_panel_sequence':
          intercepted = true;
          setIsRoutesView(false);
          setIsTurnoutsView(true);
          setIsEditingFunctions(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_refresh_routes':
          {
            const actionDelay = args[0] ? parseInt(args[0], 10) : 0;
            const runAction = () => {
              setRoutes([]);
              setAllRouteIds([]);
              setRoutesLoaded(true);
              setAreRouteRetriesEnabled(false);
              sendCommand('JA');
              setTimeout(() => setAreRouteRetriesEnabled(true), 500);
            };
            if (actionDelay > 0) setTimeout(runAction, actionDelay);
            else runAction();
          }
          break;
        case 'tour_refresh_turnouts':
          {
            const actionDelay = args[0] ? parseInt(args[0], 10) : 0;
            const runAction = () => {
              setTurnouts([]);
              setAllTurnoutIds([]);
              setTurnoutsLoaded(true);
              setAreTurnoutRetriesEnabled(false);
              sendCommand('JT');
              setTimeout(() => setAreTurnoutRetriesEnabled(true), 500);
            };
            if (actionDelay > 0) setTimeout(runAction, actionDelay);
            else runAction();
          }
          break;
        case 'tour_select_lighting_group':
          {
            const delayTime = args[0] ? parseInt(args[0], 10) : 0;
            const actionFunc = () => {
              if (isTourDemoAssignmentActiveRef.current) {
                setTourDemoEnabledFunctionGroups(prev => 
                  prev.includes('lighting') ? prev : [...prev, 'lighting']
                );
              } else {
                const currentLocoAddr = cabAddress.toString();
                setEnabledFunctionGroups(prev => {
                  const current = prev[currentLocoAddr] || [];
                  const next = current.includes('lighting') ? current : [...current, 'lighting'];
                  setUseFunctionGroups(true);
                  return { ...prev, [currentLocoAddr]: next };
                });
              }
              addLog('info', 'DCC: Included lighting group');
            };
            if (delayTime > 0) setTimeout(actionFunc, delayTime);
            else actionFunc();
          }
          break;
        case 'tour_select_sound_group':
          {
            const delayTime = args[0] ? parseInt(args[0], 10) : 0;
            const actionFunc = () => {
              if (isTourDemoAssignmentActiveRef.current) {
                setTourDemoEnabledFunctionGroups(prev => 
                  prev.includes('sound') ? prev : [...prev, 'sound']
                );
              } else {
                const currentLocoAddr = cabAddress.toString();
                setEnabledFunctionGroups(prev => {
                  const current = prev[currentLocoAddr] || [];
                  const next = current.includes('sound') ? current : [...current, 'sound'];
                  setUseFunctionGroups(true);
                  return { ...prev, [currentLocoAddr]: next };
                });
              }
              addLog('info', 'DCC: Included sound group');
            };
            if (delayTime > 0) setTimeout(actionFunc, delayTime);
            else actionFunc();
          }
          break;
        case 'tour_set_use_function_groups':
          {
            const enable = args[0] !== 'false';
            setUseFunctionGroups(enable);
            addLog('info', `DCC: Set Use Function Groups to ${enable}`);
          }
          break;
        case 'tour_uncheck_loco_1234': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            const idx = presets.findIndex(p => p?.toString() === '1234');
            if (idx !== -1) {
              setLocoIncludedInSort(prev => {
                const next = [...prev];
                next[idx] = false;
                return next;
              });
              addLog('info', `1234 excluded from sort.`);
            }
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_check_loco_1234': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            const idx = presets.findIndex(p => p?.toString() === '1234');
            if (idx !== -1) {
              setLocoIncludedInSort(prev => {
                const next = [...prev];
                next[idx] = true;
                return next;
              });
              addLog('info', `1234 included in sort.`);
            }
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_move_loco_1234_down': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setCustomPresetOrder(prevOrder => {
              const locoIdx = presets.findIndex(p => p?.toString() === '1234');
              if (locoIdx === -1) return prevOrder;
              const position = prevOrder.indexOf(locoIdx);
              if (position === -1) return prevOrder;
              const targetPosition = position + 1;
              if (targetPosition >= 0 && targetPosition < maxPresets) {
                const nextOrder = [...prevOrder];
                [nextOrder[position], nextOrder[targetPosition]] = [nextOrder[targetPosition], nextOrder[position]];
                localStorage.setItem('dcc_custom_preset_order', JSON.stringify(nextOrder));
                return nextOrder;
              }
              return prevOrder;
            });
            // Switch to custom baselines if needed
            if (locoSortMode !== 'custom') {
              setLocoSortMode('custom');
              setPrevLocoSortMode('custom');
              localStorage.setItem('dcc_loco_sort_mode', 'custom');
              localStorage.setItem('dcc_prev_loco_sort_mode', 'custom');
            }
            addLog('info', `1234 moved down in preset order.`);
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_move_loco_1234_up': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setCustomPresetOrder(prevOrder => {
              const locoIdx = presets.findIndex(p => p?.toString() === '1234');
              if (locoIdx === -1) return prevOrder;
              const position = prevOrder.indexOf(locoIdx);
              if (position === -1) return prevOrder;
              const targetPosition = position - 1;
              if (targetPosition >= 0 && targetPosition < maxPresets) {
                const nextOrder = [...prevOrder];
                [nextOrder[position], nextOrder[targetPosition]] = [nextOrder[targetPosition], nextOrder[position]];
                localStorage.setItem('dcc_custom_preset_order', JSON.stringify(nextOrder));
                return nextOrder;
              }
              return prevOrder;
            });
            // Switch to custom baselines if needed
            if (locoSortMode !== 'custom') {
              setLocoSortMode('custom');
              setPrevLocoSortMode('custom');
              localStorage.setItem('dcc_loco_sort_mode', 'custom');
              localStorage.setItem('dcc_prev_loco_sort_mode', 'custom');
            }
            addLog('info', `1234 moved up in preset order.`);
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_sort_custom': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setLocoSortMode('custom');
            setPrevLocoSortMode('custom');
            localStorage.setItem('dcc_loco_sort_mode', 'custom');
            localStorage.setItem('dcc_prev_loco_sort_mode', 'custom');
            addLog('info', 'Sorted presets by custom order.');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_sort_id_asc': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setLocoSortMode('id');
            setPrevLocoSortMode('id');
            setLocoIdSortDirection('asc');
            localStorage.setItem('dcc_loco_sort_mode', 'id');
            localStorage.setItem('dcc_prev_loco_sort_mode', 'id');
            localStorage.setItem('dcc_loco_id_sort_direction', 'asc');
            addLog('info', 'Sorted presets by ID (Ascending).');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_sort_id_desc': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setLocoSortMode('id');
            setPrevLocoSortMode('id');
            setLocoIdSortDirection('desc');
            localStorage.setItem('dcc_loco_sort_mode', 'id');
            localStorage.setItem('dcc_prev_loco_sort_mode', 'id');
            localStorage.setItem('dcc_loco_id_sort_direction', 'desc');
            addLog('info', 'Sorted presets by ID (Descending).');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_sort_road_asc': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            const currentMode = locoSortModeRef.current;
            const prevMode = currentMode === 'id' ? 'id' : 'custom';
            setPrevLocoSortMode(prevMode);
            localStorage.setItem('dcc_prev_loco_sort_mode', prevMode);
            setLocoSortMode('roadName');
            setLocoSortDirection('asc');
            localStorage.setItem('dcc_loco_sort_mode', 'roadName');
            localStorage.setItem('dcc_loco_sort_direction', 'asc');
            addLog('info', 'Sorted presets by Road (Ascending).');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_sort_road_desc': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            const currentMode = locoSortModeRef.current;
            const prevMode = currentMode === 'id' ? 'id' : 'custom';
            setPrevLocoSortMode(prevMode);
            localStorage.setItem('dcc_prev_loco_sort_mode', prevMode);
            setLocoSortMode('roadName');
            setLocoSortDirection('desc');
            localStorage.setItem('dcc_loco_sort_mode', 'roadName');
            localStorage.setItem('dcc_loco_sort_direction', 'desc');
            addLog('info', 'Sorted presets by Road (Descending).');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_toggle_sort_id': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            const currentMode = locoSortModeRef.current;
            const currentDir = locoIdSortDirectionRef.current;
            if (currentMode === 'id' || currentMode === 'roadName') {
              const nextDir = currentDir === 'asc' ? 'desc' : 'asc';
              setLocoIdSortDirection(nextDir);
              localStorage.setItem('dcc_loco_id_sort_direction', nextDir);
              addLog('info', `Toggled sort ID direction to ${nextDir}.`);
            } else {
              setPrevLocoSortMode('id');
              setLocoIdSortDirection('asc');
              setLocoSortMode('id');
              localStorage.setItem('dcc_loco_sort_mode', 'id');
              localStorage.setItem('dcc_prev_loco_sort_mode', 'id');
              localStorage.setItem('dcc_loco_id_sort_direction', 'asc');
              addLog('info', 'Activated ID sort (Ascending).');
            }
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_toggle_sort_road': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            const currentMode = locoSortModeRef.current;
            const currentDir = locoSortDirectionRef.current;
            if (currentMode !== 'roadName') {
              const prevMode = currentMode === 'id' ? 'id' : 'custom';
              setPrevLocoSortMode(prevMode);
              localStorage.setItem('dcc_prev_loco_sort_mode', prevMode);
              setLocoSortDirection('asc');
              setLocoSortMode('roadName');
              localStorage.setItem('dcc_loco_sort_mode', 'roadName');
              localStorage.setItem('dcc_loco_sort_direction', 'asc');
              addLog('info', 'Activated Road sort (Ascending).');
            } else {
              if (currentDir === 'asc') {
                setLocoSortDirection('desc');
                localStorage.setItem('dcc_loco_sort_direction', 'desc');
                addLog('info', 'Toggled Road sort to Descending.');
              } else {
                const prevMode = prevLocoSortModeRef.current;
                setLocoSortMode(prevMode);
                localStorage.setItem('dcc_loco_sort_mode', prevMode);
                setLocoSortDirection('asc');
                addLog('info', 'Road sort deactivated.');
              }
            }
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_picker_opacity': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const opacity = args[1] ? parseInt(args[1], 10) : 80;
          const perform = () => {
            setActivePickerOpacity(opacity);
            addLog('info', `Opacity set to ${opacity}%.`);
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_picker_accent_opacity': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const opacity = args[1] ? parseInt(args[1], 10) : 80;
          const perform = () => {
            setActivePickerAccentOpacity(opacity);
            addLog('info', `Accent opacity set to ${opacity}%.`);
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_select_loco_1234_yellow': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setActivePickerColor('#fbbf24');
            addLog('info', 'Yellow selected for loco 1234 preset.');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_select_loco_1234_blue_accent': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setActivePickerAccentColor('#3b82f6');
            addLog('info', 'Blue selected for loco 1234 preset accent.');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_apply_loco_1234_colors': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            // No backup ref created, assuming it was empty, just backing it up isn't requested deeply but we will just apply it for now.
            setLocoColors(prev => {
              const next = { ...prev, '1234': '#fbbf24' };
              localStorage.setItem('dcc_loco_colors', JSON.stringify(next));
              return next;
            });
            setLocoOpacity(prev => {
              const next = { ...prev, '1234': 80 };
              localStorage.setItem('dcc_loco_opacity', JSON.stringify(next));
              return next;
            });
            setLocoAccentColors(prev => {
              const next = { ...prev, '1234': '#3b82f6' };
              localStorage.setItem('dcc_loco_accent_colors', JSON.stringify(next));
              return next;
            });
            setLocoAccentOpacity(prev => {
              const next = { ...prev, '1234': 80 };
              localStorage.setItem('dcc_loco_accent_opacity', JSON.stringify(next));
              return next;
            });
            addLog('info', 'Applied custom colors to loco 1234 for tour demo.');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_remove_loco_1234_colors': {
          const delay = args[0] ? parseInt(args[0], 10) : 0;
          const perform = () => {
            setLocoColors(prev => {
              const next = { ...prev };
              delete next['1234'];
              localStorage.setItem('dcc_loco_colors', JSON.stringify(next));
              return next;
            });
            setLocoOpacity(prev => {
              const next = { ...prev };
              delete next['1234'];
              localStorage.setItem('dcc_loco_opacity', JSON.stringify(next));
              return next;
            });
            setLocoAccentColors(prev => {
              const next = { ...prev };
              delete next['1234'];
              localStorage.setItem('dcc_loco_accent_colors', JSON.stringify(next));
              return next;
            });
            setLocoAccentOpacity(prev => {
              const next = { ...prev };
              delete next['1234'];
              localStorage.setItem('dcc_loco_accent_opacity', JSON.stringify(next));
              return next;
            });
            addLog('info', 'Removed custom colors from loco 1234.');
          };
          if (delay > 0) {
            const timeoutId = setTimeout(perform, delay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            perform();
          }
          break;
        }
        case 'tour_set_active_function_group':
          {
            const delayTime = args[0] ? parseInt(args[0], 10) : 0;
            const groupId = args[1] || 'default';
            const actionFunc = () => {
              const currentLocoAddr = cabAddress.toString();
              setActiveFunctionGroupId(prev => ({
                ...prev,
                [currentLocoAddr]: groupId
              }));
              addLog('info', `DCC: Set active function group to ${groupId}`);
            };
            if (delayTime === 0) {
              actionFunc();
            } else {
              const t = setTimeout(actionFunc, delayTime);
              tourScheduledTimeoutsRef.current.push(t);
            }
          }
          break;
        case 'tour_animate_checking_boxes':
          {
            const startDelay = args[0] ? parseInt(args[0], 10) : 1000;
            const interval = args[1] ? parseInt(args[1], 10) : 400;
            const currentLocoAddr = cabAddress.toString();
            
            if (isTourDemoAssignmentActiveRef.current) {
              setTourDemoLocoFunctionGroups(prev => ({
                ...prev,
                lighting: (prev.lighting || []).filter(idx => idx !== 0 && idx !== 5 && idx !== 6),
                sound: (prev.sound || []).filter(idx => idx !== 1 && idx !== 2 && idx !== 3),
                speed: (prev.speed || []).filter(idx => idx !== 4),
              }));

              const targetBoxes = [
                { fn: 0, cat: 'lighting', label: 'Lighting' },
                { fn: 5, cat: 'lighting', label: 'Lighting' },
                { fn: 6, cat: 'lighting', label: 'Lighting' },
                { fn: 1, cat: 'sound', label: 'Sound' },
                { fn: 2, cat: 'sound', label: 'Sound' },
                { fn: 3, cat: 'sound', label: 'Sound' },
                { fn: 4, cat: 'speed', label: 'Speed & Braking' },
              ];

              let currentDelay = startDelay;
              targetBoxes.forEach((box) => {
                setTimeout(() => {
                  setTourDemoLocoFunctionGroups(prev => {
                    const currentList = prev[box.cat] || [];
                    if (!currentList.includes(box.fn)) {
                      return {
                        ...prev,
                        [box.cat]: [...currentList, box.fn]
                      };
                    }
                    return prev;
                  });
                  addLog('info', `DCC: Assigned F${box.fn} to ${box.label} group`);
                }, currentDelay);
                currentDelay += interval;
              });
            } else {
              // Clear current configurations for these specific checkboxes to ensure the animation is visible
              setLocoFunctionGroups(prev => {
                const currentGroups = prev[currentLocoAddr] || {};
                return {
                  ...prev,
                  [currentLocoAddr]: {
                    ...currentGroups,
                    lighting: (currentGroups.lighting || []).filter(idx => idx !== 0 && idx !== 5 && idx !== 6),
                    sound: (currentGroups.sound || []).filter(idx => idx !== 1 && idx !== 2 && idx !== 3),
                    speed: (currentGroups.speed || []).filter(idx => idx !== 4),
                  }
                };
              });

              const targetBoxes = [
                { fn: 0, cat: 'lighting', label: 'Lighting' },
                { fn: 5, cat: 'lighting', label: 'Lighting' },
                { fn: 6, cat: 'lighting', label: 'Lighting' },
                { fn: 1, cat: 'sound', label: 'Sound' },
                { fn: 2, cat: 'sound', label: 'Sound' },
                { fn: 3, cat: 'sound', label: 'Sound' },
                { fn: 4, cat: 'speed', label: 'Speed & Braking' },
              ];

              let currentDelay = startDelay;
              targetBoxes.forEach((box) => {
                setTimeout(() => {
                  setLocoFunctionGroups(prev => {
                    const currentGroups = prev[currentLocoAddr] || {};
                    const currentList = currentGroups[box.cat] || [];
                    if (!currentList.includes(box.fn)) {
                      return {
                        ...prev,
                        [currentLocoAddr]: {
                          ...currentGroups,
                          [box.cat]: [...currentList, box.fn]
                        }
                      };
                    }
                    return prev;
                  });
                  addLog('info', `DCC: Assigned F${box.fn} to ${box.label} group`);
                }, currentDelay);
                currentDelay += interval;
              });
            }
          }
          break;
        case 'disconnect_emulator_sequence':
          intercepted = true;
          setConnectionMode('emulator');
          setShowTerminal(false);
          await disconnect('emulator');
          setTimeout(() => driverInstance?.movePrevious(), delay);
          break;
        case 'hide_icon_settings': setShowIconSettingsModal(false); break;
        case 'hide_display_settings': setShowDisplaySettings(false); break;
        case 'hide_icon_settings_sequence':
          intercepted = true;
          setShowIconSettingsModal(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_display_settings_sequence':
          intercepted = true;
          setShowDisplaySettings(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'hide_display_settings_sequence':
          intercepted = true;
          setShowDisplaySettings(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_user_custom_settings_sequence':
          intercepted = true;
          setShowDisplaySettings(false);
          setShowUserCustomSettingsModal(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'hide_user_custom_settings_sequence':
          intercepted = true;
          setShowUserCustomSettingsModal(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_icon_settings_sequence':
          intercepted = true;
          setShowIconSettingsModal(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'reset_to_base':
          setConnectionMode('serial');
          setShowTerminal(false);
          setShowWifiAdvice(false);
          break;
        case 'turn_off_serial_monitor': setShowTerminal(false); break;
        case 'expand_presets': setIsCompactLocoPresets(false); break;
        case 'compact_presets': setIsCompactLocoPresets(true); break;
        case 'expand_throttle': setIsCompactThrottle(false); break;
        case 'compact_throttle': setIsCompactThrottle(true); break;
        case 'expand_functions': {
          const compFnOffDelay = args[0] ? parseInt(args[0]) : 0;
          if (compFnOffDelay > 0) setTimeout(() => setIsCompactFunctions(false), compFnOffDelay);
          else setIsCompactFunctions(false);
          break;
        }
        case 'compact_functions': {
          const compFnOnDelay = args[0] ? parseInt(args[0]) : 0;
          if (compFnOnDelay > 0) setTimeout(() => setIsCompactFunctions(true), compFnOnDelay);
          else setIsCompactFunctions(true);
          break;
        }
        case 'tour_edit_functions_off_sequence':
          intercepted = true;
          setIsEditingFunctions(false);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_edit_functions_on_sequence':
          intercepted = true;
          setIsEditingFunctions(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_edit_functions': {
          const efDelay = args[0] ? parseInt(args[0]) : 0;
          const efState = args[1] === 'true';
          const runAction = () => {
            if (efState) {
              setIsRoutesView(false);
              setIsTurnoutsView(false);
            }
            setIsEditingFunctions(efState);
          };
          if (efDelay > 0) setTimeout(runAction, efDelay);
          else runAction();
          break;
        }
        case 'tour_throttle_direction_forward':
          const tdfDelay = args[0] ? parseInt(args[0]) : 0;
          if (tdfDelay > 0) setTimeout(() => updateThrottle(speed, true), tdfDelay);
          else updateThrottle(speed, true);
          break;
        case 'tour_throttle_direction_reverse':
          const tdrDelay = args[0] ? parseInt(args[0]) : 0;
          if (tdrDelay > 0) setTimeout(() => updateThrottle(speed, false), tdrDelay);
          else updateThrottle(speed, false);
          break;
        case 'tour_throttle_enable_override':
          const teoDelay = args[0] ? parseInt(args[0]) : 0;
          const teoStatus = args[1] === 'true';
          if (teoDelay > 0) setTimeout(() => setIsTourThrottleEnabledOverride(teoStatus), teoDelay);
          else setIsTourThrottleEnabledOverride(teoStatus);
          break;
        case 'tour_functions_enable_override':
          const feoDelay = args[0] ? parseInt(args[0]) : 0;
          const feoStatus = args[1] === 'true';
          if (feoDelay > 0) setTimeout(() => setIsTourFunctionsEnabledOverride(feoStatus), feoDelay);
          else setIsTourFunctionsEnabledOverride(feoStatus);
          break;
        case 'tour_function_set': {
          const fsDelay = args[0] ? parseInt(args[0]) : 0;
          const fnIndex = args[1] ? parseInt(args[1]) : 0;
          const fnState = args[2] === 'true';
          const runAction = () => {
            setFunctionState(fnIndex, fnState);
          };
          if (fsDelay > 0) setTimeout(runAction, fsDelay);
          else runAction();
          break;
        }
        case 'tour_f2_pressed': {
          const fpDelay = args[0] ? parseInt(args[0]) : 0;
          const fpState = args[1] === 'true';
          if (fpDelay > 0) setTimeout(() => setIsTourF2Pressed(fpState), fpDelay);
          else setIsTourF2Pressed(fpState);
          break;
        }
        case 'tour_select_copy_source': {
          const scDelay = args[0] ? parseInt(args[0]) : 0;
          const scValue = args[1] || '';
          const runAction = () => {
            setCopySourceAddr(scValue);
          };
          if (scDelay > 0) setTimeout(runAction, scDelay);
          else runAction();
          break;
        }
        case 'tour_display_settings_highlight_on': {
          const btn = document.getElementById('tour-display-settings');
          if (btn) {
            btn.classList.remove('bg-btn-bg', 'border-btn-border', 'text-text-muted', 'hover:text-text-main', 'hover:border-text-muted');
            btn.classList.add('bg-accent', 'border-accent', 'text-white', 'shadow-lg', 'shadow-accent/20');
          }
          break;
        }
        case 'tour_display_settings_highlight_off': {
          const btn = document.getElementById('tour-display-settings');
          if (btn && !showDisplaySettings) {
            btn.classList.add('bg-btn-bg', 'border-btn-border', 'text-text-muted', 'hover:text-text-main', 'hover:border-text-muted');
            btn.classList.remove('bg-accent', 'border-accent', 'text-white', 'shadow-lg', 'shadow-accent/20');
          }
          break;
        }
        case 'tour_turn_off_all_custom_settings_btn_highlight_on': {
          const btn = document.getElementById('tour-turn-off-all-custom-settings-btn');
          if (btn) {
            btn.classList.remove('bg-btn-bg', 'border-btn-border', 'text-text-muted', 'hover:text-text-main', 'hover:border-text-muted', 'border-white/10', 'hover:bg-white/5');
            btn.classList.add('bg-accent', 'border-accent', 'text-white', 'shadow-lg', 'shadow-accent/20');
          }
          break;
        }
        case 'tour_turn_off_all_custom_settings_btn_highlight_off': {
          const btn = document.getElementById('tour-turn-off-all-custom-settings-btn');
          if (btn) {
            btn.classList.add('bg-btn-bg', 'border-btn-border', 'text-text-muted', 'hover:text-text-main', 'hover:border-text-muted', 'border-white/10', 'hover:bg-white/5');
            btn.classList.remove('bg-accent', 'border-accent', 'text-white', 'shadow-lg', 'shadow-accent/20');
          }
          break;
        }
        case 'tour_show_memory_autosave_confirm_sequence': {
          const slot = args[0] ? parseInt(args[0]) : 1;
          setPendingMemorySlot(slot);
          setAutoSaveIncludesReset(true);
          setShowMemoryAutoSaveConfirm(true);
          break;
        }
        case 'tour_hide_memory_autosave_confirm_sequence': {
          setShowMemoryAutoSaveConfirm(false);
          setPendingMemorySlot(null);
          setPendingMemoryName('');
          break;
        }
        case 'tour_type_memory_save_name': {
          const msnDelay = args[0] ? parseInt(args[0]) : 0;
          const text = args[1] || '';
          const runAction = () => {
            setPendingMemoryName(text);
          };
          if (msnDelay > 0) setTimeout(runAction, msnDelay);
          else runAction();
          break;
        }
          case 'tour_set_demomemory_1_mismatch': {
          setTourMemorySlot1MatchedForce(false);
          setTourMemorySlot1MutedForce(false);
          if (!tourMemorySlot1BackupRef.current) {
            tourMemorySlot1BackupRef.current = memorySlots[1] || 'empty';
          }
          setMemorySlots(prev => ({
            ...prev,
            1: {
              timestamp: Date.now(),
              name: 'Tablet Settings',
              data: {
                showRoadNames: true,
                isBlocksView: !isBlocksView,
              }
            }
          }));
          break;
        }
        case 'tour_set_demomemory_1_match': {
          setTourMemorySlot1MatchedForce(true);
          setTourMemorySlot1MutedForce(false);
          if (!tourMemorySlot1BackupRef.current) {
            tourMemorySlot1BackupRef.current = memorySlots[1] || 'empty';
          }
          setMemorySlots(prev => ({
            ...prev,
            1: {
              timestamp: Date.now(),
              name: 'Tablet Settings',
              data: {
                customAppIconEnabled,
                customAppIconSizeConfigs,
                defaultAppIconSizeConfigs,
                hideAllConsists,
                isCompactLocoPresets,
                showRoadNames: true,
                showLocoColors,
                isBlocksView,
                isCompactThrottle,
                throttleLayout,
                isSmallPresetsActive,
                estopConfigModeMap: estopConfigModeMap || {},
                isCompactFunctions,
                showLocoFunctionColors,
                locoSettings,
                routeCompactMode,
                turnoutCompactMode,
                stopLabelActAsButtonMap,
                isThickThrottle,
                useFunctionGroups,
                uiDensity,
                uiTheme,
              }
            }
          }));
          break;
        }
        case 'tour_clear_demomemory_1': {
          setTourMemorySlot1MatchedForce(false);
          setTourMemorySlot1MutedForce(true);
          if (tourMemorySlot1BackupRef.current) {
            if (tourMemorySlot1BackupRef.current === 'empty') {
              setMemorySlots(prev => {
                const next = { ...prev };
                delete next[1];
                return next;
              });
            } else {
              const orig = tourMemorySlot1BackupRef.current;
              setMemorySlots(prev => ({ ...prev, 1: orig }));
            }
            tourMemorySlot1BackupRef.current = null;
          }
          break;
        }
        case 'tour_show_memory_clear_sequence': {
          const slot = args[0] ? parseInt(args[0]) : 1;
          setPendingMemorySlot(slot);
          setMemoryModalMode('clear');
          setShowMemoryClearConfirm(true);
          break;
        }
        case 'tour_hide_memory_clear_sequence': {
          setShowMemoryClearConfirm(false);
          setPendingMemorySlot(null);
          break;
        }
        case 'tour_set_memory_clear_mode': {
          const tDelay = args[0] ? parseInt(args[0]) : 0;
          const mode = (args[1] || 'clear') as 'clear' | 'replace';
          const runAction = () => {
            setMemoryModalMode(mode);
          };
          if (tDelay > 0) {
            const timeoutId = setTimeout(runAction, tDelay);
            tourScheduledTimeoutsRef.current.push(timeoutId);
          } else {
            runAction();
          }
          break;
        }
        case 'tour_functions_demo_cleanup': {
          const fdcDelay = args[0] ? parseInt(args[0]) : 0;
          const runCleanup = () => {
            setFunctionState(0, false);
            setFunctionState(1, false);
            setFunctionState(2, false);
            setIsTourF2Pressed(false);
            setCopySourceAddr('');
          };
          if (fdcDelay > 0) setTimeout(runCleanup, fdcDelay);
          else runCleanup();
          break;
        }
        case 'tour_throttle_speed_set_25':
          const ts25Delay = args[0] ? parseInt(args[0]) : 0;
          if (ts25Delay > 0) setTimeout(() => updateThrottle(25, isForward), ts25Delay);
          else updateThrottle(25, isForward);
          break;
        case 'tour_throttle_speed_set_0':
          const ts0Delay = args[0] ? parseInt(args[0]) : 0;
          if (ts0Delay > 0) setTimeout(() => updateThrottle(0, isForward), ts0Delay);
          else updateThrottle(0, isForward);
          break;
        case 'tour_throttle_speed_inc':
          const tsiDelay = args[0] ? parseInt(args[0]) : 0;
          const niSpeed = Math.min(MAX_SPEED, speed + speedStepIncrement);
          if (tsiDelay > 0) setTimeout(() => updateThrottle(niSpeed, isForward), tsiDelay);
          else updateThrottle(niSpeed, isForward);
          break;
        case 'tour_throttle_speed_dec':
          const tsdDelay = args[0] ? parseInt(args[0]) : 0;
          const ndSpeed = Math.max(0, speed - speedStepIncrement);
          if (tsdDelay > 0) setTimeout(() => updateThrottle(ndSpeed, isForward), tsdDelay);
          else updateThrottle(ndSpeed, isForward);
          break;
        case 'tour_throttle_speed_set':
          const tssDelay = args[0] ? parseInt(args[0]) : 0;
          const tssSpeed = args[1] ? parseInt(args[1]) : 0;
          if (tssDelay > 0) setTimeout(() => updateThrottle(tssSpeed, isForward), tssDelay);
          else updateThrottle(tssSpeed, isForward);
          break;
        case 'tour_throttle_speed_plus_highlight':
          const tsphDelay = args[0] ? parseInt(args[0]) : 0;
          const tsphDuration = args[1] ? parseInt(args[1]) : 2000;
          setTimeout(() => {
            setIsThrottleSliderPlusHighlighted(true);
            setTimeout(() => setIsThrottleSliderPlusHighlighted(false), tsphDuration);
          }, tsphDelay);
          break;
        case 'tour_throttle_speed_minus_highlight':
          const tsmhDelay = args[0] ? parseInt(args[0]) : 0;
          const tsmhDuration = args[1] ? parseInt(args[1]) : 2000;
          setTimeout(() => {
            setIsThrottleSliderMinusHighlighted(true);
            setTimeout(() => setIsThrottleSliderMinusHighlighted(false), tsmhDuration);
          }, tsmhDelay);
          break;
        case 'tour_set_throttle_mode_standard':
          const tsmsDelay = args[0] ? parseInt(args[0]) : 0;
          if (tsmsDelay > 0) {
            setTimeout(() => handleSetThrottleMode('standard'), tsmsDelay);
          } else {
            handleSetThrottleMode('standard');
          }
          break;
        case 'tour_set_throttle_mode_switching':
          const tsmwDelay = args[0] ? parseInt(args[0]) : 0;
          if (tsmwDelay > 0) {
            setTimeout(() => handleSetThrottleMode('switching'), tsmwDelay);
          } else {
            handleSetThrottleMode('switching');
          }
          break;
        case 'tour_set_switching_orientation_left':
          const tsolDelay = args[0] ? parseInt(args[0]) : 0;
          if (tsolDelay > 0) {
            setTimeout(() => handleSetSwitchingOrientation('forward-left'), tsolDelay);
          } else {
            handleSetSwitchingOrientation('forward-left');
          }
          break;
        case 'tour_set_switching_orientation_right':
          const tsorDelay = args[0] ? parseInt(args[0]) : 0;
          if (tsorDelay > 0) {
            setTimeout(() => handleSetSwitchingOrientation('forward-right'), tsorDelay);
          } else {
            handleSetSwitchingOrientation('forward-right');
          }
          break;
        case 'tour_set_speed_scale_steps':
          const tsssDelay = args[0] ? parseInt(args[0]) : 0;
          if (tsssDelay > 0) {
            setTimeout(() => handleSetSpeedScale('steps'), tsssDelay);
          } else {
            handleSetSpeedScale('steps');
          }
          break;
        case 'tour_set_speed_scale_percent':
          const tsspDelay = args[0] ? parseInt(args[0]) : 0;
          if (tsspDelay > 0) {
            setTimeout(() => handleSetSpeedScale('percent'), tsspDelay);
          } else {
            handleSetSpeedScale('percent');
          }
          break;
        case 'tour_set_speed_increment':
          const tssiVal = args[0] ? parseInt(args[0]) : 1;
          const tssiDelay = args[1] ? parseInt(args[1]) : 0;
          if (tssiDelay > 0) {
            setTimeout(() => setSpeedStepIncrement(tssiVal), tssiDelay);
          } else {
            setSpeedStepIncrement(tssiVal);
          }
          break;
        case 'tour_set_estop_config_mode':
          const tsecVal = args[0] ? parseInt(args[0]) : 0;
          const tsecDelay = args[1] ? parseInt(args[1]) : 0;
          if (tsecDelay > 0) {
            setTimeout(() => setEstopConfigMode(tsecVal), tsecDelay);
          } else {
            setEstopConfigMode(tsecVal);
          }
          break;
        case 'tour_set_stop_as_button':
          const tssabVal = args[0] === 'true';
          const tssabDelay = args[1] ? parseInt(args[1]) : 0;
          const updateStopLabelBtn = () => {
            setStopLabelActAsButtonMap(prev => ({
              ...prev,
              [throttleLayout]: tssabVal
            }));
          };
          if (tssabDelay > 0) {
            setTimeout(updateStopLabelBtn, tssabDelay);
          } else {
            updateStopLabelBtn();
          }
          break;
        case 'tour_set_small_presets_active':
          const tsspaVal = args[0] === 'true';
          const tsspaDelay = args[1] ? parseInt(args[1]) : 0;
          if (tsspaDelay > 0) {
            setTimeout(() => setIsSmallPresetsActive(tsspaVal), tsspaDelay);
          } else {
            setIsSmallPresetsActive(tsspaVal);
          }
          break;
        case 'tour_set_thick_throttle':
          const tsttVal = args[0] === 'true';
          const tsttDelay = args[1] ? parseInt(args[1]) : 0;
          if (tsttDelay > 0) {
            setTimeout(() => setIsThickThrottle(tsttVal), tsttDelay);
          } else {
            setIsThickThrottle(tsttVal);
          }
          break;
        case 'tour_set_throttle_layout':
          const tstlVal = args[0] || 'standard';
          const tstlDelay = args[1] ? parseInt(args[1]) : 0;
          if (tstlDelay > 0) {
            setTimeout(() => setThrottleLayout(tstlVal as any), tstlDelay);
          } else {
            setThrottleLayout(tstlVal as any);
          }
          break;
        case 'tour_throttle_edit_on':
          const teonDelay = args[0] ? parseInt(args[0]) : 0;
          if (teonDelay > 0) setTimeout(() => setIsEditingThrottle(true), teonDelay);
          else setIsEditingThrottle(true);
          break;
        case 'tour_throttle_edit_off':
          const teoffDelay = args[0] ? parseInt(args[0]) : 0;
          if (teoffDelay > 0) setTimeout(() => setIsEditingThrottle(false), teoffDelay);
          else setIsEditingThrottle(false);
          break;
        case 'tour_show_keyboard_key':
          const keyType = args[0] || 'up';
          const skkStartDelay = args[1] ? parseInt(args[1]) : 0;
          const skkOffsetY = args[2] ? parseInt(args[2]) : 0;
          
          setTimeout(() => {
            setKeyboardKeyOffsetY(skkOffsetY);
            setKeyboardKeyIcon(keyType);
            setIsKeyboardKeyVisible(true);
          }, skkStartDelay);
          break;
        case 'tour_hide_keyboard_key':
          const hkkStartDelay = args[0] ? parseInt(args[0]) : 0;
          setTimeout(() => {
            setIsKeyboardKeyVisible(false);
          }, hkkStartDelay);
          break;
        case 'tour_throttle_mouse_demo':
          const tmdDelay = args[0] ? parseInt(args[0]) : 0;
          const tmdRadius = args[1] ? parseInt(args[1]) : 30;
          const tmdCycleSpeed = args[2] ? parseInt(args[2]) : 2000;
          const tmdTotalDuration = args[3] ? parseInt(args[3]) : 3000;
          
          setTimeout(() => {
            const sliderEl = document.querySelector('#tour-throttle-slider');
            if (sliderEl) {
              const sliderRect = sliderEl.getBoundingClientRect();
              setMouseDemoPosition({
                x: sliderRect.left + sliderRect.width / 2,
                y: sliderRect.top - 20
              });
              setMouseDemoRadius(tmdRadius);
              setMouseDemoDuration(tmdCycleSpeed);
              setIsMouseDemoVisible(true);
              setIsThrottleCardHighlighted(true);
              
              setTimeout(() => {
                setIsMouseDemoVisible(false);
                setIsThrottleCardHighlighted(false);
              }, tmdTotalDuration);
            }
          }, tmdDelay);
          break;
        case 'tour_throttle_preset_highlight':
          const tphDelay = args[0] ? parseInt(args[0]) : 0;
          const tphSpeed = args[1] ? parseInt(args[1]) : 0;
          const tphDuration = args[2] ? parseInt(args[2]) : 2000;
          setTimeout(() => {
            setHighlightedPreset(tphSpeed);
            updateThrottle(tphSpeed, isForward);
            setTimeout(() => setHighlightedPreset(null), tphDuration);
          }, tphDelay);
          break;
        case 'tour_throttle_slider_drag':
          const tsd_delay = args[0] ? parseInt(args[0]) : 0;
          const tsd_duration = args[1] ? parseInt(args[1]) : 2000;
          const tsd_percent = args[2] ? parseInt(args[2]) : 50;
          const tsd_offset_y = args[3] ? parseInt(args[3]) : 0;
          
          setTimeout(() => {
            setSliderDragHandOffsetY(tsd_offset_y);
            const startSpeed = speed;
            const startDir = isForward;
            const targetSpeed = Math.round((tsd_percent / 100) * MAX_SPEED);
            const isReversed = switchingOrientation === 'forward-left';
            
            setSliderDragHandDuration(tsd_duration);
            setSliderDragHandProgress(tsd_percent / 100);
            setIsSliderDragHandReversed(isReversed);
            setIsSliderDragHandVisible(true);
            
            const startTime = Date.now();
            const interval = setInterval(() => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(1, elapsed / tsd_duration);
              
              // We want to go from startSpeed to targetSpeed and back to startSpeed
              // Matching the transition: duration/2 for each way
              let currentSpeed;
              if (progress <= 0.5) {
                // First half: start to target
                const subProgress = progress * 2;
                // Simple easeInOut approximation or just linear for now
                const eased = subProgress < 0.5 ? 2 * subProgress * subProgress : 1 - Math.pow(-2 * subProgress + 2, 2) / 2;
                currentSpeed = Math.round(startSpeed + (targetSpeed - startSpeed) * eased);
              } else {
                // Second half: target to start
                const subProgress = (progress - 0.5) * 2;
                const eased = subProgress < 0.5 ? 2 * subProgress * subProgress : 1 - Math.pow(-2 * subProgress + 2, 2) / 2;
                currentSpeed = Math.round(targetSpeed - (targetSpeed - startSpeed) * eased);
              }
              
              updateThrottle(currentSpeed, startDir);
              
              if (progress >= 1) {
                clearInterval(interval);
                setIsSliderDragHandVisible(false);
                setSliderDragHandProgress(0);
                updateThrottle(startSpeed, startDir);
              }
            }, 30); // 30fps approx
            
          }, tsd_delay);
          break;
        case 'tour_show_button_hand':
          {
            const selector = args[0] || '';
            const tDelay = args[1] ? parseInt(args[1]) : 0;
            const tDuration = args[2] ? parseInt(args[2]) : 2000;
            const offsetX = args[3] ? parseInt(args[3]) : 0;
            const offsetY = args[4] ? parseInt(args[4]) : 0;

            setIsButtonHandVisible(false); // Reset first

            const timeoutId = setTimeout(() => {
              let attempts = 0;
              const tryToShow = () => {
                const btnEl = document.querySelector(selector);
                if (btnEl) {
                  setButtonHandSelector(selector);
                  setButtonHandOffsetX(offsetX);
                  setButtonHandOffsetY(offsetY);

                  const rect = btnEl.getBoundingClientRect();
                  setButtonHandPosition({
                    x: rect.left + rect.width / 2 + offsetX,
                    y: rect.top + rect.height / 2 + offsetY
                  });
                  setIsButtonHandVisible(true);

                  const hideTimeoutId = setTimeout(() => {
                    setIsButtonHandVisible(false);
                  }, tDuration);
                  tourScheduledTimeoutsRef.current.push(hideTimeoutId);
                } else if (attempts < 5) {
                  attempts++;
                  const retryTimeoutId = setTimeout(tryToShow, 50);
                  tourScheduledTimeoutsRef.current.push(retryTimeoutId);
                }
              };
              tryToShow();
            }, tDelay);

            tourScheduledTimeoutsRef.current.push(timeoutId);
          }
          break;
        case 'tour_hide_button_hand':
          setIsButtonHandVisible(false);
          break;
        case 'tour_hide_slider_drag_hand':
          setIsSliderDragHandVisible(false);
          setSliderDragHandProgress(0);
          break;
        case 'connect_emulator':
          setConnectionMode('emulator');
          await disconnect('serial');
          await disconnect('wifi');
          if (!isEmulatorConnectedRef.current) connect('emulator');
          break;
        case 'track_power_on': setTrackPower(true); break;
        case 'track_power_off': setTrackPower(false); break;
        case 'join_blocks': setAreBlocksJoined(true); break;
        case 'unjoin_blocks': setAreBlocksJoined(false); break;
        case 'show_blocks_view': setIsBlocksView(true); break;
        case 'hide_blocks_view': setIsBlocksView(false); break;
        case 'set_blocks_ab_on':
          setTrackBlocks(prev => prev.map(b => 
            (b.letter === 'A' || b.letter === 'B') ? { ...b, power: true } : b
          ));
          break;
        case 'blocks_power_animation':
          const bAnimInitial = args[0] ? parseInt(args[0]) : 800;
          const bAnimStep = args[1] ? parseInt(args[1]) : 600;
          setTimeout(() => {
            // Set B (Prog) to Off
            setTrackBlocks(prev => prev.map(b => b.letter === 'B' ? { ...b, power: false } : b));
            setTimeout(() => {
              // Set A (Main) to Off
              setTrackBlocks(prev => prev.map(b => b.letter === 'A' ? { ...b, power: false } : b));
              setTimeout(() => {
                // Set B (Prog) to On
                setTrackBlocks(prev => prev.map(b => b.letter === 'B' ? { ...b, power: true } : b));
                setTimeout(() => {
                  // Set A (Main) to On
                  setTrackBlocks(prev => prev.map(b => b.letter === 'A' ? { ...b, power: true } : b));
                }, bAnimStep);
              }, bAnimStep);
            }, bAnimStep);
          }, bAnimInitial);
          break;
        case 'set_4_blocks':
          setTrackBlocks([
            { letter: 'A', state: 'MAIN', cab: 0, power: true },
            { letter: 'B', state: 'PROG', cab: 0, power: true },
            { letter: 'C', state: 'MAIN', cab: 0, power: true },
            { letter: 'D', state: 'MAIN', cab: 0, power: true }
          ]);
          break;
        case 'set_2_blocks':
          setTrackBlocks([
            { letter: 'A', state: 'MAIN', cab: 0, power: true },
            { letter: 'B', state: 'PROG', cab: 0, power: true }
          ]);
          break;
        case 'show_block_edit_sequence':
          intercepted = true;
          setSelectedBlockForEdit('C');
          // Wait for modal to be in DOM and stable
          const modalPoll = setInterval(() => {
            const modal = document.getElementById('tour-block-edit-modal');
            if (modal && modal.getBoundingClientRect().height > 50) {
              clearInterval(modalPoll);
              if (direction === 'next') driverInstance?.moveNext();
              else if (direction === 'prev') driverInstance?.movePrevious();
              else if (direction === 'show') driverInstance?.refresh();
            }
          }, 50);
          setTimeout(() => clearInterval(modalPoll), 3000); // Safety
          break;
        case 'open_block_c_edit': 
          if (selectedBlockForEdit === 'C') {
            driverInstance?.refresh();
            return;
          }
          setSelectedBlockForEdit('C'); 
          setTimeout(() => driverInstance?.refresh(), 500);
          break;
        case 'close_block_edit': 
          setSelectedBlockForEdit(null); 
          setTimeout(() => driverInstance?.refresh(), 100);
          break;
        case 'set_block_c_dc':
          setTrackBlocks(prev => prev.map(b => b.letter === 'C' ? { ...b, state: 'DC', cab: 3 } : b));
          break;
        case 'sync_on':
          // Visual feedback for sync - maybe just highlight the button
          const syncBtn = document.getElementById('tour-track-sync-button');
          if (syncBtn) {
            syncBtn.classList.add('bg-accent', 'text-white');
            syncBtn.querySelector('svg')?.classList.add('animate-spin-slow');
          }
          break;
        case 'sync_off':
          const syncBtnOff = document.getElementById('tour-track-sync-button');
          if (syncBtnOff) {
            syncBtnOff.classList.remove('bg-accent', 'text-white');
            syncBtnOff.querySelector('svg')?.classList.remove('animate-spin-slow');
          }
          break;
        case 'highlight_user_settings_on':
          const userSetBtn = document.getElementById('tour-user-settings-button');
          if (userSetBtn) {
            userSetBtn.classList.remove('bg-accent/10', 'border-accent/20');
            userSetBtn.classList.add('bg-accent', 'text-white', 'border-accent', 'shadow-lg', 'shadow-accent/20');
          }
          break;
        case 'highlight_user_settings_off':
          const userSetBtnOff = document.getElementById('tour-user-settings-button');
          if (userSetBtnOff) {
            userSetBtnOff.classList.add('bg-accent/10', 'border-accent/20');
            userSetBtnOff.classList.remove('bg-accent', 'text-white', 'border-accent', 'shadow-lg', 'shadow-accent/20');
          }
          break;
        case 'tour_highlight_turnouts_button_on':
          const trnBtn = document.getElementById('tour-turnouts-btn');
          if (trnBtn) {
            trnBtn.classList.remove('border-btn-border', 'bg-btn-bg', 'text-text-muted', 'hover:text-text-main');
            trnBtn.classList.add('bg-accent', 'text-white', 'border-accent');
          }
          break;
        case 'tour_highlight_turnouts_button_off':
          const trnBtnOff = document.getElementById('tour-turnouts-btn');
          if (trnBtnOff) {
            trnBtnOff.classList.add('border-btn-border', 'bg-btn-bg', 'text-text-muted', 'hover:text-text-main');
            trnBtnOff.classList.remove('bg-accent', 'text-white', 'border-accent');
          }
          break;
        case 'tour_highlight_refresh_button_on':
          const refBtn = document.getElementById('tour-refresh-button');
          if (refBtn) {
            refBtn.classList.remove('border-btn-border', 'bg-btn-bg', 'text-text-muted', 'hover:text-text-main');
            refBtn.classList.add('bg-accent', 'text-white', 'border-accent');
          }
          break;
        case 'tour_highlight_refresh_button_off':
          const refBtnOff = document.getElementById('tour-refresh-button');
          if (refBtnOff) {
            refBtnOff.classList.add('border-btn-border', 'bg-btn-bg', 'text-text-muted', 'hover:text-text-main');
            refBtnOff.classList.remove('bg-accent', 'text-white', 'border-accent');
          }
          break;
        case 'tour_highlight_edit_functions_on': setIsEditFunctionsHighlighted(true); break;
        case 'tour_highlight_edit_functions_off': setIsEditFunctionsHighlighted(false); break;
        case 'tour_highlight_function_colors_on': setIsFunctionColorsHighlighted(true); break;
        case 'tour_highlight_function_colors_off': setIsFunctionColorsHighlighted(false); break;
        case 'tour_highlight_function_groups_on': setIsFunctionGroupsHighlighted(true); break;
        case 'tour_highlight_function_groups_off': setIsFunctionGroupsHighlighted(false); break;
        case 'layout_animation':
          const originalDensity = uiDensity;
          const initialDelay = args[0] ? parseInt(args[0]) : 800;
          const stepDelay = args[1] ? parseInt(args[1]) : 600;
          
          setTimeout(() => {
            setUiDensity(0); // Standard
            setTimeout(() => {
              setUiDensity(1); // Compact
              setTimeout(() => {
                setUiDensity(2); // Ultra
                setTimeout(() => {
                  setUiDensity(3); // Mobile
                  setTimeout(() => {
                    setUiDensity(originalDensity);
                  }, stepDelay);
                }, stepDelay);
              }, stepDelay);
            }, stepDelay);
          }, initialDelay);
          break;
        case 'theme_animation':
          const originalTh = uiTheme;
          const tAnimInitial = args[0] ? parseInt(args[0]) : 1200;
          const tAnimStep = args[1] ? parseInt(args[1]) : 1000;
          
          setTimeout(() => {
            setUiTheme('midnight'); 
            setTimeout(() => {
              setUiTheme('light'); 
              setTimeout(() => {
                setUiTheme('industrial'); 
                setTimeout(() => {
                  setUiTheme('blueprint'); 
                  setTimeout(() => {
                    setUiTheme('retro'); 
                    setTimeout(() => {
                      setUiTheme(originalTh);
                    }, tAnimStep);
                  }, tAnimStep);
                }, tAnimStep);
              }, tAnimStep);
            }, tAnimStep);
          }, tAnimInitial);
          break;
        case 'loco_direction_animation':
          const lDirInitial = args[0] ? parseInt(args[0]) : 800;
          const lDirStep = args[1] ? parseInt(args[1]) : 600;
          const lDirReps = args[2] ? parseInt(args[2]) : 1;
          setTimeout(() => {
            let count = 0;
            const runCycle = () => {
              updateThrottle(speed, false); // Reverse
              setTimeout(() => {
                updateThrottle(speed, true); // Forward
                count++;
                if (count < lDirReps) {
                  setTimeout(runCycle, lDirStep);
                }
              }, lDirStep);
            };
            runCycle();
          }, lDirInitial);
          break;
        case 'loco_entry_animation_12':
          {
            const lEntryInitial12 = args[0] ? parseInt(args[0]) : 800;
            const lEntryType12 = args[1] ? parseInt(args[1]) : 300;
            setTimeout(() => {
              // Focus address box
              setIsEditingAddress(true);
              setPendingCabAddress('');
              setTimeout(() => {
                // Type 1
                setPendingCabAddress('1');
                setTimeout(() => {
                  // Type 2
                  setPendingCabAddress('12');
                  setTimeout(() => {
                    // Press Enter
                    const finalAddr = '12';
                    setCabAddress(finalAddr);
                    setPendingCabAddress(finalAddr);
                    setSecretPreset(finalAddr);
                    setActiveConsistId(null);
                    setSelectedConsistId(null);
                    setActivePresetIndex(null);
                    setIsEditingAddress(false);
                  }, lEntryType12);
                }, lEntryType12);
              }, lEntryInitial12);
            }, lEntryInitial12);
          }
          break;
        case 'loco_entry_animation_1234':
          const lEntryInitial = args[0] ? parseInt(args[0]) : 800;
          const lEntryType = args[1] ? parseInt(args[1]) : 300;
          setTimeout(() => {
            // Focus address box
            setIsEditingAddress(true);
            setPendingCabAddress('');
            setTimeout(() => {
              // Type 1
              setPendingCabAddress('1');
              setTimeout(() => {
                // Type 2
                setPendingCabAddress('12');
                setTimeout(() => {
                  // Type 3
                  setPendingCabAddress('123');
                  setTimeout(() => {
                    // Type 4
                    setPendingCabAddress('1234');
                    setTimeout(() => {
                      // Press Enter
                      const finalAddr = '1234';
                      setCabAddress(finalAddr);
                      setPendingCabAddress(finalAddr);
                      setSecretPreset(finalAddr);
                      setIsEditingAddress(false);
                    }, lEntryType);
                  }, lEntryType);
                }, lEntryType);
              }, lEntryType);
            }, lEntryInitial);
          }, lEntryInitial);
          break;
        case 'loco_entry_animation_#3.1':
          const lEntryInitial31 = args[0] ? parseInt(args[0]) : 800;
          const lEntryType31 = args[1] ? parseInt(args[1]) : 300;
          setTimeout(() => {
            // Focus address box
            setIsEditingAddress(true);
            setPendingCabAddress('');
            setTimeout(() => {
              // Type #
              setPendingCabAddress('#');
              setTimeout(() => {
                // Type 3
                setPendingCabAddress('#3');
                setTimeout(() => {
                  // Type .
                  setPendingCabAddress('#3.');
                  setTimeout(() => {
                    // Type 1
                    setPendingCabAddress('#3.1');
                    setTimeout(() => {
                      // Press Enter
                      const finalAddr = '#3.1';
                      setCabAddress(finalAddr);
                      setPendingCabAddress(finalAddr);
                      setSecretPreset(finalAddr);
                      setIsEditingAddress(false);
                    }, lEntryType31);
                  }, lEntryType31);
                }, lEntryType31);
              }, lEntryType31);
            }, lEntryInitial31);
          }, lEntryInitial31);
          break;
        case 'loco_controls_flash_on':
          const lFlashInterval = args[0] ? parseInt(args[0]) : 600;
          const lFlashDelay = args[1] ? parseInt(args[1]) : 0;
          document.documentElement.style.setProperty('--tour-flash-duration', `${lFlashInterval * 2}ms`);
          if (lFlashDelay > 0) {
            setTimeout(() => {
              setIsLocoControlsFlashing(true);
            }, lFlashDelay);
          } else {
            setIsLocoControlsFlashing(true);
          }
          break;
        case 'loco_controls_flash_off':
          setIsLocoControlsFlashing(false);
          break;
        case 'open_loco_color_modal_sequence':
          intercepted = true;
          const cwIdx = presets.findIndex(p => p !== '');
          if (cwIdx !== -1) {
            setShowLocoColorModal(cwIdx);
            const addr = presets[cwIdx]!.toString();
            setActivePickerColor(locoColors[addr] || 'none');
            setActivePickerOpacity(locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50);
            setActivePickerAccentColor(locoAccentColors[addr] || 'none');
            setActivePickerAccentOpacity(locoAccentOpacity[addr] !== undefined ? locoAccentOpacity[addr] : (locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50));
            setColorModalMode('base');
          }
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'open_loco_color_modal':
          const idx = presets.findIndex(p => p !== '');
          if (idx !== -1) {
            setShowLocoColorModal(idx);
            const addr = presets[idx]!.toString();
            setActivePickerColor(locoColors[addr] || 'none');
            setActivePickerOpacity(locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50);
            setActivePickerAccentColor(locoAccentColors[addr] || 'none');
            setActivePickerAccentOpacity(locoAccentOpacity[addr] !== undefined ? locoAccentOpacity[addr] : (locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50));
            setColorModalMode('base');
          }
          break;
        case 'close_loco_color_modal':
          setShowLocoColorModal(null);
          break;
        case 'tour_open_function_color': {
          const fnIdx = args[0] ? parseInt(args[0]) : 0;
          const openDelay = args[1] ? parseInt(args[1]) : 0;
          const runOpen = () => {
            const config = getLocoFunctionConfig(cabAddress);
            const fn = config[fnIdx] || { bgColor: 'none', bgOpacity: 50, accentColor: 'none', accentOpacity: 50 };
            setEditingFunctionColor({ locoAddr: cabAddress.toString(), functionIdx: fnIdx });
            setActivePickerColor(fn.bgColor || 'none');
            setActivePickerOpacity(fn.bgOpacity !== undefined ? fn.bgOpacity : 50);
            setActivePickerAccentColor(fn.accentColor || 'none');
            setActivePickerAccentOpacity(fn.accentOpacity !== undefined ? fn.accentOpacity : 50);
            setColorModalMode('base');
          };
          if (openDelay > 0) setTimeout(runOpen, openDelay);
          else runOpen();
          break;
        }
        case 'tour_close_function_color': {
          const closeDelay = args[0] ? parseInt(args[0]) : 0;
          if (closeDelay > 0) setTimeout(() => setEditingFunctionColor(null), closeDelay);
          else setEditingFunctionColor(null);
          break;
        }
        case 'tour_backup_f0_colors': {
          const addrStr = cabAddress.toString();
          if (addrStr) {
            const config = getLocoFunctionConfig(addrStr);
            const f0 = config[0];
            if (f0 && !tourF0ColorBackupRef.current) {
              tourF0ColorBackupRef.current = {
                locoAddr: addrStr,
                bgColor: f0.bgColor,
                bgOpacity: f0.bgOpacity,
                accentColor: f0.accentColor,
                accentOpacity: f0.accentOpacity
              };
            }
          }
          break;
        }
        case 'tour_set_f0_colors_yellow_red': {
          const addrStr = cabAddress.toString();
          if (addrStr) {
            const newConfig = [...getLocoFunctionConfig(addrStr)];
            if (newConfig[0]) {
              newConfig[0] = {
                ...newConfig[0],
                bgColor: '#eab308',
                bgOpacity: 50,
                accentColor: '#ef4444',
                accentOpacity: 50
              };
              setLocoFunctionConfigs(prev => ({
                ...prev,
                [addrStr]: newConfig
              }));
            }
          }
          break;
        }
        case 'tour_restore_f0_colors': {
          const backup = tourF0ColorBackupRef.current;
          if (backup) {
            const addrStr = backup.locoAddr;
            const newConfig = [...getLocoFunctionConfig(addrStr)];
            if (newConfig[0]) {
              newConfig[0] = {
                ...newConfig[0],
                bgColor: backup.bgColor,
                bgOpacity: backup.bgOpacity,
                accentColor: backup.accentColor,
                accentOpacity: backup.accentOpacity
              };
              setLocoFunctionConfigs(prev => ({
                ...prev,
                [addrStr]: newConfig
              }));
            }
            tourF0ColorBackupRef.current = null;
          }
          break;
        }
        case 'tour_backup_show_numbers': {
          const addrStr = cabAddress.toString();
          if (addrStr && !tourShowNumbersBackupRef.current) {
            const current = locoSettings[addrStr]?.showNumbers !== false;
            tourShowNumbersBackupRef.current = {
              locoAddr: addrStr,
              showNumbers: current
            };
          }
          break;
        }
        case 'tour_backup_show_names': {
          const addrStr = cabAddress.toString();
          if (addrStr && !tourShowNamesBackupRef.current) {
            const current = locoSettings[addrStr]?.showNames !== false;
            tourShowNamesBackupRef.current = {
              locoAddr: addrStr,
              showNames: current
            };
          }
          break;
        }
        case 'tour_set_show_names_off': {
          const addrStr = cabAddress.toString();
          if (addrStr) {
            setLocoSettings(prev => ({
              ...prev,
              [addrStr]: {
                ...(prev[addrStr] || { mode: 'standard', orientation: 'forward-right' }),
                showNames: false
              }
            }));
          }
          break;
        }
        case 'tour_set_show_names_on': {
          const addrStr = cabAddress.toString();
          if (addrStr) {
            setLocoSettings(prev => ({
              ...prev,
              [addrStr]: {
                ...(prev[addrStr] || { mode: 'standard', orientation: 'forward-right' }),
                showNames: true
              }
            }));
          }
          break;
        }
        case 'tour_restore_show_names': {
          const backup = tourShowNamesBackupRef.current;
          if (backup) {
            const addrStr = backup.locoAddr;
            setLocoSettings(prev => ({
              ...prev,
              [addrStr]: {
                ...(prev[addrStr] || { mode: 'standard', orientation: 'forward-right' }),
                showNames: backup.showNames
              }
            }));
            tourShowNamesBackupRef.current = null;
          }
          break;
        }
        case 'tour_open_function_groups_modal': {
          setShowFunctionGroupsModal(true);
          break;
        }
        case 'tour_close_function_groups_modal': {
          setShowFunctionGroupsModal(false);
          break;
        }
        case 'tour_set_show_numbers_off': {
          const addrStr = cabAddress.toString();
          if (addrStr) {
            setLocoSettings(prev => ({
              ...prev,
              [addrStr]: {
                ...(prev[addrStr] || { mode: 'standard', orientation: 'forward-right' }),
                showNumbers: false
              }
            }));
          }
          break;
        }
        case 'tour_set_show_numbers_on': {
          const addrStr = cabAddress.toString();
          if (addrStr) {
            setLocoSettings(prev => ({
              ...prev,
              [addrStr]: {
                ...(prev[addrStr] || { mode: 'standard', orientation: 'forward-right' }),
                showNumbers: true
              }
            }));
          }
          break;
        }
        case 'tour_restore_show_numbers': {
          const backup = tourShowNumbersBackupRef.current;
          if (backup) {
            const addrStr = backup.locoAddr;
            setLocoSettings(prev => ({
              ...prev,
              [addrStr]: {
                ...(prev[addrStr] || { mode: 'standard', orientation: 'forward-right' }),
                showNumbers: backup.showNumbers
              }
            }));
            tourShowNumbersBackupRef.current = null;
          }
          break;
        }
        case 'show_inline_picker_on':
          setShowInlinePicker(true);
          break;
        case 'show_inline_picker_off':
          setShowInlinePicker(false);
          break;
        case 'set_color_modal_mode_accent': {
          const accentDelay = args[0] ? parseInt(args[0]) : 0;
          if (accentDelay > 0) {
            setTimeout(() => setColorModalMode('accent'), accentDelay);
          } else {
            setColorModalMode('accent');
          }
          break;
        }
        case 'set_color_modal_mode_base': {
          const baseDelay = args[0] ? parseInt(args[0]) : 0;
          if (baseDelay > 0) {
            setTimeout(() => setColorModalMode('base'), baseDelay);
          } else {
            setColorModalMode('base');
          }
          break;
        }
        case 'highlight_color_mode_button_on':
          setIsColorModeButtonHighlighted(true);
          break;
        case 'highlight_color_mode_button_off':
          setIsColorModeButtonHighlighted(false);
          break;
        case 'close_loco_color_modal_sequence':
          intercepted = true;
          setShowLocoColorModal(null);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_loco_sort_modal_on_sequence':
          intercepted = true;
          setShowLocoSortModal(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'loco_image_hover_on':
          setIsLocoImageHovered(true);
          break;
        case 'loco_image_hover_off':
          setIsLocoImageHovered(false);
          break;
        case 'show_swipe_animation_on':
          const swipeDelay = args[0] ? parseInt(args[0]) : 0;
          const runSwipeAnim = () => {
            setIsSwipeHandVisible(true);
            setSwipeHandSpeed((args[1] ? parseInt(args[1]) : 1500) / 1000);
            setSwipeHandDistance(args[2] ? parseInt(args[2]) : 100);
          };
          if (swipeOnTimeoutRef.current) clearTimeout(swipeOnTimeoutRef.current);
          if (swipeOffTimeoutRef.current) clearTimeout(swipeOffTimeoutRef.current);
          if (swipeDelay > 0) {
            swipeOnTimeoutRef.current = setTimeout(runSwipeAnim, swipeDelay);
          } else {
            runSwipeAnim();
          }
          break;
        case 'show_swipe_animation_off':
          const runSwipeOffAnim = () => {
             setIsSwipeHandVisible(false);
          };
          if (swipeOffTimeoutRef.current) clearTimeout(swipeOffTimeoutRef.current);
          const offDelay = args[0] ? parseInt(args[0]) : 0;
          if (offDelay > 0) {
            swipeOffTimeoutRef.current = setTimeout(runSwipeOffAnim, offDelay);
          } else {
            runSwipeOffAnim();
          }
          break;
        case 'edit_presets_on':
          setIsEditingPresets(true);
          break;
        case 'edit_presets_off':
          setIsEditingPresets(false);
          break;
        case 'compact_presets_on':
          const compOnDelay = args[0] ? parseInt(args[0]) : 0;
          if (compOnDelay > 0) setTimeout(() => setIsCompactLocoPresets(true), compOnDelay);
          else setIsCompactLocoPresets(true);
          break;
        case 'compact_presets_off':
          const compOffDelay = args[0] ? parseInt(args[0]) : 0;
          if (compOffDelay > 0) setTimeout(() => setIsCompactLocoPresets(false), compOffDelay);
          else setIsCompactLocoPresets(false);
          break;
        case 'highlight_compact_presets_on':
          setIsCompactPresetsHighlighted(true);
          break;
        case 'highlight_compact_presets_off':
          setIsCompactPresetsHighlighted(false);
          break;
        case 'highlight_compact_throttle_on':
          setIsCompactThrottleHighlighted(true);
          break;
        case 'highlight_compact_throttle_off':
          setIsCompactThrottleHighlighted(false);
          break;
        case 'highlight_throttle_settings_on':
          setIsThrottleSettingsHighlighted(true);
          break;
        case 'highlight_throttle_settings_off':
          setIsThrottleSettingsHighlighted(false);
          break;
        case 'tour_highlight_reverse_button_on':
          setIsReverseOrderButtonHighlighted(true);
          break;
        case 'tour_highlight_reverse_button_off':
          setIsReverseOrderButtonHighlighted(false);
          break;
        case 'tour_highlight_move_up_down_on':
          setIsMoveUpDownHighlighted(true);
          break;
        case 'tour_highlight_move_up_down_off':
          setIsMoveUpDownHighlighted(false);
          break;
        case 'tour_highlight_clear_consist_on':
          setIsClearConsistHighlighted(true);
          break;
        case 'tour_highlight_clear_consist_off':
          setIsClearConsistHighlighted(false);
          break;
        case 'tour_highlight_hide_all_consists_on':
          setIsHideAllConsistsHighlighted(true);
          break;
        case 'tour_highlight_hide_all_consists_off':
          setIsHideAllConsistsHighlighted(false);
          break;
        case 'tour_show_consist_warning_on':
          {
            const visibleIndices = getSortedIndices();
            const targetIdx = visibleIndices[0];
            const presetAddr = targetIdx !== undefined ? presets[targetIdx] : 12;
            const addrNum = typeof presetAddr === 'number' ? presetAddr : parseInt(presetAddr.toString()) || 12;
            setLocoInConsistWarning({ locoAddr: addrNum, consistId: 1 });
          }
          break;
        case 'tour_show_consist_warning_off':
          setLocoInConsistWarning(null);
          break;
        case 'tour_show_motion_warning_on':
          {
            setLocoIndividuallyMovingWarning({
              selectedConsistId: 1,
              leadLocoAddr: 3,
              conflicts: [
                { locoAddr: 3, speed: 10 },
                { locoAddr: 12, speed: 5 }
              ]
            });
          }
          break;
        case 'tour_show_motion_warning_off':
          setLocoIndividuallyMovingWarning(null);
          break;
        case 'tour_show_advanced_toggles_on':
          setShowAdvancedToggles(true);
          break;
        case 'tour_show_advanced_toggles_off':
          setShowAdvancedToggles(false);
          break;
        case 'tour_highlight_merge_btn_on':
          setIsMergeAddressHighlighted(true);
          break;
        case 'tour_highlight_merge_btn_off':
          setIsMergeAddressHighlighted(false);
          break;
        case 'tour_highlight_hide_header_btn_on':
          setIsHideHeaderHighlighted(true);
          break;
        case 'tour_highlight_hide_header_btn_off':
          setIsHideHeaderHighlighted(false);
          break;
        case 'tour_highlight_lock_btn_on':
          setIsLockScrollHighlighted(true);
          break;
        case 'tour_highlight_lock_btn_off':
          setIsLockScrollHighlighted(false);
          break;
        case 'tour_set_merge_address_on':
          setIsLocoAddressMerged(true);
          break;
        case 'tour_set_merge_address_off':
          setIsLocoAddressMerged(false);
          break;
        case 'tour_set_address_focus_on':
          setAddressFocusLevel(2);
          setIsScrollLocked(true);
          break;
        case 'tour_set_address_focus_off':
          setAddressFocusLevel(0);
          setIsScrollLocked(false);
          break;
        case 'highlight_presets_plus_minus_on':
          setIsEditingPresetsPlusMinusHighlighted(true);
          break;
        case 'highlight_presets_plus_minus_off':
          setIsEditingPresetsPlusMinusHighlighted(false);
          break;
        case 'add_one_preset':
          const addDelay = args[0] ? parseInt(args[0]) : 0;
          if (addDelay > 0) setTimeout(() => setVisiblePresetsCount(prev => Math.min(maxPresets, prev + 1)), addDelay);
          else setVisiblePresetsCount(prev => Math.min(maxPresets, prev + 1));
          break;
        case 'remove_one_preset':
          const rmDelay = args[0] ? parseInt(args[0]) : 0;
          if (rmDelay > 0) setTimeout(() => setVisiblePresetsCount(prev => Math.max(1, prev - 1)), rmDelay);
          else setVisiblePresetsCount(prev => Math.max(1, prev - 1));
          break;
        case 'highlight_sort_presets_button_on':
          setIsSortPresetsHighlighted(true);
          break;
        case 'highlight_sort_presets_button_off':
          setIsSortPresetsHighlighted(false);
          break;
        case 'highlight_export_config_button_on':
          setIsExportConfigHighlighted(true);
          break;
        case 'highlight_export_config_button_off':
          setIsExportConfigHighlighted(false);
          break;
        case 'show_loco_sort_modal_on':
          setShowLocoSortModal(true);
          break;
        case 'show_loco_sort_modal_off':
          setShowLocoSortModal(false);
          break;
        case 'open_delete_renumber_modal_sequence':
          intercepted = true;
          const drIdx = presets.findIndex(p => p !== '');
          if (drIdx !== -1) {
            const addr = presets[drIdx]?.toString() || '3';
            const nextAddr = getNextAvailableCabAddress(addr);
            setDeleteRenumberModal({
              isOpen: true,
              presetIndex: drIdx,
              addr,
              newAddr: nextAddr,
              lastValidAddr: nextAddr
            });
          }
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'close_delete_renumber_modal':
          setDeleteRenumberModal(prev => ({ ...prev, isOpen: false }));
          break;
        case 'highlight_roster_button_on':
          setIsRosterButtonHighlighted(true);
          break;
        case 'highlight_roster_button_off':
          setIsRosterButtonHighlighted(false);
          break;
        case 'show_roster_modal_on_sequence':
          intercepted = true;
          setPresetSnapshot({ max: maxPresets, visible: visiblePresetsCount });
          setShowPresetSliderModal(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_dcc_ex_import_conflict_on_sequence':
          intercepted = true;
          setImportWorkflow({
            queue: ['3'],
            currentIndex: 0,
            results: { added: 0, skipped: 0, hiddenAdded: false, maxIndexUsed: 0 },
            status: 'confirming',
            currentConflictAddr: '3'
          });
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_dcc_ex_import_finished_on_sequence':
          intercepted = true;
          setImportWorkflow({
            queue: ['3', '4', '5'],
            currentIndex: 3,
            results: { added: 3, skipped: 0, hiddenAdded: true, maxIndexUsed: 10 },
            status: 'finished',
            currentConflictAddr: null
          });
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_dcc_ex_import_conflict_on':
          setImportWorkflow({
            queue: ['3'],
            currentIndex: 0,
            results: { added: 0, skipped: 0, hiddenAdded: false, maxIndexUsed: 0 },
            status: 'confirming',
            currentConflictAddr: '3'
          });
          break;
        case 'show_dcc_ex_import_conflict_off':
          setImportWorkflow(prev => ({ ...prev, status: 'idle' }));
          break;
        case 'tour_add_loco_3_variant':
          {
            const mockDetailsFor3: DccExLocoDetails = {
              address: '3',
              description: 'SC 3',
              functions: [
                { number: 0, name: 'Headlight', isMomentary: false },
                { number: 1, name: 'Bell', isMomentary: false },
                { number: 2, name: 'Whistle', isMomentary: true },
                { number: 3, name: 'Short Whistle', isMomentary: false },
                { number: 4, name: 'Brake', isMomentary: false },
                { number: 5, name: 'Class Lights', isMomentary: false },
                { number: 7, name: 'Chatter', isMomentary: true },
                { number: 8, name: 'Mute', isMomentary: false },
                { number: 10, name: 'Half Speed', isMomentary: false }
              ]
            };
            setLocoDetailsCache(prev => ({ ...prev, '3': mockDetailsFor3 }));
            executeImport('3', 'createNew', mockDetailsFor3);
          }
          break;
        case 'tour_delete_loco_3_variant':
          const variantIdx = presets.findIndex(p => p.toString().startsWith('#3.'));
          if (variantIdx !== -1) {
            const addrToDelete = presets[variantIdx].toString();
            // Reset preset to 3 (empty slot)
            setPresets(prev => {
              const next = [...prev];
              next[variantIdx] = '3';
              return next;
            });
            // Clear all data keys associated with this specific variant address
            const clearKey = (setter: React.Dispatch<React.SetStateAction<any>>, addrKey: string) => {
              setter((prev: any) => {
                const next = { ...prev };
                delete next[addrKey];
                return next;
              });
            };
            clearKey(setLocoRoadNames, addrToDelete);
            clearKey(setLocoColors, addrToDelete);
            clearKey(setLocoOpacity, addrToDelete);
            clearKey(setLocoAccentColors, addrToDelete);
            clearKey(setLocoAccentOpacity, addrToDelete);
            clearKey(setLocoSettings, addrToDelete);
            clearKey(setLocoImages, addrToDelete);
            clearKey(setLocoPlaceholders, addrToDelete);
            clearKey(setLocoFunctionConfigs, addrToDelete);
            clearKey(setAllLocoFunctions, addrToDelete);
          }
          break;
        case 'show_roster_modal_on':
          setPresetSnapshot({ max: maxPresets, visible: visiblePresetsCount });
          setShowPresetSliderModal(true);
          break;
        case 'show_roster_modal_off':
          setShowPresetSliderModal(false);
          break;
        case 'show_hard_limit_modal_on_sequence':
          intercepted = true;
          setShowHardLimitSelection(true);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_hard_limit_modal_off':
          setShowHardLimitSelection(false);
          break;
        case 'show_dcc_ex_roster_modal_on_sequence':
          intercepted = true;
          isWaitingForRosterRef.current = true;
          sendCommand('JR');
          addLog('out', '<JR>');
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'show_dcc_ex_roster_modal_off':
          setShowDccExRosterModal(false);
          break;
        case 'click_import_locos':
          if (!showDccExRosterModal) {
            isWaitingForRosterRef.current = true;
            sendCommand('JR');
            addLog('out', '<JR>');
          }
          break;
        case 'click_roster_entry_first':
          if (dccExRoster.length > 0) {
            const addr = dccExRoster[0];
            isWaitingForSpecificLocoDetailsRef.current = addr;
            sendCommand(`JR ${getDccAddress(addr)}`);
            addLog('out', `<JR ${addr}>`);
          }
          break;
        case 'set_loco_details_modal_off':
          setShowDccExLocoDetailsModal(false);
          break;
        case 'select_first_dcc_ex_loco':
          if (dccExRosterRef.current.length > 0) {
            const addr = dccExRosterRef.current[0];
            setSelectedRosterAddrs(prev => {
              const next = new Set(prev);
              next.add(addr);
              return next;
            });
          }
          break;
        case 'unselect_first_dcc_ex_loco':
          if (dccExRosterRef.current.length > 0) {
            const addr = dccExRosterRef.current[0];
            setSelectedRosterAddrs(prev => {
              const next = new Set(prev);
              next.delete(addr);
              return next;
            });
          }
          break;
        case 'click_dcc_ex_details_import':
          if (showDccExLocoDetailsModal && selectedDccExLocoDetails) {
            const addr = selectedDccExLocoDetails.address;
            setSelectedRosterAddrs(prev => {
              const next = new Set(prev);
              if (next.has(addr)) next.delete(addr);
              else next.add(addr);
              return next;
            });
            setShowDccExLocoDetailsModal(false);
          }
          break;
        case 'show_dcc_ex_loco_details_modal_on_sequence':
          intercepted = true;
          if (dccExRosterRef.current.length > 0) {
            const addr = dccExRosterRef.current[0];
            isWaitingForSpecificLocoDetailsRef.current = addr;
            sendCommand(`JR ${getDccAddress(addr)}`);
            addLog('out', `<JR ${addr}>`);
          }
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'loco_preset_edit_animation':
          const lpAnimInitial = args[0] ? parseInt(args[0]) : 800;
          const lpAnimType = args[1] ? parseInt(args[1]) : 200;
          const lpAnimNext = args[2] ? parseInt(args[2]) : 400;
          
          setTimeout(() => {
            // Get original index of first visible preset
            const firstIdx = getSortedIndices()[0];
            
            // Type 1234 into first preset address box
            setPresets(prev => {
              const next = [...prev];
              next[firstIdx] = '1';
              return next;
            });
            setTimeout(() => {
              setPresets(prev => {
                const next = [...prev];
                next[firstIdx] = '12';
                return next;
              });
              setTimeout(() => {
                setPresets(prev => {
                  const next = [...prev];
                  next[firstIdx] = '123';
                  return next;
                });
                setTimeout(() => {
                  setPresets(prev => {
                    const next = [...prev];
                    next[firstIdx] = '1234';
                    return next;
                  });
                  // Address is 1234 now
                  
                  setTimeout(() => {
                    // Type DDT into the first road name box
                    setLocoRoadNames(prev => ({
                      ...prev,
                      ['1234']: 'D'
                    }));
                    setTimeout(() => {
                      setLocoRoadNames(prev => ({
                        ...prev,
                        ['1234']: 'DD'
                      }));
                      setTimeout(() => {
                        setLocoRoadNames(prev => ({
                          ...prev,
                          ['1234']: 'DDT'
                        }));
                        
                        setTimeout(() => {
                          // Finalize/Deselect
                          setCabAddress('1234');
                          setPendingCabAddress('1234');
                        }, lpAnimNext);
                      }, lpAnimType);
                    }, lpAnimType);
                  }, lpAnimNext);
                }, lpAnimType);
              }, lpAnimType);
            }, lpAnimType);
          }, lpAnimInitial);
          break;
        case 'select_first_preset':
        case 'select_second_preset':
        case 'select_third_preset':
          const targetIndex = action === 'select_first_preset' ? 0 : action === 'select_second_preset' ? 1 : 2;
          const selectDelay = args[0] ? parseInt(args[0]) : 0;
          const runSelectPreset = () => {
            const visibleIndices = getSortedIndices();
            const targetIdx = visibleIndices[targetIndex];
            if (targetIdx !== undefined) {
              const presetAddr = presets[targetIdx];
              if (presetAddr !== undefined && presetAddr !== '') {
                setCabAddress(presetAddr.toString());
                setPendingCabAddress(presetAddr.toString());
              }
            }
          };
          if (selectDelay > 0) {
            setTimeout(runSelectPreset, selectDelay);
          } else {
            runSelectPreset();
          }
          break;
        case 'show_road_names_on':
          setShowRoadNames(true);
          break;
        case 'show_road_names_off':
          setShowRoadNames(false);
          break;
        case 'show_loco_colors_on':
          setShowLocoColors(true);
          break;
        case 'show_loco_colors_off':
          setShowLocoColors(false);
          break;
        case 'show_function_colors_on':
          setShowLocoFunctionColors(true);
          break;
        case 'show_function_colors_off':
          setShowLocoFunctionColors(false);
          break;
        case 'set_steam_placeholder_on':
        case 'set_steam_placeholder_off':
        case 'set_diesel_placeholder_on':
        case 'set_diesel_placeholder_off':
          const placeholderDelay = args[0] ? parseInt(args[0]) : 0;
          const runSetPlaceholder = () => {
            const currentCab = cabAddressRef.current.toString();
            if (currentCab) {
              setLocoPlaceholders(prev => {
                const next = { ...prev };
                if (action === 'set_steam_placeholder_on') next[currentCab] = 'steam';
                if (action === 'set_steam_placeholder_off') delete next[currentCab];
                if (action === 'set_diesel_placeholder_on') next[currentCab] = 'diesel';
                if (action === 'set_diesel_placeholder_off') delete next[currentCab];
                return next;
              });
            }
          };
          if (placeholderDelay > 0) {
            setTimeout(runSetPlaceholder, placeholderDelay);
          } else {
            runSetPlaceholder();
          }
          break;
        case 'tour_show_consists':
          setIsConsistSetupMode(true);
          setHideAllConsists(false);
          setSelectedConsistId(consists[0]?.id || 1);
          setCabAddress('');
          setPendingCabAddress('');
          break;
        case 'tour_prepare_consist_1':
          {
            tourScheduledTimeoutsRef.current.forEach(t => clearTimeout(t));
            tourScheduledTimeoutsRef.current = [];
            const currentC1 = consistsRef.current.find(c => c.id === 1);
            if (currentC1 && !tourConsist1BackupRef.current) {
              const deepCopy = JSON.parse(JSON.stringify(currentC1));
              setTourConsist1Backup(deepCopy);
              tourConsist1BackupRef.current = deepCopy;
              tourConsist1SpeedBackupRef.current = consistSpeedsRef.current[1] !== undefined ? consistSpeedsRef.current[1] : 0;
              consistSpeedsRef.current[1] = 0;
            }
            setConsists(prev => prev.map(c => {
              if (c.id !== 1) return c;
              return { ...c, locos: [], isVisible: false, isFlipped: false };
            }));
            setIsConsistSetupMode(true);
            setHideAllConsists(false);
            setSelectedConsistId(1);
            setCabAddress('');
            setPendingCabAddress('');
          }
          break;
        case 'tour_prepare_consist_1_sequence':
          {
            intercepted = true;
            tourScheduledTimeoutsRef.current.forEach(t => clearTimeout(t));
            tourScheduledTimeoutsRef.current = [];
            const currentC1 = consistsRef.current.find(c => c.id === 1);
            if (currentC1 && !tourConsist1BackupRef.current) {
              const deepCopy = JSON.parse(JSON.stringify(currentC1));
              setTourConsist1Backup(deepCopy);
              tourConsist1BackupRef.current = deepCopy;
              tourConsist1SpeedBackupRef.current = consistSpeedsRef.current[1] !== undefined ? consistSpeedsRef.current[1] : 0;
              consistSpeedsRef.current[1] = 0;
            }
            setConsists(prev => prev.map(c => {
              if (c.id !== 1) return c;
              return { ...c, locos: [], isVisible: false, isFlipped: false };
            }));
            setIsConsistSetupMode(true);
            setHideAllConsists(false);
            setSelectedConsistId(1);
            setCabAddress('');
            setPendingCabAddress('');
            if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
            else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
            else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          }
          break;
        case 'tour_restore_consist_1':
          {
            const backup = tourConsist1BackupRef.current || tourConsist1Backup;
            if (backup) {
              const deepCopy = JSON.parse(JSON.stringify(backup));
              setConsists(prev => prev.map(c => {
                if (c.id !== 1) return c;
                return { ...deepCopy };
              }));
              setTourConsist1Backup(null);
              tourConsist1BackupRef.current = null;
              if (tourConsist1SpeedBackupRef.current !== null) {
                consistSpeedsRef.current[1] = tourConsist1SpeedBackupRef.current;
                tourConsist1SpeedBackupRef.current = null;
              }
            }
            tourScheduledTimeoutsRef.current.forEach(t => clearTimeout(t));
            tourScheduledTimeoutsRef.current = [];
          }
          break;
        case 'tour_select_preset_1':
          {
            const delayTime = args[0] ? parseInt(args[0]) : 0;
            if (delayTime === 0) {
              const sorted = getSortedIndices();
              if (sorted && sorted[0] !== undefined) {
                const idx = sorted[0];
                const addr = presets[idx];
                const addrNum = getDccAddress(addr);
                toggleLocoInConsist(addrNum, addr);
              }
            } else {
              const t = setTimeout(() => {
                const sorted = getSortedIndices();
                if (sorted && sorted[0] !== undefined) {
                  const idx = sorted[0];
                  const addr = presets[idx];
                  const addrNum = getDccAddress(addr);
                  toggleLocoInConsist(addrNum, addr);
                }
              }, delayTime);
              tourScheduledTimeoutsRef.current.push(t);
            }
          }
          break;
        case 'tour_select_preset_2':
          {
            const delayTime = args[0] ? parseInt(args[0]) : 0;
            if (delayTime === 0) {
              const sorted = getSortedIndices();
              if (sorted && sorted[1] !== undefined) {
                const idx = sorted[1];
                const addr = presets[idx];
                const addrNum = getDccAddress(addr);
                toggleLocoInConsist(addrNum, addr);
              }
            } else {
              const t = setTimeout(() => {
                const sorted = getSortedIndices();
                if (sorted && sorted[1] !== undefined) {
                  const idx = sorted[1];
                  const addr = presets[idx];
                  const addrNum = getDccAddress(addr);
                  toggleLocoInConsist(addrNum, addr);
                }
              }, delayTime);
              tourScheduledTimeoutsRef.current.push(t);
            }
          }
          break;
        case 'tour_select_preset_3':
          {
            const delayTime = args[0] ? parseInt(args[0]) : 0;
            console.log("TS_3 debug:", { delayTime, direction, isConsistSetupMode, selectedConsistId });
            if (delayTime === 0) {
              const sorted = getSortedIndices();
              console.log("TS_3 sorted indices:", sorted);
              if (sorted && sorted[2] !== undefined) {
                const idx = sorted[2];
                const addr = presets[idx];
                const addrNum = getDccAddress(addr);
                console.log("TS_3 toggling loco:", { idx, addr, addrNum });
                toggleLocoInConsist(addrNum, addr);
              } else {
                console.warn("TS_3 sorted[2] is undefined", sorted);
              }
            } else {
              const t = setTimeout(() => {
                const sorted = getSortedIndices();
                if (sorted && sorted[2] !== undefined) {
                  const idx = sorted[2];
                  const addr = presets[idx];
                  const addrNum = getDccAddress(addr);
                  toggleLocoInConsist(addrNum, addr);
                }
              }, delayTime);
              tourScheduledTimeoutsRef.current.push(t);
            }
          }
          break;
        case 'tour_set_consist_1_three_forward':
          {
            setIsConsistSetupMode(true);
            setHideAllConsists(false);
            setSelectedConsistId(1);
            const sorted = getSortedIndices();
            const locosList: { address: number; cabAddress: string | number; isReverse: boolean }[] = [];
            
            if (sorted && sorted[0] !== undefined) {
              const a = presets[sorted[0]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            if (sorted && sorted[1] !== undefined) {
              const a = presets[sorted[1]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            if (sorted && sorted[2] !== undefined) {
              const a = presets[sorted[2]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            
            setConsists(prev => prev.map(c => {
              if (c.id !== 1) return c;
              return { ...c, locos: locosList, isVisible: true, isFlipped: false };
            }));
          }
          break;
         case 'tour_set_consist_1_three_preset_3_reverse':
          {
            setIsConsistSetupMode(true);
            setHideAllConsists(false);
            setSelectedConsistId(1);
            const sorted = getSortedIndices();
            const locosList: { address: number; cabAddress: string | number; isReverse: boolean }[] = [];
            
            if (sorted && sorted[0] !== undefined) {
              const a = presets[sorted[0]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            if (sorted && sorted[1] !== undefined) {
              const a = presets[sorted[1]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            if (sorted && sorted[2] !== undefined) {
              const a = presets[sorted[2]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: true });
            }
            
            setConsists(prev => prev.map(c => {
              if (c.id !== 1) return c;
              return { ...c, locos: locosList, isVisible: true, isFlipped: false };
            }));
          }
          break;
        case 'tour_set_consist_1_two_preset_3_reverse':
          {
            setIsConsistSetupMode(true);
            setHideAllConsists(false);
            setSelectedConsistId(1);
            const sorted = getSortedIndices();
            const locosList: { address: number; cabAddress: string | number; isReverse: boolean }[] = [];
            
            if (sorted && sorted[0] !== undefined) {
              const a = presets[sorted[0]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            if (sorted && sorted[2] !== undefined) {
              const a = presets[sorted[2]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: true });
            }
            
            setConsists(prev => prev.map(c => {
              if (c.id !== 1) return c;
              return { ...c, locos: locosList, isVisible: true, isFlipped: false };
            }));
          }
          break;
        case 'tour_set_consist_1_reversed_order':
          {
            setIsConsistSetupMode(true);
            setHideAllConsists(false);
            setSelectedConsistId(1);
            const sorted = getSortedIndices();
            const locosList: { address: number; cabAddress: string | number; isReverse: boolean }[] = [];
            
            if (sorted && sorted[2] !== undefined) {
              const a = presets[sorted[2]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: false });
            }
            if (sorted && sorted[0] !== undefined) {
              const a = presets[sorted[0]];
              if (a !== undefined && a !== '') locosList.push({ address: getDccAddress(a), cabAddress: a, isReverse: true });
            }
            
            setConsists(prev => prev.map(c => {
              if (c.id !== 1) return c;
              return { ...c, locos: locosList, isVisible: true, isFlipped: true };
            }));
          }
          break;
        case 'tour_long_press_preset_2':
          {
            const delayTime = args[0] ? parseInt(args[0]) : 0;
            if (delayTime === 0) {
              const sorted = getSortedIndices();
              if (sorted && sorted[1] !== undefined) {
                const idx = sorted[1];
                const addr = presets[idx];
                const addrNum = getDccAddress(addr);
                removeLocoFromConsist(addrNum);
              }
            } else {
              const t = setTimeout(() => {
                const sorted = getSortedIndices();
                if (sorted && sorted[1] !== undefined) {
                  const idx = sorted[1];
                  const addr = presets[idx];
                  const addrNum = getDccAddress(addr);
                  removeLocoFromConsist(addrNum);
                }
              }, delayTime);
              tourScheduledTimeoutsRef.current.push(t);
            }
          }
          break;
        case 'tour_show_consists_sequence':
          intercepted = true;
          setIsConsistSetupMode(true);
          setHideAllConsists(false);
          setSelectedConsistId(consists[0]?.id || 1);
          setCabAddress('');
          setPendingCabAddress('');
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_hide_consists':
          setIsConsistSetupMode(false);
          setHideAllConsists(true);
          setSelectedConsistId(null);
          break;
        case 'tour_consist_setup_off':
          setIsConsistSetupMode(false);
          setHideAllConsists(false);
          setSelectedConsistId(null);
          setActiveConsistId(1);
          {
            const consist = consistsRef.current.find(c => c.id === 1);
            if (consist && consist.locos.length > 0) {
              const leadLoco = consist.locos[0];
              setCabAddress(leadLoco.address);
              setPendingCabAddress(leadLoco.address);
              setIsForward(!leadLoco.isReverse);
              const consistSpeed = consistSpeedsRef.current[1] || 0;
              setSpeed(consistSpeed);
            }
          }
          break;
        case 'tour_toggle_consist_1':
          {
            const delayTime = args[0] ? parseInt(args[0]) : 0;
            if (delayTime === 0) {
              handleConsistPresetClick(1);
            } else {
              const t = setTimeout(() => {
                handleConsistPresetClick(1);
              }, delayTime);
              tourScheduledTimeoutsRef.current.push(t);
            }
          }
          break;
        case 'tour_consist_setup_off_sequence':
          intercepted = true;
          setIsConsistSetupMode(false);
          setHideAllConsists(false);
          setSelectedConsistId(null);
          setActiveConsistId(1);
          {
            const consist = consistsRef.current.find(c => c.id === 1);
            if (consist && consist.locos.length > 0) {
              const leadLoco = consist.locos[0];
              setCabAddress(leadLoco.address);
              setPendingCabAddress(leadLoco.address);
              setIsForward(!leadLoco.isReverse);
              const consistSpeed = consistSpeedsRef.current[1] || 0;
              setSpeed(consistSpeed);
            }
          }
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_hide_consists_sequence':
          intercepted = true;
          setIsConsistSetupMode(false);
          setHideAllConsists(true);
          setSelectedConsistId(null);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_show_consist_warning_on_sequence':
          intercepted = true;
          {
            const visibleIndices = getSortedIndices();
            const targetIdx = visibleIndices[0];
            const presetAddr = targetIdx !== undefined ? presets[targetIdx] : 12;
            const addrNum = typeof presetAddr === 'number' ? presetAddr : parseInt(presetAddr.toString()) || 12;
            setLocoInConsistWarning({ locoAddr: addrNum, consistId: 1 });
          }
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'tour_show_consist_warning_off_sequence':
          intercepted = true;
          setLocoInConsistWarning(null);
          if (direction === 'next') setTimeout(() => driverInstance?.moveNext(), delay);
          else if (direction === 'prev') setTimeout(() => driverInstance?.movePrevious(), delay);
          else if (direction === 'show') setTimeout(() => driverInstance?.refresh(), delay);
          break;
        case 'disconnect_all':
          // Robust disconnection: try all modes independently
          await disconnect('emulator');
          await disconnect('wifi');
          await disconnect('serial');
          
          // Force reset all connection-related states
          setIsEmulatorConnected(false);
          setIsWifiConnected(false);
          setPort(null);
          setTrackPower(false);
          setSpeed(0);
          setFunctions({});
          setConnectionMode('serial'); 
          setTrackBlocks([
            { letter: 'A', state: 'MAIN', cab: 0, power: false },
            { letter: 'B', state: 'PROG', cab: 0, power: false }
          ]);
          break;
      }
    }
    return intercepted;
  }, [
    uiTheme, 
    uiDensity, 
    selectedBlockForEdit, 
    restoreTourSettings, 
    disconnect, 
    connect, 
    getStationStatus,
    dccExRoster,
    showDccExRosterModal,
    showDccExLocoDetailsModal,
    selectedDccExLocoDetails,
    setSelectedRosterAddrs,
    presets,
    sendCommand,
    addLog,
    getSortedIndices,
    getDccAddress,
    tourFirstPresetBackup,
    tourConsist1Backup,
    setConsists,
    setSelectedConsistId,
    locoRoadNames,
    locoColors,
    locoOpacity,
    locoAccentColors,
    locoAccentOpacity,
    locoSettings,
    locoImages,
    locoPlaceholders,
    locoFunctionConfigs,
    allLocoFunctions
  ]);

  const handleTourActionsRef = useRef(handleTourActions);
  useEffect(() => { handleTourActionsRef.current = handleTourActions; }, [handleTourActions]);

  const startTour = async (startIndex?: number) => {
    setIsTourActive(true);
    setIsBlocksView(false); // Reset to standard view on tour start
    
    // If no specific step provided, just show the menu
    if (startIndex === undefined) {
      setTourExitStatus(null);
      setShowTourMenu(true);
      return;
    }

    setShowTourMenu(false);
    
    // Run tour initialization routine
    await handleTourActionsRef.current(tourInitializationActions);

    if (startIndex !== undefined && tourSteps[startIndex]) {
      const step = tourSteps[startIndex] as any;
      if (step.onShow) {
        await handleTourActionsRef.current(step.onShow);
        await new Promise(r => setTimeout(r, 200)); // let React commit DOM
      }
    }

    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      overlayClickBehavior: () => {},
      disableActiveInteraction: true,
      allowKeyboardControl: false,
      overlayOpacity: 0.5,
      steps: tourSteps,
      //@ts-ignore
      onPopoverRender: (popover, { driver }) => {
        const activeIndex = driver.getActiveIndex();
        const progress = document.querySelector('.driver-popover-progress-text');
        
        if (progress) {
          progress.textContent = `${activeIndex + 1} of ${tourSteps.length}`;
        }

        const currentStep = (driver.getActiveStep ? driver.getActiveStep() : tourSteps[activeIndex]) as any;
        
        let sights = currentStep?.popover?.sights;
        if (!sights && currentStep?.popover?.sightsFromStep) {
          const refStepNum = currentStep.popover.sightsFromStep;
          const refStep = tourSteps[refStepNum - 1];
          if (refStep && refStep.popover) {
            sights = (refStep.popover as any).sights;
          }
        }

        const wrapperEl = (popover as any).wrapper || (popover as any);
        if (wrapperEl) {
          if (wrapperEl.style) {
            wrapperEl.style.removeProperty('height');
            wrapperEl.style.removeProperty('min-height');
            wrapperEl.style.removeProperty('width');
            wrapperEl.style.removeProperty('min-width');
            wrapperEl.style.removeProperty('transform');
            wrapperEl.style.removeProperty('margin-left');
            wrapperEl.style.removeProperty('margin-top');
          }
          // Remove previously applied custom-popover- classes to keep state clean between steps
          const classesToRemove = Array.from(wrapperEl.classList).filter((c: any) => c.startsWith('custom-popover-'));
          classesToRemove.forEach((c: any) => wrapperEl.classList.remove(c));
        }

        // Handle custom shift/popover class styles
        if (currentStep?.popover?.popoverClass) {
          setTimeout(() => {
            const classes = currentStep.popover.popoverClass.split(/\s+/);
            let tx = 0;
            let ty = 0;
            let hasShift = false;

            classes.forEach((cls: string) => {
              const upMatch = cls.match(/^custom-popover-shift-up:(-?\d+)$/);
              const downMatch = cls.match(/^custom-popover-shift-down:(-?\d+)$/);
              const leftMatch = cls.match(/^custom-popover-shift-left:(-?\d+)$/);
              const rightMatch = cls.match(/^custom-popover-shift-right:(-?\d+)$/);
              const shiftXMatch = cls.match(/^custom-popover-shift-x:(-?\d+)$/);
              const shiftYMatch = cls.match(/^custom-popover-shift-y:(-?\d+)$/);
              
              if (upMatch) {
                ty -= parseInt(upMatch[1], 10);
                hasShift = true;
              } else if (downMatch) {
                ty += parseInt(downMatch[1], 10);
                hasShift = true;
              } else if (leftMatch) {
                tx -= parseInt(leftMatch[1], 10);
                hasShift = true;
              } else if (rightMatch) {
                tx += parseInt(rightMatch[1], 10);
                hasShift = true;
              } else if (shiftXMatch) {
                tx += parseInt(shiftXMatch[1], 10);
                hasShift = true;
              } else if (shiftYMatch) {
                ty += parseInt(shiftYMatch[1], 10);
                hasShift = true;
              } else {
                wrapperEl.classList.add(cls);
              }
            });

            if (hasShift) {
              if (tx !== 0) wrapperEl.style.setProperty('margin-left', `${tx}px`, 'important');
              if (ty !== 0) wrapperEl.style.setProperty('margin-top', `${ty}px`, 'important');
            }
          }, 0);
        }

        const sightsContainer = wrapperEl.querySelector('.driver-popover-sights-container');
        if (sightsContainer) {
          sightsContainer.remove();
        }

        if (sights && Array.isArray(sights) && sights.length > 0) {
          const descEl = wrapperEl.querySelector('.driver-popover-description');
          if (descEl) {
            const container = document.createElement('div');
            if (currentStep?.popover?.showSightsToggle) {
              container.className = 'driver-popover-sights-container mt-4 mb-3 pt-3 border-t border-card-border/40';
              container.style.display = 'none';
            } else {
              container.className = 'driver-popover-sights-container mt-4 mb-3 pt-3 border-t border-card-border/40';
              container.style.display = 'block';
            }
            
            const header = document.createElement('h4');
            header.className = 'text-[11px] font-black text-accent uppercase tracking-widest mb-1';
            header.textContent = 'Sights along the way:';
            container.appendChild(header);
            
            const list = document.createElement('div');
            list.className = 'flex flex-col gap-0';
            
            sights.forEach((item: any) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'tour-stop-link w-full text-left text-[13px] hover:translate-x-1 transition-all flex items-center gap-2 group cursor-pointer text-text-muted hover:text-accent font-medium';
              
              const dot = document.createElement('span');
              dot.className = 'w-1.5 h-1.5 rounded-full bg-accent/20 transition-colors group-hover:bg-accent';
              
              const textSpan = document.createElement('span');
              textSpan.textContent = `${item.label} (${item.step})`;
              
              btn.appendChild(dot);
              btn.appendChild(textSpan);
              
              btn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handleTourActionsRef.current(['tour_stop_restart_cleanup'], driver, 'show');
                const targetStepIndex = item.step - 1;
                const targetStepObj = tourSteps[targetStepIndex] as any;
                if (targetStepObj?.onShow) {
                  await handleTourActionsRef.current(targetStepObj.onShow, driver, 'show');
                }
                setTimeout(() => {
                  driver.drive(targetStepIndex);
                }, 200);
              };
              
              list.appendChild(btn);
            });
            
            container.appendChild(list);
            
            if (descEl.parentNode) {
              descEl.parentNode.insertBefore(container, descEl.nextSibling);
            } else {
              descEl.appendChild(container);
            }
          }
        }

        // Cleanup existing toggle button if any
        const existingToggle = wrapperEl.querySelector('.driver-popover-sights-toggle');
        if (existingToggle) {
          existingToggle.remove();
        }

        // Cleanup existing replay button if any
        const existingReplay = wrapperEl.querySelector('.driver-popover-replay-btn');
        if (existingReplay) {
          existingReplay.remove();
        }

        const prevBtn = wrapperEl.querySelector('.driver-popover-prev-btn');
        const footerBtns = wrapperEl.querySelector('.driver-popover-footer-btns') || wrapperEl.querySelector('.driver-popover-navigation-btns');
        
        if (currentStep?.popover?.showReplay) {
          const replayBtn = document.createElement('button');
          replayBtn.type = 'button';
          replayBtn.className = 'driver-popover-replay-btn p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center justify-center !border-0 !bg-transparent !shadow-none cursor-pointer mr-2';
          replayBtn.title = 'Replay Animation';
          replayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;
          
          replayBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentStep.onShow) {
              await handleTourActionsRef.current(currentStep.onShow, driver, 'show', currentStep);
            }
          };

          if (prevBtn && prevBtn.parentNode) {
            prevBtn.parentNode.insertBefore(replayBtn, prevBtn);
          } else if (footerBtns) {
            footerBtns.appendChild(replayBtn);
          }
        }
        
        if (currentStep?.popover?.showSightsToggle) {
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'driver-popover-sights-toggle p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center justify-center !border-0 !bg-transparent !shadow-none cursor-pointer';
          toggleBtn.title = 'Sights along the way';
          toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;
          
          let stateSightsVisible = false;
          let hDesc = 0;
          let hSights = 0;
          
          const updateVisibility = () => {
            const descEl = wrapperEl.querySelector('.driver-popover-description');
            const container = wrapperEl.querySelector('.driver-popover-sights-container');
            if (stateSightsVisible) {
              if (descEl) descEl.style.setProperty('display', 'none', 'important');
              if (container) container.style.setProperty('display', 'block', 'important');
              toggleBtn.className = 'driver-popover-sights-toggle active p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center justify-center !border-0 !bg-transparent !shadow-none cursor-pointer mr-2';
              
              // Prevent shrinking: if hSights path is shorter than hDesc, min-height forces it to stay at hDesc.
              // Otherwise, we allow it to expand to hSights.
              const targetMinHeight = hSights < hDesc ? hDesc : hSights;
              if (targetMinHeight > 0) {
                wrapperEl.style.setProperty('min-height', `${targetMinHeight}px`, 'important');
              }
            } else {
              if (descEl) descEl.style.setProperty('display', 'block', 'important');
              if (container) container.style.setProperty('display', 'none', 'important');
              toggleBtn.className = 'driver-popover-sights-toggle p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center justify-center !border-0 !bg-transparent !shadow-none cursor-pointer mr-2';
              
              // On default view (description), set min-height to its natural starting height hDesc
              if (hDesc > 0) {
                wrapperEl.style.setProperty('min-height', `${hDesc}px`, 'important');
              }
            }
          };

          toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            stateSightsVisible = !stateSightsVisible;
            updateVisibility();
          };

          // Initialize visibility state in next tick to ensure container elements exist
          setTimeout(() => {
            const descEl = wrapperEl.querySelector('.driver-popover-description');
            const container = wrapperEl.querySelector('.driver-popover-sights-container');

            let maxTrackedWidth = 0;

            if (descEl && container) {
              // 1. Measure description view (natural initial state)
              descEl.style.setProperty('display', 'block', 'important');
              container.style.setProperty('display', 'none', 'important');
              hDesc = wrapperEl.offsetHeight;
              const w1 = wrapperEl.offsetWidth;

              // 2. Measure sights view (hidden interactive state)
              descEl.style.setProperty('display', 'none', 'important');
              container.style.setProperty('display', 'block', 'important');
              hSights = wrapperEl.offsetHeight;
              const w2 = wrapperEl.offsetWidth;

              maxTrackedWidth = Math.max(w1, w2);
            } else {
              hDesc = wrapperEl.offsetHeight;
              hSights = wrapperEl.offsetHeight;
              maxTrackedWidth = wrapperEl.offsetWidth;
            }

            if (maxTrackedWidth > 0) {
              wrapperEl.style.setProperty('min-width', `${maxTrackedWidth}px`, 'important');
            }
            updateVisibility();
          }, 0);

          if (prevBtn && prevBtn.parentNode) {
            prevBtn.parentNode.insertBefore(toggleBtn, prevBtn);
          } else if (footerBtns) {
            footerBtns.appendChild(toggleBtn);
          }
        }
      },
      //@ts-ignore
      onNextClick: async (element, step, { driver }) => {
        const customStep = step as any;
        const intercepted = await handleTourActionsRef.current(customStep.onNext, driver, 'next', customStep);
        if (!intercepted) {
          driver.moveNext();
        }
      },
      //@ts-ignore
      onCloseClick: async (element, step, { driver }) => {
          const activeIndex = driver.getActiveIndex();
          const isFirstStepOfStop = tourStopsMenu.some(s => s.targetStep === activeIndex + 1);
          if (isFirstStepOfStop) {
            setTourExitStatus('completed');
            setLastTourStopIndex(activeIndex - 1);
          } else {
            setTourExitStatus('canceled');
          }
          await handleTourActionsRef.current(tourTerminationActions);
          driver.destroy();

          setShowTourMenu(true);
      },
      //@ts-ignore
      onPrevClick: async (element, step, { driver }) => {
        const customStep = step as any;
        const intercepted = await handleTourActionsRef.current(customStep.onPrev, driver, 'prev', customStep);
        if (!intercepted) {
          driver.movePrevious();
        }
      },
      //@ts-ignore - onHighlightStarted is supported in driver.js v1+
      onHighlightStarted: async (element, step, { driver }) => {
        const customStep = step as any;
        const activeIndex = driver.getActiveIndex();

        setLastTourStopIndex(activeIndex);
        
        // Update current step rect for generic overlays
        if (element instanceof HTMLElement) {
          setCurrentTourStepRect(element.getBoundingClientRect());
        } else if (typeof element === 'string') {
          const el = document.querySelector(element) as HTMLElement | null;
          if (el) setCurrentTourStepRect(el.getBoundingClientRect());
        }

        // Clear any lingering animation timeouts from the previous tour step
        tourScheduledTimeoutsRef.current.forEach(t => clearTimeout(t));
        tourScheduledTimeoutsRef.current = [];
        
        await handleTourActionsRef.current(customStep.onShow, driver, 'show', customStep);

        if (customStep.popoverDelay) {
          document.body.classList.add('driver-popover-delayed');
          setTimeout(() => {
            document.body.classList.remove('driver-popover-delayed');
            driver.refresh();
          }, customStep.popoverDelay);
        }
      },
      //@ts-ignore
      onDestroyed: () => {
        window.removeEventListener('keydown', handleKeydown, true);
        document.body.classList.remove('driver-popover-delayed');
        setShowWifiAdvice(false);
        setShowTerminal(false);
        setIsTourActive(false);
        tourRef.current = null;
        setIsTourDemoAssignmentActive(false);
        isTourDemoAssignmentActiveRef.current = false;
      }
    });

    const handleKeydown = async (e: KeyboardEvent) => {
      // Prevent Enter/Return from closing the tour
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const step = driverObj.getActiveStep() as any;
        const intercepted = await handleTourActionsRef.current(step?.onNext, driverObj, 'next', step);
        if (!intercepted) {
          driverObj.moveNext();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();

        const step = driverObj.getActiveStep() as any;
        const intercepted = await handleTourActionsRef.current(step?.onPrev, driverObj, 'prev', step);
        if (!intercepted) {
          driverObj.movePrevious();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        const activeIndex = driverObj.getActiveIndex();
        const isFirstStepOfStop = tourStopsMenu.some(s => s.targetStep === activeIndex + 1);
        if (isFirstStepOfStop) {
          setTourExitStatus('completed');
          setLastTourStopIndex(activeIndex - 1);
        } else {
          setTourExitStatus('canceled');
          if (activeIndex === 0) setLastTourStopIndex(null);
        }

        driverObj.destroy();
        setIsTourActive(false);
        setShowTourMenu(true);
      }
    };

    window.addEventListener('keydown', handleKeydown, true);
    tourRef.current = driverObj;
    driverObj.drive(startIndex);
  };

  const handleEndTour = useCallback(async () => {
    setShowTourMenu(false);
    setIsTourActive(false);
    await handleTourActions(tourTerminationActions);
    setTourMemoryStatus('restoring');
    restoreTourSettings();
    setTimeout(() => setTourMemoryStatus(null), TOUR_RESTORE_DELAY);
  }, [handleTourActions, restoreTourSettings]);

  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (!showTourMenu) return;

      if (e.key === 'Escape') {
        handleEndTour();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Replicate highlighting logic to determine where to start
        const currentStopIdx = (() => {
          if (lastTourStopIndex === null) return -1;
          if (lastTourStopIndex <= 5) return -2; // Intro
          for (let i = tourStopsMenu.length - 1; i >= 0; i--) {
            if (lastTourStopIndex + 1 >= tourStopsMenu[i].targetStep) return i;
          }
          return -1;
        })();

        let targetStep = 0; // Default: start from step one (Intro)
        
        // Find if any stop is highlighted
        for (let idx = 0; idx < tourStopsMenu.length; idx++) {
          const isNext = tourExitStatus === 'completed' && (
            (currentStopIdx === -2 && idx === 0) || 
            (currentStopIdx === idx - 1)
          );
          const isCurrent = tourExitStatus === 'canceled' && currentStopIdx === idx;

          if (isCurrent && lastTourStopIndex !== null) {
            targetStep = lastTourStopIndex;
            break;
          } else if (isNext) {
            targetStep = tourStopsMenu[idx].targetStep - 1;
            break;
          }
        }

        startTour(targetStep);
      }
    };
    window.addEventListener('keydown', handleGlobalKeydown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeydown, true);
  }, [showTourMenu, lastTourStopIndex, tourExitStatus, tourStopsMenu, handleEndTour, startTour]);


  return (
    <div className={`min-h-screen bg-app-bg text-text-main font-sans selection:bg-accent/30 overflow-x-hidden transition-colors duration-500 py-0`}>
      <input 
        type="file" 
        ref={iconInputRef} 
        className="hidden" 
        accept="image/*,.svg" 
        onChange={handleIconUpload} 
      />
      <div id="tour-app-content" className={`${uiDensity === 0 ? 'max-w-[1600px]' : uiDensity === 1 ? 'max-w-[1200px]' : uiDensity === 2 ? 'max-w-[1000px]' : 'max-w-full'} mx-auto ${uiDensity === 3 ? 'p-1' : 'p-4'} ${uiDensity === 0 ? 'space-y-4' : uiDensity === 1 ? 'space-y-4' : uiDensity === 2 ? 'space-y-2' : 'space-y-1'}`}>
        
        {/* Header & Connection */}
        {addressFocusLevel === 0 && (
        <header id="tour-header-card" ref={headerRef} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card-bg ${uiDensity === 0 ? 'p-6' : uiDensity === 1 ? 'p-4 py-3' : uiDensity === 2 ? 'p-3 py-2' : 'p-2 py-1'} rounded-3xl border border-card-border backdrop-blur-xl relative z-[60]`}>
          <div className="flex items-center gap-4">
            <div>
              <button 
                id="tour-app-icon"
                onClick={() => {
                  setIconSettingsMode(customAppIconEnabled ? 'custom' : 'default');
                  setShowIconSettingsModal(true);
                }}
                className={`group relative overflow-hidden transition-all border border-accent/30 hover:bg-accent/30 bg-accent/20 ${uiDensity === 0 ? 'p-3 rounded-2xl' : uiDensity === 1 ? 'p-2 rounded-xl' : uiDensity === 2 ? 'p-1.5 rounded-lg' : 'p-1 rounded-md'}`}
                title="Manage application icon"
              >
                {(() => {
                  const baseSize = uiDensity === 0 ? 32 : uiDensity === 1 ? 24 : uiDensity === 2 ? 20 : 16;
                  const config = getEffectiveIconConfig('header');
                  if (!config?.active) {
                    return (
                      <div 
                        className="flex items-center justify-center font-black text-accent tracking-tighter" 
                        style={{ width: baseSize, height: baseSize, fontSize: Math.max(10, Math.round(baseSize * 0.7)) }}
                      >
                        DD
                      </div>
                    );
                  }
                  
                  const finalSize = (config?.large && config?.active) 
                    ? Math.round(baseSize * (1 + (config.value || 20) / 100)) 
                    : baseSize;
                  return (
                    <CustomTrainIcon 
                      className="text-accent group-hover:scale-110 transition-transform" 
                      size={finalSize}
                      customIcon={customAppIconEnabled ? customAppIcon : null}
                      customIconType={customAppIconType}
                      useThemeColor={config?.useTheme ?? true}
                    />
                  );
                })()}
                <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-colors pointer-events-none" />
              </button>


            </div>
            <div id="tour-connection-info">
              <h1 className={`${uiDensity === 0 ? 'text-2xl' : uiDensity === 1 ? 'text-xl' : uiDensity === 2 ? 'text-lg' : 'text-base'} font-black tracking-tight text-text-main italic`}>@DRIVER-D Throttle for DCC-EX</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                <span className="text-xs font-mono text-text-muted uppercase tracking-widest">{statusText}</span>
                {(electronLocalIP || isTourActive) && (
                  <>
                    <span className="text-[10px] text-accent/30 font-bold ml-1">•</span>
                    <div className="flex items-center gap-1 group/ip cursor-help" title={`Your device is accessible at http://${electronLocalIP || '192.168.1.XX'}:3000`}>
                      <Globe className="w-3 h-3 text-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
                      <span className="text-[11px] font-mono font-black text-accent tracking-tight">{electronLocalIP || '192.168.1.XX'}:3000</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Top Row: Tools & Action */}
            <div className="flex items-center gap-3">
              {isConnected && (
                <button 
                  id="tour-loco-sync-button"
                  onClick={getStationStatus}
                  title="Sync Locomotive Status"
                  className={`border transition-all bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted rounded-xl active:scale-95 ${uiDensity === 0 ? 'p-3' : uiDensity === 1 ? 'p-2' : uiDensity === 2 ? 'p-1.5' : 'p-1'}`}
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              )}

              <div className="relative" ref={paletteButtonRef}>
                <button 
                  id="tour-display-settings"
                  onClick={() => setShowDisplaySettings(!showDisplaySettings)}
                  className={`rounded-xl border transition-all ${showDisplaySettings ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted'} ${uiDensity === 0 ? 'p-3' : uiDensity === 1 ? 'p-2' : uiDensity === 2 ? 'p-1.5' : 'p-1'}`}
                  title="Display Settings"
                >
                  <Palette className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showDisplaySettings && (
                    <React.Fragment key="display-settings-fragment">
                      {/* Backdrop for closing */}
                      {!isTourActive && (
                        <div 
                          className="fixed inset-0 z-[2499]" 
                          onClick={() => setShowDisplaySettings(false)} 
                        />
                      )}
                      <motion.div 
                        id="tour-display-settings-panel"
                        initial={isTourActive ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={isTourActive ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.95 }}
                        transition={isTourActive ? { duration: 0 } : undefined}
//                        className={`${isTourActive ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] z-[100000] scale-110 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'absolute top-full mt-3 w-[288px] z-[2500]'} bg-card-bg border border-card-border rounded-2xl shadow-2xl p-4 overflow-hidden`}
                        className={`${isTourActive ? 'fixed top-1/2 left-1/2 -translate-x-1/2 translate-y-[6px] w-[288px] z-[100000] scale-100 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'absolute top-full mt-3 w-[288px] z-[2500]'} bg-card-bg border border-card-border rounded-2xl shadow-2xl p-4 overflow-hidden`}
                        style={isTourActive ? {} : displaySettingsStyle}
                      >
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-card-border">
                          <Palette className="w-4 h-4 text-accent" />
                          <h3 className="text-sm font-bold text-text-main">Display Settings</h3>
                        </div>
                        <div className="space-y-6">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Monitor className="w-4 h-4 text-accent" />
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Throttle Layout</span>
                          </div>
                          <div className="flex flex-col gap-2 bg-btn-bg p-3 rounded-xl border border-btn-border">
                            <div className="flex items-center justify-between text-[9px] font-black text-text-muted px-1 uppercase tracking-tighter">
                              <span className={uiDensity === 0 ? 'text-accent' : ''}>Standard</span>
                              <span className={uiDensity === 1 ? 'text-accent' : ''}>Compact</span>
                              <span className={uiDensity === 2 ? 'text-accent' : ''}>Ultra</span>
                              <span className={uiDensity === 3 ? 'text-accent' : ''}>Mobile</span>
                            </div>
                            <div className="px-1 relative h-6 flex items-center">
                              <input 
                                type="range"
                                min="0"
                                max="3"
                                step="1"
                                value={uiDensity}
                                onChange={(e) => setUiDensity(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-app-bg rounded-lg appearance-none cursor-pointer accent-accent"
                              />
                            </div>
                          </div>

                        </div>

                        <div className="pt-4 border-t border-card-border">
                          <div className="flex items-center gap-2 mb-3">
                            <Palette className="w-4 h-4 text-accent" />
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Appearance</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'midnight', name: 'Midnight', color: 'bg-slate-900' },
                              { id: 'light', name: 'Light', color: 'bg-white border-slate-200' },
                              { id: 'industrial', name: 'Industrial', color: 'bg-stone-900 border-stone-700' },
                              { id: 'blueprint', name: 'Blueprint', color: 'bg-sky-900 border-sky-700' },
                              { id: 'retro', name: 'Retro Brass', color: 'bg-amber-900 border-amber-700' }
                            ].map(theme => (
                              <button
                                key={theme.id}
                                onClick={() => setUiTheme(theme.id as any)}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-[10px] font-bold ${uiTheme === theme.id ? 'border-accent bg-accent/10 text-text-main' : 'bg-btn-bg border-btn-border hover:border-text-muted text-text-muted'}`}
                              >
                                <div className={`w-3 h-3 rounded-full ${theme.color} border border-white/10`}></div>
                                {theme.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* User Custom Settings Button */}
                        <div className="pt-4 border-t border-card-border">
                          <button
                            id="tour-user-settings-button"
                            onClick={() => {
                              setShowDisplaySettings(false);
                              setShowUserCustomSettingsModal(true);
                            }}
                            className="w-full py-3 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center gap-2 hover:bg-accent/20 transition-all active:scale-[0.98] group"
                          >
                            <Settings2 className="w-4 h-4 text-accent group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-[10px] font-black text-text-main uppercase tracking-widest">User Custom Settings</span>
                          </button>
                        </div>

                        {/* Help & Guide Section */}
                        <div className="pt-4 border-t border-card-border">
                          <div className="flex items-center gap-2 mb-3">
                            <HelpCircle title="Help" className="w-4 h-4 text-accent" />
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Help & Documentation</span>
                          </div>
                          <div className="flex flex-col gap-2">

                            <button 
                              onClick={() => {
                                setShowDisplaySettings(false);
                                // Trigger saving
                                setTourMemoryStatus('saving');
                                saveTourSettings();
                                setTimeout(() => {
                                  setTourMemoryStatus(null);
                                  startTour();
                                }, TOUR_SAVE_DELAY);
                              }}
                              className="flex items-center justify-between w-full p-2.5 bg-btn-bg border border-btn-border rounded-lg hover:border-text-muted transition-all group/tour"
                            >
                              <div className="flex flex-col items-start leading-tight">
                                <span className="text-[10px] font-bold text-text-muted group-hover/tour:text-text-main uppercase tracking-wider">Interactive Tour</span>
                                <span className="text-[8px] text-text-muted opacity-60 font-medium">Guided walkthrough</span>
                              </div>
                              <Play className="w-3.5 h-3.5 text-accent group-hover/tour:scale-110 transition-transform" />
                            </button>

                            <div className="flex gap-1.5 w-full">
                              <button 
                                onClick={() => {
                                  setShowDisplaySettings(false);
                                  setShowInAppGuide(true);
                                }}
                                className="flex-1 flex items-center justify-between p-2.5 bg-btn-bg border border-btn-border rounded-lg hover:border-text-muted transition-all group/userguide"
                              >
                                <div className="flex flex-col items-start leading-tight">
                                  <span className="text-[10px] font-bold text-text-muted group-hover/userguide:text-text-main uppercase tracking-wider">Open User Guide</span>
                                  <span className="text-[8px] text-text-muted opacity-60 font-medium">In-app documented guide</span>
                                </div>
                                <BookOpen className="w-3.5 h-3.5 text-accent" />
                              </button>
                              <a 
                                href={getUserGuideUrl(userGuideStepId)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                title="Open in new tab"
                                className="flex items-center justify-center w-10 bg-btn-bg border border-btn-border rounded-lg hover:border-text-muted transition-all text-text-muted hover:text-accent"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>

                          </div>
                        </div>

                      </div>
                      </motion.div>
                    </React.Fragment>
                  )}
                </AnimatePresence>
              </div>

              <button 
                id="tour-monitor-button"
                onClick={() => setShowTerminal(!showTerminal)}
                title="Serial Monitor"
                className={`rounded-xl border transition-all ${showTerminal ? 'bg-accent/20 border-accent text-text-main shadow-lg shadow-accent/20' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted'} ${uiDensity === 0 ? 'p-3' : uiDensity === 1 ? 'p-2' : uiDensity === 2 ? 'p-1.5' : 'p-1'}`}
              >
                <TerminalIcon className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                {!isConnected ? (
                  <button 
                    id="tour-connect-button"
                    onClick={connect}
                    className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-accent/20"
                  >
                    <Power className="w-5 h-5" />
                    CONNECT
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      id="tour-connect-button"
                      onClick={disconnect}
                      className="flex items-center gap-2 bg-btn-bg hover:bg-danger/20 text-text-muted hover:text-danger px-6 py-3 rounded-xl font-bold transition-all active:scale-95 border border-btn-border hover:border-danger/50"
                    >
                      <PowerOff className="w-5 h-5" />
                      DISCONNECT
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Configuration & Mode */}
            <div id="tour-wifi-config-combined" className="flex flex-wrap items-center justify-end gap-3">
              {connectionMode === 'wifi' && (
                <div id="tour-wifi-config" className={`flex items-center gap-2 bg-card-bg p-1 rounded-xl border border-card-border ${isConnected ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-1.5 px-2">
                    <Globe className="w-3.5 h-3.5 text-text-muted" />
                    <input 
                      type="text" 
                      value={wifiHost || ''}
                      onChange={(e) => setWifiHost(e.target.value)}
                      placeholder="IP Address"
                      disabled={isConnected}
                      className="bg-transparent border-none text-xs font-mono text-accent focus:outline-none w-28 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="w-px h-4 bg-card-border" />
                  <input 
                    type="number" 
                    value={wifiPort ?? ''}
                    onChange={(e) => setWifiPort(parseInt(e.target.value) || 0)}
                    placeholder="Port"
                    disabled={isConnected}
                    className="bg-transparent border-none text-xs font-mono text-accent focus:outline-none w-16 px-2 disabled:cursor-not-allowed"
                  />
                </div>
              )}

              {connectionMode === 'emulator' && (
                <div className={`flex items-center gap-2 bg-accent/10 p-2 rounded-xl border border-accent/20 px-4 ${isConnected ? 'opacity-50' : ''}`}>
                  <Info className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Local Engine Mode</span>
                </div>
              )}

              <div id="tour-connect" className={`flex bg-btn-bg p-1 rounded-xl border border-btn-border ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <button 
                  onClick={() => !isConnected && isSerialSupported && setConnectionMode('serial')}
                  disabled={isConnected || !isSerialSupported}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${connectionMode === 'serial' ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${(isConnected || !isSerialSupported) ? 'cursor-not-allowed' : ''}`}
                  title={!isSerialSupported ? "Web Serial not supported on this device" : isConnected ? "Disconnect to change mode" : ""}
                >
                  <Zap className="w-3.5 h-3.5" />
                  SERIAL
                  {!isSerialSupported && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                </button>
                <button 
                  onClick={() => {
                    if (!isConnected) {
                      if (connectionMode !== 'wifi' && !hasSeenWifiAdvice) {
                        setShowWifiAdvice(true);
                        setHasSeenWifiAdvice(true);
                      }
                      setConnectionMode('wifi');
                    }
                  }}
                  disabled={isConnected}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${connectionMode === 'wifi' ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${isConnected ? 'cursor-not-allowed' : ''}`}
                  title={isConnected ? "Disconnect to change mode" : ""}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  WIFI
                </button>
                <button 
                  onClick={() => !isConnected && setConnectionMode('emulator')}
                  disabled={isConnected}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${connectionMode === 'emulator' ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${isConnected ? 'cursor-not-allowed' : ''}`}
                  title={isConnected ? "Disconnect to change mode" : ""}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  EMULATOR
                </button>
              </div>
            </div>
          </div>
        </header>
        )}

        {/* Permission Warning */}

        {/* Main Controls Grid */}
        <div className={`grid grid-cols-1 ${gridBase} ${uiDensity <= 1 ? 'gap-4' : uiDensity === 2 ? 'gap-2' : 'gap-1'}`}>
          
          {/* Left Column: Cab & Power */}
          <div className={`${leftColBase} ${uiDensity === 0 ? 'space-y-4' : uiDensity === 1 ? 'space-y-4' : uiDensity === 2 ? 'space-y-2' : 'space-y-1'}`}>
            {/* Track Power Card */}
            {addressFocusLevel < 2 && (
            <div id="tour-track-power" className={`${uiDensity === 0 ? 'p-6' : uiDensity === 1 ? 'p-4' : uiDensity === 2 ? 'p-3' : 'p-2'} rounded-3xl border transition-all duration-500 ${trackPower ? 'bg-success/10 border-success/30' : 'bg-card-bg border-card-border'}`}>
              <div className={`flex items-center justify-between ${uiDensity === 0 ? 'mb-4' : uiDensity === 1 ? 'mb-2' : uiDensity === 2 ? 'mb-1' : 'mb-0.5'}`}>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">Track Power</h2>
                  <button 
                    id="tour-blocks-view-button"
                    onClick={handleToggleBlocksView}
                    className={`p-1.5 rounded-lg transition-all ${isBlocksView ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                    title={isBlocksView ? "Switch to Standard View" : "Switch to Blocks View"}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    id="tour-track-sync-button"
                    onClick={() => sendCommand(' = ')}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-btn-bg transition-all"
                    title="Sync Track Status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {trackBlocks.some(b => b.letter === 'A') && trackBlocks.some(b => b.letter === 'B') && (
                    <button
                      id="tour-join-button"
                      onClick={toggleJoin}
                      disabled={!isConnected}
                      className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold border relative overflow-hidden ${
                        areBlocksJoined 
                        ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' 
                        : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted'
                      }`}
                      title={areBlocksJoined ? "Unjoin Blocks A & B" : "Join Blocks A & B"}
                    >
                      {areBlocksJoined ? <Link className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
                      {areBlocksJoined ? 'JOINED' : 'JOIN A+B'}
                      {areBlocksJoined && (
                        <motion.div 
                          className="absolute inset-0 bg-white/10"
                          animate={{ opacity: [0, 0.2, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </button>
                  )}
                  {trackPower ? <Zap className="w-5 h-5 text-green-400" /> : <ZapOff className="w-5 h-5 text-text-muted" />}
                </div>
              </div>

              {!isBlocksView ? (
                <button 
                  id="tour-power-button"
                  onClick={togglePower}
                  disabled={!isConnected}
                  className={`w-full ${uiDensity === 0 ? 'py-6 text-xl' : uiDensity === 1 ? 'py-4 text-lg' : uiDensity === 2 ? 'py-3 text-base' : 'py-2 text-sm'} rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-3 border-2 ${
                    areBlocksJoined
                    ? 'bg-amber-400 text-white border-amber-400 shadow-lg shadow-amber-400/20'
                    : trackPower 
                      ? 'bg-success text-white border-success shadow-lg shadow-success/20' 
                      : uiTheme === 'retro'
                        ? 'bg-danger text-white border-danger shadow-lg shadow-danger/20 hover:bg-danger/90'
                        : 'bg-danger/20 text-danger/80 border-danger/40 hover:bg-danger/30 transition-colors'
                  }`}
                >
                  {areBlocksJoined ? 'POWER ON JOIN' : (trackPower ? 'POWER ON' : 'POWER OFF')}
                </button>
              ) : (
                <div className={`grid gap-2 ${trackBlocks.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
                  {trackBlocks.map((block) => {
                    let timer: any = null;
                    return (
                      <button
                        key={block.letter}
                        onPointerDown={() => {
                          timer = setTimeout(() => {
                            setSelectedBlockForEdit(block.letter);
                            timer = null;
                          }, 600);
                        }}
                        onPointerUp={() => {
                          if (timer) {
                            clearTimeout(timer);
                            toggleBlockPower(block.letter);
                          }
                        }}
                        onPointerLeave={() => {
                          if (timer) clearTimeout(timer);
                        }}
                        disabled={!isConnected}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 ${
                          (areBlocksJoined && (block.state === 'MAIN' || block.state === 'PROG'))
                          ? 'bg-amber-400/20 border-amber-400 text-amber-400 shadow-md shadow-amber-400/10'
                          : block.power 
                            ? 'bg-success/20 border-success text-success shadow-md shadow-success/10' 
                            : 'bg-btn-bg border-btn-border text-text-muted hover:border-text-muted'
                        }`}
                      >
                        <span className="text-lg font-black">{block.letter}</span>
                        <div className="flex flex-col items-center -mt-1">
                          <span className="text-[10px] font-bold text-text-main/90">{block.state || 'NONE'}</span>
                          {block.cab > 0 && <span className="text-[9px] font-bold text-text-muted">CAB {block.cab}</span>}
                        </div>
                        {block.power && (
                          <motion.div 
                            layoutId={`power-glow-${block.letter}`}
                            className={`absolute inset-0 rounded-xl pointer-events-none ${
                              (areBlocksJoined && (block.state === 'MAIN' || block.state === 'PROG'))
                              ? 'bg-amber-400/5'
                              : 'bg-success/5'
                            }`}
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Cab Address Card */}
            <div id="tour-loco-address" className={`bg-card-bg ${uiDensity === 0 ? 'p-6' : uiDensity === 1 ? 'p-4' : uiDensity === 2 ? 'p-3' : 'p-2'} rounded-3xl border border-card-border relative`}>
              {/* Invisible combined spotlight target for step 88 */}
              {isTourActive && combinedHighlightBounds && (
                <div 
                  id="tour-loco-header-and-address-combined"
                  className="absolute pointer-events-none z-10"
                  style={{
                    top: `${combinedHighlightBounds.top - 6}px`,
                    height: `${combinedHighlightBounds.height + 12}px`,
                    left: `${combinedHighlightBounds.left - 6}px`,
                    width: `${combinedHighlightBounds.width + 12}px`,
                  }}
                />
              )}
              <div id="tour-loco-card-header" className={`flex items-center justify-between ${uiDensity === 0 ? 'mb-4' : uiDensity === 1 ? 'mb-2' : 'mb-1'}`}>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">Loco Address</h2>
                  <button 
                    onClick={() => {
                      setIsEditingPresets(!isEditingPresets);
                      if (!isEditingPresets) {
                        setAddressFocusLevel(0);
                        setIsScrollLocked(false);
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-all ${isEditingPresets ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                    title="Edit Presets"
                  >
                    {/* <Settings className={`${uiDensity === 0 ? 'w-4 h-4' : uiDensity === 1 ? 'w-3.5 h-3.5' : uiDensity === 2 ? 'w-3 h-3' : 'w-2.5 h-2.5'}`} /> */}
                    <Settings className={`${uiDensity === 0 ? 'w-4 h-4' : uiDensity === 1 ? 'w-4 h-4' : uiDensity === 2 ? 'w-4 h-4' : 'w-4 h-4'}`} />
                  </button>
                  {!isEditingPresets && (
                    <div className="flex items-center gap-1">
                      <button 
                        onMouseDown={() => {
                          longPressFired.current = false;
                          const timer = setTimeout(() => {
                            longPressFired.current = true;
                            setShowAdvancedToggles(!showAdvancedToggles);
                          }, 800);
                          (window as any)._presetLongPressTimer = timer;
                        }}
                        onMouseUp={() => clearTimeout((window as any)._presetLongPressTimer)}
                        onMouseLeave={() => clearTimeout((window as any)._presetLongPressTimer)}
                        onTouchStart={() => {
                          longPressFired.current = false;
                          const timer = setTimeout(() => {
                            longPressFired.current = true;
                            setShowAdvancedToggles(!showAdvancedToggles);
                          }, 800);
                          (window as any)._presetLongPressTimer = timer;
                        }}
                        onTouchEnd={() => clearTimeout((window as any)._presetLongPressTimer)}
                        onClick={() => {
                          if (longPressFired.current) {
                            longPressFired.current = false;
                            return;
                          }
                          setIsCompactLocoPresets(!isCompactLocoPresets);
                        }}
                        id="tour-loco-compact-presets-btn"
                        className={`p-1.5 rounded-lg transition-all ${isCompactPresetsHighlighted || isCompactLocoPresets ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                        title={isCompactLocoPresets ? "Expand Presets" : "Compact Presets"}
                      >
                        {isCompactLocoPresets ? <Maximize2 className={`${uiDensity === 0 ? 'w-4 h-4' : uiDensity === 1 ? 'w-4 h-4' : uiDensity === 2 ? 'w-4 h-4' : 'w-4 h-4'}`} /> : <Minimize2 className={`${uiDensity === 0 ? 'w-4 h-4' : uiDensity === 1 ? 'w-4 h-4' : uiDensity === 2 ? 'w-4 h-4' : 'w-4 h-4'}`} />}
                      </button>

                      {showAdvancedToggles && !isEditingPresets && (
                        <div className="flex items-center gap-1 bg-black/10 p-0.5 rounded-lg animate-in fade-in slide-in-from-left-2 duration-300">
                          <button 
                            id="tour-loco-merge-address-btn"
                            onClick={() => setIsLocoAddressMerged(!isLocoAddressMerged)}
                            className={`p-1.5 rounded-lg transition-all ${isMergeAddressHighlighted || isLocoAddressMerged ? 'bg-warning text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                            title={isLocoAddressMerged ? "Unmerge Address Box" : "Merge Address Box" }
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                          <button 
                            id="tour-loco-hide-header-btn"
                            onClick={() => {
                              const next = ((addressFocusLevel + 1) % 3) as 0 | 1 | 2;
                              setAddressFocusLevel(next);
                              if (next === 2) {
                                setIsScrollLocked(true);
                              } else {
                                setIsScrollLocked(false);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-all ${isHideHeaderHighlighted || addressFocusLevel === 2 ? 'bg-warning text-white' : addressFocusLevel === 1 ? 'bg-warning/50 text-white hover:bg-warning/70' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                            title={addressFocusLevel === 0 ? "Hide Header Card" : addressFocusLevel === 1 ? "Hide Track Power Card" : "Show Header Cards"}
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                          <button 
                            id="tour-loco-lock-btn"
                            onClick={() => setIsScrollLocked(!isScrollLocked)}
                            className={`p-1.5 rounded-lg transition-all ${isLockScrollHighlighted || isScrollLocked ? 'bg-warning text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                            title={isScrollLocked ? "Unlock Scroll" : "Lock Scroll"}
                          >
                            {isLockScrollHighlighted || isScrollLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">

                      {isEditingPresets && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setShowLocoSortModal(true)}
                            className={`p-1.5 rounded-lg border transition-all ${isSortPresetsHighlighted ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main'}`}
                            title="Sort Presets"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={handleExportConfig}
                            id="tour-export-config-btn"
                            className={`p-1.5 rounded-lg border transition-all ${isExportConfigHighlighted ? 'bg-accent border-accent text-white' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main'}`}
                            title="Export Config"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <label className="p-1.5 rounded-lg bg-btn-bg border border-btn-border text-text-muted hover:text-text-main transition-all cursor-pointer" title="Import Config">
                            <FileUp className="w-4 h-4" />
                            <input type="file" accept=".json" className="hidden" onChange={handleImportConfig} />
                          </label>
                          <div className={`flex items-center rounded-lg p-0.5 border min-w-[100px] justify-between shadow-sm transition-all ${isEditingPresetsPlusMinusHighlighted ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-btn-bg border-btn-border'}`}>
                            <button 
                              onClick={handleRemovePresets}
                              disabled={visiblePresetsCount <= 1}
                              className={`p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${isEditingPresetsPlusMinusHighlighted ? 'hover:text-white/70 text-white' : 'hover:text-text-main text-text-muted'}`}
                              title="Remove 1 Preset"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span 
                              onClick={() => {
                                setPresetSnapshot({ max: maxPresets, visible: visiblePresetsCount });
                                setShowPresetSliderModal(true);
                              }}
                              className={`text-xs font-black cursor-pointer hover:scale-110 transition-transform px-2 ${isEditingPresetsPlusMinusHighlighted ? 'text-white' : 'text-accent'}`}
                              title="Click for advanced configuration"
                            >
                              {visiblePresetsCount}
                            </span>
                            <button 
                              onClick={handleAddPresets}
                              disabled={visiblePresetsCount >= maxPresets}
                              className={`p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${isEditingPresetsPlusMinusHighlighted ? 'hover:text-white/70 text-white' : 'hover:text-text-main text-text-muted'}`}
                              title="Add 1 Preset"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                  {(isConsistSetupMode || (!hideAllConsists && consists.some(c => c.isVisible && c.locos.length > 0))) && (
                    <button 
                      id="tour-consist-hide-all-btn"
                      onClick={() => {
                        setHideAllConsists(true);
                        setIsConsistSetupMode(false);
                        setSelectedConsistId(null);
                      }}
                      className={`p-1.5 rounded-lg transition-all ${
                        isHideAllConsistsHighlighted
                          ? 'bg-danger text-white' 
                          : 'text-text-muted/40 hover:text-danger hover:bg-danger/10'
                      }`}
                      title="Hide All Consists & Exit"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  )}
                  {(() => {
                    const isConsistSetupHighlighted = isTourActive && lastTourStopIndex !== null && tourSteps[lastTourStopIndex]?.element === '#tour-consist-setup-btn';
                    return (
                      <button 
                        id="tour-consist-setup-btn"
                        onClick={() => {
                          const nextMode = !isConsistSetupMode;
                          setIsConsistSetupMode(nextMode);
                          if (nextMode) {
                            setHideAllConsists(false);
                            setSelectedConsistId(consists[0].id);
                            // Deselect any currently selected locomotive
                            setCabAddress('');
                            setPendingCabAddress('');
                          } else {
                            setSelectedConsistId(null);
                          }
                        }}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isConsistSetupMode 
                            ? 'bg-accent border-accent text-white' 
                            : isConsistSetupHighlighted
                              ? 'border-accent bg-accent text-white'
                              : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main'
                        }`}
                        title="Consist Setup"
                      >
                        <Layers className={`${uiDensity === 0 ? 'w-4 h-4' : uiDensity === 1 ? 'w-3.5 h-3.5' : uiDensity === 2 ? 'w-3 h-3' : 'w-2.5 h-2.5'} ${isConsistSetupHighlighted ? 'text-white' : ''}`} />
                      </button>
                    );
                  })()}
                </div>
              </div>
              {/* Consist Presets Row */}
              {(isConsistSetupMode || (!hideAllConsists && consists.some(c => c.isVisible && c.locos.length > 0))) && (
                <div className="space-y-2">
                  <div id="tour-consist-header-actions" className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Consists
                    </span>
                    {isConsistSetupMode && selectedConsistId && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => moveConsistPreset(selectedConsistId, 'up')}
                          className={`p-1 rounded transition-colors ${
                            isMoveUpDownHighlighted
                              ? 'bg-accent text-white border border-accent/20'
                              : 'bg-btn-bg text-text-muted hover:text-text-main border border-btn-border'
                          }`}
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => moveConsistPreset(selectedConsistId, 'down')}
                          className={`p-1 rounded transition-colors ${
                            isMoveUpDownHighlighted
                              ? 'bg-accent text-white border border-accent/20'
                              : 'bg-btn-bg text-text-muted hover:text-text-main border border-btn-border'
                          }`}
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => reverseConsistOrder(selectedConsistId)}
                          className={`p-1 rounded transition-colors ${
                            isReverseOrderButtonHighlighted
                              ? 'bg-accent text-white border border-accent/20'
                              : 'bg-btn-bg text-text-muted hover:text-text-main border border-btn-border'
                          }`}
                          title="Reverse Order"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => clearConsist(selectedConsistId)}
                          className={`p-1 rounded transition-colors ${
                            isClearConsistHighlighted
                              ? 'bg-danger text-white border border-danger/20'
                              : 'bg-danger/20 text-danger hover:bg-danger/30 border border-danger/30'
                          }`}
                          title="Clear Consist"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div id="tour-loco-presets-to-bottom-combined" className={uiDensity === 0 ? 'space-y-6 -mb-6 pb-6 mt-2' : uiDensity === 1 ? 'space-y-4 -mb-4 pb-4 mt-1.5' : uiDensity === 2 ? 'space-y-2 -mb-3 pb-3 mt-1' : 'space-y-1 -mb-2 pb-2 mt-0.5'}>
                {(isConsistSetupMode || (!hideAllConsists && consists.some(c => c.isVisible && c.locos.length > 0))) && (
                  <div id="tour-consist-presets-grid" className="grid grid-cols-5 sm:grid-cols-9 gap-2">
                    {consists.map((c) => {
                      const isConfigured = c.locos.length > 0;
                      const isSelected = selectedConsistId === c.id;
                      const isActive = !isConsistSetupMode && activeConsistId === c.id;
                      
                      if (!isConsistSetupMode && (!c.isVisible || !isConfigured || hideAllConsists)) return null;

                      return (
                        <button
                          key={c.id}
                          onClick={() => handleConsistPresetClick(c.id)}
                          className={`
                            relative py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border-2
                            ${isSelected || isActive ? (
                              c.isFlipped ? 'border-warning bg-warning/20 text-warning' : 'border-accent bg-accent/20 text-accent'
                            ) : isConfigured ? (
                              'border-btn-border bg-btn-bg text-text-muted hover:border-text-muted'
                            ) : 'border-btn-border bg-btn-bg text-text-muted hover:text-text-main hover:border-text-muted'}
                            ${!isConsistSetupMode && !isConfigured ? 'hidden' : ''}
                          `}
                          style={{
                            backgroundColor: (() => {
                              if (!showLocoColors || !isConfigured) return undefined;
                              if (isSelected || isActive) return undefined;
                              const leadLoco = c.locos[0];
                              const leadAddr = (leadLoco.cabAddress ?? leadLoco.address).toString();
                              const baseColor = locoColors[leadAddr];
                              if (!baseColor) return undefined;
                              const opacity = locoOpacity[leadAddr] !== undefined ? locoOpacity[leadAddr] : 50;
                              const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                              const accentColor = locoAccentColors[leadAddr];
                              
                              if (accentColor && accentColor !== 'none') {
                                  return undefined; // We'll use backgroundImage instead
                              }
                              
                              return baseColor + alpha;
                            })(),
                            backgroundImage: (() => {
                              if (!showLocoColors || !isConfigured) return undefined;
                              if (isSelected || isActive) return undefined;
                              const leadLoco = c.locos[0];
                              const leadAddr = (leadLoco.cabAddress ?? leadLoco.address).toString();
                              const baseColor = locoColors[leadAddr];
                              if (!baseColor) return undefined;
                              const accentColor = locoAccentColors[leadAddr];
                              if (!accentColor || accentColor === 'none') return undefined;
                              
                              const opacity = locoOpacity[leadAddr] !== undefined ? locoOpacity[leadAddr] : 50;
                              const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                              const combinedBase = baseColor + alpha;

                              const accentOpacity = locoAccentOpacity[leadAddr] !== undefined ? locoAccentOpacity[leadAddr] : opacity;
                              const accentAlpha = Math.round((accentOpacity / 100) * 255).toString(16).padStart(2, '0');
                              const combinedAccent = accentColor + accentAlpha;
                              
                              return `linear-gradient(to bottom, ${combinedBase} 85%, ${combinedAccent} 85%)`;
                            })()
                          }}
                        >
                          <span className={`text-[8px] ${(isSelected || isActive) ? (
                            isActive ? (isForward ? (c.locos[0]?.isReverse ? 'text-warning' : 'text-accent') : (c.locos[0]?.isReverse ? 'text-accent' : 'text-warning')) : 
                            (c.locos[0]?.isReverse ? 'text-warning' : 'text-accent')
                          ) : isConfigured ? 'text-text-muted' : 'opacity-50'}`}>
                            {c.id}
                          </span>
                          <Layers className={`w-3 h-3 ${(isSelected || isActive) ? (
                            isActive ? (isForward ? (c.locos[0]?.isReverse ? 'text-warning' : 'text-accent') : (c.locos[0]?.isReverse ? 'text-accent' : 'text-warning')) : 
                            (c.locos[0]?.isReverse ? 'text-warning' : 'text-accent')
                          ) : isConfigured ? 'text-text-muted' : ''}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              {/* Combined Address and Image Container for Merging */}
                <div className={`relative flex flex-col ${isLocoAddressMerged ? 'gap-0' : (uiDensity === 0 ? 'gap-4' : uiDensity === 1 ? 'gap-2' : 'gap-1 text-center')}`}>
                  {/* Cab Address Input at the top */}
                  <div 
                    className={`${isLocoAddressMerged ? 'absolute top-0 left-0 right-0 z-40' : 'relative group/nav'}`}
                  >
                    <div id="tour-loco-address-box" className={`w-full ${isLocoAddressMerged ? 'bg-transparent border-transparent shadow-none' : 'bg-app-bg border-card-border'} border-2 rounded-2xl px-6 py-4 flex items-center justify-center gap-2 ${uiDensity === 0 ? 'min-h-[76px]' : uiDensity === 1 ? 'min-h-[60px]' : uiDensity === 2 ? 'min-h-[50px]' : 'min-h-[44px]'}`}>
                    <button 
                      id="tour-loco-nav-prev"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigatePresets('prev');
                      }}
                      className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 ${isLocoAddressMerged ? 'text-white/50 hover:text-white' : 'text-card-border hover:text-text-muted/80'} transition-colors z-20`}
                      title="Previous Preset"
                    >
                      <ChevronsLeft className={`w-5 h-5 ${isLocoControlsFlashing ? 'animate-tour-flash text-accent' : ''}`} />
                    </button>
                    <button 
                      id="tour-loco-nav-next"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigatePresets('next');
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 ${isLocoAddressMerged ? 'text-white/50 hover:text-white' : 'text-card-border hover:text-text-muted/80'} transition-colors z-20`}
                      title="Next Preset"
                    >
                      <ChevronsRight className={`w-5 h-5 ${isLocoControlsFlashing ? 'animate-tour-flash text-accent' : ''}`} />
                    </button>
                    {secretPreset !== '' && cabAddress.toString() === secretPreset.toString() && (
                      <button 
                        id="tour-loco-nav-clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSecretPreset('');
                        }}
                        className={`absolute left-14 top-1/2 -translate-y-1/2 font-mono text-xs uppercase hover:text-warning transition-colors z-30 cursor-pointer ${isLocoControlsFlashing ? 'animate-tour-flash text-accent' : 'text-text-muted/40'}`}
                      >
                        clear
                      </button>
                    )}
                    {(activeConsistId !== null || (isConsistSetupMode && selectedConsistId !== null)) && !isEditingAddress ? (
                      <div 
                        className="flex items-center gap-2 flex-wrap justify-center cursor-pointer"
                        onClick={(e) => {
                          if (!isEditingAddress) {
                            e.stopPropagation();
                            setPendingCabAddress('');
                            setIsEditingAddress(true);
                          }
                        }}
                      >
                        {(() => {
                          const idToShow = isConsistSetupMode ? selectedConsistId : activeConsistId;
                          const consist = consists.find(c => c.id === idToShow);
                          if (!consist || consist.locos.length === 0) return null;
                          
                          const locos = (!isConsistSetupMode && activeConsistTempReverse) ? [...consist.locos].reverse().map(l => ({ ...l, isReverse: !l.isReverse })) : consist.locos;
                          
                          // The lead locomotive is the first one in the "actual" consist order (locos[0])
                          const leadLoco = locos[0];
                          const leadAddr = (leadLoco.cabAddress ?? leadLoco.address).toString();
                          const leadRoadName = showRoadNames ? getRoadNameForAddr(leadAddr) : '';
                          
                          // Order for display depends on orientation
                          const displayLocos = switchingOrientation === 'forward-right' ? [...locos].reverse() : locos;
                          
                          return (
                            <>
                              {switchingOrientation === 'forward-left' && <ChevronLeft className="w-5 h-5 text-accent" />}
                              {(switchingOrientation === 'forward-left' && leadRoadName) && (
                                <span className="text-sm font-bold text-text-muted uppercase tracking-tight mx-2">
                                  {leadRoadName}
                                </span>
                              )}
                              {displayLocos.map((l, i) => (
                                <span 
                                  key={i} 
                                  className={`text-3xl font-black ${ (isForward ? l.isReverse : !l.isReverse) ? 'text-warning/70' : 'text-accent' } transition-colors duration-300`}
                                >
                                  {getDisplayAddress(l.address || 0)}
                                  {i < displayLocos.length - 1 && <span className="text-card-border mx-1">·</span>}
                                </span>
                              ))}
                              {(switchingOrientation === 'forward-right' && leadRoadName) && (
                                <span className="text-sm font-bold text-text-muted uppercase tracking-tight mx-2">
                                  {leadRoadName}
                                </span>
                              )}
                              {switchingOrientation === 'forward-right' && <ChevronRight className="w-5 h-5 text-accent" />}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        {(!isEditingAddress && switchingOrientation === 'forward-left') && <ChevronLeft className="w-5 h-5 text-accent" />}
                        {(!isEditingAddress && showRoadNames && getRoadNameForAddr(cabAddress)) && (
                           <span className="text-sm font-bold text-text-muted uppercase tracking-tight animate-in fade-in slide-in-from-right-2 duration-300">
                             {getRoadNameForAddr(cabAddress)}
                           </span>
                        )}
                        <input 
                          ref={addressInputRef}
                          type="text" 
                          inputMode="text"
                          value={isEditingAddress ? (pendingCabAddress ?? '') : getDisplayAddress(cabAddress)}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow DCC address or #address.decimal
                            if (val === '' || /^\d+$/.test(val) || /^#\d*(\.\d*)?$/.test(val)) {
                              setPendingCabAddress(val);
                            }
                          }}
                          onFocus={() => {
                            if (isEditingAddress) {
                              setPendingCabAddress('');
                            }
                          }}
                          onClick={() => {
                            if (!isEditingAddress) {
                              setIsEditingAddress(true);
                              setPendingCabAddress('');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              let inputAddr = (pendingCabAddress === '' || pendingCabAddress === '0' || pendingCabAddress === 0) ? cabAddress.toString() : pendingCabAddress.toString();
                              const finalAddr = sanitizeCabAddress(inputAddr);
                              handleAddressSubmit(finalAddr);
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              setPendingCabAddress(cabAddress);
                              setIsEditingAddress(false);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={() => {
                            const finalAddr = sanitizeCabAddress((pendingCabAddress === '' || pendingCabAddress === '0' || pendingCabAddress === 0) ? cabAddress.toString() : pendingCabAddress.toString());
                            handleAddressSubmit(finalAddr);
                          }}
                          className={`w-full max-w-[120px] bg-transparent border-none font-black ${isForward ? 'text-accent' : 'text-warning/70'} focus:outline-none text-center transition-colors duration-300 ${uiDensity === 0 ? 'text-3xl' : uiDensity === 1 ? 'text-2xl' : uiDensity === 2 ? 'text-xl' : 'text-lg'}`}
                        />
                        {(!isEditingAddress && switchingOrientation === 'forward-right') && <ChevronRight className="w-5 h-5 text-accent" />}
                      </div>
                    )}
                  </div>
                  <div className={`absolute right-8 bottom-1 ${isLocoAddressMerged ? 'text-white/20' : 'text-text-muted/40'} font-mono text-xs uppercase pointer-events-none transition-opacity duration-300 ${isEditingAddress ? 'opacity-0' : 'opacity-100'}`}>
                    {(activeConsistId !== null || isConsistSetupMode) ? 'Consist' : 'Cab'}
                  </div>
                </div>

                <div className={`${imageContainerBase} ${isLocoAddressMerged ? 'gap-0' : ''}`}>
                  {/* Image on top for wide screen, left for tablet */}
                  <div className={imageWrapperBase}>
                    <motion.div 
                      drag={(!isEditingPresets && !disablePhotoSwipe) ? "x" : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.1}
                      onDragEnd={(e, info) => {
                        if (isEditingPresets || disablePhotoSwipe) return;
                        if (info.offset.x > 50) {
                          navigatePresets('prev');
                        } else if (info.offset.x < -50) {
                          navigatePresets('next');
                        }
                      }}
                      className={`${imageBoxBase} aspect-[324/230] bg-app-bg rounded-2xl border-2 border-card-border overflow-hidden flex items-center justify-center relative ${(!isEditingPresets && !disablePhotoSwipe) ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
                      id="tour-loco-image"
                    >
                      {(() => {
                        let displayAddr = cabAddress.toString();
                        const idToShow = isConsistSetupMode ? selectedConsistId : activeConsistId;
                        if (idToShow !== null) {
                          const consist = consists.find(c => c.id === idToShow);
                          if (consist && consist.locos.length > 0) {
                            const locos = (!isConsistSetupMode && activeConsistTempReverse) ? [...consist.locos].reverse() : consist.locos;
                            const leadLoco = locos[0];
                            displayAddr = (leadLoco.cabAddress ?? leadLoco.address).toString();
                          } else if (isConsistSetupMode) {
                            displayAddr = ''; // No picture if consist empty in setup mode
                          }
                        }
                        
                        const placeholderType = locoPlaceholders[displayAddr];
                        
                        if (locoImages[displayAddr]) {
                          return (
                            <>
                              <img 
                                src={locoImages[displayAddr]} 
                                alt="Locomotive" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {idToShow !== null && (
                                <div className="absolute top-4 left-4 p-2 bg-accent/80 rounded-xl backdrop-blur-sm border border-accent/30">
                                  <Layers className="w-6 h-6 text-white" />
                                </div>
                              )}
                            </>
                          );
                        }

                        if (placeholderType) {
                          return (
                            <div className="w-full h-full flex items-center justify-center p-6">
                              <div 
                                style={{
                                  maskImage: `url(${placeholderType}_loco.png)`,
                                  maskSize: 'contain',
                                  maskRepeat: 'no-repeat',
                                  maskPosition: 'center',
                                  WebkitMaskImage: `url(${placeholderType}_loco.png)`,
                                  WebkitMaskSize: 'contain',
                                  WebkitMaskRepeat: 'no-repeat',
                                  WebkitMaskPosition: 'center',
                                }}
                                className="w-full h-full bg-text-muted/30"
                              />
                              {idToShow !== null && (
                                <div className="absolute top-4 left-4 p-2 bg-accent/80 rounded-xl backdrop-blur-sm border border-accent/30">
                                  <Layers className="w-6 h-6 text-white" />
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="relative">
                            <ImageIcon className="w-12 h-12 text-card-border" />
                            {idToShow !== null && (
                              <Layers className="absolute -top-2 -right-2 w-6 h-6 text-accent/50" />
                            )}
                          </div>
                        );
                      })()}
                      
                      {isEditingPresets && (
                        <div className={`absolute inset-0 bg-accent/40 transition-opacity ${(isLocoImageHovered || (typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0)))) ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}>
                          {/* Absolute Center: Upload & Remove Controls */}
                          <div className="absolute inset-0 flex items-center justify-center gap-4">
                            <label className="p-3 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-colors backdrop-blur-sm shadow-xl" title="Upload Custom Photo">
                              <Upload className="w-6 h-6 text-white" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleImageUpload}
                              />
                            </label>

                            {locoImages[cabAddress.toString()] && (
                              <button 
                                onClick={handleRemoveImage}
                                className="p-3 bg-red-600/40 hover:bg-red-600/60 rounded-full cursor-pointer transition-colors backdrop-blur-sm shadow-xl"
                                title="Remove Image"
                              >
                                <Trash2 className="w-6 h-6 text-white" />
                              </button>
                            )}
                          </div>

                          {/* Positioned Below Center: Steam & Diesel Placeholders */}
                          <div className="absolute top-[calc(50%+44px)] left-0 right-0 flex justify-center gap-3">
                            <button 
                              onClick={() => handleSetPlaceholder('steam')}
                              className={`p-2.5 rounded-full transition-all backdrop-blur-sm flex items-center justify-center shadow-lg ${locoPlaceholders[cabAddress.toString()] === 'steam' ? 'bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-transparent' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                              title="Use Steam Placeholder"
                            >
                              <div 
                                style={{
                                  maskImage: 'url(steam_loco.png)',
                                  maskSize: 'contain',
                                  maskRepeat: 'no-repeat',
                                  maskPosition: 'center',
                                  WebkitMaskImage: 'url(steam_loco.png)',
                                  WebkitMaskSize: 'contain',
                                  WebkitMaskRepeat: 'no-repeat',
                                  WebkitMaskPosition: 'center',
                                }}
                                className="w-5 h-5 bg-current"
                              />
                            </button>
                            <button 
                              onClick={() => handleSetPlaceholder('diesel')}
                              className={`p-2.5 rounded-full transition-all backdrop-blur-sm flex items-center justify-center shadow-lg ${locoPlaceholders[cabAddress.toString()] === 'diesel' ? 'bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-transparent' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                              title="Use Diesel Placeholder"
                            >
                              <div 
                                style={{
                                  maskImage: 'url(diesel_loco.png)',
                                  maskSize: 'contain',
                                  maskRepeat: 'no-repeat',
                                  maskPosition: 'center',
                                  WebkitMaskImage: 'url(diesel_loco.png)',
                                  WebkitMaskSize: 'contain',
                                  WebkitMaskRepeat: 'no-repeat',
                                  WebkitMaskPosition: 'center',
                                }}
                                className="w-5 h-5 bg-current"
                              />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {isSwipeHandVisible && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-[60]">
                          <motion.div
                            key={`swipe-hand-${swipeHandSpeed}-${swipeHandDistance}`}
                            initial={{ x: -swipeHandDistance }}
                            animate={{ x: swipeHandDistance }}
                            transition={{
                              duration: swipeHandSpeed,
                              repeat: Infinity,
                              repeatType: "reverse",
                              ease: "easeInOut"
                            }}
                          >
                            <Pointer className="w-12 h-12 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" fill="rgba(255,255,255,0.2)" />
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                    {isEditingPresets && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-card-bg rounded text-[10px] font-bold text-text-muted uppercase tracking-tighter border border-card-border">
                        324x230
                      </div>
                    )}
                  </div>

                  {/* Presets below for wide screen, right for tablet */}
                  {(isEditingPresets || !isCompactLocoPresets) && (
                    <div className="w-full flex-1" id="tour-loco-presets">
                      <div className={`grid ${presetGridBase} gap-2`}>
                      {getSortedIndices().slice(0, visiblePresetsCount).map((originalIndex, i) => {
                        const addr = presets[originalIndex];
                        const index = originalIndex; // Preserve original index for data binding
                        const addrNum = getDccAddress(addr);
                        
                        // Highlighting logic:
                        // 1. In setup mode, show locos in the selected consist
                        // 2. Not in setup mode, show locos in the active consist
                        const locoInConsist = isConsistSetupMode 
                          ? (selectedConsistId ? consists.find(c => c.id === selectedConsistId)?.locos.find(l => (l.cabAddress ?? l.address).toString() === addr.toString()) : null)
                          : (activeConsistId ? consists.find(c => c.id === activeConsistId)?.locos.find(l => (l.cabAddress ?? l.address).toString() === addr.toString()) : null);

                        return (
                          <div key={originalIndex} className="relative group">
                            {isEditingPresets ? (
                              <div className="flex gap-1 h-10" id={i === 0 ? "tour-loco-preset-first-inputs" : undefined}>
                                <input 
                                  type="text"
                                  placeholder="RD"
                                  value={locoRoadNames[addr?.toString() || ''] || ''}
                                  maxLength={8}
                                  onChange={(e) => {
                                    setLocoRoadNames(prev => ({
                                      ...prev,
                                      [addr?.toString() || '']: e.target.value.toUpperCase()
                                    }));
                                  }}
                                  className="w-[35%] h-full bg-app-bg border border-accent/30 rounded-lg text-[8px] font-bold text-text-muted text-center focus:outline-none focus:border-accent uppercase px-0.5"
                                />
                                <input 
                                  type="text"
                                  value={addr ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val) || /^#\d*(\.\d*)?$/.test(val)) {
                                      const newPresets = [...presets];
                                      newPresets[index] = val;
                                      setPresets(newPresets);
                                      
                                      // Update cab address in real-time so image/functions follow
                                      if (val !== '') {
                                        setActivePresetIndex(index);
                                        setCabAddress(val);
                                        setPendingCabAddress(val);
                                        if (!isConsistSetupMode) {
                                          setActiveConsistId(null);
                                          setSelectedConsistId(null);
                                        }
                                      }
                                    }
                                  }}
                                  onFocus={(e) => {
                                    editingPresetValue.current = addr;
                                    e.target.select();
                                    // Update cab address when focusing
                                    if (addr !== '') {
                                      setActivePresetIndex(index);
                                      setCabAddress(addr);
                                      setPendingCabAddress(addr);
                                      if (!isConsistSetupMode) {
                                        setActiveConsistId(null);
                                        setSelectedConsistId(null);
                                      }
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  onBlur={() => {
                                    let val = presets[index]?.toString() || '';
                                    const sanitized = sanitizeCabAddress(val);
                                    
                                    if (!isValidCabAddressFormat(sanitized) || (sanitized === '' || sanitized === '0')) {
                                      const newPresets = [...presets];
                                      const restoredVal = editingPresetValue.current || '3';
                                      newPresets[index] = restoredVal.toString();
                                      setPresets(newPresets);
                                      setCabAddress(restoredVal.toString());
                                      setPendingCabAddress(restoredVal.toString());
                                    } else {
                                      const newPresets = [...presets];
                                      newPresets[index] = sanitized;
                                      setPresets(newPresets);
                                      setCabAddress(sanitized);
                                      setPendingCabAddress(sanitized);
                                    }
                                  }}
                                  className="w-[65%] h-full bg-app-bg border border-accent/50 rounded-lg text-sm font-black text-accent text-center focus:outline-none focus:border-accent"
                                />
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  if (isConsistSetupMode) {
                                    if (longPressRemovalRef.current) {
                                      longPressRemovalRef.current = false;
                                      return;
                                    }
                                    toggleLocoInConsist(addrNum, addr);
                                  } else {
                                    // Check if loco is in a moving consist
                                    const movingConsist = consists.find(c => 
                                      c.locos.some(l => l.address === addrNum) && 
                                      (consistSpeedsRef.current[c.id] || 0) > 0
                                    );
                                    if (movingConsist) {
                                      setLocoInConsistWarning({ locoAddr: addrNum, consistId: movingConsist.id, presetIndex: index });
                                    } else {
                                      // Toggle direction if already selected
                                      if (!isConsistSetupMode && activeConsistId === null && cabAddress.toString() === addr.toString()) {
                                        updateThrottle(speed, !isForward);
                                      } else {
                                        setActivePresetIndex(index);
                                        setCabAddress(addr);
                                        setPendingCabAddress(addr);
                                        setActiveConsistId(null);
                                        setSelectedConsistId(null);
                                        setIsEditingAddress(false);
                                      }
                                    }
                                  }
                                }}
                                onContextMenu={(e) => {
                                  if (isConsistSetupMode) {
                                    e.preventDefault();
                                    removeLocoFromConsist(addrNum);
                                  }
                                }}
                                onPointerDown={(e) => {
                                  if (isConsistSetupMode) {
                                    const timer = setTimeout(() => {
                                      removeLocoFromConsist(addrNum);
                                      longPressRemovalRef.current = true;
                                    }, 600);
                                    (e.target as any)._removeTimer = timer;
                                  }
                                }}
                                onPointerUp={(e) => {
                                  clearTimeout((e.target as any)._removeTimer);
                                }}
                                onPointerLeave={(e) => {
                                  clearTimeout((e.target as any)._removeTimer);
                                }}
                                className={`
                                  w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-2
                                  ${locoInConsist ? (
                                    (isForward ? locoInConsist.isReverse : !locoInConsist.isReverse) ? 'border-warning bg-warning/20 text-warning' : 'border-accent bg-accent/20 text-accent'
                                  ) : (
                                    !isConsistSetupMode && cabAddress.toString() === addr.toString() && activeConsistId === null ? (isForward ? 'border-accent bg-accent/20 text-accent' : 'border-warning bg-warning/20 text-warning') : 'border-btn-border bg-btn-bg hover:bg-btn-bg/80 text-text-muted hover:text-text-main hover:border-text-muted'
                                  )}
                                `}
                                style={{
                                  backgroundColor: (() => {
                                    if (!showLocoColors) return undefined;
                                    if (locoInConsist || (!isConsistSetupMode && cabAddress.toString() === addr.toString() && activeConsistId === null)) return undefined;
                                    const baseColor = locoColors[addr];
                                    if (!baseColor) return undefined;
                                    const opacity = locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50;
                                    const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                                    const accentColor = locoAccentColors[addr];
                                    
                                    if (accentColor && accentColor !== 'none') {
                                      return undefined; // We'll use backgroundImage instead
                                    }
                                    
                                    return baseColor + alpha;
                                  })(),
                                  backgroundImage: (() => {
                                    if (!showLocoColors) return undefined;
                                    if (locoInConsist || (!isConsistSetupMode && cabAddress.toString() === addr.toString() && activeConsistId === null)) return undefined;
                                    const baseColor = locoColors[addr];
                                    if (!baseColor) return undefined;
                                    const accentColor = locoAccentColors[addr];
                                    if (!accentColor || accentColor === 'none') return undefined;
                                    
                                    const opacity = locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50;
                                    const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                                    const combinedBase = baseColor + alpha;

                                    const accentOpacity = locoAccentOpacity[addr] !== undefined ? locoAccentOpacity[addr] : opacity;
                                    const accentAlpha = Math.round((accentOpacity / 100) * 255).toString(16).padStart(2, '0');
                                    const combinedAccent = accentColor + accentAlpha;
                                    
                                    return `linear-gradient(to bottom, ${combinedBase} 85%, ${combinedAccent} 85%)`;
                                  })()
                                }}
                              >
                                {(() => {
                                  const config = getEffectiveIconConfig('presets');
                                  if (!config?.active) return null;
                                  return (
                                    <CustomTrainIcon 
                                      className={` ${isConsistSetupMode && locoInConsist ? 'text-current' : 'text-text-muted'}`} 
                                      size={(config?.large && config?.active) ? Math.round(12 * (1 + (config.value || 20) / 100)) : 12}
                                      customIcon={customAppIconEnabled ? customAppIcon : null}
                                      customIconType={customAppIconType}
                                      useThemeColor={config?.useTheme ?? true}
                                    />
                                  );
                                })()}
                                {showRoadNames && locoRoadNames[addr] && (
                                  <span className="opacity-50 text-[10px] uppercase font-black truncate max-w-[40px] tracking-tighter">
                                    {locoRoadNames[addr]}
                                  </span>
                                )}
                                {getDisplayAddress(addr)}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Throttle & Functions */}
          <div className={`${rightColBase} ${uiDensity <= 1 ? 'space-y-4' : uiDensity === 2 ? 'space-y-2' : 'space-y-1'}`}>
            
            {/* Throttle Card */}
            {(() => {
              const directionLabelUI = (
                <span className="text-xs font-bold text-text-muted uppercase mb-1">Direction</span>
              );

              const speedDisplayUI = (
                <div className={`${isForward ? 'text-accent' : 'text-warning'} transition-colors duration-300 shrink-0`}>
                  <div className="text-5xl font-black leading-none flex items-baseline mt-4">
                    {getDisplaySpeed(speed)} 
                    {throttleMode === 'standard' ? (
                      <span className="text-xl text-text-muted/50 ml-1">/{getDisplayMaxSpeed()}</span>
                    ) : (
                      <span className={`text-xl ml-1 ${isForward ? 'text-accent' : 'text-warning'}`}>
                        {isForward ? 'FWD' : 'REV'}
                      </span>
                    )}
                  </div>
                </div>
              );

              const directionButtonsOnlyVerticalUI = (
                <div className="flex bg-app-bg p-1 rounded-xl border border-card-border overflow-hidden w-full max-w-[240px]">
                  {switchingOrientation === 'forward-right' ? (
                    <>
                      <button 
                        onClick={() => updateThrottle(speed, false)}
                        disabled={cabAddress === ''}
                        className={`flex-1 min-w-0 px-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${!isForward ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <ChevronLeft className="w-4 h-4 shrink-0" />
                        <span className="truncate">{throttleCardWidth > 525 ? 'REVERSE' : (throttleCardWidth > 420 ? 'REV' : 'R')}</span>
                      </button>
                      <button 
                        onClick={() => updateThrottle(speed, true)}
                        disabled={cabAddress === ''}
                        className={`flex-1 min-w-0 px-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${isForward ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className="truncate">{throttleCardWidth > 525 ? 'FORWARD' : (throttleCardWidth > 420 ? 'FWD' : 'F')}</span>
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => updateThrottle(speed, true)}
                        disabled={cabAddress === ''}
                        className={`flex-1 min-w-0 px-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${isForward ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <ChevronLeft className="w-4 h-4 shrink-0" />
                        <span className="truncate">{throttleCardWidth > 525 ? 'FORWARD' : (throttleCardWidth > 420 ? 'FWD' : 'F')}</span>
                      </button>
                      <button 
                        onClick={() => updateThrottle(speed, false)}
                        disabled={cabAddress === ''}
                        className={`flex-1 min-w-0 px-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 ${!isForward ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className="truncate">{throttleCardWidth > 525 ? 'REVERSE' : (throttleCardWidth > 420 ? 'REV' : 'R')}</span>
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      </button>
                    </>
                  )}
                </div>
              );

              const directionButtonsOnlyUI = (
                <div id="tour-throttle-direction-btns" className="flex bg-app-bg p-1 rounded-xl border border-card-border overflow-hidden">
                  {switchingOrientation === 'forward-right' ? (
                    <>
                      <button 
                        onClick={() => updateThrottle(speed, false)}
                        disabled={cabAddress === ''}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${!isForward ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <ChevronLeft className="w-4 h-4" /> REVERSE
                      </button>
                      <button 
                        onClick={() => updateThrottle(speed, true)}
                        disabled={cabAddress === ''}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${isForward ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        FORWARD <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => updateThrottle(speed, true)}
                        disabled={cabAddress === ''}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${isForward ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <ChevronLeft className="w-4 h-4" /> FORWARD
                      </button>
                      <button 
                        onClick={() => updateThrottle(speed, false)}
                        disabled={cabAddress === ''}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${!isForward ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'text-text-muted hover:text-text-main'} ${cabAddress === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        REVERSE <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              );

              const directionButtonsUI = (
                <div className={`flex ${throttleLayout === 'standard' ? 'flex-col items-start' : `w-full items-center justify-between gap-4 ${throttleLayout === 'reversed' ? 'flex-row-reverse' : ''}`} ${
                  throttleMode !== 'standard' && throttleLayout === 'standard'
                    ? 'hidden' 
                    : ''
                }`}>
                  {throttleLayout === 'standard' ? (
                    <>
                      {directionLabelUI}
                      {directionButtonsOnlyUI}
                    </>
                  ) : (
                    <>
                      {throttleMode !== 'switching' ? (
                        <div className={`flex flex-col flex-1 min-w-0 ${throttleLayout === 'vertical' ? 'items-start' : 'items-end'}`}>
                          {directionLabelUI}
                          {directionButtonsOnlyVerticalUI}
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                      {speedDisplayUI}
                    </>
                  )}
                </div>
              );

              const presetsArray = speedScale === 'percent' ? [0, 20, 40, 60, 80, 100] : [0, 25, 50, 75, 100, 126];

              const presetsUI = (
                <div id="tour-throttle-presets-grid" className={`grid grid-cols-2 ${throttleLayout !== 'standard' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3 relative z-10 ${isCompactThrottle ? (throttleLayout !== 'standard' ? 'invisible pointer-events-none' : 'hidden') : ''}`}>
                  {presetsArray.map(val => {
                    const internalVal = getInternalSpeed(val);
                    if (val === 0 && isSmallPresetsActive) {
                      return (
                        <div key="small_stop_presets" className="flex gap-3">
                          {[1, 5, 10].map(sVal => {
                            const internalSVal = getInternalSpeed(sVal);
                            return (
                            <button
                              key={sVal}
                              onClick={() => updateThrottle(internalSVal, isForward)}
                              disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                              className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all border ${
                                speed === internalSVal 
                                ? (isForward ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-warning border-warning text-white shadow-lg shadow-warning/20')
                                : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted'
                              } ${highlightedPreset === sVal ? '!bg-accent !text-white !border-accent shadow-lg shadow-accent/20' : ''} ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`}
                            >
                              {sVal}
                            </button>
                            );
                          })}
                        </div>
                      );
                    }
                    return (
                      <button 
                        key={val}
                        onClick={() => updateThrottle(internalVal, isForward)}
                        disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                        id={val === 0 ? "tour-throttle-preset-stop" : undefined}
                        className={`py-3 rounded-xl text-sm font-black transition-all border ${
                          val === 0 
                          ? (uiTheme === 'retro' ? 'bg-danger border-danger text-white hover:bg-danger/90' : 'bg-danger/20 border-danger text-danger hover:bg-danger/30') 
                          : speed === internalVal 
                            ? (isForward ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-warning border-warning text-white shadow-lg shadow-warning/20')
                            : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted'
                        } ${highlightedPreset === val && val !== 0 ? '!bg-accent !text-white !border-accent shadow-lg shadow-accent/20' : ''} ${val === 0 && highlightedPreset === 0 ? '!bg-danger/80 !text-white !border-danger/50 shadow-lg shadow-danger/20' : ''} ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`}
                      >
                        {val === 0 ? 'STOP' : val}
                      </button>
                    );
                  })}
                </div>
              );

              const emergencyStopUI = (
                <div className="flex gap-3 w-full">
                  {(() => {
                    const estopBtn = (className: string) => (
                      <button 
                        id="tour-estop"
                        ref={estopButtonRef}
                        onClick={() => isConnected && emergencyStop()}
                        onMouseDown={() => {
                          const timer = setTimeout(() => {
                            if (addressFocusLevel > 0) {
                              setAddressFocusLevel(0);
                              setIsScrollLocked(false);
                              addLog('info', 'Focus Mode deactivated via E-Stop long-press');
                            }
                          }, 3000);
                          (window as any)._estopLongPressTimer = timer;
                        }}
                        onMouseUp={() => clearTimeout((window as any)._estopLongPressTimer)}
                        onMouseLeave={() => clearTimeout((window as any)._estopLongPressTimer)}
                        onTouchStart={() => {
                          const timer = setTimeout(() => {
                            if (addressFocusLevel > 0) {
                              setAddressFocusLevel(0);
                              setIsScrollLocked(false);
                              addLog('info', 'Focus Mode deactivated via E-Stop long-press');
                            }
                          }, 3000);
                          (window as any)._estopLongPressTimer = timer;
                        }}
                        onTouchEnd={() => clearTimeout((window as any)._estopLongPressTimer)}
                        className={`${className} ${!isConnected ? 'bg-btn-bg border-btn-border text-text-muted' : 'bg-danger hover:bg-danger/80 text-white border-danger/50 shadow-danger/20'} py-4 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-3 border-2 relative z-10 overflow-hidden cursor-default`}
                      >
                        <AlertOctagon className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate">{estopLabel}</span>
                      </button>
                    );
                    
                    const stopBtn = (className: string) => (
                      <button 
                        onClick={() => updateThrottle(0, isForward)}
                        disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                        className={`${className} py-4 rounded-2xl text-lg font-black transition-all border ${
                          (!isConnected && !isTourThrottleEnabledOverride) || (!isThrottleActive && !isTourThrottleEnabledOverride) || (cabAddress === '' && !isTourThrottleEnabledOverride)
                            ? 'bg-btn-bg border-btn-border text-text-muted'
                            : (uiTheme === 'retro' 
                               ? 'bg-danger border-danger text-white hover:bg-danger/90' 
                               : 'bg-danger/20 border-danger text-danger hover:bg-danger/30')
                        } ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'} relative z-10 flex items-center justify-center overflow-hidden`}
                      >
                        STOP
                      </button>
                    );

                    switch (estopConfigMode) {
                      case 1:
                        return (
                          <>
                            {stopBtn("w-1/3")}
                            {estopBtn("w-2/3")}
                          </>
                        );
                      case 2:
                        return (
                          <>
                            {stopBtn("w-1/2")}
                            {estopBtn("w-1/2")}
                          </>
                        );
                      case 3:
                        return (
                          <>
                            {stopBtn("w-2/3")}
                            {estopBtn("w-1/3")}
                          </>
                        );
                      case 4:
                        return (
                          <>
                            {estopBtn("w-1/3")}
                            {stopBtn("w-2/3")}
                          </>
                        );
                      case 5:
                        return (
                          <>
                            {estopBtn("w-1/2")}
                            {stopBtn("w-1/2")}
                          </>
                        );
                      case 6:
                        return (
                          <>
                            {estopBtn("w-2/3")}
                            {stopBtn("w-1/3")}
                          </>
                        );
                      default:
                        return estopBtn("w-full");
                    }
                  })()}
                </div>
              );

              const renderStopLabel = (alwaysButton = false) => (
                (isCompactThrottle || alwaysButton || isStopLabelActAsButton) ? (
                  <button 
                    onClick={() => updateThrottle(0, isForward)}
                    className={`px-1 py-0.5 rounded-lg text-[9px] font-black transition-all border text-center ${
                      uiTheme === 'retro' ? 'bg-danger border-danger text-white hover:bg-danger/90' : 'bg-danger/20 border-danger text-danger hover:bg-danger/30'
                    } ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`}
                    disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                  >
                    STOP
                  </button>
                ) : (
                  <span>STOP</span>
                )
              );

              const throttleControlHeader = (
                <div id="tour-throttle-top-controls" className="relative z-10">
                  <div className={`flex justify-between flex-wrap h-8 overflow-hidden ${throttleLayout === 'reversed' ? 'flex-row-reverse' : ''} ${throttleLayout !== 'standard' ? 'mt-2 -mb-1' : '-mb-2'}`}>
                    {/* Container 1: Throttle Control Title and Settings Buttons */}
                    <div className={`flex flex-col ${throttleLayout === 'reversed' ? 'items-end' : 'items-start'} ${throttleLayout !== 'standard' ? 'w-2/3' : 'flex-1'} min-w-fit`}>
              <div id="tour-throttle-settings-title-combined" className={`flex items-center gap-2 ${throttleLayout === 'reversed' ? 'flex-row-reverse' : ''}`}>
                        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest whitespace-nowrap">Throttle Control</h2>
                        <button 
                          id="tour-throttle-settings-btn"
                          onClick={() => setIsEditingThrottle(!isEditingThrottle)}
                          className={`p-1.5 rounded-lg transition-all ${isEditingThrottle || isThrottleSettingsHighlighted ? 'bg-accent text-white hover:bg-accent/70' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                          title="Throttle Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        {isEditingThrottle && (
                          <button 
                            id="tour-throttle-layout-btn"
                            onClick={() => {
                              if (throttleLayout === 'standard') setThrottleLayout('vertical');
                              else if (throttleLayout === 'vertical') setThrottleLayout('reversed');
                              else setThrottleLayout('standard');
                            }}
                            className={`p-1.5 rounded-lg transition-all ${throttleLayout !== 'standard' ? (throttleLayout === 'reversed' ? 'bg-warning text-white hover:bg-warning/50' : 'bg-warning/50 text-white hover:bg-warning') : 'bg-accent text-white hover:bg-accent/50'}`}
                            title={throttleLayout === 'standard' ? "Vertical Layout" : throttleLayout === 'vertical' ? "Reversed Vertical Layout" : "Standard Layout"}
                          >
                            <Columns2 className="w-4 h-4" />
                          </button>
                        )}
                        {isEditingThrottle && (
                          <button 
                            id="tour-throttle-estop-mode-btn"
                            onClick={() => setEstopConfigMode((estopConfigMode + 1) % 7)}
                            className="p-1.5 rounded-lg transition-all bg-danger text-white hover:bg-danger/80"
                            title="Cycle Emergency Stop Layout"
                          >
                            <AlertOctagon className="w-4 h-4" />
                          </button>
                        )}
                        {isEditingThrottle && (
                          <button 
                            id="tour-throttle-stop-mode-btn"
                            onClick={() => {
                              setStopLabelActAsButtonMap(prev => ({
                                ...prev,
                                [throttleLayout]: !prev[throttleLayout]
                              }));
                            }}
                            className={`p-1.5 rounded-lg transition-all ${isStopLabelActAsButton ? 'bg-danger/70 text-white hover:bg-danger/50' : 'bg-accent text-white hover:bg-accent/50'}`}
                            title={isStopLabelActAsButton ? "Stop is Button" : "Stop is Label"}
                          >
                            <StopCircle className="w-4 h-4" />
                          </button>
                        )}
                        {isEditingThrottle && (
                          <button 
                            id="tour-throttle-small-presets-btn"
                            onClick={() => setIsSmallPresetsActive(!isSmallPresetsActive)}
                            className={`p-1.5 rounded-lg transition-all ${isSmallPresetsActive ? 'bg-success text-white hover:bg-success/80' : 'bg-success/40 text-white hover:bg-success/60'}`}
                            title={isSmallPresetsActive ? "Disable Small Presets" : "Enable Small Presets"}
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        )}
                        {isEditingThrottle && (
                          <button 
                            id="tour-throttle-thick-slider-btn"
                            onClick={() => setIsThickThrottle(!isThickThrottle)}
                            className={`p-1.5 rounded-lg transition-all ${isThickThrottle ? 'bg-warning text-white hover:bg-warning/80' : 'bg-warning/40 text-text-muted hover:text-text-main hover:bg-warning/80'}`}
                            title={isThickThrottle ? "Disable Thick Slider" : "Enable Thick Slider"}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        )}
                        {!isEditingThrottle && (
                          <button 
                            id="tour-throttle-compact-btn"
                            onClick={() => setIsCompactThrottle(!isCompactThrottle)}
                            className={`p-1.5 rounded-lg transition-all ${isCompactThrottle || isCompactThrottleHighlighted ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                            title={isCompactThrottle ? "Expand Throttle" : "Compact Throttle"}
                          >
                            {isCompactThrottle ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Container 2: Direction text or Speed display (for other layouts) */}
                    <div className="flex flex-col items-end self-end flex-shrink-0">
                      {throttleLayout === 'standard' && (
                        <div className={`${throttleMode !== 'standard' ? 'hidden' : ''}`}>
                          {directionLabelUI}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {throttleLayout === 'standard' && (
                    <div className="flex items-end justify-between gap-2 mb-3 flex-nowrap whitespace-nowrap">
                        <div id="tour-throttle-speed-display" className={`text-5xl font-black ${isForward ? 'text-accent' : 'text-warning'} transition-colors duration-300`}>
                          {getDisplaySpeed(speed)} 
                          {throttleMode === 'standard' ? (
                            <span className="text-xl text-text-muted/50 ml-2">/ {getDisplayMaxSpeed()}</span>
                          ) : (
                            <span className={`text-xl ml-2 ${isForward ? 'text-accent' : 'text-warning'}`}>
                              {isForward ? 'FWD' : 'REV'}
                            </span>
                          )}
                        </div>
                        {throttleMode === 'standard' && directionButtonsOnlyUI}
                    </div>
                  )}
                </div>
              );

              return (
      <div 
        ref={throttleCardRef}
        id="throttle-control-card" 
        onMouseEnter={() => setIsHoveringThrottle(true)}
        onMouseLeave={() => setIsHoveringThrottle(false)}
        className={`bg-card-bg rounded-3xl border transition-all duration-300 relative overflow-hidden ${
          throttleLayout !== 'standard' 
            ? (uiDensity === 0 ? 'pt-4 px-8 pb-8' : uiDensity === 1 ? 'pt-2 px-4 pb-4' : uiDensity === 2 ? 'pt-1.5 px-3 pb-3' : 'pt-1 px-1.5 pb-1.5')
            : (uiDensity === 0 ? 'p-8' : uiDensity === 1 ? 'p-4' : uiDensity === 2 ? 'p-3' : 'p-1.5')
        } ${
          (isHoveringThrottle && !isEditingThrottle && trackPower) || isThrottleCardHighlighted
            ? 'border-accent ring-1 ring-accent/50 shadow-lg shadow-accent/20' 
            : 'border-card-border'
        }`}
        style={{
          cursor: isHoveringThrottle && !isEditingThrottle && trackPower
            ? `url('data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2322c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gauge"%3E%3Cpath d="m12 14 4-4"/%3E%3Cpath d="M3.34 19a10 10 0 1 1 17.32 0"/%3E%3C/svg%3E') 12 12, auto`
            : 'auto'
        }}
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          {(() => {
            const config = getEffectiveIconConfig('throttle');
            if (!config?.active) return null;
            return (
              <CustomTrainIcon 
                size={(config?.large && config?.active) ? Math.round(192 * (1 + (config.value || 20) / 100)) : 192}
                className="" 
                customIcon={customAppIconEnabled ? customAppIcon : null}
                customIconType={customAppIconType}
                useThemeColor={config?.useTheme ?? true}
              />
            );
          })()}
        </div>

        <div id="tour-throttle-all-but-estop">
          <div id="tour-throttle-main-controls">
            {throttleControlHeader}

            {throttleLayout === 'standard' && (
              <div className="space-y-6 relative z-10 mt-4 mb-4">
                {isEditingThrottle && (
                  <div id="tour-throttle-settings-pane" className="bg-app-bg px-4 py-2 rounded-2xl border border-accent/30 mb-4 space-y-4 relative z-20">
                    <div id="tour-throttle-roster-settings" className="space-y-4">
                      <div id="tour-throttle-mode-setting-combined" className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Throttle Mode</span>
                        <div className="flex bg-card-bg p-1 rounded-lg border border-card-border">
                          <button 
                            onClick={() => handleSetThrottleMode('standard')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${throttleMode === 'standard' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            STANDARD
                          </button>
                          <button 
                            onClick={() => handleSetThrottleMode('switching')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${throttleMode === 'switching' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            SWITCHING
                          </button>
                        </div>
                      </div>

                      <div id="tour-throttle-orientation-setting-combined" className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Orientation</span>
                        <div className="flex bg-card-bg p-1 rounded-lg border border-card-border">
                          <button 
                            onClick={() => handleSetSwitchingOrientation('forward-left')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${switchingOrientation === 'forward-left' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            FWD LEFT
                          </button>
                          <button 
                            onClick={() => handleSetSwitchingOrientation('forward-right')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${switchingOrientation === 'forward-right' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            FWD RIGHT
                          </button>
                        </div>
                      </div>
                    </div>

                    <div id="tour-throttle-speed-scale-combined" className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Scale Speed Steps or %</span>
                      <div className="flex bg-card-bg p-1 rounded-lg border border-card-border">
                        <button 
                          onClick={() => handleSetSpeedScale('steps')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${speedScale === 'steps' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                        >
                          0-126 Steps
                        </button>
                        <button 
                          onClick={() => handleSetSpeedScale('percent')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${speedScale === 'percent' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                        >
                          0-100 %
                        </button>
                      </div>
                    </div>
                    <div id="tour-throttle-speed-increment-combined" className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Speed Step Increment</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSpeedStepIncrement(Math.max(1, speedStepIncrement - 1))}
                          className="p-1.5 bg-btn-bg border border-btn-border rounded-lg text-text-muted hover:text-text-main"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-xl font-black text-accent w-8 text-center">{speedStepIncrement}</span>
                        <button 
                          onClick={() => setSpeedStepIncrement(Math.min(50, speedStepIncrement + 1))}
                          className="p-1.5 bg-btn-bg border border-btn-border rounded-lg text-text-muted hover:text-text-main"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div id="tour-throttle-slider-combined" className="flex items-center gap-4">
                  <button 
                    id="tour-throttle-slider-minus"
                    onClick={() => handleThrottleHorizontalLeft(speedStepIncrement)}
                    onMouseDown={() => startSpeedRepeat(handleThrottleHorizontalLeft)}
                    onMouseUp={stopSpeedRepeat}
                    onMouseLeave={stopSpeedRepeat}
                    onTouchStart={() => startSpeedRepeat(handleThrottleHorizontalLeft)}
                    onTouchEnd={stopSpeedRepeat}
                    disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '' || (throttleMode === 'standard' && ((switchingOrientation === 'forward-right' && speed === 0) || (switchingOrientation === 'forward-left' && speed === MAX_SPEED))))}
                    className={`p-4 ${isThrottleSliderMinusHighlighted ? '!bg-accent !text-white disabled:opacity-100' : `bg-btn-bg text-text-muted ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`} hover:bg-btn-bg/80 rounded-2xl hover:text-text-main transition-all border border-btn-border hover:border-text-muted`}
                  >
                    {((throttleMode === 'switching' || throttleMode === 'standard') && switchingOrientation === 'forward-left') ? <Plus className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                  </button>

                  <div id="tour-throttle-slider-container" className="flex-1 space-y-4">
                    <input 
                      id="tour-throttle-slider"
                      type="range" 
                      min={throttleMode === 'standard' ? 0 : -getDisplayMaxSpeed()} 
                      max={getDisplayMaxSpeed()} 
                      value={throttleMode === 'standard' ? (
                        switchingOrientation === 'forward-right' ? getDisplaySpeed(speed) : (getDisplayMaxSpeed() - getDisplaySpeed(speed))
                      ) : (
                        isForward 
                          ? (switchingOrientation === 'forward-right' ? getDisplaySpeed(speed) : -getDisplaySpeed(speed))
                          : (switchingOrientation === 'forward-right' ? -getDisplaySpeed(speed) : getDisplaySpeed(speed))
                      )}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (throttleMode === 'standard') {
                          const finalDisplaySpeed = switchingOrientation === 'forward-right' ? val : (getDisplayMaxSpeed() - val);
                          updateThrottle(getInternalSpeed(finalDisplaySpeed), isForward);
                        } else {
                          handleSwitchingThrottleChange(val);
                        }
                      }}
                      disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                      style={{ '--thumb-color': isForward ? 'var(--accent)' : 'var(--warning)' } as any}
                      className={`w-full ${isThickThrottle ? 'h-10' : 'h-4'} bg-app-bg rounded-full appearance-none cursor-pointer border border-card-border transition-all throttle-slider ${isThickThrottle ? 'thick' : ''}`}
                    />
                    <div className="flex justify-between text-[10px] font-mono text-text-muted uppercase tracking-tighter items-center">
                      {throttleMode === 'standard' ? (
                        switchingOrientation === 'forward-right' ? (
                          <>{renderStopLabel()}<span>Slow</span><span>Cruise</span><span>Fast</span><span>Max</span></>
                        ) : (
                          <><span>Max</span><span>Fast</span><span>Cruise</span><span>Slow</span>{renderStopLabel()}</>
                        )
                      ) : (
                        <>
                          <span>{switchingOrientation === 'forward-right' ? 'Max Rev' : 'Max Fwd'}</span>
                          {renderStopLabel()}
                          <span>{switchingOrientation === 'forward-right' ? 'Max Fwd' : 'Max Rev'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button 
                    id="tour-throttle-slider-plus"
                    onClick={() => handleThrottleHorizontalRight(speedStepIncrement)}
                    onMouseDown={() => startSpeedRepeat(handleThrottleHorizontalRight)}
                    onMouseUp={stopSpeedRepeat}
                    onMouseLeave={stopSpeedRepeat}
                    onTouchStart={() => startSpeedRepeat(handleThrottleHorizontalRight)}
                    onTouchEnd={stopSpeedRepeat}
                    disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '' || (throttleMode === 'standard' && ((switchingOrientation === 'forward-right' && speed === MAX_SPEED) || (switchingOrientation === 'forward-left' && speed === 0))))}
                    className={`p-4 ${isThrottleSliderPlusHighlighted ? '!bg-accent !text-white disabled:opacity-100' : `bg-btn-bg text-text-muted ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`} hover:bg-btn-bg/80 rounded-2xl hover:text-text-main transition-all border border-btn-border hover:border-text-muted`}
                  >
                    {((throttleMode === 'switching' || throttleMode === 'standard') && switchingOrientation === 'forward-left') ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {throttleLayout === 'standard' ? (
            <div className="space-y-6 relative z-10">
              {presetsUI}
            </div>
          ) : (
            <div className={`flex gap-8 relative z-10 ${throttleLayout === 'reversed' ? 'flex-row-reverse' : ''}`}>
              {/* Left/Right 2/3: Controls */}
              <div className="w-2/3 flex flex-col pt-0 pb-0">
                {isEditingThrottle && (
                  <div id="tour-throttle-settings-pane" className="bg-app-bg px-4 py-2 mt-2 rounded-2xl border border-accent/30 mb-4 space-y-4 relative z-20">
                    <div id="tour-throttle-roster-settings" className="space-y-4">
                      <div id="tour-throttle-mode-setting-combined" className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Throttle Mode</span>
                        <div className="flex bg-card-bg p-1 rounded-lg border border-card-border">
                          <button 
                            onClick={() => handleSetThrottleMode('standard')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${throttleMode === 'standard' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            STANDARD
                          </button>
                          <button 
                            onClick={() => handleSetThrottleMode('switching')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${throttleMode === 'switching' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            SWITCHING
                          </button>
                        </div>
                      </div>

                      <div id="tour-throttle-orientation-setting-combined" className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Orientation</span>
                        <div className="flex bg-card-bg p-1 rounded-lg border border-card-border">
                          <button 
                            onClick={() => handleSetSwitchingOrientation('forward-left')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${switchingOrientation === 'forward-left' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            FWD LEFT
                          </button>
                          <button 
                            onClick={() => handleSetSwitchingOrientation('forward-right')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${switchingOrientation === 'forward-right' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                          >
                            FWD RIGHT
                          </button>
                        </div>
                      </div>
                    </div>

                    <div id="tour-throttle-speed-scale-combined" className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Scale Speed Steps or %</span>
                      <div className="flex bg-card-bg p-1 rounded-lg border border-card-border">
                        <button 
                          onClick={() => handleSetSpeedScale('steps')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${speedScale === 'steps' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                        >
                          0-126 Steps
                        </button>
                        <button 
                          onClick={() => handleSetSpeedScale('percent')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${speedScale === 'percent' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main'}`}
                        >
                          0-100 %
                        </button>
                      </div>
                    </div>
                    <div id="tour-throttle-speed-increment-combined" className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Step Increment</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSpeedStepIncrement(Math.max(1, speedStepIncrement - 1))}
                          className="p-1.5 bg-btn-bg border border-btn-border rounded-lg text-text-muted hover:text-text-main"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-xl font-black text-accent w-8 text-center">{speedStepIncrement}</span>
                        <button 
                          onClick={() => setSpeedStepIncrement(Math.min(50, speedStepIncrement + 1))}
                          className="p-1.5 bg-btn-bg border border-btn-border rounded-lg text-text-muted hover:text-text-main"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {directionButtonsUI}
                  {presetsUI}
                  <div className="pt-0">
                    {emergencyStopUI}
                  </div>
                </div>
              </div>

              {/* Right/Left 1/3: Vertical Throttle */}
              <div className={`w-1/3 flex flex-col ${throttleLayout === 'vertical' && throttleCardWidth < 525 ? 'items-start pl-4' : 'items-center'} pt-0 pb-0 ${throttleLayout === 'reversed' ? 'border-r pr-4' : 'border-l pl-4'} border-card-border/50`}>
                <div className="flex flex-row items-stretch">
                  {/* Vertical Stack: Plus, Slider, Minus */}
                  <div className="flex flex-col items-center">
                    <button 
                      onClick={() => handleThrottleVerticalTop(speedStepIncrement)}
                      onMouseDown={() => startSpeedRepeat(handleThrottleVerticalTop)}
                      onMouseUp={stopSpeedRepeat}
                      onMouseLeave={stopSpeedRepeat}
                      onTouchStart={() => startSpeedRepeat(handleThrottleVerticalTop)}
                      onTouchEnd={stopSpeedRepeat}
                      disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '' || (throttleMode === 'standard' && speed === MAX_SPEED) || (throttleMode === 'switching' && isForward && speed === MAX_SPEED))}
                      className={`p-4 ${isThrottleSliderPlusHighlighted ? '!bg-accent !text-white disabled:opacity-100' : `bg-btn-bg text-text-muted ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`} hover:bg-btn-bg/80 rounded-2xl hover:text-text-main transition-all border border-btn-border hover:border-text-muted -mt-6`}
                    >
                      <Plus className="w-6 h-6" />
                    </button>

                    <div className="h-[216px] relative mt-2 mb-2 flex items-center justify-center">
                      <input 
                        type="range"
                        orient="vertical"
                        min={throttleMode === 'standard' ? 0 : -getDisplayMaxSpeed()} 
                        max={getDisplayMaxSpeed()} 
                        value={throttleMode === 'standard' ? getDisplaySpeed(speed) : (isForward ? getDisplaySpeed(speed) : -getDisplaySpeed(speed))}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (throttleMode === 'standard') {
                            updateThrottle(getInternalSpeed(val), isForward);
                          } else {
                            if (val >= 0) {
                              updateThrottle(getInternalSpeed(val), true);
                            } else {
                              updateThrottle(getInternalSpeed(Math.abs(val)), false);
                            }
                          }
                        }}
                        disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                        style={{ '--thumb-color': isForward ? 'var(--accent)' : 'var(--warning)' } as any}
                        className={`throttle-slider vertical h-full ${isThickThrottle ? 'thick w-10!' : ''}`}
                      />
                    </div>

                    <button 
                      onClick={() => handleThrottleVerticalBottom(speedStepIncrement)}
                      onMouseDown={() => startSpeedRepeat(handleThrottleVerticalBottom)}
                      onMouseUp={stopSpeedRepeat}
                      onMouseLeave={stopSpeedRepeat}
                      onTouchStart={() => startSpeedRepeat(handleThrottleVerticalBottom)}
                      onTouchEnd={stopSpeedRepeat}
                      disabled={!isTourThrottleEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '' || (throttleMode === 'standard' && speed === 0) || (throttleMode === 'switching' && !isForward && speed === MAX_SPEED))}
                      className={`p-4 ${isThrottleSliderMinusHighlighted ? '!bg-accent !text-white disabled:opacity-100' : `bg-btn-bg text-text-muted ${isTourThrottleEnabledOverride ? 'opacity-100' : 'disabled:opacity-30'}`} hover:bg-btn-bg/80 rounded-2xl hover:text-text-main transition-all border border-btn-border hover:border-text-muted`}
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Speed Labels Sidecar */}
                  <div className={`w-12 flex flex-col justify-between text-[10px] font-mono text-text-muted uppercase tracking-tighter pt-10 ${throttleMode === 'standard' ? 'pb-17' : 'pb-16'} ${isThickThrottle ? '-ml-4' : '-ml-5'} pl-3`}>
                    {throttleMode === 'standard' ? (
                      <>
                        <span>Max</span>
                        <span>Fast</span>
                        <span>Cruise</span>
                        <span>Slow</span>
                        {renderStopLabel()}
                      </>
                    ) : (
                      <>
                        <span>Fwd</span>
                        {renderStopLabel()}
                        <span>Rev</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {throttleLayout === 'standard' && (
          <div className="mt-4 relative z-10">
            {emergencyStopUI}
          </div>
        )}
      </div>
    );
  })()}
            
            {/* Functions Card */}
            <div id="functions-panel" className={`relative bg-card-bg ${uiDensity === 0 ? 'p-6' : uiDensity === 1 ? 'p-4' : uiDensity === 2 ? 'p-3' : 'p-2'} rounded-3xl border border-card-border`}>
              <div id="tour-functions-top-row" className="absolute pointer-events-none transition-all duration-300" style={topRowHighlightStyle} />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
                    {isRoutesView ? 'Routes & Automations' : isTurnoutsView ? 'Turnouts' : 'Loco Functions'}
                  </h2>
                  <button 
                    id="tour-edit-functions-btn"
                    onClick={() => {
                      if (!isEditingFunctions) {
                        // Switch to functions view if moving into edit mode
                        setIsRoutesView(false);
                        setIsTurnoutsView(false);

                        // Scroll lock logic: Entering edit mode
                        if (isScrollLocked) {
                          setScrollLockedBeforeEdit(true);
                          setIsScrollLocked(false);
                          setScrollLockToast("Scroll Lock Deactivated");
                        } else {
                          setScrollLockedBeforeEdit(false);
                        }
                      } else {
                        // Scroll lock logic: Exiting edit mode
                        if (scrollLockedBeforeEdit) {
                          setIsScrollLocked(true);
                          setScrollLockToast("Scroll Lock Reactivated");
                        }
                        setScrollLockedBeforeEdit(false);
                      }
                      
                      if (isEditingFunctions) setCopySourceAddr('');
                      setIsEditingFunctions(!isEditingFunctions);
                    }}
                    className={`p-1.5 rounded-lg transition-colors duration-200 ${(isEditingFunctions || isEditFunctionsHighlighted) ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                    title="Edit Functions"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
{/*
                  {isEditingFunctions && (
                    <div className="flex items-center gap-2 ml-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-text-muted uppercase">Pal R:</span>
                        <input readOnly value={paletteRight} className="w-9 bg-app-bg border border-card-border rounded px-1 py-0.5 text-[9px] text-accent focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-text-muted uppercase">Show L:</span>
                        <input readOnly value={showLeft} className="w-9 bg-app-bg border border-card-border rounded px-1 py-0.5 text-[9px] text-accent focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-text-muted uppercase">MinW:</span>
                        <input readOnly value={minRowWidth} className="w-9 bg-app-bg border border-card-border rounded px-1 py-0.5 text-[9px] text-accent focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-text-muted uppercase">CurW:</span>
                        <input readOnly value={containerWidth} className="w-9 bg-app-bg border border-card-border rounded px-1 py-0.5 text-[9px] text-accent focus:outline-none" />
                      </div>
                    </div>
                  )}
*/}
                  {isEditingFunctions ? (
                    <div key="edit-toolbar" className="flex items-center gap-1">
                      <button 
                        id="tour-show-function-colors-btn"
                        key="fn-colors-btn"
                        onClick={() => setShowLocoFunctionColors(!showLocoFunctionColors)}
                        className={`p-1.5 rounded-lg transition-colors duration-200 border border-transparent ${(showLocoFunctionColors || isFunctionColorsHighlighted) ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                        title={showLocoFunctionColors ? "Hide Function Colors" : "Show Function Colors"}
                      >
                        <Palette className="w-4 h-4" />
                      </button>
                      <button 
                        id="tour-hide-function-numbers-btn"
                        key="fn-numbers-btn"
                        onClick={() => {
                          const current = locoSettings[cabAddress.toString()]?.showNumbers !== false;
                          setLocoSettings(prev => ({
                            ...prev,
                            [cabAddress.toString()]: { 
                              ...(prev[cabAddress.toString()] || { mode: 'standard', orientation: 'forward-right' }), 
                              showNumbers: !current 
                            }
                          }));
                        }}
                        className={`p-1.5 rounded-lg transition-colors duration-200 border border-transparent ${locoSettings[cabAddress.toString()]?.showNumbers !== false ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                        title={locoSettings[cabAddress.toString()]?.showNumbers !== false ? "Hide Function Numbers" : "Show Function Numbers"}
                      >
                        <span className="text-xs font-black w-4 h-4 flex items-center justify-center">F</span>
                      </button>
                      <button 
                        id="tour-hide-function-names-btn"
                        key="fn-names-btn"
                        onClick={() => {
                          const current = locoSettings[cabAddress.toString()]?.showNames !== false;
                          setLocoSettings(prev => ({
                            ...prev,
                            [cabAddress.toString()]: { 
                              ...(prev[cabAddress.toString()] || { mode: 'standard', orientation: 'forward-right' }), 
                              showNames: !current 
                            }
                          }));
                        }}
                        className={`p-1.5 rounded-lg transition-colors duration-200 border border-transparent ${locoSettings[cabAddress.toString()]?.showNames !== false ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg'}`}
                        title={locoSettings[cabAddress.toString()]?.showNames !== false ? "Hide Function Names" : "Show Function Names"}
                      >
                        <span className="text-xs font-black w-4 h-4 flex items-center justify-center">N</span>
                      </button>
                      <button 
                        id="tour-setup-groups-btn"
                        key="setup-groups-btn"
                        onClick={() => {
                          const currentLocoAddr = cabAddress.toString();
                          if (!useFunctionGroups) {
                            const restored = rememberedGroups[currentLocoAddr] || [];
                            if (restored.length > 0) {
                              setEnabledFunctionGroups(prev => ({
                                ...prev,
                                [currentLocoAddr]: restored
                              }));
                              setUseFunctionGroups(true);
                            }
                          }
                          setShowFunctionGroupsModal(true);
                        }}
                        className={`p-1.5 rounded-lg border transition-colors duration-200 ${(useFunctionGroups && ((isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : enabledFunctionGroups[cabAddress.toString()] || [])?.length > 0)) || isFunctionGroupsHighlighted ? 'bg-accent text-white border-transparent' : 'border-accent/20 bg-btn-bg text-text-muted hover:text-accent hover:border-accent/50'}`}
                        title="Loco Function Groups Setup"
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div key="normal-toolbar" className="flex items-center gap-1">
                      <button 
                        key="compact-view-btn"
                        onClick={() => {
                          if (isRoutesView) {
                            setRouteCompactMode((routeCompactMode + 1) % 3);
                          } else if (isTurnoutsView) {
                            setTurnoutCompactMode((turnoutCompactMode + 1) % 3);
                          } else {
                            setIsCompactFunctions(!isCompactFunctions);
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-colors duration-200 border border-transparent ${(() => {
                          if (isRoutesView) {
                            if (routeCompactMode === 1) return 'bg-accent text-white';
                            if (routeCompactMode === 2) return 'bg-warning text-white';
                            return 'text-text-muted hover:text-text-main hover:bg-btn-bg';
                          }
                          if (isTurnoutsView) {
                            if (turnoutCompactMode === 1) return 'bg-accent text-white';
                            if (turnoutCompactMode === 2) return 'bg-warning text-white';
                            return 'text-text-muted hover:text-text-main hover:bg-btn-bg';
                          }
                          return isCompactFunctions ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main hover:bg-btn-bg';
                        })()}`}
                        title={(() => {
                          if (isRoutesView) {
                            return routeCompactMode === 0 ? "Compact IDs" : routeCompactMode === 1 ? "Compact Names" : "Expand Routes";
                          }
                          if (isTurnoutsView) {
                            return turnoutCompactMode === 0 ? "Compact IDs" : turnoutCompactMode === 1 ? "Compact Names" : "Expand Turnouts";
                          }
                          return isCompactFunctions ? "Expand Functions" : "Compact Functions";
                        })()}
                      >
                        {(() => {
                          const mode = isRoutesView ? routeCompactMode : isTurnoutsView ? turnoutCompactMode : (isCompactFunctions ? 1 : 0);
                          return mode === 0 ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />;
                        })()}
                      </button>
                      {!isRoutesView && !isTurnoutsView && useFunctionGroups && ((isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : enabledFunctionGroups[cabAddress.toString()] || [])?.length > 0) && (
                        <button 
                          id="tour-cycle-groups-btn"
                          key="cycle-groups-btn"
                          onClick={() => {
                            const currentLocoAddr = cabAddress.toString();
                            const enabledGroups = isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : (enabledFunctionGroups[currentLocoAddr] || []);
                            const activeGroupId = activeFunctionGroupId[currentLocoAddr] || 'default';
                            const currentGroups = ['default', ...enabledGroups];
                            const currentIndex = currentGroups.indexOf(activeGroupId);
                            const nextIndex = (currentIndex + 1) % currentGroups.length;
                            const nextGroupId = currentGroups[nextIndex];
                            setActiveFunctionGroupId(prev => ({
                              ...prev,
                              [currentLocoAddr]: nextGroupId
                            }));
                            addLog('info', `Switched to ${nextGroupId === 'default' ? 'Default' : (FUNCTION_CATEGORIES.find(c => c.id === nextGroupId)?.label || userGroupNames[currentLocoAddr]?.[nextGroupId] || nextGroupId)} group`);
                          }}
                          className={`p-1.5 rounded-lg border transition-colors duration-200 flex items-center gap-1.5 group/fgroup ${(() => {
                            const gid = activeFunctionGroupId[cabAddress.toString()] || 'default';
                            if (gid === 'default') return 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main';
                            const cat = FUNCTION_CATEGORIES.find(c => c.id === gid);
                            return `${cat?.color || 'bg-accent'} border-transparent text-white shadow-lg shadow-black/20`;
                          })()}`}
                          title="Cycle Function Groups"
                        >
                          {(() => {
                            const gid = activeFunctionGroupId[cabAddress.toString()] || 'default';
                            if (gid === 'default') return <Layers className="w-4 h-4" />;
                            const cat = FUNCTION_CATEGORIES.find(c => c.id === gid);
                            return cat ? <cat.icon className="w-4 h-4" /> : <Tag className="w-4 h-4" />;
                          })()}
                          <span className="text-[9px] font-black uppercase tracking-tighter pr-0.5">
                            {(() => {
                              const gid = activeFunctionGroupId[cabAddress.toString()] || 'default';
                              if (gid === 'default') return 'Default';
                              const userDefined = userGroupNames[cabAddress.toString()]?.[gid];
                              if (userDefined && userDefined.trim() !== '') return userDefined;
                              return FUNCTION_CATEGORIES.find(c => c.id === gid)?.label || 'Group';
                            })()}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {(isRoutesView || isTurnoutsView) && (
                      <button 
                        onClick={() => {
                          if (isRoutesView) {
                            setRoutes([]);
                            setAllRouteIds([]);
                            setRoutesLoaded(true);
                            setAreRouteRetriesEnabled(false);
                            sendCommand('JA');
                            setTimeout(() => setAreRouteRetriesEnabled(true), 500);
                          } else {
                            setTurnouts([]);
                            setAllTurnoutIds([]);
                            setTurnoutsLoaded(true);
                            setAreTurnoutRetriesEnabled(false);
                            sendCommand('JT');
                            setTimeout(() => setAreTurnoutRetriesEnabled(true), 500);
                          }
                        }}
                        id="tour-refresh-button"
                        className="p-1.5 rounded-lg border border-btn-border bg-btn-bg text-text-muted hover:text-text-main transition-all"
                        title={isRoutesView ? "Refresh Routes" : "Refresh Turnouts"}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        if (isTurnoutsView) return;
                        setIsTurnoutsView(true);
                        setIsRoutesView(false);
                        setIsEditingFunctions(false); // Turn off gear icon
                        if (!turnoutsLoaded) {
                          setTurnouts([]);
                          setAllTurnoutIds([]);
                          setTurnoutsLoaded(true);
                          setAreTurnoutRetriesEnabled(false);
                          sendCommand('JT');
                          setTimeout(() => setAreTurnoutRetriesEnabled(true), 500);
                        }
                      }}
                      id="tour-turnouts-btn"
                      className={`p-1.5 rounded-lg border transition-all ${isTurnoutsView ? 'bg-accent border-accent text-white' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main'}`}
                      title="Turnouts"
                    >
                      <Split className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (isRoutesView) return;
                        setIsRoutesView(true);
                        setIsTurnoutsView(false);
                        setIsEditingFunctions(false); // Turn off gear icon
                        if (!routesLoaded) {
                          setRoutes([]);
                          setAllRouteIds([]);
                          setRoutesLoaded(true);
                          setAreRouteRetriesEnabled(false);
                          sendCommand('JA');
                          setTimeout(() => setAreRouteRetriesEnabled(true), 500);
                        }
                      }}
                      id="tour-routes-btn"
                      className={`p-1.5 rounded-lg border transition-all ${isRoutesView ? 'bg-accent border-accent text-white' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main'}`}
                      title="Routes & Automations"
                    >
                      <Map className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setIsRoutesView(false);
                        setIsTurnoutsView(false);
                      }}
                      className={`p-1.5 rounded-lg border transition-all ${(!isRoutesView && !isTurnoutsView) ? 'bg-accent border-accent text-white' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main'}`}
                      title="Loco Functions"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {isRoutesView ? (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {routes.length === 0 ? (
                    <div className="text-center py-8 text-text-muted italic text-xs">
                      No routes or automations found.
                    </div>
                  ) : (
                    <>
                      {/* Automations Group */}
                      {routes.filter(r => r.description === 'Automation').length > 0 && (
                        <div className="space-y-3">
                          <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${functionGridBase} ${routeCompactMode !== 0 ? 'gap-2' : 'gap-4'}`}>
                            {routes.filter(r => r.description === 'Automation').map(route => (
                              <button
                                key={route.id}
                                onClick={() => handleRouteClick(route)}
                                className={`flex items-center justify-center transition-all active:scale-90 group select-none border-2 border-btn-border bg-btn-bg text-text-muted hover:text-text-main hover:border-text-muted ${
                                  routeCompactMode === 0 
                                    ? 'flex-col gap-2 p-3 rounded-2xl' 
                                    : 'flex-row gap-2 py-2 px-3 rounded-xl min-h-[40px]'
                                }`}
                              >
                                {routeCompactMode !== 2 && <span className={`${routeCompactMode === 0 ? 'text-[10px]' : 'text-[11px]'} font-bold`}>{route.id}</span>}
                                {routeCompactMode !== 1 && (
                                  <span className={`${routeCompactMode === 0 ? 'text-[9px] w-full text-center' : 'text-[10px] truncate max-w-[80px]'} font-black uppercase tracking-tighter`}>
                                    {route.name || `Auto ${route.id}`}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Separator */}
                      {routes.filter(r => r.description === 'Automation').length > 0 && 
                       routes.filter(r => r.description === 'Route').length > 0 && (
                        <div className="border-t border-card-border my-2"></div>
                      )}

                      {/* Routes Group */}
                      {routes.filter(r => r.description === 'Route').length > 0 && (
                        <div className="space-y-3">
                          <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${functionGridBase} ${routeCompactMode !== 0 ? 'gap-2' : 'gap-4'}`}>
                            {routes.filter(r => r.description === 'Route').map(route => (
                              <button
                                key={route.id}
                                onClick={() => handleRouteClick(route)}
                                className={`flex items-center justify-center transition-all active:scale-90 group select-none border-2 border-accent/30 bg-btn-bg text-accent/60 hover:text-accent hover:border-accent/60 ${
                                  routeCompactMode === 0 
                                    ? 'flex-col gap-2 p-3 rounded-2xl' 
                                    : 'flex-row gap-2 py-2 px-3 rounded-xl min-h-[40px]'
                                }`}
                              >
                                {routeCompactMode !== 2 && <span className={`${routeCompactMode === 0 ? 'text-[10px]' : 'text-[11px]'} font-bold`}>{route.id}</span>}
                                {routeCompactMode !== 1 && (
                                  <span className={`${routeCompactMode === 0 ? 'text-[9px] w-full text-center' : 'text-[10px] truncate max-w-[80px]'} font-black uppercase tracking-tighter`}>
                                    {route.name || `Route ${route.id}`}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : isTurnoutsView ? (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {turnouts.length === 0 ? (
                    <div className="text-center py-8 text-text-muted italic text-xs">
                      No turnouts found.
                    </div>
                  ) : (
                    <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${functionGridBase} ${turnoutCompactMode !== 0 ? 'gap-2' : 'gap-4'}`}>
                      {turnouts.map(turnout => (
                        <button
                          key={turnout.id}
                          onClick={() => toggleTurnout(turnout.id, turnout.state)}
                          className={`flex items-center justify-center transition-all active:scale-90 group select-none border-2 ${
                            turnoutCompactMode === 0 
                              ? 'flex-col gap-2 p-3 rounded-2xl' 
                              : 'flex-row gap-2 py-2 px-3 rounded-xl min-h-[40px]'
                          } ${
                            turnout.state === 'T' 
                              ? 'border-accent/30 bg-btn-bg text-accent/60 hover:text-accent hover:border-accent/60' 
                              : 'border-btn-border bg-btn-bg text-text-muted hover:text-text-main hover:border-text-muted'
                          }`}
                        >
                          {turnoutCompactMode !== 2 && <span className={`${turnoutCompactMode === 0 ? 'text-[10px]' : 'text-[11px]'} font-bold`}>{turnout.id}</span>}
                          {turnoutCompactMode !== 1 && (
                            <span className={`${turnoutCompactMode === 0 ? 'text-[9px] w-full text-center' : 'text-[10px] truncate max-w-[80px]'} font-black uppercase tracking-tighter`}>
                              {turnout.name || `Turnout ${turnout.id}`}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : isEditingFunctions ? (
                <div className="space-y-4">
                  {/* Copy From UI */}
                  {(Object.keys(locoFunctionConfigs).filter(addr => addr !== cabAddress.toString()).length > 0 || !!tourRef.current) && (
                    <div id="tour-copy-function-config" className="flex items-center gap-3 bg-accent/10 p-3 rounded-2xl border border-accent/20">
                      <div className="flex items-center gap-2">
                        <Copy className="w-3.5 h-3.5 text-accent" />
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">Copy Config From:</span>
                      </div>
                      <div className="flex-1 flex gap-2">
                        <select 
                          className="flex-1 bg-app-bg border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-main focus:outline-none focus:border-accent"
                          value={copySourceAddr || ''}
                          onChange={(e) => setCopySourceAddr(e.target.value)}
                        >
                          <option value="" disabled>Select Locomotive...</option>
                          {Object.keys(locoFunctionConfigs)
                            .filter(addr => addr !== cabAddress.toString())
                            .map(addr => (
                              <option key={addr} value={addr}>Loco {addr}</option>
                            ))
                          }
                          {Object.keys(locoFunctionConfigs).filter(addr => addr !== cabAddress.toString()).length === 0 && (
                            <option value="12">Loco 12</option>
                          )}
                        </select>
                        <button 
                          onClick={() => {
                            if (copySourceAddr) {
                              const sourceConfig = locoFunctionConfigs[copySourceAddr];
                              if (sourceConfig) {
                                setLocoFunctionConfigs(prev => {
                                  const next = {
                                    ...prev,
                                    [cabAddress.toString()]: JSON.parse(JSON.stringify(sourceConfig))
                                  };
                                  return next;
                                });

                                // Also copy function groups information
                                const sourceGroups = locoFunctionGroups[copySourceAddr];
                                if (sourceGroups) {
                                  setLocoFunctionGroups(prev => ({
                                    ...prev,
                                    [cabAddress.toString()]: JSON.parse(JSON.stringify(sourceGroups))
                                  }));
                                }

                                const sourceEnabledGroups = enabledFunctionGroups[copySourceAddr];
                                if (sourceEnabledGroups) {
                                  setEnabledFunctionGroups(prev => ({
                                    ...prev,
                                    [cabAddress.toString()]: JSON.parse(JSON.stringify(sourceEnabledGroups))
                                  }));
                                }

                                const sourceGroupNames = userGroupNames[copySourceAddr];
                                if (sourceGroupNames) {
                                  setUserGroupNames(prev => ({
                                    ...prev,
                                    [cabAddress.toString()]: JSON.parse(JSON.stringify(sourceGroupNames))
                                  }));
                                }

                                const sourceActiveGroup = activeFunctionGroupId[copySourceAddr];
                                if (sourceActiveGroup) {
                                  setActiveFunctionGroupId(prev => ({
                                    ...prev,
                                    [cabAddress.toString()]: sourceActiveGroup
                                  }));
                                }

                                addLog('info', `Copied function configuration and groups from Loco ${copySourceAddr} to Loco ${cabAddress}`);
                                setCopySourceAddr('');
                              }
                            }
                          }}
                          disabled={!copySourceAddr}
                          className="px-3 py-1.5 bg-accent hover:bg-accent/80 disabled:bg-btn-bg disabled:border-btn-border disabled:text-text-muted text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-transparent disabled:border-btn-border"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                  <div 
                    ref={functionsListRef}
                    className={`space-y-2 max-h-[400px] overflow-y-auto p-1 custom-scrollbar ${isEditingFunctions && containerWidth < (minRowWidth+10) ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
                  >
                    {isEditingFunctions && containerWidth < minRowWidth+10 && (
                      <div style={{ width: `${minRowWidth}px`, height: 0, visibility: 'hidden' }} />
                    )}
                  {getLocoFunctionConfig(cabAddress).map((fn, i) => {
                    const isScrolling = isEditingFunctions && containerWidth < (minRowWidth+48);
                    return (
                      <div 
                        key={i} 
                        className="sticky left-0 w-full flex items-center bg-card-bg rounded-xl border border-card-border overflow-hidden"
                      >
                      {/* Sticky Part: F-number, Name, Color Palette */}
                      <div 
                        ref={i === 0 ? fixedPartRef : undefined}
                        className={`z-20 flex items-center gap-3 bg-card-bg p-2 pr-[6px] border-r border-card-border/30 rounded-l-xl transition-shadow ${isFunctionsScrolled ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)]' : ''} ${isScrolling ? 'shrink-0' : 'flex-1'}`}
                        style={{ width: (isScrolling && fixedWidth) ? `${fixedWidth}px` : undefined }}
                      >
                        <div className="w-8 text-[10px] font-black text-text-muted text-center shrink-0">F{i}</div>
                        <input 
                          type="text"
                          value={fn.name || ''}
                          onChange={(e) => {
                            const newConfig = [...getLocoFunctionConfig(cabAddress)];
                            newConfig[i] = { ...newConfig[i], name: e.target.value };
                            setLocoFunctionConfigs(prev => ({
                              ...prev,
                              [cabAddress.toString()]: newConfig
                            }));
                          }}
                          placeholder={`Function ${i} Name`}
                          className={`${isScrolling ? 'w-[128px]' : 'flex-1 min-w-[128px]'} bg-app-bg border border-card-border rounded-lg px-3 py-1.5 text-xs text-accent focus:outline-none focus:border-accent shrink-0`}
                        />
                        <button
                          id={i === 0 ? 'tour-f0-color-btn' : undefined}
                          ref={i === 0 ? paletteRef : undefined}
                          onClick={() => {
                            setEditingFunctionColor({ locoAddr: cabAddress.toString(), functionIdx: i });
                            setActivePickerColor(fn.bgColor || 'none');
                            setActivePickerOpacity(fn.bgOpacity !== undefined ? fn.bgOpacity : 50);
                            setActivePickerAccentColor(fn.accentColor || 'none');
                            setActivePickerAccentOpacity(fn.accentOpacity !== undefined ? fn.accentOpacity : 50);
                            setColorModalMode('base');
                          }}
                          className={`w-8 h-8 rounded-lg border border-btn-border flex items-center justify-center transition-all overflow-hidden shrink-0 relative ${fn.bgColor && fn.bgColor !== 'none' ? '' : 'bg-app-bg'}`}
                          style={{ 
                            backgroundColor: (() => {
                              const baseColor = fn.bgColor;
                              if (!baseColor || baseColor === 'none') return undefined;
                              const accentColor = fn.accentColor;
                              if (accentColor && accentColor !== 'none') return undefined; // use gradient
                              const opacity = fn.bgOpacity !== undefined ? fn.bgOpacity : 50;
                              const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                              return baseColor + alpha;
                            })(),
                            backgroundImage: (() => {
                              const baseColor = fn.bgColor;
                              if (!baseColor || baseColor === 'none') return undefined;
                              const accentColor = fn.accentColor;
                              if (!accentColor || accentColor === 'none') return undefined;
                              const opacity = fn.bgOpacity !== undefined ? fn.bgOpacity : 50;
                              const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                              const combinedBase = baseColor + alpha;
                              
                              const accentOpacity = fn.accentOpacity !== undefined ? fn.accentOpacity : opacity;
                              const accentAlpha = Math.round((accentOpacity / 100) * 255).toString(16).padStart(2, '0');
                              const combinedAccent = accentColor + accentAlpha;
                              
                              return `linear-gradient(to right, ${combinedBase} 90%, ${combinedAccent} 90%)`;
                            })()
                          }}
                          title="Set Function Button Color"
                        >
                          <Palette className={`w-3.5 h-3.5 relative z-10 ${fn.bgColor && fn.bgColor !== 'none' ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : 'text-accent'}`} />
                          {(!fn.bgColor || fn.bgColor === 'none') && (
                            <div 
                              className="absolute inset-0 z-0" 
                              style={{
                                backgroundImage: 'linear-gradient(225deg, transparent 48%, #ef4444 48%, #ef4444 52%, transparent 52%)'
                              }}
                            />
                          )}
                        </button>
                      </div>
 
                      {/* Scrollable Part: Checkboxes */}
                      <div className={`overflow-hidden flex ${isScrolling ? 'flex-1 justify-start' : 'shrink-0 justify-end'}`}>
                        <div 
                          ref={i === 0 ? scrollablePartRef : undefined}
                          className={`flex items-center ${uiDensity === 2 ? 'gap-3' : 'gap-4'} px-[6px] py-2 shrink-0`}
                          style={{ transform: isScrolling ? `translateX(${-scrollX}px)` : undefined }}
                        >
                        <label 
                          ref={i === 0 ? showRef : undefined}
                          className="flex items-center gap-2 cursor-pointer group shrink-0"
                        >
                          <span className="text-[9px] font-bold text-text-muted group-hover:text-text-main uppercase">Show</span>
                          <input 
                            type="checkbox"
                            checked={fn.visible || false}
                            onChange={(e) => {
                              const newConfig = [...getLocoFunctionConfig(cabAddress)];
                              newConfig[i] = { ...newConfig[i], visible: e.target.checked };
                              setLocoFunctionConfigs(prev => ({
                                ...prev,
                                [cabAddress.toString()]: newConfig
                              }));
                            }}
                            className="w-4 h-4 rounded border-card-border bg-app-bg text-accent focus:ring-accent focus:ring-offset-card-bg"
                          />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                          <span className="text-[9px] font-bold text-text-muted group-hover:text-text-main uppercase">Consist</span>
                          <input 
                            type="checkbox"
                            checked={fn.sendToConsist || false}
                            onChange={(e) => {
                              const newConfig = [...getLocoFunctionConfig(cabAddress)];
                              newConfig[i] = { ...newConfig[i], sendToConsist: e.target.checked };
                              setLocoFunctionConfigs(prev => ({
                                ...prev,
                                [cabAddress.toString()]: newConfig
                              }));
                            }}
                            className="w-4 h-4 rounded border-card-border bg-app-bg text-accent focus:ring-accent focus:ring-offset-card-bg"
                          />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                          <span className="text-[9px] font-bold text-text-muted group-hover:text-text-main uppercase">Momentary</span>
                          <input 
                            type="checkbox"
                            checked={fn.momentary || false}
                            onChange={(e) => {
                              const newConfig = [...getLocoFunctionConfig(cabAddress)];
                              newConfig[i] = { ...newConfig[i], momentary: e.target.checked };
                              setLocoFunctionConfigs(prev => ({
                                ...prev,
                                [cabAddress.toString()]: newConfig
                              }));
                            }}
                            className="w-4 h-4 rounded border-card-border bg-app-bg text-accent focus:ring-accent focus:ring-offset-card-bg"
                          />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                          <span className="text-[9px] font-bold text-text-muted group-hover:text-text-main uppercase">Repeat</span>
                          <input 
                            type="checkbox"
                            checked={fn.repeat || false}
                            onChange={(e) => {
                              const newConfig = [...getLocoFunctionConfig(cabAddress)];
                              newConfig[i] = { ...newConfig[i], repeat: e.target.checked };
                              setLocoFunctionConfigs(prev => ({
                                ...prev,
                                [cabAddress.toString()]: newConfig
                              }));
                            }}
                            className="w-4 h-4 rounded border-card-border bg-app-bg text-accent focus:ring-accent focus:ring-offset-card-bg"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
                </div>
              </div>
            ) : (
                <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${functionGridBase} ${isCompactFunctions ? 'gap-2' : 'gap-4'}`}>
                  {(() => {
                    const functionConfigs = getLocoFunctionConfig(cabAddress);
                    const renderFunctionButton = (fn: LocoFunctionConfig, i: number) => {
                      const currentLocoAddr = cabAddress.toString();
                      const activeGroupId = activeFunctionGroupId[currentLocoAddr] || 'default';
                      let isVisible = fn.visible;
                      if (useFunctionGroups && !isEditingFunctions && activeGroupId !== 'default') {
                        if (activeGroupId === 'all') {
                          isVisible = true;
                        } else {
                          isVisible = (isTourDemoAssignmentActive 
                            ? (tourDemoLocoFunctionGroups[activeGroupId] || []) 
                            : (locoFunctionGroups[currentLocoAddr]?.[activeGroupId] || [])).includes(i);
                        }
                      }
                      return isVisible && (
                      <button 
                        key={i}
                        id={i === 0 ? "tour-function-f0" : i === 1 ? "tour-function-f1" : i === 2 ? "tour-function-f2" : undefined}
                        onPointerDown={() => {
                          if (fn.momentary) {
                            setFunctionState(i, true);
                          }
                          if (fn.repeat) {
                            startFunctionRapid(i);
                          }
                        }}
                        onPointerUp={() => {
                          if (fn.momentary) {
                            setFunctionState(i, false);
                          }
                          if (fn.repeat) {
                            stopFunctionRapid();
                          }
                        }}
                        onPointerLeave={() => {
                          if (fn.momentary && functions[i]) {
                            setFunctionState(i, false);
                          }
                          if (fn.repeat) {
                            stopFunctionRapid();
                          }
                        }}
                        onClick={() => {
                          if (!fn.momentary && !fn.repeat) {
                            toggleFunction(i);
                          } else if (!fn.momentary && fn.repeat) {
                            // For repeat non-momentary, a simple click should still toggle
                            // but we need to be careful about not doubling up with the start of repeat
                            // Actually, just let it toggle.
                            toggleFunction(i);
                          }
                        }}
                        disabled={!isTourFunctionsEnabledOverride && (!isConnected || !isThrottleActive || cabAddress === '')}
                        className={`
                          flex ${isCompactFunctions ? 'flex-row py-2 px-3 rounded-xl gap-2 font-bold' : 'flex-col p-3 rounded-2xl gap-2 font-black min-h-[70px]'} 
                          items-center justify-center border-2 transition-all ${i === 2 && isTourF2Pressed ? 'scale-90 border-accent text-accent shadow-inner' : 'active:scale-90'} disabled:opacity-30 select-none 
                          ${functions[i] 
                            ? (showLocoFunctionColors && fn.bgColor && fn.bgColor !== 'none' ? 'border-accent text-accent shadow-lg shadow-accent/20' : 'bg-accent/20 border-accent text-accent shadow-lg shadow-accent/10') 
                            : (showLocoFunctionColors && fn.bgColor && fn.bgColor !== 'none' ? 'border-card-border text-text-main hover:border-text-muted shadow-sm' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-text-muted')
                          }
                        `}
                        style={{ 
                          backgroundColor: (() => {
                            if (!showLocoFunctionColors) return undefined;
                            const baseColor = fn.bgColor;
                            if (!baseColor || baseColor === 'none') return undefined;
                            const accentColor = fn.accentColor;
                            if (accentColor && accentColor !== 'none') return undefined; // use gradient
                            const opacity = fn.bgOpacity !== undefined ? fn.bgOpacity : (functions[i] ? 60 : 50);
                            const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                            return baseColor + alpha;
                          })(),
                          backgroundImage: (() => {
                            if (!showLocoFunctionColors) return undefined;
                            const baseColor = fn.bgColor;
                            if (!baseColor || baseColor === 'none') return undefined;
                            const accentColor = fn.accentColor;
                            if (!accentColor || accentColor === 'none') return undefined;
                            const opacity = fn.bgOpacity !== undefined ? fn.bgOpacity : (functions[i] ? 60 : 50);
                            const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                            const combinedBase = baseColor + alpha;
                            
                            const accentOpacity = fn.accentOpacity !== undefined ? fn.accentOpacity : opacity;
                            const accentAlpha = Math.round((accentOpacity / 100) * 255).toString(16).padStart(2, '0');
                            const combinedAccent = accentColor + accentAlpha;
                            
                            return `linear-gradient(to right, ${combinedBase} 90%, ${combinedAccent} 90%)`;
                          })()
                        }}
                      >
                        {isEditingFunctions && (!fn.bgColor || fn.bgColor === 'none') && (
                          <div className="absolute top-1.5 right-1.5 opacity-40 pointer-events-none">
                            <div className="relative">
                              <Palette className="w-3 h-3 text-text-muted" />
                              <div 
                                className="absolute inset-0 z-10" 
                                style={{
                                  backgroundImage: 'linear-gradient(225deg, transparent 48%, #ef4444 48%, #ef4444 52%, transparent 52%)'
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {(locoSettings[cabAddress.toString()]?.showNumbers !== false) && (
                          i === 0 ? <Lightbulb className={`${isCompactFunctions ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : 
                          i === 1 ? <Bell className={`${isCompactFunctions ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : 
                          i === 2 ? <Volume2 className={`${isCompactFunctions ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : 
                          <span className={`${isCompactFunctions ? 'text-[9px]' : 'text-[10px]'} font-bold`}>F{i}</span>
                        )}
                        {(locoSettings[cabAddress.toString()]?.showNames !== false) && fn.name && fn.name.toUpperCase() !== `F${i}` ? (
                          <span className={`${isCompactFunctions ? 'text-[10px] truncate max-w-[70%]' : 'text-[9px] w-full text-center'} uppercase tracking-tighter truncate md:max-w-none`}>
                            {fn.name}
                          </span>
                        ) : (
                          !(locoSettings[cabAddress.toString()]?.showNumbers !== false) && <div className="h-[12px]">&nbsp;</div>
                        )}
                      </button>
                      );
                    };

                    return (
                      <>
                        {functionConfigs.map((fn, idx) => renderFunctionButton(fn, idx))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Consist Warning Modal */}
      {locoInConsistWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-sm">
          <motion.div 
            id="tour-consist-warning-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-card-bg border-2 border-accent/50 rounded-3xl p-8 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-accent/20 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h3 className="text-xl font-black text-text-main">Consist Warning</h3>
                <p className="text-text-muted text-sm">Locomotive {locoInConsistWarning.locoAddr} is active in a consist.</p>
              </div>
            </div>
            
            <p className="text-text-main/80 mb-8 leading-relaxed">
              This locomotive is currently part of <span className="text-accent font-bold">Consist {locoInConsistWarning.consistId}</span> which is in motion. 
              Controlling it individually now could cause unexpected behavior or derailments.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  if (activeConsistId !== locoInConsistWarning.consistId) {
                    handleConsistPresetClick(locoInConsistWarning.consistId);
                  }
                  if (locoInConsistWarning.presetIndex !== undefined) {
                    setActivePresetIndex(locoInConsistWarning.presetIndex);
                  }
                  setLocoInConsistWarning(null);
                }}
                className="w-full py-4 bg-accent hover:bg-accent-hover text-white font-black rounded-2xl transition-all shadow-lg shadow-accent/20"
              >
                Control Consist {locoInConsistWarning.consistId}
              </button>
              <button 
                onClick={() => {
                  setCabAddress(locoInConsistWarning.locoAddr);
                  setPendingCabAddress(locoInConsistWarning.locoAddr);
                  setActiveConsistId(null);
                  if (locoInConsistWarning.presetIndex !== undefined) {
                    setActivePresetIndex(locoInConsistWarning.presetIndex);
                  }
                  setLocoInConsistWarning(null);
                }}
                className="w-full py-4 bg-warning hover:bg-warning/80 text-white font-black rounded-2xl transition-all shadow-lg shadow-warning/20"
              >
                Control Individually Anyway
              </button>
              <button 
                onClick={() => setLocoInConsistWarning(null)}
                className="w-full py-4 bg-btn-bg hover:bg-btn-bg/80 text-text-muted font-bold rounded-2xl transition-all border border-btn-border"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Consist Conflict Warning Modal */}
      {consistConflictWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card-bg p-8 rounded-3xl border border-warning shadow-2xl max-w-md w-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-warning/20 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
              <div>
                <h3 className="text-xl font-black text-text-main">Consist Conflict Warning</h3>
                <p className="text-text-muted text-sm">Locomotives active in multiple consists.</p>
              </div>
            </div>
            
            <p className="text-text-main/80 mb-4 leading-relaxed">
              The following locomotive(s) in the selected consist are currently part of other consist(s) that are currently in motion. Controlling this consist now could cause unexpected behavior and derailments.
            </p>
            
            <div className="bg-app-bg p-4 rounded-xl border border-card-border mb-8 max-h-40 overflow-y-auto">
              <div className="text-accent font-black text-sm mb-2 border-b border-card-border pb-2">
                Consist Speed {consistConflictWarning.selectedConsistSpeed}
              </div>
              {consistConflictWarning.conflicts.map((c, i) => (
                <div key={i} className="text-text-main font-mono text-sm mb-1 last:mb-0">
                  Loco {c.locoAddr} - Consist {c.otherConsistId} (Speed {c.speed})
                </div>
              ))}
              {consistConflictWarning.individualConflicts && consistConflictWarning.individualConflicts.length > 0 && (
                <>
                  <p className="text-text-main/80 mt-4 mb-2 leading-relaxed whitespace-pre-wrap">
                    In addition, the following locomotives in the selected consist are also in motion.
                  </p>
                  {consistConflictWarning.individualConflicts.map((c, i) => (
                    <div key={`indiv-${i}`} className="text-text-main font-mono text-sm mb-1 last:mb-0">
                      Loco {c.locoAddr} - Speed {c.speed}
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  handleConsistPresetClick(consistConflictWarning.selectedConsistId, true);
                  setConsistConflictWarning(null);
                }}
                className="w-full py-4 bg-warning hover:bg-warning/80 text-white font-black rounded-2xl transition-all shadow-lg shadow-warning/20"
              >
                Control Consist {consistConflictWarning.selectedConsistId}
              </button>
              <button 
                onClick={() => setConsistConflictWarning(null)}
                className="w-full py-4 bg-btn-bg hover:bg-btn-bg/80 text-text-muted font-bold rounded-2xl transition-all border border-btn-border"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Loco Individually Moving Warning Modal */}
      {locoIndividuallyMovingWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-sm">
          <motion.div 
            id="tour-loco-individually-moving-warning-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card-bg p-8 rounded-3xl border border-warning shadow-2xl max-w-md w-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-warning/20 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
              <div>
                <h3 className="text-xl font-black text-text-main">Locomotive(s) Already in Motion</h3>
                <p className="text-text-muted text-sm">Individual locomotives are moving.</p>
              </div>
            </div>
            
            <p className="text-text-main/80 mb-4 leading-relaxed">
              The following locomotive(s) in the selected consist are currently in motion.
            </p>
            
            <div className="bg-app-bg p-4 rounded-xl border border-card-border mb-8 max-h-40 overflow-y-auto">
              {locoIndividuallyMovingWarning.conflicts.map((c, i) => (
                <div key={i} className="text-text-main font-mono text-sm mb-1 last:mb-0">
                  Loco {c.locoAddr} - Speed {c.speed}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={() => {
                  syncLongPressTimeoutRef.current = setTimeout(() => {
                    syncLongPressFiredRef.current = true;
                    setLocoIndividuallyMovingWarning(prev => {
                      if (!prev) return prev;
                      const currentIndex = prev.conflicts.findIndex(c => c.locoAddr === prev.leadLocoAddr);
                      const nextIndex = (currentIndex + 1) % prev.conflicts.length;
                      return { ...prev, leadLocoAddr: prev.conflicts[nextIndex].locoAddr };
                    });
                  }, 500);
                }}
                onTouchEnd={() => {
                  if (syncLongPressTimeoutRef.current) clearTimeout(syncLongPressTimeoutRef.current);
                }}
                onMouseDown={() => {
                  syncLongPressTimeoutRef.current = setTimeout(() => {
                    syncLongPressFiredRef.current = true;
                    setLocoIndividuallyMovingWarning(prev => {
                      if (!prev) return prev;
                      const currentIndex = prev.conflicts.findIndex(c => c.locoAddr === prev.leadLocoAddr);
                      const nextIndex = (currentIndex + 1) % prev.conflicts.length;
                      return { ...prev, leadLocoAddr: prev.conflicts[nextIndex].locoAddr };
                    });
                  }, 500);
                }}
                onMouseUp={() => {
                  if (syncLongPressTimeoutRef.current) clearTimeout(syncLongPressTimeoutRef.current);
                }}
                onMouseLeave={() => {
                  if (syncLongPressTimeoutRef.current) clearTimeout(syncLongPressTimeoutRef.current);
                }}
                onClick={() => {
                  if (syncLongPressFiredRef.current) {
                    syncLongPressFiredRef.current = false;
                    return;
                  }
                  const syncSpeed = locoIndividuallyMovingWarning.conflicts.find(c => c.locoAddr === locoIndividuallyMovingWarning.leadLocoAddr)?.speed || 0;
                  handleConsistPresetClick(locoIndividuallyMovingWarning.selectedConsistId, true, syncSpeed);
                  setLocoIndividuallyMovingWarning(null);
                }}
                className="w-full py-4 bg-accent hover:bg-accent-hover text-white font-black rounded-2xl transition-all shadow-lg shadow-accent/20 select-none cursor-pointer touch-none"
              >
                Sync Speeds With Locomotive {locoIndividuallyMovingWarning.leadLocoAddr}
              </button>
              <button 
                onClick={() => {
                  handleConsistPresetClick(locoIndividuallyMovingWarning.selectedConsistId, true);
                  setLocoIndividuallyMovingWarning(null);
                }}
                className="w-full py-4 bg-warning hover:bg-warning/80 text-white font-black rounded-2xl transition-all shadow-lg shadow-warning/20"
              >
                Select Consist Without Sync
              </button>
              <button 
                onClick={() => setLocoIndividuallyMovingWarning(null)}
                className="w-full py-4 bg-btn-bg hover:bg-btn-bg/80 text-text-muted font-bold rounded-2xl transition-all border border-btn-border"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Consist Speed Mismatch Modal */}
      {consistSpeedMismatchWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card-bg p-8 rounded-3xl border border-warning shadow-2xl max-w-md w-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-warning/20 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
              <div>
                <h3 className="text-xl font-black text-text-main">Consist Speed Mismatch</h3>
                <p className="text-text-muted text-sm">Loco speeds do not match.</p>
              </div>
            </div>
            
            <p className="text-text-main/80 mb-4 leading-relaxed">
              Speeds for some locomotive(s) in the consist do not match the consist speed!
            </p>
            
            <div className="bg-app-bg p-4 rounded-xl border border-card-border mb-8 max-h-40 overflow-y-auto">
              <div className="text-accent font-black text-sm mb-2 border-b border-card-border pb-2">
                Consist Speed {consistSpeedMismatchWarning.consistSpeed}
              </div>
              {consistSpeedMismatchWarning.locoSpeeds.map((c, i) => (
                <div key={i} className="text-text-main font-mono text-sm mb-1 last:mb-0">
                  Loco {c.locoAddr} - Speed {c.speed}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  handleConsistPresetClick(consistSpeedMismatchWarning.selectedConsistId, true, consistSpeedMismatchWarning.consistSpeed);
                  setConsistSpeedMismatchWarning(null);
                }}
                className="w-full py-4 bg-accent hover:bg-accent-hover text-white font-black rounded-2xl transition-all shadow-lg shadow-accent/20"
              >
                Sync Locos to Consist Speed
              </button>
              <button 
                onClick={() => {
                  handleConsistPresetClick(consistSpeedMismatchWarning.selectedConsistId, true);
                  setConsistSpeedMismatchWarning(null);
                }}
                className="w-full py-4 bg-warning hover:bg-warning/80 text-white font-black rounded-2xl transition-all shadow-lg shadow-warning/20"
              >
                Select Consist Without Sync
              </button>
              <button 
                onClick={() => setConsistSpeedMismatchWarning(null)}
                className="w-full py-4 bg-btn-bg hover:bg-btn-bg/80 text-text-muted font-bold rounded-2xl transition-all border border-btn-border"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Block Assignment Modal */}
      <AnimatePresence>
        {selectedBlockForEdit && (
          <div key="block-assignment-modal" className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBlockForEdit(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              id="tour-block-edit-modal"
              initial={isTourActive ? false : { scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={isTourActive ? false : { scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-card-bg border border-card-border rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <Settings className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-text-main">Block {selectedBlockForEdit}</h2>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Configure Assignment</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBlockForEdit(null)}
                  className="p-2 hover:bg-btn-bg rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-text-muted" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Track Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['MAIN', 'PROG', 'MAIN_INV', 'DC', 'DCX', 'NONE'].map(m => (
                      <button
                        key={m}
                        id={`tour-block-mode-${m}`}
                        onClick={() => {
                          const block = trackBlocks.find(b => b.letter === selectedBlockForEdit);
                          if (block) {
                            // If type is actually changing, turn power off
                            if (block.state !== m) {
                              if (block.power) {
                                toggleBlockPower(block.letter);
                              }
                            }
                            
                            // Assign the new block type
                            assignBlock(selectedBlockForEdit, m, block.cab || 1);
                            
                            // Close dialog if not DC/DCX
                            if (m !== 'DC' && m !== 'DCX') {
                              setSelectedBlockForEdit(null);
                            }
                          }
                        }}
                        className={`py-3 rounded-xl font-black text-[10px] transition-all border-2 ${
                          trackBlocks.find(b => b.letter === selectedBlockForEdit)?.state === m
                          ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20'
                          : 'bg-btn-bg border-btn-border text-text-muted hover:border-text-muted'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {(trackBlocks.find(b => b.letter === selectedBlockForEdit)?.state === 'DC' || 
                  trackBlocks.find(b => b.letter === selectedBlockForEdit)?.state === 'DCX') && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Fake DCC Address (Cab)</label>
                    <input 
                      type="number"
                      min="1"
                      max="10239"
                      value={trackBlocks.find(b => b.letter === selectedBlockForEdit)?.cab || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const block = trackBlocks.find(b => b.letter === selectedBlockForEdit);
                        if (block) assignBlock(selectedBlockForEdit, block.state, val);
                      }}
                      className="w-full bg-btn-bg border border-btn-border rounded-xl px-4 py-3 text-sm font-bold text-accent focus:outline-none focus:border-accent"
                      placeholder="Enter Cab Address"
                    />
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setTrackBlocks(prev => prev.filter(b => b.letter !== selectedBlockForEdit));
                    setSelectedBlockForEdit(null);
                  }}
                  disabled={selectedBlockForEdit === 'A' || selectedBlockForEdit === 'B'}
                  className="w-full py-4 bg-danger/10 hover:bg-danger/20 text-danger font-bold rounded-2xl transition-all border border-danger/30 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Block
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Loco Color Modal */}
      <AnimatePresence>
        {(showLocoColorModal !== null || editingFunctionColor !== null) && (
          <div key="loco-color-modal" className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLocoColorModal(null);
                setEditingFunctionColor(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
              <motion.div 
                id="tour-loco-color-modal"
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-xs bg-card-bg border border-card-border rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh]"
              >
                <button
                  id="tour-loco-color-mode-button"
                  onClick={() => setColorModalMode(colorModalMode === 'base' ? 'accent' : 'base')}
                  className="w-fit mx-auto mb-4 px-4 py-1.5 rounded-full bg-black/20 border border-card-border hover:bg-black/30 hover:border-accent transition-all group shrink-0"
                >
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isColorModeButtonHighlighted ? 'text-accent' : 'text-text-main group-hover:text-accent'}`}>
                    {editingFunctionColor ? (colorModalMode === 'base' ? 'Function Button Color' : 'Function Accent Color') : (colorModalMode === 'base' ? 'Loco Button Color' : 'Loco Accent Color')}
                  </h3>
                </button>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-6 pb-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Select {colorModalMode === 'base' ? 'Background' : 'Accent'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-accent uppercase">{colorModalMode === 'base' ? activePickerOpacity : activePickerAccentOpacity}%</span>
                        <div 
                          className={`w-12 h-6 rounded-lg border border-card-border ${(colorModalMode === 'base' ? activePickerColor : activePickerAccentColor) === 'none' ? 'none-swatch-pattern' : ''}`}
                          style={{ 
                            backgroundColor: (colorModalMode === 'base' ? activePickerColor : activePickerAccentColor) !== 'none' ? (colorModalMode === 'base' ? activePickerColor : activePickerAccentColor) : undefined, 
                            opacity: (colorModalMode === 'base' ? activePickerColor : activePickerAccentColor) !== 'none' ? (colorModalMode === 'base' ? activePickerOpacity / 100 : activePickerAccentOpacity / 100) : 1 
                          }}
                        />
                      </div>
                    </div>

                    {/* Opacity Slider */}
                    <div className="px-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-tight">Opacity</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={colorModalMode === 'base' ? activePickerOpacity : activePickerAccentOpacity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (colorModalMode === 'base') {
                            setActivePickerOpacity(val);
                          } else {
                            setActivePickerAccentOpacity(val);
                          }
                        }}
                        className="w-full h-1.5 bg-black/20 rounded-lg appearance-none cursor-pointer accent-accent"
                      />
                      <div className="flex justify-between text-[8px] text-text-muted font-bold uppercase overflow-x-hidden">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Swatches Grid */}
                    <div className="grid grid-cols-4 gap-2 p-1 bg-black/20 rounded-2xl border border-card-border">
                      {LOCO_PRESET_COLORS.map((color, idx) => (
                        <motion.button
                          key={color}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.01 }}
                          whileHover={{ scale: 1.15, zIndex: 10 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            if (colorModalMode === 'base') {
                              setActivePickerColor(color);
                            } else {
                              setActivePickerAccentColor(color);
                            }
                            setShowInlinePicker(false);
                          }}
                          className={`aspect-square rounded-lg border-2 transition-shadow ${(colorModalMode === 'base' ? activePickerColor : activePickerAccentColor).toLowerCase() === color.toLowerCase() ? 'border-white shadow-lg shadow-white/20' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>

                    <div id="tour-loco-custom-color-picker-container" className="flex flex-col gap-3">
                      <motion.button
                        id="tour-loco-custom-color-button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowInlinePicker(!showInlinePicker)}
                        className={`w-full py-2.5 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${showInlinePicker ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:border-accent'}`}
                      >
                        <Layers className={`w-3.5 h-3.5 ${showInlinePicker ? 'text-white' : 'text-accent'}`} />
                        {showInlinePicker ? 'Hide Custom Picker' : `Custom / ${colorModalMode === 'base' ? 'Background' : 'Accent'}`}
                      </motion.button>
                      
                      {showInlinePicker && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="w-full flex flex-col gap-4 pb-2"
                        >
                          <div className="custom-color-picker px-1">
                            <HexColorPicker 
                              color={(colorModalMode === 'base' ? (activePickerColor === 'none' ? '#2563eb' : activePickerColor) : (activePickerAccentColor === 'none' ? '#2563eb' : activePickerAccentColor))} 
                              onChange={(color) => {
                                if (colorModalMode === 'base') {
                                  setActivePickerColor(color);
                                } else {
                                  setActivePickerAccentColor(color);
                                }
                              }} 
                            />
                          </div>
                          <div className="flex items-center gap-2 px-1">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Hex</span>
                            <input 
                              type="text"
                              value={(colorModalMode === 'base' ? (activePickerColor === 'none' ? '' : activePickerColor.toUpperCase()) : (activePickerAccentColor === 'none' ? '' : activePickerAccentColor.toUpperCase()))}
                              placeholder="#000000"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (/^#[0-9A-F]{0,6}$/i.test(val) || val === '') {
                                  const colorVal = val || 'none';
                                  if (colorModalMode === 'base') {
                                    setActivePickerColor(colorVal);
                                  } else {
                                    setActivePickerAccentColor(colorVal);
                                  }
                                }
                              }}
                              className="flex-1 bg-btn-bg border border-btn-border rounded-lg px-2 py-1.5 text-xs font-mono text-accent focus:outline-none focus:border-accent uppercase"
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                <div id="tour-loco-color-footer" className="grid grid-cols-2 gap-3 pt-4 border-t border-card-border shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (colorModalMode === 'base') {
                          setActivePickerColor('none');
                        } else {
                          setActivePickerAccentColor('none');
                        }
                        setShowInlinePicker(false);
                      }}
                      className="py-3 bg-btn-bg hover:bg-black/20 border border-btn-border text-text-muted rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
                    >
                      None
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowLocoColorModal(null);
                        setEditingFunctionColor(null);
                        setShowInlinePicker(false);
                      }}
                      className="py-3 bg-btn-bg hover:bg-black/20 border border-btn-border text-text-muted rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98, y: 0 }}
                      onClick={() => {
                        if (showLocoColorModal !== null) {
                          const locoAddr = presets[showLocoColorModal];
                          if (locoAddr) {
                            setLocoColors(prev => {
                              const next = { ...prev };
                              if (activePickerColor === 'none') {
                                delete next[locoAddr];
                              } else {
                                next[locoAddr] = activePickerColor;
                              }
                              return next;
                            });
                            setLocoOpacity(prev => {
                              const next = { ...prev };
                              if (activePickerColor === 'none') {
                                delete next[locoAddr];
                              } else {
                                next[locoAddr] = activePickerOpacity;
                              }
                              return next;
                            });
                            setLocoAccentColors(prev => {
                              const next = { ...prev };
                              if (activePickerAccentColor === 'none') {
                                delete next[locoAddr];
                              } else {
                                next[locoAddr] = activePickerAccentColor;
                              }
                              return next;
                            });
                            setLocoAccentOpacity(prev => {
                              const next = { ...prev };
                              if (activePickerAccentColor === 'none') {
                                delete next[locoAddr];
                              } else {
                                next[locoAddr] = activePickerAccentOpacity;
                              }
                              return next;
                            });
                          }
                          setShowLocoColorModal(null);
                        } else if (editingFunctionColor !== null) {
                          const { locoAddr, functionIdx } = editingFunctionColor;
                          const newConfig = [...getLocoFunctionConfig(locoAddr)];
                          newConfig[functionIdx] = { 
                            ...newConfig[functionIdx], 
                            bgColor: activePickerColor,
                            bgOpacity: activePickerOpacity,
                            accentColor: activePickerAccentColor,
                            accentOpacity: activePickerAccentOpacity
                          };
                          setLocoFunctionConfigs(prev => ({
                            ...prev,
                            [locoAddr]: newConfig
                          }));
                          setEditingFunctionColor(null);
                        }
                        setShowInlinePicker(false);
                      }}
                      className="col-span-2 py-4 bg-accent hover:bg-accent-hover text-white rounded-2xl text-xs font-black shadow-lg shadow-accent/20 transition-all uppercase tracking-[0.2em]"
                    >
                      Done
                    </motion.button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scroll Lock Status Toast */}
      <AnimatePresence>
        {scrollLockToast && (
          <div key="scroll-lock-toast" className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="bg-warning text-black px-6 py-3 rounded-2xl shadow-2xl border border-black/10 font-bold flex items-center gap-3"
            >
              <div className="p-1.5 bg-black/10 rounded-lg">
                <Lock className="w-4 h-4" />
              </div>
              <span className="uppercase text-xs tracking-widest">{scrollLockToast}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WiFi Connection Advice Modal */}
      <AnimatePresence>
        {showWifiAdvice && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              id="tour-wifi-reminder"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-card-bg border-2 border-accent/30 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-accent/10 rounded-2xl mb-6">
                  <Wifi className="w-12 h-12 text-accent" />
                </div>
                <h3 className="text-xl font-black text-text-main mb-4 uppercase tracking-tight">WiFi Setup Reminder</h3>
                <p className="text-text-muted text-sm leading-relaxed mb-6">
                  To use WiFi, be sure your computer or device is on the same local WiFI network as your DCC-EX command station.
                </p>
                {electronLocalIP && (
                  <div className="mb-8 p-4 bg-app-bg rounded-2xl border border-accent/20">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Connect from Tablet/Phone</p>
                    <div className="flex items-center justify-center gap-2">
                      <Globe className="w-4 h-4 text-accent" />
                      <span className="text-lg font-mono font-black text-accent">{electronLocalIP}:3000</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setShowWifiAdvice(false)}
                  className="w-full py-4 bg-accent hover:bg-accent-hover text-white font-black rounded-2xl transition-all shadow-lg shadow-accent/20 uppercase text-xs tracking-widest"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete and Renumber Modals */}
      <AnimatePresence>
        {deleteRenumberModal.isOpen && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              id="tour-loco-delete-renumber-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-card-bg border-2 border-danger/30 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-danger/10 rounded-2xl shrink-0">
                  <Settings className="w-8 h-8 text-danger" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black text-text-main whitespace-normal uppercase tracking-tight leading-tight">Delete or Renumber Loco</h2>
                  <p className="text-text-muted text-xs font-bold uppercase mt-1">Loco No. {deleteRenumberModal.addr}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Delete Button */}
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-4 bg-danger hover:bg-danger/80 text-white font-black rounded-2xl transition-all shadow-lg shadow-danger/20 flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Roster Entry for this Loco
                </button>

                {/* Renumber Section */}
                <div className="pt-4 border-t border-card-border space-y-4">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Renumber to</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        value={deleteRenumberModal.newAddr}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Rule: Only allow '.' if starts with '#'
                          if (val.includes('.') && !val.startsWith('#')) return;
                          setDeleteRenumberModal(prev => ({ ...prev, newAddr: val }));
                        }}
                        onBlur={() => {
                           const sanitized = sanitizeCabAddress(deleteRenumberModal.newAddr);
                           if (sanitized === deleteRenumberModal.addr) {
                              const next = getNextAvailableCabAddress(sanitized);
                              setDeleteRenumberModal(prev => ({ ...prev, newAddr: next, lastValidAddr: next }));
                              triggerRenumberAlert("Please enter a new address to renumber.");
                              return;
                           }
                           
                           if (!isValidCabAddressFormat(sanitized)) {
                              triggerRenumberAlert("Invalid format. Use 1-9999 or #DCC.decimal");
                              // Restore last valid address
                              setDeleteRenumberModal(prev => ({ ...prev, newAddr: prev.lastValidAddr }));
                              return;
                           }

                           if (isAddressInUse(sanitized, deleteRenumberModal.addr)) {
                             const next = getNextAvailableCabAddress(sanitized);
                             if (next === sanitized) {
                               triggerRenumberAlert("Selected address already in use. Choose another.");
                               setDeleteRenumberModal(prev => ({ ...prev, newAddr: prev.lastValidAddr }));
                             } else {
                               setDeleteRenumberModal(prev => ({ ...prev, newAddr: next, lastValidAddr: next }));
                               triggerRenumberAlert("Selected address already in use. Showing next available.");
                             }
                           } else {
                             // Valid and not in use
                             setDeleteRenumberModal(prev => ({ ...prev, newAddr: sanitized, lastValidAddr: sanitized }));
                           }
                        }}
                        className="w-full bg-btn-bg border-2 border-accent/20 rounded-2xl px-4 py-4 text-sm font-bold text-accent focus:outline-none focus:border-accent transition-all"
                        placeholder="e.g. #3.1"
                      />
                      <AnimatePresence>
                        {renumberAlert.show && (
                          <motion.div 
                            key="renumber-alert"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute inset-0 bg-danger/90 backdrop-blur-sm rounded-2xl flex items-center justify-center p-2 z-[4100]"
                          >
                            <p className="text-[10px] font-black text-white uppercase tracking-wider text-center leading-tight">
                              {renumberAlert.message}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => handleAdjustRenumberAddr(1)}
                        className="p-2 bg-btn-bg hover:bg-accent hover:text-white rounded-lg border border-btn-border transition-all"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleAdjustRenumberAddr(-1)}
                        className="p-2 bg-btn-bg hover:bg-accent hover:text-white rounded-lg border border-btn-border transition-all"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button 
                    onMouseDown={(e) => {
                      // Prevent input blur before this fires if possible, 
                      // or just rely on the fact that onMouseDown fires before onBlur
                      executeRenumberRosterEntry();
                    }}
                    className="w-full py-4 bg-accent hover:bg-accent-hover text-white font-black rounded-2xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Renumber Roster Entry for this Loco
                  </button>
                </div>

                <button 
                  onClick={() => setDeleteRenumberModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-4 bg-btn-bg hover:bg-btn-bg/80 text-text-muted font-bold rounded-2xl transition-all border border-btn-border uppercase text-[10px] tracking-widest"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div key="delete-confirm-overlay" className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-card-bg border-2 border-danger rounded-[2rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-danger" />
              </div>
              <h3 className="text-lg font-black text-text-main mb-2">Are you sure?</h3>
              <p className="text-text-muted text-sm mb-4">
                About to delete this locomotive entry from the roster:
              </p>
              <div className="text-xl font-black text-danger mb-8 uppercase tracking-tight">
                Loco No. {deleteRenumberModal.addr}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-3 bg-btn-bg text-text-muted font-bold rounded-xl border border-btn-border hover:text-text-main transition-all"
                >
                  No
                </button>
                <button 
                  onClick={executeDeleteRosterEntry}
                  className="py-3 bg-danger text-white font-black rounded-xl shadow-lg shadow-danger/20 hover:brightness-110 transition-all uppercase tracking-widest text-[10px]"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRenumberSuccess.isOpen && (
          <div key="renumber-success-overlay" className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-card-bg border-2 border-accent rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-black text-text-main mb-2 uppercase tracking-tight">Roster Entry Renumbered</h3>
              <p className="text-text-muted text-sm mb-4">
                Successfully moved from <span className="font-bold text-text-main">{showRenumberSuccess.oldAddr}</span> to <span className="font-bold text-accent">{showRenumberSuccess.newAddr}</span>.
              </p>
              
              {showRenumberSuccess.warning && (
                <div className="bg-warning/10 border border-warning/30 p-4 rounded-xl mb-8 flex items-start gap-3 text-left">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                  <p className="text-[10px] font-bold text-warning leading-relaxed uppercase">
                    {showRenumberSuccess.warning}
                  </p>
                </div>
              )}

              <button 
                onClick={() => setShowRenumberSuccess(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-4 bg-accent text-white font-black rounded-2xl shadow-lg shadow-accent/20 hover:brightness-110 transition-all uppercase tracking-[0.2em] text-xs"
              >
                OK
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Terminal Overlay */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div 
              id="tour-terminal"
              key="terminal-overlay"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-card-bg px-6 py-3 flex items-center justify-between border-b border-card-border">
                <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-widest">
                  <TerminalIcon className="w-4 h-4" />
                  DCC-EX Native Protocol Monitor
                </div>
                <div id="tour-terminal-actions" className="flex items-center gap-4">
                  <button 
                    id="tour-clear-locos"
                    onClick={() => setShowClearLocosConfirm(true)} 
                    className="text-[10px] font-bold text-text-muted hover:text-text-main transition-colors uppercase"
                  >
                    Clear DCC-EX Locos
                  </button>
                  <button id="tour-clear-monitor" onClick={() => setLogs([])} className="text-[10px] font-bold text-text-muted hover:text-text-main transition-colors uppercase">Clear Monitor</button>
                </div>
              </div>
              <div 
                ref={scrollRef}
                className="h-48 overflow-y-auto p-4 font-mono text-[10px] space-y-1 bg-app-bg/50"
              >
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-text-muted/50 shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                    <span className={`
                      ${log.type === 'in' ? 'text-emerald-400' : ''}
                      ${log.type === 'out' ? 'text-accent' : ''}
                      ${log.type === 'info' ? 'text-text-muted italic' : ''}
                      ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                    `}>
                      {log.type === 'in' && '← '}
                      {log.type === 'out' && '→ '}
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-card-bg p-3 border-t border-card-border flex gap-2">
                <input 
                  type="text" 
                  value={terminalInput || ''}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && terminalInput.trim()) {
                      sendCommand(terminalInput.trim());
                      setTerminalInput('');
                    }
                  }}
                  placeholder="Enter raw command (e.g. <1>, <t 1 3 50 1>)"
                  disabled={!isConnected}
                  className="flex-1 bg-btn-bg border border-btn-border rounded-lg px-3 py-2 text-xs font-mono text-accent focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                />
                <button 
                  onClick={() => {
                    if (terminalInput.trim()) {
                      sendCommand(terminalInput.trim());
                      setTerminalInput('');
                    }
                  }}
                  disabled={!isConnected || !terminalInput.trim()}
                  className="bg-accent hover:bg-accent-hover disabled:bg-btn-bg disabled:border-btn-border disabled:text-text-muted text-white p-2 rounded-lg transition-all active:scale-95 border border-accent"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="text-center py-0.5">
          <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.2em] flex flex-wrap justify-center gap-x-2">
            <span className="whitespace-nowrap">DCC-EX Native Protocol Throttle</span>
            <span className="whitespace-nowrap">©2026 by @DriverDTrains • v1.4.2</span>
          </p>
        </footer>

        {/* Route Consist Confirmation Popup */}
        <AnimatePresence>
          {showRouteConsistConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-md w-full p-6 overflow-hidden relative"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-2xl">
                    <Map className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text-main uppercase tracking-tight">Dispatch Lead Loco?</h3>
                    <p className="text-xs text-text-muted">Only the lead loco will be dispatched on the route.</p>
                  </div>
                </div>

                <p className="text-sm text-text-main mb-8">
                  Confirm starting route <span className="font-bold text-accent">{showRouteConsistConfirm.name}</span> for lead locomotive <span className="font-bold text-accent">#{(() => {
                    const c = consists.find(cons => cons.id === activeConsistId);
                    if (!c) return '';
                    return activeConsistTempReverse ? c.locos[c.locos.length - 1]?.address : c.locos[0]?.address;
                  })()}</span>?
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowRouteConsistConfirm(null)}
                    className="flex-1 py-3 bg-btn-bg border border-btn-border text-text-muted rounded-xl font-bold hover:text-text-main transition-all"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={() => {
                      const c = consists.find(cons => cons.id === activeConsistId);
                      const leadCab = c ? (activeConsistTempReverse ? c.locos[c.locos.length - 1]?.address : c.locos[0]?.address) : null;
                      if (leadCab) {
                        sendCommand(`/ START ${leadCab} ${showRouteConsistConfirm.id}`);
                        addLog('info', `Started Route ${showRouteConsistConfirm.id} (${showRouteConsistConfirm.name}) for Lead Cab ${leadCab}`);
                      }
                      setShowRouteConsistConfirm(null);
                    }}
                    className="flex-1 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/80 transition-all shadow-lg shadow-accent/20"
                  >
                    CONFIRM
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Clear DCC-EX Locos Confirmation Dialog */}
        <AnimatePresence>
          {showClearLocosConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-sm w-full p-6 overflow-hidden relative"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-danger/10 rounded-2xl">
                    <Trash2 className="w-6 h-6 text-danger" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text-main uppercase tracking-tight">Clear Locos?</h3>
                    <p className="text-xs text-text-muted italic">This sends the {"< - >"} command to DCC-EX.</p>
                  </div>
                </div>

                <p className="text-sm text-text-main mb-8">
                  Clear current DCC-EX locos?
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowClearLocosConfirm(false)}
                    className="flex-1 py-3 bg-btn-bg border border-btn-border text-text-muted rounded-xl font-bold hover:text-text-main transition-all"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={() => {
                      sendCommand('-');
                      addLog('info', 'Command sent: < - > (Clear all locomotives)');
                      setShowClearLocosConfirm(false);
                    }}
                    className="flex-1 py-3 bg-danger text-white rounded-xl font-bold hover:bg-danger/80 transition-all shadow-lg shadow-danger/20"
                  >
                    YES
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Preset Sorting Modal */}
        <AnimatePresence>
          {showLocoSortModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
              <motion.div 
                id="tour-loco-sort-modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-card-bg w-full max-w-sm rounded-[32px] border border-card-border overflow-hidden shadow-2xl"
              >
                <div className="px-6 pt-6 pb-3 border-b border-card-border bg-black/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowLocoSortModal(false)}
                      className="p-2 bg-danger rounded-xl group/close hover:bg-danger/80 shadow-lg shadow-danger/20 transition-all cursor-pointer"
                      title="Close Sort"
                    >
                      <ArrowUpDown className="w-5 h-5 text-white transition-transform group-hover/close:scale-110" />
                    </button>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-text-main uppercase tracking-tight">Sort & Configure Presets</h3>
                      <p className="text-[10px] text-text-muted mt-0.5 font-bold uppercase tracking-wider">Choose display order & color</p>
                    </div>
                  </div>

                  <div id="tour-loco-sort-header-controls" className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const next = !showRoadNames;
                        setShowRoadNames(next);
                        addLog('info', next ? 'Road names displayed.' : 'Road names hidden.');
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border w-fit shrink-0 ${showRoadNames ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' : 'bg-black/20 border-card-border text-text-muted hover:text-text-main hover:border-accent'}`}
                      title={showRoadNames ? "Hide Road Names" : "Show Road Names"}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none pt-0.5">{showRoadNames ? "Names On" : "Names Off"}</span>
                    </button>

                    <button 
                      onClick={() => {
                        const next = !showLocoColors;
                        setShowLocoColors(next);
                        addLog('info', next ? 'Preset colors enabled.' : 'Preset colors disabled.');
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border w-fit shrink-0 ${showLocoColors ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' : 'bg-black/20 border-card-border text-text-muted hover:text-text-main hover:border-accent'}`}
                      title={showLocoColors ? "Hide Preset Colors" : "Show Preset Colors"}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none pt-0.5">{showLocoColors ? "Color On" : "Color Off"}</span>
                    </button>

                    <button 
                      id="tour-loco-roster-button"
                      onClick={() => {
                        setPresetSnapshot({ max: maxPresets, visible: visiblePresetsCount });
                        setShowPresetSliderModal(true);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border w-fit shrink-0 ${isRosterButtonHighlighted ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' : 'bg-black/20 border-card-border text-text-muted hover:text-text-main hover:border-accent'}`}
                      title="Manage Roster Capacity"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none pt-0.5">Roster</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.1em]">Sort Order</p>
                  </div>

                  {/* Mode Selector - Moved to Header */}
                  <div id="tour-loco-sort-buttons" className="grid grid-cols-3 gap-2 bg-btn-bg p-1 rounded-2xl border border-btn-border">
                    {/* Custom Button */}
                    <button
                      onClick={() => {
                        setLocoSortMode('custom');
                        setPrevLocoSortMode('custom');
                        localStorage.setItem('dcc_loco_sort_mode', 'custom');
                        localStorage.setItem('dcc_prev_loco_sort_mode', 'custom');
                        addLog('info', 'Sorted presets by custom order.');
                      }}
                      className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition-all ${locoSortMode === 'custom' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-muted hover:text-text-main'}`}
                    >
                      <Layers className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">Custom</span>
                    </button>

                    {/* ID Button */}
                    <button
                      onClick={() => {
                        if (locoSortMode === 'id' || locoSortMode === 'roadName') {
                          const nextDir = locoIdSortDirection === 'asc' ? 'desc' : 'asc';
                          setLocoIdSortDirection(nextDir);
                          localStorage.setItem('dcc_loco_id_sort_direction', nextDir);
                        } else {
                          setLocoSortMode('id');
                          setPrevLocoSortMode('id');
                          setLocoIdSortDirection('asc');
                          localStorage.setItem('dcc_loco_sort_mode', 'id');
                          localStorage.setItem('dcc_prev_loco_sort_mode', 'id');
                          localStorage.setItem('dcc_loco_id_sort_direction', 'asc');
                        }
                        addLog('info', `Sorted by ID (${locoIdSortDirection === 'asc' ? 'descending' : 'ascending'}).`);
                      }}
                      className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
                        (locoSortMode === 'id' || locoSortMode === 'roadName') 
                        ? (locoIdSortDirection === 'desc' ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'bg-accent text-white shadow-lg shadow-accent/20') 
                        : 'text-text-muted hover:text-text-main'
                      } ${locoSortMode === 'roadName' ? 'opacity-50' : ''}`}
                    >
                      <div className="relative">
                        <Zap className="w-4 h-4" />
                        {(locoSortMode === 'id' || locoSortMode === 'roadName') && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={locoIdSortDirection}
                            className="absolute -right-1.5 -top-1"
                          >
                            {locoIdSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                          </motion.div>
                        )}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tighter">By ID</span>
                    </button>

                    {/* Road Button */}
                    <button
                      onClick={() => {
                        if (locoSortMode !== 'roadName') {
                          setPrevLocoSortMode(locoSortMode === 'id' ? 'id' : 'custom');
                          localStorage.setItem('dcc_prev_loco_sort_mode', locoSortMode === 'id' ? 'id' : 'custom');
                          setLocoSortMode('roadName');
                          setLocoSortDirection('asc');
                          localStorage.setItem('dcc_loco_sort_mode', 'roadName');
                          localStorage.setItem('dcc_loco_sort_direction', 'asc');
                        } else if (locoSortDirection === 'asc') {
                          setLocoSortDirection('desc');
                          localStorage.setItem('dcc_loco_sort_direction', 'desc');
                        } else {
                          // Third click: turn off road sort
                          setLocoSortMode(prevLocoSortMode);
                          localStorage.setItem('dcc_loco_sort_mode', prevLocoSortMode);
                        }
                        addLog('info', `Road sort: ${locoSortMode !== 'roadName' ? 'ASC' : (locoSortDirection === 'asc' ? 'DESC' : 'OFF')}`);
                      }}
                      className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition-all ${locoSortMode === 'roadName' ? (locoSortDirection === 'desc' ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'bg-accent text-white shadow-lg shadow-accent/20') : 'text-text-muted hover:text-text-main'}`}
                    >
                      <div className="relative">
                        <Tag className="w-4 h-4" />
                        {locoSortMode === 'roadName' && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={locoSortDirection}
                            className="absolute -right-1.5 -top-1"
                          >
                            {locoSortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                          </motion.div>
                        )}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tighter">By Road</span>
                    </button>
                  </div>
                </div>

                <div id="tour-loco-presets-list" className="px-6 pt-3 pb-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {/* Preset List */}
                  <div className="space-y-2">
                    {getSortedIndices().map((originalIdx, currentIndex) => {
                      const addr = presets[originalIdx];
                      const road = locoRoadNames[addr?.toString() || ''];
                      const isIncluded = locoIncludedInSort[originalIdx];
                      
                      return (
                        <div 
                          key={originalIdx}
                          id={currentIndex === 0 ? "tour-loco-preset-item-0" : undefined}
                          className={`flex items-center justify-between pl-3 pr-1 py-1 rounded-2xl border transition-all ${isIncluded ? 'bg-btn-bg border-btn-border' : 'bg-black/10 border-transparent opacity-60'}`}
                        >
                          <div className="flex items-center gap-3 py-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox"
                                checked={isIncluded || false}
                                onChange={(e) => {
                                  const next = [...locoIncludedInSort];
                                  next[originalIdx] = e.target.checked;
                                  setLocoIncludedInSort(next);
                                  localStorage.setItem('dcc_loco_included_in_sort', JSON.stringify(next));
                                  addLog('info', `${addr} ${e.target.checked ? 'included in' : 'excluded from'} sort.`);
                                }}
                                className="w-4 h-4 rounded border-accent/30 text-accent focus:ring-accent bg-card-bg"
                                title="Include This Loco When Sorting"
                              />
                              <div className="w-8 flex flex-col items-center">
                                <button 
                                  onClick={() => moveCustomOrder(currentIndex, 'up')}
                                  disabled={currentIndex === 0}
                                  className="p-1 text-text-muted hover:text-accent disabled:opacity-20 transition-colors"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => moveCustomOrder(currentIndex, 'down')}
                                  disabled={currentIndex === 15}
                                  className="p-1 text-text-muted hover:text-accent disabled:opacity-20 transition-colors"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-accent">{addr || '?'}</span>
                                {road && (
                                  <span className="text-[10px] font-bold text-text-muted uppercase border-l border-card-border pl-2 truncate">
                                    {road}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {currentIndex < visiblePresetsCount && (
                              <div className="px-2 py-0.5 bg-accent/20 rounded text-[8px] font-black text-accent uppercase">Visible</div>
                            )}
                            
                            <button
                              onClick={() => {
                                // Default new addr is next available decimal
                                const nextAddr = getNextAvailableCabAddress(addr?.toString() || '3');
                                setDeleteRenumberModal({
                                  isOpen: true,
                                  presetIndex: originalIdx,
                                  addr: addr?.toString() || '3',
                                  newAddr: nextAddr,
                                  lastValidAddr: nextAddr
                                });
                              }}
                              className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all active:scale-95"
                              title="Delete or Renumber Loco"
                            >
                              <Settings className="w-4 h-4" />
                            </button>

                            <button
                                id={currentIndex === 0 ? "tour-loco-color-button-0" : undefined}
                                onClick={() => {
                                  setShowLocoColorModal(originalIdx);
                                  setActivePickerColor(locoColors[addr] || 'none');
                                  setActivePickerOpacity(locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50);
                                  setActivePickerAccentColor(locoAccentColors[addr] || 'none');
                                  setActivePickerAccentOpacity(locoAccentOpacity[addr] !== undefined ? locoAccentOpacity[addr] : (locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50));
                                  setColorModalMode('base');
                                }}
                              className={`relative w-10 h-10 rounded-xl border border-btn-border flex items-center justify-center transition-all overflow-hidden ${locoColors[addr] ? '' : 'bg-transparent'}`}
                              style={{ 
                                backgroundColor: (() => {
                                  const baseColor = locoColors[addr];
                                  if (!baseColor) return undefined;
                                  const accentColor = locoAccentColors[addr];
                                  if (accentColor && accentColor !== 'none') return undefined; // use background image
                                  const opacity = locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50;
                                  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                                  return baseColor + alpha;
                                })(),
                                backgroundImage: (() => {
                                  const baseColor = locoColors[addr];
                                  if (!baseColor) return undefined;
                                  const accentColor = locoAccentColors[addr];
                                  if (!accentColor || accentColor === 'none') return undefined;
                                  const opacity = locoOpacity[addr] !== undefined ? locoOpacity[addr] : 50;
                                  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
                                  const combinedBase = baseColor + alpha;
                                  
                                  const accentOpacity = locoAccentOpacity[addr] !== undefined ? locoAccentOpacity[addr] : opacity;
                                  const accentAlpha = Math.round((accentOpacity / 100) * 255).toString(16).padStart(2, '0');
                                  const combinedAccent = accentColor + accentAlpha;
                                  
                                  return `linear-gradient(to bottom, ${combinedBase} 85%, ${combinedAccent} 85%)`;
                                })()
                              }}
                              title="Set Color"
                            >
                              {!locoColors[addr] && (
                                <div 
                                  className="absolute inset-0 z-0" 
                                  style={{
                                    backgroundImage: 'linear-gradient(135deg, transparent 48%, #ef4444 48%, #ef4444 52%, transparent 52%)'
                                  }}
                                />
                              )}
                              <Palette className={`w-4 h-4 relative z-10 ${locoColors[addr] ? 'text-white' : 'text-text-muted'}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Close Button (Inside Scroll) */}
                  <div className="mt-8">
                    <button 
                      onClick={() => setShowLocoSortModal(false)}
                      className="w-full py-4 bg-danger hover:bg-danger/80 text-white rounded-2xl font-black border border-danger/50 transition-all uppercase text-xs tracking-widest shadow-lg shadow-danger/20"
                    >
                      Close Sort
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Hard Limit Selection Modal */}
        <AnimatePresence>
          {showHardLimitSelection && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[3000] flex items-center justify-center p-4">
              <motion.div 
                id="tour-loco-hard-limit-modal"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full overflow-hidden"
              >
                <div className="p-6 border-b border-card-border bg-accent/5">
                  <h3 className="text-sm font-black text-text-main uppercase tracking-widest text-center">Maximum Storage Limit</h3>
                  <p className="text-[9px] text-text-muted mt-2 font-bold uppercase tracking-wider text-center">Select your roster capacity ceiling</p>
                </div>
                <div className="p-4 grid grid-cols-1 gap-2">
                  {[16, 32, 64, 128, 256].map((limit) => (
                    <button
                      key={limit}
                      onClick={() => {
                        setHardLimit(limit);
                        localStorage.setItem('dcc_hard_limit', limit.toString());
                        if (maxPresets > limit) {
                          setMaxPresets(limit);
                          if (visiblePresetsCount > limit) {
                            setVisiblePresetsCount(limit);
                          }
                        }
                        setShowHardLimitSelection(false);
                      }}
                      className={`py-3 rounded-xl font-bold transition-all uppercase text-xs tracking-widest border ${
                        hardLimit === limit 
                          ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' 
                          : 'bg-btn-bg text-text-muted border-btn-border hover:border-accent/50 hover:text-text-main'
                      }`}
                    >
                      {limit} Slots
                    </button>
                  ))}
                </div>
                <div className="p-4 pt-0">
                  <button 
                    onClick={() => setShowHardLimitSelection(false)}
                    className="w-full py-2 text-[10px] font-bold text-text-muted hover:text-text-main transition-colors uppercase tracking-widest"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Preset Configuration Modal */}
        <AnimatePresence>
          {showPresetSliderModal && (
            <div key="preset-slider-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
              <motion.div 
                id="tour-loco-manage-roster-modal"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative"
              >
                <div className="p-6 border-b border-card-border bg-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-xl text-accent">
                      <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-black text-text-main uppercase tracking-tight">Manage Roster</h3>
                  </div>
                  <p className="text-[10px] text-text-muted mt-2 font-bold uppercase tracking-wider">Manage your locomotive roster capacity</p>
                </div>

                <div className="p-6 space-y-8">
                  {/* Import from DCC-EX */}
                  <button
                    id="tour-loco-import-button"
                    onClick={() => {
                      isWaitingForRosterRef.current = true;
                      sendCommand('JR');
                      addLog('out', '<JR>');
                    }}
                    disabled={!isConnected}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-accent hover:bg-accent/80 disabled:bg-btn-bg disabled:text-text-muted text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl shadow-accent/20 border border-accent/20"
                  >
                    <RefreshCw className={`w-5 h-5 ${!isConnected ? '' : 'animate-spin-slow'}`} style={{ animationDuration: '3s' }} />
                    Import Locos From DCC-EX
                  </button>

                  {/* Max Presets Slider */}
                  <div id="tour-loco-roster-capacity-container" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <List className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-xs font-bold text-text-main uppercase tracking-wide">Roster Capacity</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-accent">{maxPresets} Units</span>
                    </div>
                    <div className="bg-btn-bg p-4 rounded-2xl border border-btn-border">
                      <input 
                        type="range"
                        min="1"
                        max={hardLimit}
                        value={maxPresets}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setMaxPresets(val);
                          if (visiblePresetsCount > val) {
                            setVisiblePresetsCount(val);
                          }
                        }}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-[8px] text-text-muted font-bold tracking-tighter uppercase">1</span>
                        <span 
                          onClick={() => setShowHardLimitSelection(true)}
                          className="text-xs text-accent font-black tracking-tighter uppercase cursor-pointer hover:scale-110 transition-transform origin-right"
                          title="Click to change max range"
                        >
                          {hardLimit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visible Presets Slider */}
                  <div id="tour-loco-visible-presets-container" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Maximize2 className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-xs font-bold text-text-main uppercase tracking-wide">Visible Presets</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-warning">{visiblePresetsCount} Slots</span>
                    </div>
                    <div className="bg-btn-bg p-4 rounded-2xl border border-btn-border">
                      <input 
                        type="range"
                        min="1"
                        max={maxPresets}
                        value={visiblePresetsCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setVisiblePresetsCount(val);
                        }}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-warning"
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-[8px] text-text-muted font-bold tracking-tighter uppercase">1</span>
                        <span className="text-[8px] text-text-muted font-bold tracking-tighter uppercase">{maxPresets}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                  <button 
                    onClick={() => setShowPresetSliderModal(false)}
                    className="flex-[2] py-3 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 uppercase text-xs tracking-widest"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={handleCancelPresets}
                    className="flex-1 py-3 bg-danger text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-danger/20 uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Granular Icon Size Configuration */}
        <AnimatePresence>
          {showIconSettingsModal && (
            <div key="icon-settings-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2100] flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                id="tour-icon-settings-modal"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden my-auto relative"
              >
                {(() => {
                  const currentConfigs = iconSettingsMode === 'custom' ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
                  return (
                    <>
                      <div className="pt-6 px-6 pb-2 border-b border-card-border bg-accent/5">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setIconSettingsMode(iconSettingsMode === 'custom' ? 'default' : 'custom')}
                            className="p-2 bg-accent/10 rounded-xl text-accent hover:bg-accent/20 transition-all active:scale-95 cursor-pointer"
                            title={`Switch to ${iconSettingsMode === 'custom' ? 'Default' : 'Custom'} Icon Settings`}
                          >
                            <CustomTrainIcon 
                              size={20}
                              customIcon={iconSettingsMode === 'custom' ? (localStorage.getItem('dcc_custom_app_icon') || customAppIcon) : null}
                              customIconType={iconSettingsMode === 'custom' ? customAppIconType : 'svg'}
                              useThemeColor={currentConfigs.header?.useTheme ?? true}
                            />
                          </button>
                          <h3 className="text-lg font-black text-text-main uppercase tracking-tight">
                            {iconSettingsMode === 'custom' ? 'Custom' : 'Default'} App Icon Settings
                          </h3>
                        </div>
                        <p className="text-[10px] text-text-muted mt-2 font-bold uppercase tracking-wider">
                          Configure {iconSettingsMode === 'custom' ? 'custom' : 'default'} icon behavior per zone
                        </p>

                        {/* Global Use Custom Icon Toggle */}
                        <div className="mt-4 pt-4 border-t border-card-border/50 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Use Custom App Icon</span>
                              <span className="text-[8px] text-text-muted font-bold uppercase">Enable or disable globally</span>
                            </div>
                            <button
                              onClick={() => {
                                const nextEnabled = !customAppIconEnabled;
                                setCustomAppIconEnabled(nextEnabled);
                                // The user requested that the toggle switches the modal mode
                                if (nextEnabled) {
                                  setIconSettingsMode('custom');
                                  addLog('info', 'Switched to custom app icon');
                                } else {
                                  setIconSettingsMode('default');
                                  addLog('info', 'Switched to default app icon');
                                }
                              }}
                              className={`w-12 h-6 rounded-full p-1 transition-all duration-500 ease-in-out ${customAppIconEnabled ? 'bg-warning shadow-[0_0_15px_rgba(var(--color-warning),0.4)]' : 'bg-slate-700'}`}
                            >
                              <div className={`w-4 h-4 rounded-full shadow-sm transition-all duration-500 ease-in-out ${customAppIconEnabled ? 'translate-x-6 bg-white' : 'translate-x-0 bg-white'}`} />
                            </button>
                          </div>

                          {iconSettingsMode === 'custom' && (
                            <button
                              onClick={() => iconInputRef.current?.click()}
                              className="w-full py-3 bg-btn-bg border border-btn-border rounded-xl flex items-center justify-center gap-2 hover:bg-btn-bg-hover transition-all active:scale-[0.98] group"
                            >
                              <Upload className="w-3.5 h-3.5 text-warning group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Upload Custom Icon</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {[
                          { id: 'header', label: 'Main Header Icon', icon: ImageIcon },
                          { id: 'presets', label: 'Loco Presets Icon', icon: List },
                          { id: 'throttle', label: 'Throttle Watermark', icon: Zap }
                        ].map(zone => {
                          const zoneConfig = currentConfigs[zone.id] || { active: true, value: 20, useTheme: true, large: true };
                          return (
                            <div key={zone.id} className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4">
                                <zone.icon className="w-3.5 h-3.5 text-accent" />
                                <span className="text-[10px] font-black text-text-main uppercase tracking-widest">{zone.label}</span>
                              </div>

                              <div className="grid grid-cols-1 gap-3">
                                <div className="grid grid-cols-3 gap-2">
                                  {/* Show Icon Toggle */}
                                  <div className="flex flex-col items-center justify-between p-2.5 rounded-xl bg-btn-bg/50 border border-btn-border">
                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-wider mb-2">Show Icon</span>
                                    <button
                                      onClick={() => updateIconConfig(zone.id, 'active', !zoneConfig.active)}
                                      className={`w-9 h-4.5 rounded-full p-1 transition-colors ${zoneConfig.active ? 'bg-accent' : 'bg-slate-700'}`}
                                    >
                                      <div className={`w-2.5 h-2.5 bg-white rounded-full transition-transform ${zoneConfig.active ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                    </button>
                                  </div>

                                  {/* Match Theme Toggle */}
                                  <div className={`flex flex-col items-center justify-between p-2.5 rounded-xl bg-btn-bg/50 border border-btn-border transition-opacity ${(!zoneConfig.active || (iconSettingsMode === 'custom' && customAppIconType !== 'svg')) ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-wider mb-2">Match Theme</span>
                                    <button
                                      disabled={!zoneConfig.active || (iconSettingsMode === 'custom' && customAppIconType !== 'svg')}
                                      onClick={() => updateIconConfig(zone.id, 'useTheme', !zoneConfig.useTheme)}
                                      className={`w-9 h-4.5 rounded-full p-1 transition-colors ${zoneConfig.useTheme ? 'bg-accent' : 'bg-slate-700'}`}
                                    >
                                      <div className={`w-2.5 h-2.5 bg-white rounded-full transition-transform ${zoneConfig.useTheme ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                    </button>
                                  </div>

                                  {/* Enlarge Icon Toggle */}
                                  <div className={`flex flex-col items-center justify-between p-2.5 rounded-xl bg-btn-bg/50 border border-btn-border transition-opacity ${!zoneConfig.active ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-wider mb-2">Enlarge Icon</span>
                                    <button
                                      disabled={!zoneConfig.active}
                                      onClick={() => updateIconConfig(zone.id, 'large', !zoneConfig.large)}
                                      className={`w-9 h-4.5 rounded-full p-1 transition-colors ${zoneConfig.large ? 'bg-accent' : 'bg-slate-700'}`}
                                    >
                                      <div className={`w-2.5 h-2.5 bg-white rounded-full transition-transform ${zoneConfig.large ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                    </button>
                                  </div>
                                </div>

                                {/* Slider */}
                                {zoneConfig.active && zoneConfig.large && (
                                  <div className="bg-btn-bg p-4 rounded-xl border border-btn-border animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-4">
                                      <div className="flex-1">
                                        <input 
                                          type="range"
                                          min="0"
                                          max="100"
                                          value={zoneConfig.value ?? 20}
                                          onChange={(e) => updateIconConfig(zone.id, 'value', parseInt(e.target.value))}
                                          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
                                        />
                                        <div className="flex justify-between mt-1">
                                          <span className="text-[8px] text-text-muted font-bold tracking-tighter uppercase">Standard</span>
                                          <span className="text-[8px] text-text-muted font-bold tracking-tighter uppercase">+100%</span>
                                        </div>
                                      </div>
                                      <div className="w-12 text-right">
                                        <span className="text-xs font-mono font-bold text-accent">+{zoneConfig.value}%</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-6 pt-4 space-y-3 bg-card-bg border-t border-card-border">
                        <button 
                          onClick={() => setShowIconSettingsModal(false)}
                          className="w-full py-4 bg-accent text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          Done
                        </button>
                        <button 
                          onClick={() => {
                            const defaults = { 
                              header: { active: true, value: 20, useTheme: true, large: true }, 
                              presets: { active: true, value: 20, useTheme: true, large: true }, 
                              throttle: { active: true, value: 20, useTheme: true, large: true } 
                            };
                            if (iconSettingsMode === 'custom') {
                              setCustomAppIconSizeConfigs(defaults);
                            } else {
                              setDefaultAppIconSizeConfigs(defaults);
                            }
                            addLog('info', `Reset ${iconSettingsMode} icon settings to defaults`);
                          }}
                          className="w-full py-2 text-[9px] font-bold text-text-muted hover:text-danger transition-colors uppercase tracking-widest bg-white/5 rounded-lg border border-transparent hover:border-danger/20"
                        >
                          Reset to default
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* User Custom Settings Modal */}
        <AnimatePresence>
          {showUserCustomSettingsModal && (
            <div key="user-custom-settings-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2050] flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                id="tour-user-settings-modal"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden my-auto relative shadow-accent/10"
              >
                <div className="pt-6 px-6 pb-2 border-b border-card-border bg-accent/5 transition-all">
                  <div id="tour-loco-card-header" className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-xl text-accent">
                        <Settings2 size={20} />
                      </div>
                      <h3 className="text-lg font-black text-text-main uppercase tracking-tight">User Custom Settings</h3>
                    </div>
                    <button 
                      onClick={() => setShowUserCustomSettingsModal(false)}
                      className="p-2 hover:bg-white/5 rounded-full text-text-muted transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="animate-in fade-in slide-in-from-top-2 duration-500 mb-3">
                    {(() => {
                      const iconsCurrent = customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
                      const isIconsOff = !Object.values(iconsCurrent).some((c: any) => c && (!c.active || !c.useTheme || c.large));
                      const isAllOff = isIconsOff && 
                        hideAllConsists && 
                        !isCompactLocoPresets && 
                        !isLocoAddressMerged && 
                        !showRoadNames && 
                        !showLocoColors && 
                        !isBlocksView && 
                        !isCompactThrottle && 
                        throttleLayout === 'standard' && 
                        !isSmallPresetsActive && 
                        estopConfigMode === 0 && 
                        !isCompactFunctions && 
                        !showLocoFunctionColors && 
                        !isThickThrottle && 
                        !useFunctionGroups && 
                        locoSettings[cabAddress.toString()]?.showNumbers !== false && 
                        routeCompactMode === 0 && 
                        turnoutCompactMode === 0 &&
                        speedScale === 'steps';

                      return (
                        <div className="relative h-[42px]">
                          <AnimatePresence mode="wait">
                            {memoryNotification ? (
                              <motion.div
                                key="notification"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 z-10 px-4 rounded-xl bg-accent border border-accent/30 flex flex-col justify-center shadow-lg shadow-accent/20"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-white uppercase flex items-center gap-1">
                                    <Save size={10} />
                                    Slot {memoryNotification.id} Loaded
                                  </span>
                                  <span className="text-[9px] text-white/80 font-medium">
                                    {new Date(memoryNotification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 overflow-hidden mt-0.5">
                                  {memoryNotification.name ? (
                                    <div className="text-[10px] font-bold text-white truncate">
                                      "{memoryNotification.name}"
                                    </div>
                                  ) : (
                                    <div className="text-[8px] text-white/70 italic">
                                      Created: {new Date(memoryNotification.timestamp).toLocaleDateString()}
                                    </div>
                                  )}
                                  {memoryNotification.name && (
                                    <div className="text-[8px] text-white/70 italic shrink-0">
                                      {new Date(memoryNotification.timestamp).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ) : (
                              <motion.button
                                id="tour-turn-off-all-custom-settings-btn"
                                key="button"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => {
                                  const addr = cabAddress.toString();
                                  if (isAllOff) {
                                    // Turn All ON
                                    setCustomAppIconEnabled(true);
                                    
                                    const next = { ...iconsCurrent };
                                    Object.keys(next).forEach((k) => {
                                      // Enable, use theme, and enlarge for all versions (header, presets, watermark)
                                      next[k] = { ...next[k], active: true, useTheme: true, large: true };
                                    });
                                    setCustomAppIconSizeConfigs(next);
                                    setDefaultAppIconSizeConfigs(next);

                                    setHideAllConsists(false);
                                    setIsCompactLocoPresets(true);
                                    setIsLocoAddressMerged(true);
                                    setShowRoadNames(true);
                                    setShowLocoColors(true);
                                    setIsBlocksView(true);
                                    setIsCompactThrottle(true);
                                    setThrottleLayout('vertical');
                                    setIsSmallPresetsActive(true);
                                    setEstopConfigMode(1);
                                    setIsCompactFunctions(true);
                                    setShowLocoFunctionColors(true);
                                    setIsThickThrottle(true);
                                    setUseFunctionGroups(true);
                                    
                                    setLocoSettings(prev => ({
                                      ...prev,
                                      [addr]: { ...prev[addr], showNumbers: false }
                                    }));
                                    setRouteCompactMode(1);
                                    setTurnoutCompactMode(1);
                                    handleSetSpeedScale('percent');
                                    setShowIconSettingsModal(true);
                                  } else {
                                    // Identify memory slot to save before turning off
                                    let targetId = -1;
                                    for (let i = 1; i <= 8; i++) {
                                      if (!memorySlots[i]) {
                                        targetId = i;
                                        break;
                                      }
                                    }

                                    if (targetId !== -1) {
                                      // PROPOSAL: Ask user if they want to save to this free slot
                                      setPendingMemorySlot(targetId);
                                      setAutoSaveIncludesReset(true);
                                      setFlashingSlot({ id: targetId, color: 'lemony' });
                                      setShowMemoryAutoSaveConfirm(true);
                                      
                                      // Auto-clear flash after 3 blinks (0.75s)
                                      setTimeout(() => {
                                        setFlashingSlot(null);
                                      }, 750);
                                    } else {
                                      // All slots full, find oldest slot to ask for overwrite
                                      let oldestId = 1;
                                      let oldestTime = memorySlots[1]?.timestamp || Infinity;
                                      for (let i = 2; i <= 8; i++) {
                                        if (memorySlots[i]?.timestamp < oldestTime) {
                                          oldestId = i;
                                          oldestTime = memorySlots[i].timestamp;
                                        }
                                      }
                                      setPendingMemorySlot(oldestId);
                                      setAutoSaveIncludesReset(true);
                                      setFlashingSlot({ id: oldestId, color: 'danger' });
                                      setShowMemoryOverwriteConfirm(true);
                                      setTimeout(() => {
                                        setFlashingSlot(null);
                                      }, 750);
                                    }
                                  }
                                }}
                                className={`absolute inset-0 w-full rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border shadow-lg ${
                                  isAllOff 
                                    ? 'bg-warning border-warning/50 text-white shadow-warning/20 hover:scale-[1.02]' 
                                    : 'bg-btn-bg border-btn-border text-text-muted hover:text-text-main border-white/10 hover:bg-white/5'
                                }`}
                              >
                                <Power size={14} className={isAllOff ? 'animate-pulse' : ''} />
                                {isAllOff ? 'turn on all custom settings' : 'turn off all custom settings'}
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}
                  </div>

                    {/* Memory Buttons */}
                    <div id="tour-memory-slots-panel" className="mb-1 space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Memory Slots (1-8)</span>
                      </div>
                      
                      <div className="grid grid-cols-8 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(id => {
                        const isSaved = (id === 1 && tourMemorySlot1MutedForce && isTourActive) ? false : !!memorySlots[id];
                        const slot = memorySlots[id];
                        const isMatching = isMemorySlotMatching(id);
                        const isFlashing = flashingSlot?.id === id;
                        
                        const tooltipText = isSaved 
                          ? (slot.name || `Saved on ${new Date(slot.timestamp).toLocaleDateString()} at ${new Date(slot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
                          : 'Empty Slot (Long press to save current settings)';

                        const flashColor = isFlashing ? (
                          flashingSlot.color === 'success' ? 'bg-success border-success' :
                          flashingSlot.color === 'danger' ? 'bg-danger border-danger' :
                          flashingSlot.color === 'lemony' ? 'bg-[#DFFF00] border-[#DFFF00]' :
                          flashingSlot.color === 'info' ? 'bg-accent border-accent' :
                          'bg-warning border-warning'
                        ) : '';

                        return (
                          <button
                            key={id}
                            id={`tour-memory-slot-${id}`}
                            onContextMenu={(e) => e.preventDefault()}
                            onPointerDown={(e) => {
                              memoryHoldTimer.current = setTimeout(() => {
                                if (isSaved) {
                                  setPendingMemorySlot(id);
                                  setMemoryModalMode('clear');
                                  setFlashingSlot({ id, color: 'danger' });
                                  setShowMemoryClearConfirm(true);
                                  setTimeout(() => {
                                    setFlashingSlot(null);
                                  }, 750);
                                } else {
                                  // Free slot long press: same sequence as Turn Off All but no reset
                                  setPendingMemorySlot(id);
                                  setAutoSaveIncludesReset(false);
                                  setFlashingSlot({ id, color: 'lemony' });
                                  setShowMemoryAutoSaveConfirm(true);
                                  setTimeout(() => {
                                    setFlashingSlot(null);
                                  }, 750);
                                }
                              }, 800);
                            }}
                            onPointerUp={() => {
                              if (memoryHoldTimer.current) clearTimeout(memoryHoldTimer.current);
                            }}
                            onPointerLeave={() => {
                              if (memoryHoldTimer.current) clearTimeout(memoryHoldTimer.current);
                            }}
                            title={tooltipText}
                            className={`h-10 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center relative overflow-hidden ${
                              isFlashing ? `${flashColor} text-white animate-fast-blink shadow-lg` :
                              isMatching ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/50' :
                              isSaved ? 'bg-warning/30 border-warning/70 text-white shadow-lg shadow-warning/20 hover:bg-warning/50' :
                              'bg-btn-bg border-btn-border text-text-muted hover:text-text-main hover:bg-white/5'
                            }`}
                            onClick={() => {
                              if (isSaved) {
                                loadMemorySlot(id);
                              }
                            }}
                          >
                            {id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* App Icon Section */}
                  <div className="group">
                    <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                      <Palette className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">App Icon</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { 
                          id: 'icon', 
                          label: 'Custom Icon', 
                          active: customAppIconEnabled,
                          toggle: () => {
                            if (customAppIconEnabled) {
                              setCustomAppIconEnabled(false);
                            } else {
                              if (customAppIcon) {
                                setCustomAppIconEnabled(true);
                              } else {
                                iconInputRef.current?.click();
                              }
                            }
                          }
                        },
                        { 
                          id: 'visibility', 
                          label: 'Custom Visibility', 
                          active: Object.values(customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs).some((c: any) => c && !c.active),
                          toggle: () => {
                            const current = customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
                            const isCurrentlyCustom = Object.values(current).some((c: any) => c && !c.active);
                            if (isCurrentlyCustom) {
                              const next = { ...current };
                              Object.keys(next).forEach(k => next[k] = { ...next[k], active: true });
                              if (customAppIconEnabled) setCustomAppIconSizeConfigs(next);
                              else setDefaultAppIconSizeConfigs(next);
                            } else {
                              const next = { ...current };
                              ['header', 'presets', 'throttle'].forEach(k => {
                                if (next[k]) next[k] = { ...next[k], active: false };
                              });
                              if (customAppIconEnabled) setCustomAppIconSizeConfigs(next);
                              else setDefaultAppIconSizeConfigs(next);
                              setIconSettingsMode(customAppIconEnabled ? 'custom' : 'default');
                              setShowIconSettingsModal(true);
                            }
                          }
                        },
                        { 
                          id: 'theme', 
                          label: 'Custom Theme', 
                          active: Object.values(customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs).some((c: any) => c && !c.useTheme),
                          toggle: () => {
                            const current = customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
                            const isCurrentlyCustom = Object.values(current).some((c: any) => c && !c.useTheme);
                            if (isCurrentlyCustom) {
                              const next = { ...current };
                              Object.keys(next).forEach(k => next[k] = { ...next[k], useTheme: true });
                              if (customAppIconEnabled) setCustomAppIconSizeConfigs(next);
                              else setDefaultAppIconSizeConfigs(next);
                            } else {
                              const next = { ...current };
                              ['header', 'presets', 'throttle'].forEach(k => {
                                if (next[k]) next[k] = { ...next[k], useTheme: false };
                              });
                              if (customAppIconEnabled) setCustomAppIconSizeConfigs(next);
                              else setDefaultAppIconSizeConfigs(next);
                              setIconSettingsMode(customAppIconEnabled ? 'custom' : 'default');
                              setShowIconSettingsModal(true);
                            }
                          }
                        },
                        { 
                          id: 'size', 
                          label: 'Custom Size', 
                          active: Object.values(customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs).some((c: any) => c && c.large),
                          toggle: () => {
                            const current = customAppIconEnabled ? customAppIconSizeConfigs : defaultAppIconSizeConfigs;
                            const isCurrentlyCustom = Object.values(current).some((c: any) => c && c.large);
                            if (isCurrentlyCustom) {
                              const next = { ...current };
                              Object.keys(next).forEach(k => next[k] = { ...next[k], large: false });
                              if (customAppIconEnabled) setCustomAppIconSizeConfigs(next);
                              else setDefaultAppIconSizeConfigs(next);
                            } else {
                              const next = { ...current };
                              ['header', 'presets', 'throttle'].forEach(k => {
                                if (next[k]) next[k] = { ...next[k], large: true };
                              });
                              if (customAppIconEnabled) setCustomAppIconSizeConfigs(next);
                              else setDefaultAppIconSizeConfigs(next);
                              setIconSettingsMode(customAppIconEnabled ? 'custom' : 'default');
                              setShowIconSettingsModal(true);
                            }
                          }
                        }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={item.toggle}
                          className="flex items-center justify-between w-full p-3 bg-btn-bg/30 border border-btn-border rounded-xl hover:bg-white/5 transition-all group"
                        >
                          <span className="text-[9px] font-black text-text-main uppercase tracking-tight">{item.label}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${item.active ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.4)]' : 'bg-slate-700'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Track Power Section */}
                  <div className="group">
                    <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                      <Zap className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Track Power</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { 
                          id: 'blocksView', 
                          label: 'Track Blocks View', 
                          active: isBlocksView, 
                          toggle: () => setIsBlocksView(!isBlocksView)
                        }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={item.toggle}
                          className="flex items-center justify-between w-full p-3 bg-btn-bg/30 border border-btn-border rounded-xl hover:bg-white/5 transition-all group"
                        >
                          <span className="text-[9px] font-black text-text-main uppercase tracking-tight">{item.label}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${item.active ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.4)]' : 'bg-slate-700'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loco Address Section */}
                  <div className="group">
                    <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                      <Tag className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Loco Address</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { 
                          id: 'displayConsists', 
                          label: 'Display Consists', 
                          active: !hideAllConsists, 
                          toggle: () => {
                            if (!hideAllConsists) {
                              setHideAllConsists(true);
                            } else {
                              if (consists.length > 0) {
                                setHideAllConsists(false);
                              }
                            }
                          }
                        },
                        { 
                          id: 'compact', 
                          label: 'Compact Presets', 
                          active: isCompactLocoPresets, 
                          toggle: () => setIsCompactLocoPresets(!isCompactLocoPresets)
                        },
                        { 
                          id: 'names', 
                          label: 'Show Road Names', 
                          active: showRoadNames, 
                          toggle: () => {
                            const next = !showRoadNames;
                            setShowRoadNames(next);
                            addLog('info', next ? 'Road names displayed.' : 'Road names hidden.');
                          }
                        },
                        { 
                          id: 'colors', 
                          label: 'Color Presets', 
                          active: showLocoColors, 
                          toggle: () => {
                            const next = !showLocoColors;
                            setShowLocoColors(next);
                            addLog('info', next ? 'Preset colors enabled.' : 'Preset colors disabled.');
                          }
                        },
                        { 
                          id: 'photoSwipe', 
                          label: 'Disable Photo Swipe', 
                          active: disablePhotoSwipe, 
                          toggle: () => setDisablePhotoSwipe(!disablePhotoSwipe)
                        },
                        { 
                          id: 'mergeAddress', 
                          label: 'Merge Address Box', 
                          active: isLocoAddressMerged, 
                          toggle: () => setIsLocoAddressMerged(!isLocoAddressMerged)
                        },
                        { 
                          id: 'mergeAdvanced', 
                          label: 'Advanced Toggles', 
                          active: showAdvancedToggles, 
                          toggle: () => setShowAdvancedToggles(!showAdvancedToggles)
                        }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={item.toggle}
                          className="flex items-center justify-between w-full p-3 bg-btn-bg/30 border border-btn-border rounded-xl hover:bg-white/5 transition-all group"
                        >
                          <span className="text-[9px] font-black text-text-main uppercase tracking-tight">{item.label}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${item.active ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.4)]' : 'bg-slate-700'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Throttle Control Section */}
                  <div className="group">
                    <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                      <ArrowUpDown className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Throttle Control</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { 
                          id: 'compactThrottle', 
                          label: 'Compact Throttle', 
                          active: isCompactThrottle, 
                          toggle: () => setIsCompactThrottle(!isCompactThrottle)
                        },
                        { 
                          id: 'verticalThrottle', 
                          label: 'Vertical Throttle', 
                          active: throttleLayout !== 'standard', 
                          toggle: () => setThrottleLayout(throttleLayout !== 'standard' ? 'standard' : 'vertical')
                        },
                        { 
                          id: 'thickThrottle', 
                          label: 'Thick Slider', 
                          active: isThickThrottle, 
                          toggle: () => setIsThickThrottle(!isThickThrottle)
                        },
                        { 
                          id: 'lowSpeed', 
                          label: 'Small Presets', 
                          active: isSmallPresetsActive, 
                          toggle: () => setIsSmallPresetsActive(!isSmallPresetsActive)
                        },
                        { 
                          id: 'estopLayout', 
                          label: 'Emergency Stop Layout', 
                          active: estopConfigMode !== 0, 
                          toggle: () => setEstopConfigMode((estopConfigMode + 1) % 7)
                        },
                        { 
                          id: 'stopAsBtn', 
                          label: 'Stop is Button', 
                          active: Object.values(stopLabelActAsButtonMap).some(v => v === true), 
                          toggle: () => {
                            const isCurrentlyActive = Object.values(stopLabelActAsButtonMap).some(v => v === true);
                            if (isCurrentlyActive) {
                              setStopLabelActAsButtonMap({ standard: false, vertical: false, reversed: false });
                            } else {
                              setStopLabelActAsButtonMap({ standard: true, vertical: true, reversed: true });
                            }
                          }
                        },
                        { 
                          id: 'scaleSpeedSteps', 
                          label: 'Scale % Speed Steps', 
                          active: speedScale === 'percent', 
                          toggle: () => handleSetSpeedScale(speedScale === 'percent' ? 'steps' : 'percent')
                        }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={item.toggle}
                          className="flex items-center justify-between w-full p-3 bg-btn-bg/30 border border-btn-border rounded-xl hover:bg-white/5 transition-all group"
                        >
                          <span className="text-[9px] font-black text-text-main uppercase tracking-tight">{item.label}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${item.active ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.4)]' : 'bg-slate-700'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loco Functions Section */}
                  <div className="group">
                    <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                      <List className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Loco Functions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { 
                          id: 'compactFunctions', 
                          label: 'Compact Functions', 
                          active: isCompactFunctions, 
                          toggle: () => setIsCompactFunctions(!isCompactFunctions)
                        },
                        { 
                          id: 'functionColors', 
                          label: 'Function Colors', 
                          active: showLocoFunctionColors, 
                          toggle: () => setShowLocoFunctionColors(!showLocoFunctionColors)
                        },
                        { 
                          id: 'useFunctionGroups', 
                          label: 'Use Function Groups', 
                          active: useFunctionGroups, 
                          toggle: () => {
                            const currentLocoAddr = cabAddress.toString();
                            if (useFunctionGroups) {
                              // Turning off: remember current enabled groups and disable toggle
                              setRememberedGroups(prev => ({
                                ...prev,
                                [currentLocoAddr]: enabledFunctionGroups[currentLocoAddr] || []
                              }));
                              setEnabledFunctionGroups(prev => ({
                                ...prev,
                                [currentLocoAddr]: []
                              }));
                              setActiveFunctionGroupId(prev => ({
                                ...prev,
                                [currentLocoAddr]: 'default'
                              }));
                            } else {
                              // Turning on: restore from memory if available
                              const restored = rememberedGroups[currentLocoAddr] || [];
                              if (restored.length > 0) {
                                setEnabledFunctionGroups(prev => ({
                                  ...prev,
                                  [currentLocoAddr]: restored
                                }));
                              }
                            }
                            setUseFunctionGroups(!useFunctionGroups);
                          }
                        },
                        { 
                          id: 'hideFNumbers', 
                          label: 'Hide F-Numbers', 
                          active: locoSettings[cabAddress.toString()]?.showNumbers === false, 
                          toggle: () => {
                            const addr = cabAddress.toString();
                            const currentShow = locoSettings[addr]?.showNumbers !== false;
                            setLocoSettings(prev => ({
                              ...prev,
                              [addr]: { ...prev[addr], showNumbers: !currentShow }
                            }));
                          }
                        },
                        { 
                          id: 'hideFNames', 
                          label: 'Hide F-Names', 
                          active: locoSettings[cabAddress.toString()]?.showNames === false, 
                          toggle: () => {
                            const addr = cabAddress.toString();
                            const currentShow = locoSettings[addr]?.showNames !== false;
                            setLocoSettings(prev => ({
                              ...prev,
                              [addr]: { ...prev[addr], showNames: !currentShow }
                            }));
                          }
                        }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={item.toggle}
                          className="flex items-center justify-between w-full p-3 bg-btn-bg/30 border border-btn-border rounded-xl hover:bg-white/5 transition-all group"
                        >
                          <span className="text-[9px] font-black text-text-main uppercase tracking-tight">{item.label}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${item.active ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.4)]' : 'bg-slate-700'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Routes & Turnouts Section */}
                  <div className="group">
                    <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                      <Split className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Routes & Turnouts</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { 
                          id: 'compactRoutes', 
                          label: 'Compact Routes', 
                          active: routeCompactMode === 1 || routeCompactMode === 2, 
                          toggle: () => setRouteCompactMode(routeCompactMode > 0 ? 0 : 1)
                        },
                        { 
                          id: 'compactTurnouts', 
                          label: 'Compact Turnouts', 
                          active: turnoutCompactMode === 1 || turnoutCompactMode === 2, 
                          toggle: () => setTurnoutCompactMode(turnoutCompactMode > 0 ? 0 : 1)
                        }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={item.toggle}
                          className="flex items-center justify-between w-full p-3 bg-btn-bg/30 border border-btn-border rounded-xl hover:bg-white/5 transition-all group"
                        >
                          <span className="text-[9px] font-black text-text-main uppercase tracking-tight">{item.label}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${item.active ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.4)]' : 'bg-slate-700'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {electronLocalIP && (
                    <div className="group">
                      <div className="flex items-center gap-2 border-b border-card-border pb-2 mb-4 group-hover:border-accent/50 transition-colors">
                        <Globe className="w-3.5 h-3.5 text-accent" />
                        <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Network Information</span>
                      </div>
                      <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 mb-4 transition-all hover:bg-accent/10">
                        <p className="text-[10px] font-medium text-text-muted mb-2 leading-relaxed">
                          Connect from another device (Phone/Tablet) on your local network:
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <div className="p-2 px-3 bg-app-bg rounded-lg border border-accent/20 flex-1">
                            <span className="font-mono text-xs font-black text-accent">{electronLocalIP}:3000</span>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`http://${electronLocalIP}:3000`);
                              addLog('info', 'Address copied to clipboard');
                            }}
                            className="p-2.5 bg-btn-bg border border-btn-border rounded-xl hover:bg-accent hover:text-white transition-all text-text-muted active:scale-95"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 pt-4 border-t border-card-border bg-card-bg">
                  <button 
                    onClick={() => setShowUserCustomSettingsModal(false)}
                    className="w-full py-4 bg-accent text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Close Settings
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Electron Serial Port Picker Modal */}
        <AnimatePresence>
          {showElectronPicker && (
            <div key="electron-picker-overlay" className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
              >
                <div className="p-6 border-b border-card-border bg-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-xl text-accent">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-main uppercase tracking-tight">Select Serial Port</h3>
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Choose your DCC-EX device</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 max-h-[22rem] overflow-y-auto custom-scrollbar space-y-2">
                  {electronPorts.length > 0 ? (
                    electronPorts.map((port: any) => (
                      <button
                        key={port.portId}
                        onClick={() => handleSelectElectronPort(port.portId)}
                        className="w-full text-left p-4 bg-btn-bg hover:bg-accent/10 border border-btn-border hover:border-accent/40 rounded-2xl transition-all group active:scale-[0.98] flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-black text-text-main group-hover:text-accent transition-colors">
                            {port.displayName || 'Unknown Device'}
                          </p>
                          <p className="text-[10px] text-text-muted font-mono">{port.portName || port.portId}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-all" />
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 space-y-3">
                      <div className="w-12 h-12 bg-btn-bg rounded-full flex items-center justify-center mx-auto opacity-50">
                        <Unlink className="w-6 h-6 text-text-muted" />
                      </div>
                      <p className="text-sm text-text-muted italic">No serial ports found.</p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 pt-2">
                  <button 
                    onClick={() => {
                        handleSelectElectronPort('');
                        setShowElectronPicker(false);
                    }}
                    className="w-full py-3 bg-white/5 border border-white/10 text-text-muted rounded-xl font-bold hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* DCC-EX Loco Roster Modal */}
        <AnimatePresence>
          {showDccExRosterModal && (
            <div key="dcc-ex-roster-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2005] flex items-center justify-center p-4">
              <motion.div 
                id="tour-loco-dcc-ex-roster-modal"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative"
              >
                <div className="p-6 border-b border-card-border bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-xl text-accent">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-black text-text-main uppercase tracking-tight">DCC-EX Loco Roster</h3>
                    </div>
                    <button 
                      id="tour-loco-dcc-ex-roster-close"
                      onClick={() => setShowDccExRosterModal(false)}
                      className="p-2 hover:bg-white/5 rounded-xl transition-all text-text-muted hover:text-text-main"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{dccExRoster.length} Locomotives Found</p>
                      <p className="text-[9px] font-black uppercase tracking-widest flex gap-2">
                        <span className="text-success">
                          {dccExRoster.filter(addr => presets.some(p => p.toString() === addr.toString())).length} Match Presets
                        </span>
                        <span className="text-text-muted opacity-30">|</span>
                        <span className="text-danger">
                          {dccExRoster.filter(addr => !presets.some(p => p.toString() === addr.toString())).length} Unknown
                        </span>
                      </p>
                    </div>
                    {dccExRoster.length > 0 && (
                      <button
                        onClick={() => {
                          const allSelected = dccExRoster.length > 0 && selectedRosterAddrs.size === dccExRoster.length;
                          if (allSelected) {
                            setSelectedRosterAddrs(new Set());
                          } else {
                            setSelectedRosterAddrs(new Set(dccExRoster));
                          }
                        }}
                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                          dccExRoster.length > 0 && selectedRosterAddrs.size === dccExRoster.length
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                            : 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
                        }`}
                      >
                        {dccExRoster.length > 0 && selectedRosterAddrs.size === dccExRoster.length ? 'select none' : 'select all'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-6 py-3 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
                  {dccExRoster.map((addr, idx) => {
                    const existsInPresets = presets.some(p => p.toString() === addr.toString());
                    const isSelected = selectedRosterAddrs.has(addr);
                    
                    return (
                      <div 
                        key={addr} 
                        id={idx === 0 ? "tour-loco-roster-entry-first" : undefined}
                        className="flex items-center gap-2"
                      >
                        <button
                          onClick={() => {
                            isWaitingForSpecificLocoDetailsRef.current = addr;
                            sendCommand(`JR ${getDccAddress(addr)}`);
                            addLog('out', `<JR ${addr}>`);
                            addLog('info', `Requesting details for Loco #${addr}...`);
                          }}
                          className="flex-1 flex items-center justify-between p-4 bg-btn-bg hover:bg-accent/10 border border-btn-border hover:border-accent/40 rounded-2xl transition-all group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-black/20 rounded-lg group-hover:bg-accent/20 transition-all">
                              {(() => {
                                const config = getEffectiveIconConfig('presets');
                                if (!config?.active) return null;
                                return (
                                  <CustomTrainIcon 
                                    size={16} 
                                    customIcon={customAppIconEnabled ? customAppIcon : null}
                                    customIconType={customAppIconType}
                                    useThemeColor={config?.useTheme ?? true}
                                    className="text-text-muted group-hover:text-accent"
                                  />
                                );
                              })()}
                            </div>
                            <span className="text-sm font-black text-text-main group-hover:text-accent transition-colors">#{addr}</span>
                          </div>

                          {/* Middle Existence Checkbox */}
                          <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${existsInPresets ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
                            {existsInPresets ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </div>
                        </button>
                        
                        {/* Right Selection Checkbox */}
                        <button
                          onClick={() => {
                            setSelectedRosterAddrs(prev => {
                              const next = new Set(prev);
                              if (next.has(addr)) next.delete(addr);
                              else next.add(addr);
                              return next;
                            });
                          }}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-[0.8] ${isSelected ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-btn-bg border-btn-border text-text-muted hover:border-accent/40'}`}
                        >
                          {isSelected && <Check className="w-5 h-5" />}
                        </button>
                      </div>
                    );
                  })}
                  
                  {dccExRoster.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-text-muted italic">No locomotives found in DCC-EX memory.</p>
                    </div>
                  )}
                </div>

                <div id="tour-loco-dcc-ex-roster-footer" className="p-6 pt-3 flex gap-3">
                  <button 
                    onClick={() => setShowDccExRosterModal(false)}
                    className="flex-1 py-3 bg-danger/10 border border-danger/30 text-danger rounded-xl font-bold hover:bg-danger/20 transition-all uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={startImportWorkflow}
                    disabled={selectedRosterAddrs.size === 0}
                    className="flex-[2] py-3 bg-accent text-white shadow-lg shadow-accent/20 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase text-xs tracking-widest"
                  >
                    Import Selected ({selectedRosterAddrs.size})
                  </button>
                </div>

                {/* Import Workflow Overlays */}
                <AnimatePresence>
                  {importWorkflow.status !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[10] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-center"
                    >
                      <motion.div
                        id="tour-loco-import-conflict-alert"
                        initial={{ scale: 0.9, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        className="bg-card-bg border border-card-border p-6 rounded-2xl shadow-2xl space-y-4 max-w-[300px]"
                      >
                        {(importWorkflow.status === 'processing' || importWorkflow.status === 'fetching') && (
                          <div className="space-y-3">
                            <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
                            <p className="text-xs font-bold text-text-main uppercase tracking-widest">
                              {importWorkflow.status === 'fetching' ? 'Fetching Details...' : 'Processing...'}
                            </p>
                            <p className="text-[10px] text-text-muted">{importWorkflow.currentIndex} / {importWorkflow.queue.length} processed</p>
                            {importWorkflow.status === 'fetching' && (
                              <p className="text-[9px] text-accent font-bold uppercase">Loco #{importWorkflow.queue[importWorkflow.currentIndex]}</p>
                            )}
                          </div>
                        )}

                        {importWorkflow.status === 'confirming' && (
                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
                              <Zap className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-text-main leading-relaxed">
                              Loco #{importWorkflow.currentConflictAddr} already exists in throttle.
                            </p>
                            <div className="space-y-2">
                              <button 
                                onClick={() => executeImport(importWorkflow.currentConflictAddr!, 'replace')}
                                className="w-full py-2.5 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-accent/20"
                              >
                                Replace with roster information from <span className="whitespace-nowrap">DCC-EX</span>
                              </button>
                              <button 
                                id="tour-loco-import-conflict-create-new-btn"
                                onClick={() => executeImport(importWorkflow.currentConflictAddr!, 'createNew')}
                                className="w-full py-2.5 bg-warning border-2 border-warning text-text-main rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-warning/20"
                              >
                                Create new locomotive with roster information from <span className="whitespace-nowrap">DCC-EX</span>
                              </button>
                              <button 
                                onClick={skipImport}
                                className="w-full py-2.5 bg-danger/10 border border-danger/30 text-danger rounded-xl font-bold hover:bg-danger/20 transition-all uppercase text-xs tracking-widest"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {importWorkflow.status === 'full' && (
                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mx-auto text-danger">
                              <X className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-text-main uppercase tracking-widest">Presets Full</p>
                            <p className="text-[10px] text-text-muted leading-relaxed">All slots are filled. Could not process any more selected locomotives.</p>
                            <button 
                              onClick={() => setImportWorkflow(prev => ({ ...prev, status: 'idle' }))}
                              className="w-full py-2 bg-btn-bg border border-btn-border text-text-main rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              Close
                            </button>
                          </div>
                        )}

                        {importWorkflow.status === 'finished' && (
                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                              <Check className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-text-main uppercase tracking-widest">Import Complete</p>
                              <p className="text-[10px] text-text-muted">
                                {importWorkflow.results.added} Added | {importWorkflow.results.skipped} Skipped
                              </p>
                            </div>
                            
                            {importWorkflow.results.hiddenAdded && (
                              <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl space-y-2">
                                <p className="text-[9px] text-text-muted leading-relaxed">
                                  Some new locos were added to hidden presets. Would you like to make them visible?
                                </p>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={finishImport}
                                    className="flex-1 py-1.5 bg-btn-bg text-[8px] font-black uppercase tracking-tighter text-text-muted rounded-md"
                                  >
                                    Keep Hidden
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setVisiblePresetsCount(importWorkflow.results.maxIndexUsed + 1); 
                                      finishImport();
                                    }}
                                    className="flex-1 py-1.5 bg-accent text-white text-[8px] font-black uppercase tracking-tighter rounded-md"
                                  >
                                    Show New
                                  </button>
                                </div>
                              </div>
                            )}

                            {!importWorkflow.results.hiddenAdded && (
                              <button 
                                onClick={finishImport}
                                className="w-full py-2 bg-accent text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                              >
                                Done
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* DCC-EX Loco Details Modal */}
        <AnimatePresence>
          {showDccExLocoDetailsModal && selectedDccExLocoDetails && (
            <div key="dcc-ex-loco-details-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2010] flex items-center justify-center p-4">
              <motion.div 
                id="tour-loco-dcc-ex-details-modal"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
              >
                <div className="p-6 border-b border-card-border bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-xl text-accent">
                        {(() => {
                          const config = getEffectiveIconConfig('presets');
                          if (!config?.active) return null;
                          return (
                            <CustomTrainIcon 
                              size={20}
                              customIcon={customAppIconEnabled ? customAppIcon : null}
                              customIconType={customAppIconType}
                              useThemeColor={config?.useTheme ?? true}
                              className="text-accent"
                            />
                          );
                        })()}
                      </div>
                      <h3 className="text-lg font-black text-accent uppercase tracking-tight">Details for Loco {selectedDccExLocoDetails.address}</h3>
                    </div>
                    <button 
                      onClick={() => setShowDccExLocoDetailsModal(false)}
                      className="p-2 hover:bg-white/5 rounded-xl transition-all text-text-muted hover:text-text-main"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-base font-bold text-text-main mt-2">
                    <span className="text-accent mr-1">Description:</span>
                    {selectedDccExLocoDetails.description}
                  </p>
                </div>

                <div className="p-0 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 divide-y divide-card-border">
                    {selectedDccExLocoDetails.functions.map((f) => (
                      <div key={f.number} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 flex items-center justify-center bg-btn-bg border border-btn-border rounded-lg text-xs font-black text-accent uppercase">
                            F{f.number}
                          </span>
                          <span className="text-sm font-bold text-text-main">{f.name}</span>
                        </div>
                        {f.isMomentary && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md text-[9px] font-black text-amber-500 uppercase tracking-widest">
                            <Zap className="w-2.5 h-2.5 fill-amber-500" />
                            Momentary
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {selectedDccExLocoDetails.functions.length === 0 && (
                    <div className="p-12 text-center">
                      <div className="w-12 h-12 bg-btn-bg rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                        <List className="w-6 h-6 text-text-muted" />
                      </div>
                      <p className="text-sm text-text-muted italic">No functions defined for this locomotive.</p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-card-border flex gap-3">
                  <button 
                    onClick={() => setShowDccExLocoDetailsModal(false)}
                    className="flex-1 py-3 bg-danger/10 border border-danger/30 text-danger rounded-xl font-bold hover:bg-danger/20 transition-all uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    id="tour-loco-dcc-ex-import-loco-btn"
                    onClick={() => {
                      if (selectedDccExLocoDetails) {
                        const addr = selectedDccExLocoDetails.address;
                        setSelectedRosterAddrs(prev => {
                          const next = new Set(prev);
                          if (next.has(addr)) next.delete(addr);
                          else next.add(addr);
                          return next;
                        });
                        setShowDccExLocoDetailsModal(false);
                      }
                    }}
                    className={`flex-[2] py-3 rounded-xl font-bold transition-all uppercase text-xs tracking-widest shadow-lg ${
                      selectedDccExLocoDetails && selectedRosterAddrs.has(selectedDccExLocoDetails.address)
                        ? 'bg-amber-500 text-white shadow-amber-500/20 hover:brightness-110'
                        : 'bg-accent text-white shadow-accent/20 hover:brightness-110'
                    }`}
                  >
                    {selectedDccExLocoDetails && selectedRosterAddrs.has(selectedDccExLocoDetails.address) 
                      ? "Don't Import" 
                      : "Import Loco"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Loco Function Groups Setup Modal */}
        <AnimatePresence>
          {showFunctionGroupsModal && (
            <div key="function-groups-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
              <motion.div 
                id="tour-function-groups-modal"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-card-border bg-accent/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-xl text-accent">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-main uppercase tracking-tight">Loco Function Groups Setup</h3>
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Configuring groups for Loco {cabAddress}</p>
                    </div>
                    <div id="tour-use-function-groups-toggle-container" className="flex items-center gap-3 ml-8 border-l border-card-border pl-8">
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Use Function Groups</span>
                      <button 
                        onClick={() => {
                          const currentLocoAddr = cabAddress.toString();
                          if (useFunctionGroups) {
                            // Turning off: remember current enabled groups and disable toggle
                            setRememberedGroups(prev => ({
                              ...prev,
                              [currentLocoAddr]: enabledFunctionGroups[currentLocoAddr] || []
                            }));
                            setEnabledFunctionGroups(prev => ({
                              ...prev,
                              [currentLocoAddr]: []
                            }));
                            setActiveFunctionGroupId(prev => ({
                              ...prev,
                              [currentLocoAddr]: 'default'
                            }));
                          } else {
                            // Turning on: restore from memory if available
                            const restored = rememberedGroups[currentLocoAddr] || [];
                            if (restored.length > 0) {
                              setEnabledFunctionGroups(prev => ({
                                ...prev,
                                [currentLocoAddr]: restored
                              }));
                            }
                          }
                          setUseFunctionGroups(!useFunctionGroups);
                        }}
                        className={`w-10 h-5 rounded-full relative transition-all border-2 shrink-0 ${useFunctionGroups ? 'bg-accent/20 border-accent' : 'bg-btn-bg border-btn-border'}`}
                      >
                        <motion.div 
                          animate={{ x: useFunctionGroups ? 20 : 0 }}
                          className={`w-4 h-4 rounded-full absolute -top-0.5 left-0.5 shadow-lg ${useFunctionGroups ? 'bg-accent' : 'bg-text-muted'}`}
                        />
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowFunctionGroupsModal(false)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all text-text-muted hover:text-text-main"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-30 bg-card-bg/95 backdrop-blur-md shadow-sm">
                      <tr>
                        <th id="tour-group-all-header" className="relative px-2 py-4 text-center border-b border-card-border w-36 bg-card-bg sticky left-0 z-40 shadow-[2px_0_0_0_rgba(0,0,0,0.1)]">
                          <div id="tour-custom-default-box" style={tourCustomBoxStyle} />
                          <div className="flex flex-col items-center gap-2">
                            <div className={`p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20`}>
                              <Layers size={16} />
                            </div>
                            <span className="text-[10px] font-black text-text-main uppercase tracking-widest whitespace-nowrap">All Functions</span>
                            <button 
                              onClick={() => {
                                if (isTourDemoAssignmentActive) {
                                  setTourDemoEnabledFunctionGroups(prev => 
                                    prev.includes('all') ? prev.filter(id => id !== 'all') : [...prev, 'all']
                                  );
                                } else {
                                  const currentLocoAddr = cabAddress.toString();
                                  const current = enabledFunctionGroups[currentLocoAddr] || [];
                                  const next = current.includes('all') 
                                    ? current.filter(id => id !== 'all')
                                    : [...current, 'all'];

                                  // Forget remembered groups when changes made
                                  setRememberedGroups(prev => ({ ...prev, [currentLocoAddr]: [] }));

                                  // If we un-included 'all' and it was active, reset to default
                                  if (current.includes('all') && !next.includes('all') && activeFunctionGroupId[currentLocoAddr] === 'all') {
                                    setActiveFunctionGroupId(prev => ({ ...prev, [currentLocoAddr]: 'default' }));
                                  }

                                  // Toggle 'useFunctionGroups' automatically
                                  if (next.length > 0) setUseFunctionGroups(true);
                                  else setUseFunctionGroups(false);

                                  setEnabledFunctionGroups(prev => ({ ...prev, [currentLocoAddr]: next }));
                                }
                              }}
                              className={`mt-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm ${
                                (isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : (enabledFunctionGroups[cabAddress.toString()] || [])).includes('all')
                                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                  : 'bg-btn-bg text-text-muted border border-btn-border'
                              }`}
                            >
                              {(isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : (enabledFunctionGroups[cabAddress.toString()] || [])).includes('all') ? 'Included' : 'Include'}
                            </button>
                          </div>
                        </th>
                        <th id="tour-group-default-header" className="px-2 py-4 text-center border-b border-card-border min-w-[100px]">
                          <div className="flex flex-col items-center gap-2">
                             <div className="p-2 bg-slate-500/20 text-slate-400 rounded-lg">
                               <Settings size={16} />
                             </div>
                             <span className="text-[10px] font-black text-text-main uppercase tracking-widest whitespace-nowrap">Default</span>
                             <div className="h-8 flex items-center">
                               <span className="text-[9px] font-bold text-text-muted italic">Always Included</span>
                             </div>
                          </div>
                        </th>
                        {FUNCTION_CATEGORIES.filter(c => !c.noColumn).map(cat => (
                          <th key={cat.id} className="relative px-2 py-4 text-center border-b border-card-border min-w-[120px]">
                            {cat.id === 'lighting' && (
                              <div id="tour-custom-lighting-box" style={tourCustomLightingBoxStyle} />
                            )}
                            {cat.id === 'user1' && (
                              <div id="tour-custom-user-box" style={tourCustomUserBoxStyle} />
                            )}
                            <div className="flex flex-col items-center gap-2">
                              <div className={`p-2 ${cat.color} text-white rounded-lg shadow-lg shadow-black/20`}>
                                <cat.icon size={16} />
                              </div>
                              {cat.id.startsWith('user') ? (
                                <input 
                                  type="text"
                                  value={userGroupNames[cabAddress.toString()]?.[cat.id] ?? cat.label}
                                  onFocus={(e) => {
                                    const currentLocoAddr = cabAddress.toString();
                                    const currentName = userGroupNames[currentLocoAddr]?.[cat.id] ?? cat.label;
                                    lastFocusedGroupInfo.current = { id: cat.id, name: currentName };
                                    setUserGroupNames(prev => ({
                                      ...prev,
                                      [currentLocoAddr]: {
                                        ...(prev[currentLocoAddr] || {}),
                                        [cat.id]: ""
                                      }
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = e.currentTarget.value.trim();
                                      if (val === "" && lastFocusedGroupInfo.current?.id === cat.id) {
                                        const currentLocoAddr = cabAddress.toString();
                                        const originalName = lastFocusedGroupInfo.current.name;
                                        setUserGroupNames(prev => ({
                                          ...prev,
                                          [currentLocoAddr]: {
                                            ...(prev[currentLocoAddr] || {}),
                                            [cat.id]: originalName
                                          }
                                        }));
                                      }
                                      lastFocusedGroupInfo.current = null;
                                      e.currentTarget.blur();
                                    } else if (e.key === 'Escape') {
                                      if (lastFocusedGroupInfo.current?.id === cat.id) {
                                        const currentLocoAddr = cabAddress.toString();
                                        const originalName = lastFocusedGroupInfo.current.name;
                                        setUserGroupNames(prev => ({
                                          ...prev,
                                          [currentLocoAddr]: {
                                            ...(prev[currentLocoAddr] || {}),
                                            [cat.id]: originalName
                                          }
                                        }));
                                      }
                                      lastFocusedGroupInfo.current = null;
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val === "" && lastFocusedGroupInfo.current?.id === cat.id) {
                                      const currentLocoAddr = cabAddress.toString();
                                      const originalName = lastFocusedGroupInfo.current.name;
                                      setUserGroupNames(prev => ({
                                        ...prev,
                                        [currentLocoAddr]: {
                                          ...(prev[currentLocoAddr] || {}),
                                          [cat.id]: originalName
                                        }
                                      }));
                                    }
                                    lastFocusedGroupInfo.current = null;
                                  }}
                                  onChange={(e) => {
                                    const name = e.target.value;
                                    const currentLocoAddr = cabAddress.toString();

                                    // Forget remembered groups when changes made
                                    setRememberedGroups(prev => ({ ...prev, [currentLocoAddr]: [] }));

                                    setUserGroupNames(prev => ({
                                      ...prev,
                                      [currentLocoAddr]: {
                                        ...(prev[currentLocoAddr] || {}),
                                        [cat.id]: name
                                      }
                                    }));
                                  }}
                                  className="text-[10px] font-black text-text-main uppercase tracking-widest bg-transparent border-b border-dashed border-text-muted/30 focus:border-accent outline-none text-center w-full px-1"
                                />
                              ) : (
                                <span className="text-[10px] font-black text-text-main uppercase tracking-widest whitespace-nowrap">{cat.label}</span>
                              )}
                              <button 
                                onClick={() => {
                                  if (isTourDemoAssignmentActive) {
                                    setTourDemoEnabledFunctionGroups(prev => 
                                      prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                    );
                                  } else {
                                    const currentLocoAddr = cabAddress.toString();
                                    const current = enabledFunctionGroups[currentLocoAddr] || [];
                                    const next = current.includes(cat.id) 
                                      ? current.filter(id => id !== cat.id)
                                      : [...current, cat.id];
                                    
                                    // Forget remembered groups when changes made
                                    setRememberedGroups(prev => ({ ...prev, [currentLocoAddr]: [] }));
                                    
                                    // If we un-included the currently active group, reset to default
                                    if (current.includes(cat.id) && !next.includes(cat.id) && activeFunctionGroupId[currentLocoAddr] === cat.id) {
                                      setActiveFunctionGroupId(prev => ({ ...prev, [currentLocoAddr]: 'default' }));
                                    }

                                    // Toggle 'useFunctionGroups' automatically
                                    if (next.length > 0) setUseFunctionGroups(true);
                                    else setUseFunctionGroups(false);

                                    setEnabledFunctionGroups(prev => ({ ...prev, [currentLocoAddr]: next }));
                                  }
                                }}
                                className={`mt-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm ${
                                  (isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : (enabledFunctionGroups[cabAddress.toString()] || [])).includes(cat.id)
                                    ? `${cat.color} text-white shadow-lg shadow-black/20`
                                    : 'bg-btn-bg text-text-muted border border-btn-border'
                                }`}
                              >
                                {(isTourDemoAssignmentActive ? tourDemoEnabledFunctionGroups : (enabledFunctionGroups[cabAddress.toString()] || [])).includes(cat.id) ? 'Included' : 'Include'}
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                      {getLocoFunctionConfig(cabAddress).map((fn, i) => (
                        <tr key={i} className="hover:bg-accent/5 transition-colors group/row">
                          <td className="px-2 py-4 border-r border-card-border bg-card-bg sticky left-0 z-20 shadow-[2px_0_0_0_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 flex items-center justify-center bg-btn-bg border border-btn-border rounded text-[10px] font-black text-accent uppercase">F{i}</span>
                              <span className="text-xs font-bold text-text-main truncate max-w-[120px]">{fn.name || `Function ${i}`}</span>
                            </div>
                          </td>
                          <td className="px-2 py-4 text-center">
                            <div className={`w-5 h-5 rounded border-2 mx-auto flex items-center justify-center transition-all ${fn.visible ? 'bg-accent/20 border-accent text-accent' : 'border-btn-border text-transparent'}`}>
                               <Check className="w-3.5 h-3.5" strokeWidth={4} />
                            </div>
                          </td>
                          {FUNCTION_CATEGORIES.filter(c => !c.noColumn).map(cat => (
                            <td key={cat.id} className="px-2 py-4 text-center">
                              <button 
                                onClick={() => {
                                  if (isTourDemoAssignmentActive) {
                                    setTourDemoLocoFunctionGroups(prev => {
                                      const currentList = prev[cat.id] || [];
                                      const nextList = currentList.includes(i)
                                        ? currentList.filter(idx => idx !== i)
                                        : [...currentList, i];
                                      return {
                                        ...prev,
                                        [cat.id]: nextList
                                      };
                                    });
                                  } else {
                                    const currentLocoAddr = cabAddress.toString();
                                    const currentGroups = locoFunctionGroups[currentLocoAddr] || {};
                                    const currentFnList = currentGroups[cat.id] || [];
                                    const nextFnList = currentFnList.includes(i)
                                      ? currentFnList.filter(idx => idx !== i)
                                      : [...currentFnList, i];
                                    
                                    // Forget remembered groups when changes made
                                    setRememberedGroups(prev => ({ ...prev, [currentLocoAddr]: [] }));

                                    setLocoFunctionGroups(prev => ({
                                      ...prev,
                                      [currentLocoAddr]: { ...currentGroups, [cat.id]: nextFnList }
                                    }));
                                  }
                                }}
                                className={`w-6 h-6 rounded-lg border-2 mx-auto flex items-center justify-center transition-all active:scale-90 ${
                                  (isTourDemoAssignmentActive 
                                    ? (tourDemoLocoFunctionGroups[cat.id] || []) 
                                    : (locoFunctionGroups[cabAddress.toString()]?.[cat.id] || [])).includes(i)
                                    ? `${cat.color} border-transparent text-white shadow-[0_0_8px_rgba(0,0,0,0.1)]`
                                    : 'border-text-muted/50 bg-black/20 text-transparent opacity-30 hover:opacity-100 hover:border-text-muted/50'
                                }`}
                              >
                                <Check className="w-4 h-4" strokeWidth={4} />
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 border-t border-card-border bg-card-bg flex justify-between items-center">
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                    * Changes are saved automatically per locomotive.
                  </p>
                  <button 
                    onClick={() => setShowFunctionGroupsModal(false)}
                    className="px-8 py-3 bg-accent text-white shadow-lg shadow-accent/20 rounded-xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Memory Confirmation Modals */}
      <AnimatePresence>
        {showMemoryAutoSaveConfirm && pendingMemorySlot !== null && (
          <div key="memory-autosave-overlay" className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center p-4 text-center">
            <motion.div 
              id="tour-memory-save-settings-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full overflow-hidden"
            >
              <div className="p-6 border-b border-card-border bg-accent/5">
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4 mx-auto">
                  <Save size={24} />
                </div>
                <h3 className="text-sm font-black text-text-main uppercase tracking-tight">Save Settings?</h3>
                <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                  Save current user custom settings in memory button {pendingMemorySlot}?
                </p>
                <div className="mt-4 px-2">
                  <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 text-left">
                    optional save name
                  </label>
                  <input
                    id="tour-memory-save-input-name"
                    type="text"
                    value={pendingMemoryName}
                    onChange={(e) => setPendingMemoryName(e.target.value)}
                    placeholder="e.g. Yard Mode"
                    className="w-full bg-black/20 border border-card-border rounded-xl px-3 py-2 text-[11px] text-text-main focus:border-accent/50 outline-none transition-all placeholder:text-text-muted/30"
                  />
                </div>
              </div>
              <div className="p-4 flex gap-3">
                <button 
                  onClick={() => {
                    setFlashingSlot(null);
                    setShowMemoryAutoSaveConfirm(false);
                    if (autoSaveIncludesReset) {
                      handleTurnOffAllCustomSettings();
                    }
                    setPendingMemorySlot(null);
                    setPendingMemoryName('');
                  }}
                  className="flex-1 py-3 bg-btn-bg border border-btn-border text-text-muted rounded-xl font-bold hover:text-text-main transition-all uppercase text-[10px] tracking-widest"
                >
                  No
                </button>
                <button 
                  onClick={() => {
                    // Blink Green using fast-blink style
                    setFlashingSlot({ id: pendingMemorySlot, color: 'success' });
                    saveMemorySlot(pendingMemorySlot, pendingMemoryName);
                    
                    setTimeout(() => {
                      setFlashingSlot(null);
                      setShowMemoryAutoSaveConfirm(false);
                      if (autoSaveIncludesReset) {
                        handleTurnOffAllCustomSettings();
                      }
                      setPendingMemorySlot(null);
                      setPendingMemoryName('');
                    }, 750);
                  }}
                  className="flex-1 py-3 bg-success text-white rounded-xl font-bold hover:bg-success/80 transition-all shadow-lg shadow-success/20 uppercase text-[10px] tracking-widest"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showMemoryOverwriteConfirm && pendingMemorySlot !== null && (
          <div key="memory-overwrite-overlay" className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center p-4 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full overflow-hidden"
            >
              <div className="p-6 border-b border-card-border bg-danger/5">
                <div className="w-12 h-12 bg-danger/10 rounded-2xl flex items-center justify-center text-danger mb-4 mx-auto">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-sm font-black text-text-main uppercase tracking-tight">Overwrite Settings?</h3>
                <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                  Overwrite button {pendingMemorySlot} custom settings saved on {new Date(memorySlots[pendingMemorySlot]?.timestamp).toLocaleDateString()} at {new Date(memorySlots[pendingMemorySlot]?.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}?
                </p>
                <div className="mt-4 px-2 text-center">
                  <label className="block text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5 text-left">
                    optional save name
                  </label>
                  <input
                    type="text"
                    value={pendingMemoryName}
                    onChange={(e) => setPendingMemoryName(e.target.value)}
                    placeholder="e.g. Yard Mode"
                    className="w-full bg-black/20 border border-card-border rounded-xl px-3 py-2 text-[11px] text-text-main focus:border-accent/50 outline-none transition-all placeholder:text-text-muted/30"
                  />
                </div>
              </div>
              <div className="p-4 flex gap-3">
                <button 
                  onClick={() => {
                    setShowMemoryOverwriteConfirm(false);
                    if (autoSaveIncludesReset) {
                      handleTurnOffAllCustomSettings();
                    } else {
                      setShowMemoryLongPressInfo(true);
                    }
                    setPendingMemorySlot(null);
                    setPendingMemoryName('');
                  }}
                  className="flex-1 py-3 bg-btn-bg border border-btn-border text-text-muted rounded-xl font-bold hover:text-text-main transition-all uppercase text-[10px] tracking-widest"
                >
                  No
                </button>
                <button 
                  onClick={() => {
                    saveMemorySlot(pendingMemorySlot, pendingMemoryName);
                    setShowMemoryOverwriteConfirm(false);
                    if (autoSaveIncludesReset) {
                      handleTurnOffAllCustomSettings();
                    }
                    setPendingMemorySlot(null);
                    setPendingMemoryName('');
                  }}
                  className="flex-1 py-3 bg-danger text-white rounded-xl font-bold hover:bg-danger/80 transition-all shadow-lg shadow-danger/20 uppercase text-[10px] tracking-widest"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showMemoryClearConfirm && pendingMemorySlot !== null && (
          <div key="memory-clear-overlay" className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center p-4 text-center">
            <motion.div 
              id="tour-memory-clear-confirm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full overflow-hidden"
            >
              <div className={`p-6 border-b border-card-border transition-colors duration-300 ${memoryModalMode === 'clear' ? 'bg-danger/5' : 'bg-success/5'}`}>
                <div className="flex items-center justify-center gap-6 mb-4">
                  <button 
                    onClick={() => setMemoryModalMode('clear')}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${memoryModalMode === 'clear' ? 'bg-danger text-white shadow-lg shadow-danger/20 scale-110' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}
                  >
                    <Trash2 size={24} />
                  </button>
                  <button 
                    onClick={() => setMemoryModalMode('replace')}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${memoryModalMode === 'replace' ? 'bg-success text-white shadow-lg shadow-success/20 scale-110' : 'bg-success/10 text-success hover:bg-success/20'}`}
                  >
                    <RefreshCw size={24} />
                  </button>
                </div>
                <h3 className="text-sm font-black text-text-main uppercase tracking-tight">
                  {memoryModalMode === 'clear' ? 'Clear Settings?' : 'Replace Settings?'}
                </h3>
                <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                  {memoryModalMode === 'clear' 
                    ? `Clear memory button ${pendingMemorySlot} custom settings saved on ${new Date(memorySlots[pendingMemorySlot]?.timestamp).toLocaleDateString()} at ${new Date(memorySlots[pendingMemorySlot]?.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}?`
                    : `Replace settings in memory button ${pendingMemorySlot} with your current configuration? Name "${memorySlots[pendingMemorySlot]?.name || 'Slot ' + pendingMemorySlot}" will be kept.`
                  }
                </p>
              </div>
              <div className="p-4 flex gap-3">
                <button 
                  onClick={() => {
                    setShowMemoryClearConfirm(false);
                    setPendingMemorySlot(null);
                  }}
                  className="flex-1 py-3 bg-btn-bg border border-btn-border text-text-muted rounded-xl font-bold hover:text-text-main transition-all uppercase text-[10px] tracking-widest"
                >
                  No
                </button>
                <button 
                  onClick={() => {
                    if (memoryModalMode === 'clear') {
                      clearMemorySlot(pendingMemorySlot);
                    } else {
                      saveMemorySlot(pendingMemorySlot, memorySlots[pendingMemorySlot]?.name);
                    }
                    setShowMemoryClearConfirm(false);
                    setPendingMemorySlot(null);
                  }}
                  className={`flex-1 py-3 text-white rounded-xl font-bold transition-all shadow-lg uppercase text-[10px] tracking-widest ${
                    memoryModalMode === 'clear' 
                      ? 'bg-danger hover:bg-danger/80 shadow-danger/20' 
                      : 'bg-success hover:bg-success/80 shadow-success/20'
                  }`}
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showMemoryClearSuccess && (
          <div key="memory-success-overlay" className="fixed inset-0 bg-black/30 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full p-8 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center text-success mb-6">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-xs font-bold text-text-main mb-8 uppercase tracking-widest leading-relaxed">
                Memory button {pendingMemorySlot} now available for use.
              </p>
              <button 
                onClick={() => {
                  setShowMemoryClearSuccess(false);
                  setPendingMemorySlot(null);
                }}
                className="w-full py-4 bg-success text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-success/20 transition-all active:scale-95"
              >
                Ok
              </button>
            </motion.div>
          </div>
        )}

        {showMemoryLongPressInfo && (
          <div key="memory-info-overlay" className="fixed inset-0 bg-black/30 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full p-8 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center text-accent mb-6">
                <Info size={32} />
              </div>
              <p className="text-xs font-bold text-text-main mb-8 uppercase tracking-widest leading-relaxed">
                Long press any memory button to clear it
              </p>
              <button 
                onClick={() => setShowMemoryLongPressInfo(false)}
                className="w-full py-4 bg-accent text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-accent/20 transition-all active:scale-95"
              >
                Ok
              </button>
            </motion.div>
          </div>
        )}
        {showInAppGuide && (
          <div key="userguide-overlay" className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-card-bg border border-card-border rounded-[2.5rem] shadow-2xl w-full h-full max-w-5xl flex flex-col overflow-hidden relative"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 border-b border-card-border bg-card-bg/80 backdrop-blur-md sticky top-0 z-10 gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-main uppercase tracking-tight">User Guide</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold opacity-60">Interactive Documentation</p>
                  </div>
                </div>

                {/* Combined Section, Stepper, and Tuner Controls in the Header Area */}
                <div className="flex flex-wrap items-center justify-center gap-4 flex-1">
                  {/* Section Selector */}
                  <div className="flex items-center bg-sky-600 border border-solid border-white/50 hover:border-white p-1 rounded-xl shadow-inner">
                    <button 
                      onClick={() => {
                        userGuideIframeRef.current?.contentWindow?.postMessage({ type: 'userguide-command', command: 'prev-section' }, '*');
                      }}
                      disabled={userGuideSection <= 1}
                      className={`px-2.5 py-1.5 text-xs font-black rounded-lg transition-all ${
                        userGuideSection <= 1 
                          ? 'text-text-muted opacity-25 cursor-not-allowed' 
                          : 'text-white/60 hover:text-white cursor-pointer'
                      }`}
                      title="Previous Section"
                    >
                      &lt;&lt;
                    </button>
                    
                    <span className="px-1 py-1 font-mono text-[10px] font-black text-text-main uppercase tracking-wider text-center min-w-[120px] md:min-w-[140px] whitespace-nowrap">
                      {userGuideSectionName}
                    </span>
                    
                    <button 
                      onClick={() => {
                        userGuideIframeRef.current?.contentWindow?.postMessage({ type: 'userguide-command', command: 'next-section' }, '*');
                      }}
                      disabled={userGuideSection >= 7}
                      className={`px-2.5 py-1.5 text-xs font-black rounded-lg transition-all ${
                        userGuideSection >= 7 
                          ? 'text-text-muted opacity-25 cursor-not-allowed' 
                          : 'text-white/60 hover:text-white cursor-pointer'
                      }`}
                      title="Next Section"
                    >
                      &gt;&gt;
                    </button>
                  </div>

                  {/* Page Indicator */}
                  <div className="flex items-center gap-1.5 bg-btn-bg/40 border border-btn-border px-2.5 py-1.5 rounded-lg select-none">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                      {userGuideStepText}
                    </span>
                  </div>

                  {/* Tuner Mode Toggle */}
                  {userGuideIsDev && (
                    <button 
                      onClick={() => {
                        userGuideIframeRef.current?.contentWindow?.postMessage({ type: 'userguide-command', command: 'toggle-tuner' }, '*');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-bold rounded-lg border transition-all ${
                        userGuideTunerMode 
                          ? 'border-sky-500 bg-sky-500/10 text-sky-400 scale-102 font-black' 
                          : 'border-btn-border hover:border-sky-500 hover:bg-sky-500/5 text-text-muted hover:text-text-main'
                      }`}
                    >
                      ⚙️ <span className="uppercase tracking-widest">{userGuideTunerMode ? "Tuner ON" : "Tuner Off"}</span>
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => setShowInAppGuide(false)}
                  className="w-10 h-10 rounded-2xl bg-btn-bg border border-btn-border flex items-center justify-center text-text-muted hover:text-text-main transition-all shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 bg-white relative">
                <iframe 
                  ref={userGuideIframeRef}
                  src="./userguide/index.html" 
                  className="w-full h-full border-none"
                  title="DriverD Throttle Guide"
                />
              </div>

              <div className="p-4 border-t border-card-border bg-card-bg flex justify-between items-center">
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">© 2026 @DriverDTrains</p>
                <a 
                  href={getUserGuideUrl(userGuideStepId)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-btn-bg border border-btn-border rounded-xl text-[10px] font-bold text-text-muted hover:text-accent transition-all uppercase tracking-widest"
                >
                  <ExternalLink size={12} />
                  Open in New Tab
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {showTourMenu && (
          <div key="tour-menu-overlay" className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative"
            >
              <div className="px-4 py-2 border-b border-gray-100 bg-white/80 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl text-black font-black">{tourTOC.tocHeader}</h3>
                  <button 
                    onClick={handleEndTour}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-danger transition-all font-bold"
                  >
                    <X size={18} strokeWidth={4}/>
                  </button>
                </div>
              </div>

              <div className="px-4 pt-2 pb-4 space-y-2">
                <p className="text-base leading-relaxed text-gray-600 font-medium">{tourTOC.welcome}</p>
                
                <button 
                  onClick={() => startTour(0)}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                    tourExitStatus === 'canceled' && (lastTourStopIndex !== null && lastTourStopIndex <= 5)
                    ? 'bg-accent text-white shadow-accent/20'
                    : 'bg-accent text-white shadow-accent/20'
                  }`}
                >
                  <Play size={16} fill="currentColor" />
                  {tourTOC.beginIntroLabel}
                </button>

                <div className="pt-3 px-4 border-t border-gray-100">
                  <h4 className="text-[14px] font-black text-accent uppercase tracking-widest mb-3">{tourTOC.tocTitle}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {tourStopsMenu.map((stop, idx) => {
                      const currentStopIdx = (() => {
                        if (lastTourStopIndex === null) return -1;
                        if (lastTourStopIndex <= 5) return -2; // Intro
                        for (let i = tourStopsMenu.length - 1; i >= 0; i--) {
                          if (lastTourStopIndex + 1 >= tourStopsMenu[i].targetStep) return i;
                        }
                        return -1;
                      })();

                      const isNext = tourExitStatus === 'completed' && (
                        (currentStopIdx === -2 && idx === 0) || // Finished Intro, next is Stop 0
                        (currentStopIdx === idx - 1) // Finished prev stop
                      );

                      const isCurrent = tourExitStatus === 'canceled' && currentStopIdx === idx;

                      return (
                        <button 
                          key={idx}
                          onClick={() => startTour(isCurrent && lastTourStopIndex !== null ? lastTourStopIndex : stop.targetStep - 1)}
                          className={`tour-stop-link w-full text-left text-base hover:translate-x-1 transition-all flex items-center gap-2 group cursor-pointer ${
                            isNext ? 'text-accent font-bold' : 
                            isCurrent ? 'text-warning font-bold' : 
                            'text-text-muted hover:text-accent'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            isNext ? 'bg-accent' : 
                            isCurrent ? 'bg-warning' : 
                            'bg-accent/20 group-hover:bg-accent'
                          }`}></span>
                          {stop.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const currentStopIdx = (() => {
                    if (lastTourStopIndex === null) return -1;
                    if (lastTourStopIndex <= 5) return -2; // Intro
                    for (let i = tourStopsMenu.length - 1; i >= 0; i--) {
                      if (lastTourStopIndex + 1 >= tourStopsMenu[i].targetStep) return i;
                    }
                    return -1;
                  })();

                  const priorStopStep = (() => {
                    if (lastTourStopIndex === null || lastTourStopIndex <= 5) return null;
                    if (currentStopIdx >= 0) return tourStopsMenu[currentStopIdx].targetStep - 1;
                    return null;
                  })();

                  const nextStopStep = (() => {
                    if (lastTourStopIndex === null || lastTourStopIndex <= 5) return tourStopsMenu[0].targetStep - 1;
                    if (currentStopIdx !== -1 && currentStopIdx < tourStopsMenu.length - 1) {
                      return tourStopsMenu[currentStopIdx + 1].targetStep - 1;
                    }
                    return null;
                  })();

                  return (
                    <div className="flex gap-2 pt-2">
                      <button 
                        disabled={priorStopStep === null}
                        onClick={() => priorStopStep !== null && startTour(priorStopStep)}
                        className={`flex-1 py-2 px-2 bg-white/5 border border-white/10 rounded-lg text-sm text-black font-bold hover:text-warning hover:bg-white/10 transition-all ${
                          priorStopStep === null 
                            ? 'opacity-20 cursor-not-allowed text-black' 
                            : 'text-black hover:text-warning hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                        }`}
                      >
                        {tourTOC.revisitLastLabel}
                      </button>
                      <button 
                        disabled={nextStopStep === null}
                        onClick={() => nextStopStep !== null && startTour(nextStopStep)}
                        className={`flex-1 py-2 px-2 border rounded-lg text-sm font-bold transition-all ${
                          nextStopStep === null
                            ? 'bg-white/5 border-white/10 text-black opacity-20 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 text-black hover:text-accent hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                        }`}
                      >
                        {tourTOC.nextTourStopLabel}
                      </button>
                    </div>
                  );
                })()}

                <button 
                  onClick={handleEndTour}
                  className="w-full py-2.5 px-4 bg-danger text-white rounded-xl font-bold hover:bg-danger hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-danger/20"
                >
                  {tourTOC.endTourLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isSliderDragHandVisible && (
          <motion.div
            key="tour-slider-drag-overlay"
            initial={{ 
              opacity: 0, 
              scale: 0.8,
              top: currentTourStepRect ? (currentTourStepRect.top + currentTourStepRect.height / 2 + 10 - sliderDragHandOffsetY) : '50%',
              left: currentTourStepRect 
                ? (isSliderDragHandReversed 
                    ? currentTourStepRect.left + currentTourStepRect.width - 60 
                    : currentTourStepRect.left + 60) 
                : '20%',
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              top: currentTourStepRect ? (currentTourStepRect.top + currentTourStepRect.height / 2 + 10 - sliderDragHandOffsetY) : '50%',
              left: currentTourStepRect 
                ? (isSliderDragHandReversed
                    ? (currentTourStepRect.left + currentTourStepRect.width - 60 - (currentTourStepRect.width - 120) * sliderDragHandProgress)
                    : (currentTourStepRect.left + 60 + (currentTourStepRect.width - 120) * sliderDragHandProgress))
                : '50%',
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ 
              left: { duration: sliderDragHandDuration / 1000 / 2, repeat: 1, repeatType: "reverse", ease: "easeInOut" },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 }
            }}
            style={{
              position: 'fixed',
              x: '-50%',
              y: '-50%',
              zIndex: 100003
            }}
            className="pointer-events-none"
          >
            <Pointer className="w-10 h-10 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" fill="rgba(255,255,255,0.4)" />
          </motion.div>
        )}

        {isButtonHandVisible && (
          <motion.div
            key="tour-button-hand-overlay"
            initial={{ 
              opacity: 0, 
              scale: 0.8,
              top: buttonHandPosition.y,
              left: buttonHandPosition.x,
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              top: buttonHandPosition.y,
              left: buttonHandPosition.x,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ 
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 }
            }}
            style={{
              position: 'fixed',
              x: '-50%',
              y: '-50%',
              zIndex: 100003
            }}
            className="pointer-events-none"
          >
            <Pointer className="w-10 h-10 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" fill="rgba(255,255,255,0.4)" />
          </motion.div>
        )}

        {isKeyboardKeyVisible && (
          <motion.div
            key="tour-keyboard-overlay"
            initial={{ 
              opacity: 0, 
              scale: 0.5,
              top: currentTourStepRect ? (currentTourStepRect.top + currentTourStepRect.height / 2 - keyboardKeyOffsetY) : '50%',
              left: currentTourStepRect ? currentTourStepRect.left + currentTourStepRect.width / 2 : '50%',
            }}
            animate={{ 
              opacity: 1, 
              scale: [0.8, 1.1, 1],
              top: currentTourStepRect ? (currentTourStepRect.top + currentTourStepRect.height / 2 - keyboardKeyOffsetY) : '50%',
              left: currentTourStepRect ? currentTourStepRect.left + currentTourStepRect.width / 2 : '50%',
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              x: '-50%',
              y: '-50%',
              zIndex: 100002
            }}
            className="pointer-events-none"
          >
            <div className="w-[60px] h-[60px] bg-gradient-to-br from-white/20 to-white/5 rounded-2xl border border-white/20 shadow-inner flex items-center justify-center backdrop-blur-md">
              {(() => {
                const iconSize = 32;
                const iconProps = { size: iconSize, className: "text-white" };
                switch (keyboardKeyIcon.toLowerCase()) {
                  case 'up': return <ArrowUp {...iconProps} />;
                  case 'down': return <ArrowDown {...iconProps} />;
                  case 'left': return <ArrowLeft {...iconProps} />;
                  case 'right': return <ArrowRight {...iconProps} />;
                  case 'enter': return <CornerDownLeft {...iconProps} />;
                  case 'cmd': case 'command': return <Command {...iconProps} />;
                  case 'opt': case 'option': return <Option {...iconProps} />;
                  case 'ctrl': case 'control': return <span className="text-xl font-black text-white px-2">CTRL</span>;
                  case 'shift': return <span className="text-xl font-black text-white px-2">SHFT</span>;
                  case 'esc': return <span className="text-xl font-black text-white px-2">ESC</span>;
                  case 'space': return <Space {...iconProps} />;
                  case 'delete': return <Trash2 {...iconProps} />;
                  case 'plus': return <Plus {...iconProps} />;
                  case 'minus': return <Minus {...iconProps} />;
                  default: return <span className="text-2xl font-black text-white px-2">{keyboardKeyIcon.toUpperCase()}</span>;
                }
              })()}
            </div>
          </motion.div>
        )}

        {isMouseDemoVisible && (
          <motion.div
            key="tour-mouse-demo-overlay"
            initial={{ 
              opacity: 0, 
              scale: 0.5,
              left: mouseDemoPosition.x,
              top: mouseDemoPosition.y
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: mouseDemoRadius * Math.cos(0),
              y: mouseDemoRadius * Math.sin(0)
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            style={{
              position: 'fixed',
              left: mouseDemoPosition.x,
              top: mouseDemoPosition.y,
              zIndex: 100004
            }}
            className="pointer-events-none"
          >
            <motion.div
              animate={{
                x: [
                  mouseDemoRadius * Math.cos(0),
                  mouseDemoRadius * Math.cos(Math.PI / 2),
                  mouseDemoRadius * Math.cos(Math.PI),
                  mouseDemoRadius * Math.cos(3 * Math.PI / 2),
                  mouseDemoRadius * Math.cos(2 * Math.PI)
                ],
                y: [
                  mouseDemoRadius * Math.sin(0),
                  mouseDemoRadius * Math.sin(Math.PI / 2),
                  mouseDemoRadius * Math.sin(Math.PI),
                  mouseDemoRadius * Math.sin(3 * Math.PI / 2),
                  mouseDemoRadius * Math.sin(2 * Math.PI)
                ]
              }}
              transition={{
                duration: mouseDemoDuration / 1000,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Gauge className="w-10 h-10 text-green-500 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" />
            </motion.div>
          </motion.div>
        )}

        {tourMemoryStatus && (
          <div key="tour-memory-sync-overlay" className="fixed inset-0 bg-black/40 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card-bg border border-card-border rounded-3xl shadow-2xl max-w-xs w-full p-8 flex flex-col items-center text-center"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={tourMemoryStatus}
                  initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 10, scale: 0.8, opacity: 0 }}
                  className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${tourMemoryStatus === 'saving' ? 'bg-accent/20 text-accent' : 'bg-success/20 text-success'}`}
                >
                  {tourMemoryStatus === 'saving' ? <Save size={32} className="animate-pulse" /> : <RefreshCw size={32} className="animate-spin-slow" />}
                </motion.div>
              </AnimatePresence>
              <h3 className="text-sm font-black text-text-main uppercase tracking-tight mb-2">
                {tourMemoryStatus === 'saving' ? 'Saving User Custom Settings' : 'Restoring User Custom Settings'}
              </h3>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold opacity-60">
                Please wait a moment...
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
