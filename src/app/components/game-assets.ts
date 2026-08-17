/** Magic Spell assets under /public/assets/magicSpell */

export const GAME_ASSETS = {
  images: {
    logo: '/assets/magicSpell/images/header/logo.png',
    winBanner: '/assets/magicSpell/images/common/win.png',
    gameBoard: '/assets/magicSpell/images/intro/gameBoard.jpg',
    gameBoardMobile: '/assets/magicSpell/images/intro/gameBoard-mobile.jpg',
    makingMove: '/assets/magicSpell/images/intro/makingMove.png',
    makingMoveMobile: '/assets/magicSpell/images/intro/makingMove-mobile.png',
    resultStrip: '/assets/magicSpell/images/intro/result.png',
  },

  icons: {
    burger: '/assets/magicSpell/images/vectors/menu.svg',
    soundOn: '/assets/magicSpell/images/vectors/sound.svg',
    soundOff: '/assets/magicSpell/images/vectors/soundOff.svg',
    vimPlay: '/assets/magicSpell/images/vectors/vimPlay.svg',
    close: '/assets/magicSpell/images/vectors/close.svg',
    copy: '/assets/magicSpell/images/vectors/copy.svg',
    home: '/assets/magicSpell/images/vectors/home.svg',
    betHistory: '/assets/magicSpell/images/vectors/bet-history.svg',
    gameGuide: '/assets/magicSpell/images/vectors/game-guide.svg',
    plus: '/assets/magicSpell/images/vectors/plusIcon.svg',
    minus: '/assets/magicSpell/images/vectors/minusIcon.svg',
    amountPopup: '/assets/magicSpell/images/vectors/amountPopupIcon.svg',
    empty: '/assets/magicSpell/images/vectors/not-data.svg',
  },

  spine: {
    backgroundSkel: '/assets/magicSpell/spine/background.skel',
    backgroundAtlas: '/assets/magicSpell/spine/background.atlas',
    backgroundTexture: '/assets/magicSpell/spine/background.png',
    mainSkel: '/assets/magicSpell/spine/main-details.skel',
    mainAtlas: '/assets/magicSpell/spine/main-details.atlas',
    mainTexture: '/assets/magicSpell/spine/main-details.png',
  },

  sounds: {
    bg: '/assets/magicSpell/audio/backgroundSound.mp3',
    click: '/assets/magicSpell/audio/buttonsSound.mp3',
    secondClick: '/assets/magicSpell/audio/secondLevelButtonsSound.mp3',
    win: '/assets/magicSpell/audio/win.mp3',
    lose: '/assets/magicSpell/audio/lose.mp3',
    spine: '/assets/magicSpell/audio/spine.mp3',
  },
} as const;

/**
 * Layout for 1280×720 Vimplay frame.
 * Live bundle values (scale/defaultPos) target their custom renderer; in Pixi we
 * map the same visual result with hall cover-fit + wizard height-fit.
 */
export const MAGIC_SPELL_SPINE_CONFIG = {
  designWidth: 1280,
  designHeight: 720,
  background: {
    /** Slight overscan so hall edges never clip */
    coverPad: 1.03,
    /** Pin hall floor to bottom of stage */
    anchorY: 1,
    /** Nudge hall downward (px) */
    offsetY: 13,
    /** Measure only the hall — stars/spider skew bounds */
    fitAttachments: ['Untitled-1 2'],
    idleAnimation: 'Background_animation',
  },
  main: {
    /** Wizard height ≈ 58% of stage (slightly wider/taller vs 0.55) */
    heightRatio: 0.58,
    /** Visual center Y on stage — slightly above bottom bet panel */
    anchorY: 0.49,
    idleAnimations: [
      { name: 'Wizard_idle_1', probability: 0.4 },
      { name: 'Wizard_idle_2', probability: 0.2 },
      { name: 'Wizard_idle_3', probability: 0.2 },
      { name: 'Wizard_idle_4', probability: 0.2 },
    ],
  },
} as const;

export const MAGIC_SPELL_ANIMS = {
  backgroundIdle: 'Background_animation',
  wizardIdle: [
    'Wizard_idle_1',
    'Wizard_idle_2',
    'Wizard_idle_3',
    'Wizard_idle_4',
    'Wizard_idle_5',
  ],
  wizarding: 'Wizard_wizarding_main',
  win: 'Wizard_win',
  win2: 'Wizard_win_2',
  win4: 'Wizard_win_4',
  lose: 'Wizard_lose_main',
} as const;
