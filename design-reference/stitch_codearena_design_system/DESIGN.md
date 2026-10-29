---
name: Coin-Op Arcade Matrix
colors:
  surface: '#13131b'
  surface-dim: '#13131b'
  surface-bright: '#393842'
  surface-container-lowest: '#0d0d16'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#d1c6ab'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#302f39'
  outline: '#9a9078'
  outline-variant: '#4d4632'
  surface-tint: '#eec200'
  primary: '#ffecb9'
  on-primary: '#3c2f00'
  primary-container: '#facc15'
  on-primary-container: '#6c5700'
  inverse-primary: '#735c00'
  secondary: '#ffb1c5'
  on-secondary: '#65002f'
  secondary-container: '#e30071'
  on-secondary-container: '#fffbff'
  tertiary: '#b8f9ff'
  on-tertiary: '#00363a'
  tertiary-container: '#00e7f5'
  on-tertiary-container: '#00636a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe083'
  primary-fixed-dim: '#eec200'
  on-primary-fixed: '#231b00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#ffd9e1'
  secondary-fixed-dim: '#ffb1c5'
  on-secondary-fixed: '#3f001b'
  on-secondary-fixed-variant: '#8f0045'
  tertiary-fixed: '#7df4ff'
  tertiary-fixed-dim: '#00dbe9'
  on-tertiary-fixed: '#002022'
  on-tertiary-fixed-variant: '#004f54'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: 0.08em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: 0.06em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: 0.04em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: 0.04em
  title-md:
    fontFamily: Space Mono
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: 0.06em
  body-lg:
    fontFamily: Space Mono
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.02em
  body-md:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.1em
  label-md:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.12em
  label-sm:
    fontFamily: Space Mono
    fontSize: 9px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.14em
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels the electric, tactile thrill of 1980s and 1990s 2D coin-op arcade cabinets, early home consoles (NES/Famicom, Sega Master System, SNES), and CRT phosphors. It rejects modern homogenous SaaS conventions—no smooth pill badges, floating drop shadows, or generic pastel rounded cards. Instead, it enforces a strict 8-bit/16-bit raster mentality: uncompromising rectangular geometry, hard-edged stepped borders, glowing phosphor text, high-saturation neon accents against an abyssal midnight canvas, and interactive tactile micro-states that replicate physical microswitches, coin doors, and arcade marquees.

The target audience spans gamers, developers, Web3/retro-tech communities, interactive event apps, and digital platforms demanding unbridled nostalgia, intense identity, and playful tactile feedback. The emotional tone is energetic, competitive, arcade-authentic, and nostalgic without sacrificing digital accessibility.

## Colors

The palette operates in strict dark mode, anchored by deep arcade CRT chassis blacks and illuminated by saturated phosphor hues:

- **Primary (`#facc15` / `#f59e0b`):** Golden Arcade Coin Yellow. Used for primary calls to action, high-score indicators, insert-coin triggers, and critical badges.
- **Secondary (`#ff2a85` / `#ec4899`):** 8-Bit Neon Magenta. Used for secondary interactive states, boss alerts, marquee highlights, and accent trims.
- **Tertiary (`#00f0ff` / `#38bdf8`):** Player 2 Cyan. Used for informational metrics, selection cursors, data streams, and active tabs.
- **Support Colors:**
  - **1UP Green (`#22c55e`):** Success notifications, extra lives, active system status, verified badges.
  - **Brick Red (`#ef4444`):** Game over alerts, danger zones, destructive actions, health meters.
  - **CRT Deep Midnight (`#0a0a12` / `#0d0f1a`):** Primary canvas and nested panel background.
  - **Scanline Neutral (`#1e2238`):** Unfocused borders, structural pixel gutters, and secondary container fills.

All color applications avoid soft alpha gradients in favor of stepped dithered stripes, solid block fills, or 100% opaque hard-cut pixel shadows.

## Typography

The typography strategy leverages monospaced and structured geometric grotesque fonts (`Space Mono` and `Space Grotesk`) to guarantee pixel alignment, rigid tabular readouts, and an unmistakable terminal/arcade look across web and mobile viewports.

- **Uppercase Convention:** All headlines, HUD readouts (`1UP`, `HI-SCORE`, `INSERT COIN`, `STAGE 1`), action buttons, and status chips must use full uppercase casing.
- **Tabular Figures:** Numbers must render with equal spacing to prevent UI shifting during live counters and score increments.
- **Phosphor Glow:** In high-impact headers, text can feature an intense hard-edged drop shadow (`2px 2px 0px #ff2a85` or `3px 3px 0px #000000`) rather than Gaussian blurs.

## Layout & Spacing

Layout adheres to an 8px grid cadence (`4px` for atomic micro-steps like borders and bevels), honoring retro tile-based hardware constraints:

