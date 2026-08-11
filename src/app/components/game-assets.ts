/** All assets that exist under /public/assets */
export const GAME_ASSETS = {
  images: {
    // Brand / header
    logo: '/assets/logo.png',
    balance: '/assets/balance.png',
    volumeBtn: '/assets/volumebtn.png',
    headerButtonSmall: '/assets/header-button_small.png',
    wideButtonSmall: '/assets/wide-button_small.png',

    // Backgrounds
    backgroundDesktop: '/assets/backgroundDesktop.png',
    backgroundMobile: '/assets/backgroundMobile.png',
    tableBg: '/assets/tableBg.png',
    mobileviewTableBg: '/assets/mobileviewTablebg.png',
    tableLight: '/assets/tablelight.png',
    tableSpots: '/assets/tableSpots.png',

    // Scene lights / atmosphere
    lightwire: '/assets/lightwire.png',
    lightsOnwire: '/assets/lightsOnwire.png',
    lightsStringOdd: '/assets/lights-string-odd_medium.png',
    purplelight: '/assets/purplelight.png',
    blueLightLarge: '/assets/blue-light_large.avif',
    greenlight: '/assets/greenlight.png',
    lightFrameOn: '/assets/lightFrameOn.png',
    lightFrametop: '/assets/lightFrametop.png',
    fog: '/assets/fog.png',
    fogDark: '/assets/fog-dark.png',
    redFog: '/assets/redfog.png',
    smoke: '/assets/smoke.png',
    greenSmoke: '/assets/greensmoke.png',

    // Characters
    joker: '/assets/joker.png',
    jokerOf: '/assets/jokerof.png',

    // Board / gameplay (Pixi)
    pegLarge: '/assets/peglarge.png',
    pegLargeActive: '/assets/peglarge-active.png',
    ballLarge: '/assets/balllarge.png',
    betMultiplier: '/assets/betMultiplayar.png',

    // UI buttons / panels
    buttonSmall: '/assets/button_small.png',
    buttonLarge: '/assets/button_large.png',
    buttonHoverSmall: '/assets/button-hover_small.png',
    incrementBtn: '/assets/increment btn.png',
    betButtonDesktop: '/assets/betbuttondesktop.png',
    betButtonBg: '/assets/betButtonbg.png',
    betButtonBgHover: '/assets/betbuttonbghover.png',
    betButtonBgMobile: '/assets/betbuttonbgmobile.png',
    betAmountMedium: '/assets/bet-amount_medium.png',
    betPanelSmall: '/assets/bet-panel_small.png',
    betPanelDesktopLarge: '/assets/bet-panel-desktop_large.png',
    betSlipBg: '/assets/betslipbg.png',
    betSlipBtn: '/assets/betslipbtn.png',
    disabledBtnBetSlip: '/assets/disbaledbtnbetslip.png',
    modalLarge: '/assets/modal_large.png',

    // Guide images
    gameDesktop: '/assets/game-desktop.png',
    gameMobileMedium: '/assets/game-mobile_medium.png',
  },

  spine: {
    harleysPlinkoAtlas: '/assets/spine/harleysPlinko.atlas',
    harleysPlinkoSkel: '/assets/spine/harleysPlinko.skel',
    harleysPlinkoTexture: '/assets/spine/harleysPlinko.png',
  },

  sounds: {
    bg: '/assets/sounds/bg-sound.webm',
    click: '/assets/sounds/button-click.webm',
    turbo: '/assets/sounds/turbo.webm',
    pegHit: '/assets/sounds/peg-hit.wav',
  },
} as const;

/** Flat list for ResourceLoaderService — every file that exists on disk */
export const GAME_ASSET_URLS: string[] = [
  ...Object.values(GAME_ASSETS.images),
  ...Object.values(GAME_ASSETS.spine),
  ...Object.values(GAME_ASSETS.sounds),
];

/** Pixi board textures — preload so pegs are ready before loader hides */
export const PIXI_BOARD_ASSETS = [
  { alias: 'pegLarge', src: GAME_ASSETS.images.pegLarge },
  { alias: 'pegLargeActive', src: GAME_ASSETS.images.pegLargeActive },
  { alias: 'ballLarge', src: GAME_ASSETS.images.ballLarge },
  { alias: 'binBox', src: GAME_ASSETS.images.betMultiplier },
] as const;