- **Grid Architecture:** Desktop views utilize a 12-column grid with `1.5rem` (`24px`) gutters. Mobile switches to 4 fluid columns with `1rem` (`16px`) gutters.
- **Canvas Container:** Maximum content bounding box is `1200px`, centered with hard-edged border brackets simulating a cabinet bezel or a CRT monitor housing.
- **Rhythm:** Spacing follows fixed powers of 4px and 8px (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 40px). Fluid or sub-pixel rem intervals are prohibited to avoid blur on non-retina displays.

## Elevation & Depth

True to vintage 8-bit and 16-bit aesthetics, Gaussian drop shadows and translucent frosted blurs are forbidden. Depth is achieved purely through hard geometric projection, pixel-stepped shadows, and color-stepped bevels:

1. **Hard Pixel Drop:** Elements cast solid, unblurred 2px, 4px, or 6px shadows offset diagonally (e.g., `box-shadow: 4px 4px 0px #000000` or `box-shadow: 4px 4px 0px #ff2a85`).
2. **Beveled Chassis (Light & Shade):** Panels and push buttons use top/left light borders and bottom/right dark borders (e.g., `border-top: 3px solid #fde047; border-left: 3px solid #fde047; border-bottom: 3px solid #b45309; border-right: 3px solid #b45309;`) giving them physical, punchy extrusion.
3. **Scanline Overlay:** Full viewport or internal card panels can carry a faint repetitive CSS scanline pattern (`linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%)`, background-size: `100% 4px`) to emulate CRT phosphors.
4. **Stepped Corners:** Rounded borders are replaced with pixel-art stepped corners constructed via 4px stepped box-shadows or SVG 9-slice cutouts.

## Shapes

All elements feature zero corner radius (`0px` / `roundedness: 0`). Soft corners, fluid pills, and modern rounded concentric boxes are incompatible with this visual language.

- **Pixel Stepping:** Where diagonal or shaped cuts are desired (e.g., status flags, speech bubbles, health containers), use 4px hard-stepped corner notches (`clip-path` or CSS pseudo-element pixel staircases).
- **Thick Outlines:** All borders and divider frames are strictly `2px`, `3px`, or `4px` solid rules. Hairline 1px borders are reserved strictly for internal CRT scanline detailing.

## Components

### Buttons
- **Primary Arcade Button:** Chunky rectangular shape. Gold background (`#facc15`), black bold uppercase text, 3px solid black border with a 4px hard black right-down shadow (`box-shadow: 4px 4px 0px #000000`). Top/left 2px highlight in `#fef08a`.
  - *Active/Pressed State:* Button translates `+4px` on X and Y with zero shadow (`transform: translate(4px, 4px); box-shadow: none;`), simulating a mechanical microswitch push.
- **Secondary Coin-Slot Button:** Cyan (`#00f0ff`) or Magenta (`#ff2a85`) outline button with transparent black fill. On hover, fills solid neon with inverted black text and emits a 4px solid neon hard shadow.

### Cards & Chassis Panels
- **HUD Frame:** Background in CRT midnight `#0d0f1a` with a 3px solid border in `#1e2238` or neon accent `#ff2a85`. Outer corners feature 4px square pixel notches or yellow corner brackets (`┌ ┐ └ ┘`).
- **Marquee Card:** Top header contains a high-contrast accent band (`#facc15` or `#ff2a85`) holding monospace category identifiers or stage names (`STAGE 01`, `BOSS FIGHT`).

### Inputs & Form Elements
- **Terminal Input:** Hard black box with 2px solid cyan border (`#00f0ff`). Monospace green (`#22c55e`) text preceded by a persistent blinking prompt character (`> `). Caret is a non-antialiased solid blinking block.
- **Checkbox & Radio:** 
  - *Checkbox:* Rigid 18x18px square box with 2px yellow border. Checked state displays a solid 8x8px square pixel block or an 8-bit `X`.
  - *Radio Button:* Diamond or hard stepped hexagon frame with a solid center square pip when active.

### Chips & Badges
- **1UP / Score Badges:** Zero-radius rectangular tags with thick 2px solid outlines. Background solid black with high-visibility neon text (`1UP: 004820`, `CREDITS: 02`).
- **INSERT COIN Flash:** A persistent, CSS stepped blink animation (`opacity: 1` to `opacity: 0` using `steps(1)`) for callout tags and system standby notices.

### Progress & Health Bars
- **Segmented Pixel Bar:** Life and energy meters are divided into discrete rectangular blocks (e.g., eight 12px wide blocks with 2px gaps) colored in green `#22c55e`, yellow `#facc15`, or red `#ef4444`, avoiding continuous fluid gradients.