# ElevenLabs Design System — Light Mode
**Reverse-engineered spec · v2025**

---

## Table of Contents
1. [Colors](#colors)
2. [Typography](#typography)
3. [Spacing & Radii](#spacing--radii)
4. [Components](#components)
5. [Motion](#motion)
6. [Patterns](#patterns)
7. [Interactive Spec (React)](#interactive-spec-react)

---

## Colors

### Background Scale
| Token | Value | Use |
|-------|-------|-----|
| `bg.base` | `#FFFFFF` | Page background |
| `bg.surface` | `#F7F7F6` | Cards, panels |
| `bg.elevated` | `#EFEFED` | Elevated surfaces, inputs |
| `bg.overlay` | `#E5E5E2` | Tooltips, dropdowns |

> Backgrounds use warm-tinted off-whites rather than cold greys. Feels crafted, not clinical.

### Text Scale
| Token | Value | Use |
|-------|-------|-----|
| `text.primary` | `#0A0A0A` | Headings, body |
| `text.secondary` | `rgba(0,0,0,0.55)` | Supporting copy |
| `text.tertiary` | `rgba(0,0,0,0.36)` | Metadata, labels |
| `text.disabled` | `rgba(0,0,0,0.20)` | Disabled states |

> Never pure `#000000`. Primary text is near-black to avoid harshness.

### Accent Colors
| Token | Value | Use |
|-------|-------|-----|
| `accent.orange` | `#E8470A` | Primary CTA, links, highlights |
| `accent.orangeMuted` | `rgba(232,71,10,0.08)` | Badge backgrounds |
| `accent.orangeGlow` | `rgba(232,71,10,0.18)` | CTA button shadow |
| `accent.blue` | `#2563EB` | API, code identifiers |
| `accent.purple` | `#7C3AED` | Code keywords, beta badge |
| `accent.green` | `#16A34A` | Success, free badge |

> Orange is darkened to `#E8470A` from the dark-mode `#FF6D3F` to maintain WCAG AA (4.5:1) contrast on white. All other accents shifted ~15% darker for the same reason.

### Border Tokens
| Token | Value |
|-------|-------|
| `border.subtle` | `rgba(0,0,0,0.06)` |
| `border.default` | `rgba(0,0,0,0.10)` |
| `border.strong` | `rgba(0,0,0,0.18)` |

### Gradients
| Token | Value | Use |
|-------|-------|-----|
| `gradient.purpleBlue` | `linear-gradient(135deg, #3730A3, #1D4ED8, #1E40AF)` | Hero/feature cards |
| `gradient.orangeFade` | `linear-gradient(135deg, rgba(232,71,10,0.08), transparent)` | Accent card overlay |
| `gradient.meshLeft` | `radial-gradient(ellipse at 20% 50%, rgba(109,40,217,0.08), transparent)` | Hero background |
| `gradient.meshRight` | `radial-gradient(ellipse at 80% 50%, rgba(37,99,235,0.07), transparent)` | Hero background |

---

## Typography

### Font Families
| Token | Value | Use |
|-------|-------|-----|
| `font.display` | `'Söhne', 'DM Sans', sans-serif` | Headings, UI |
| `font.body` | `'Söhne', 'DM Sans', sans-serif` | Body copy |
| `font.mono` | `'Söhne Mono', 'JetBrains Mono', monospace` | Code, tokens |

### Type Scale
| Token | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| `5xl` | 3.5rem | 600 | 1.1 | −0.03em |
| `4xl` | 2.5rem | 600 | 1.15 | −0.025em |
| `3xl` | 1.875rem | 600 | 1.2 | −0.02em |
| `2xl` | 1.5rem | 600 | 1.25 | −0.015em |
| `xl` | 1.25rem | 500 | 1.4 | −0.01em |
| `lg` | 1.125rem | 400 | 1.6 | 0 |
| `base` | 1rem | 400 | 1.6 | 0 |
| `sm` | 0.875rem | 400 | 1.5 | 0 |
| `xs` | 0.75rem | 500 | 1.4 | +0.04em |

### Usage Rules
| Context | Rule |
|---------|------|
| Headings | Display font, tight negative tracking, weight 600. Never regular weight at large sizes. |
| Body | Normal tracking, weight 400, line-height 1.6. |
| Labels / Caps | Weight 500–600, letter-spacing +0.08em to +0.12em, uppercase. |
| Code | Mono family exclusively. Rendered in `bg.elevated` containers with `border.subtle`. |
| CTA Copy | Short, imperative, title case. Max 3 words on primary buttons. Never all-caps. |

---

## Spacing & Radii

### Spacing Scale (4px base)
| Token | Value |
|-------|-------|
| `spacing-0` | 0px |
| `spacing-1` | 4px |
| `spacing-2` | 8px |
| `spacing-3` | 12px |
| `spacing-4` | 16px |
| `spacing-5` | 20px |
| `spacing-6` | 24px |
| `spacing-7` | 32px |
| `spacing-8` | 40px |
| `spacing-9` | 48px |
| `spacing-10` | 64px |
| `spacing-11` | 80px |
| `spacing-12` | 96px |
| `spacing-13` | 128px |

### Border Radii
| Token | Value | Use |
|-------|-------|-----|
| `radius.none` | 0px | Sharp/technical elements |
| `radius.sm` | 4px | Small tags, inner elements |
| `radius.md` | 8px | Buttons, inputs |
| `radius.lg` | 12px | Dropdowns, tooltips |
| `radius.xl` | 16px | Cards |
| `radius.2xl` | 24px | Feature panels |
| `radius.full` | 9999px | Badges, pills, avatars |

### Elevation / Shadows
| Token | Value | Use |
|-------|-------|-----|
| None | `none` | Flat surfaces, inline elements |
| Subtle | `0 1px 4px rgba(0,0,0,0.08)` | Cards, dropdowns |
| Medium | `0 4px 20px rgba(0,0,0,0.12)` | Modals, overlays |
| Glow — Orange | `0 0 32px rgba(232,71,10,0.18)` | Primary CTA focus |
| Glow — Blue | `0 0 32px rgba(37,99,235,0.15)` | API/code surfaces |

---

## Components

### Buttons
| Variant | Background | Color | Border | Shadow |
|---------|-----------|-------|--------|--------|
| Primary | `#E8470A` | `#ffffff` | none | Orange glow |
| Secondary | `rgba(0,0,0,0.05)` | `text.primary` | `border.default` | none |
| Ghost | `transparent` | `text.secondary` | `border.subtle` | none |
| Destructive | `rgba(220,38,38,0.07)` | `#DC2626` | `rgba(220,38,38,0.20)` | none |

- Border radius: `radius.md` (8px)
- Padding: `10px 20px`
- Font size: 0.875rem, weight 500
- Transition: all 150ms ease-out

### Badges / Tags
| Variant | Background | Color | Border |
|---------|-----------|-------|--------|
| New | `rgba(232,71,10,0.08)` | `#E8470A` | `rgba(232,71,10,0.18)` |
| Beta | `rgba(124,58,237,0.08)` | `#7C3AED` | `rgba(124,58,237,0.20)` |
| API | `rgba(37,99,235,0.08)` | `#2563EB` | `rgba(37,99,235,0.20)` |
| Free | `rgba(22,163,74,0.08)` | `#16A34A` | `rgba(22,163,74,0.20)` |

- Border radius: `radius.full`
- Padding: `3px 10px`
- Font size: 0.7rem, weight 600, letter-spacing +0.04em

### Cards
| Variant | Background | Border | Notes |
|---------|-----------|--------|-------|
| Default | `bg.surface` | `border.default` | Standard content card |
| Accent | `bg.surface` + orange fade overlay | `border.default` | Feature highlight |
| Hero | `gradient.purpleBlue` | `rgba(55,48,163,0.3)` | Always white text inside |

- Border radius: `radius.xl` (16px)
- Padding: 24px

### Inputs
| State | Border | Shadow |
|-------|--------|--------|
| Default | `border.default` | none |
| Focus | `rgba(232,71,10,0.45)` | `0 0 0 3px rgba(232,71,10,0.08)` |
| Disabled | `border.subtle` | none |

- Background: `bg.surface`
- Border radius: `radius.md` (8px)
- Padding: `10px 14px`
- Font size: 0.875rem

### Code Blocks
- Background: `#F3F3F1` (slightly warmer than surface)
- Border: `border.default`
- Border radius: `radius.lg` (12px)
- Font: `font.mono`, 0.8rem, line-height 1.7
- Syntax colours: keywords `#7C3AED`, identifiers `#2563EB`, strings `#E8470A`, functions `#16A34A`

### Navigation (Sticky Header)
- Height: 60px
- Background: `rgba(255,255,255,0.85)`
- Backdrop filter: `blur(20px)`
- Border bottom: `border.subtle`
- Position: sticky, z-index 100
- Logo mark: 28×28px, `radius.sm`, orange fill
- CTA: Primary button (Sign up) + Ghost text link (Log in)

---

## Motion

### Easing Curves
| Token | Value | Use |
|-------|-------|-----|
| `ease.outExpo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions, reveals, modals entering |
| `ease.inOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes, tab switches, toggles |
| `ease.out` | `cubic-bezier(0, 0, 0.2, 1)` | Hover effects, button interactions, focus |
| `ease.spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful elements, badges, tooltips |

### Duration Scale
| Token | Duration | Use |
|-------|----------|-----|
| `duration.instant` | 50ms | Button press feedback |
| `duration.fast` | 120ms | Hover states, focus rings |
| `duration.normal` | 200ms | Dropdowns, tooltips, toggles |
| `duration.slow` | 350ms | Modals, page transitions |
| `duration.deliberate` | 500ms | Complex reveals, onboarding |
| `duration.cinematic` | 800ms | Hero animations, landing sequences |

### Principles
| Principle | Guidance |
|-----------|----------|
| Purposeful | Motion conveys meaning — entries reveal, exits de-emphasize. Never animate for decoration. |
| Snappy at small scale | Micro-interactions under 200ms. Quick hover feedback signals a responsive, alive interface. |
| Waveform as motif | Waveform animations are the signature ElevenLabs metaphor. Always sync with audio playback. |
| Fade + Translate | Elements enter by fading in while translating 8–12px upward. Consistent, grounded feel. |
| Stagger reveals | Lists/grids stagger 40–60ms per item. Hero sequences stagger 80–120ms. |

---

## Patterns

### Layout Grid
| Property | Value |
|----------|-------|
| Container max-width | 1200px |
| Side padding (desktop) | 40px |
| Side padding (mobile) | 20px |
| Grid system | 12-column CSS grid, 24px gutter |
| Bento gutter | 16px |
| Major section spacing | 96px vertical |
| Sub-section spacing | 48px vertical |
| Prose max-width | 640px |
| Feature content max-width | 960px |

### Logo Marquee / Social Proof
- Horizontal scroll, continuous loop at ~30s
- Opacity: 0.45 on light (reduced from 0.55 dark)
- Edge fade: linear-gradient masks on left/right
- Font: 0.75rem, weight 700, letter-spacing +0.06em
- Brands shown: Twilio, Disney, Cisco, NVIDIA, Revolut, Meta, Salesforce, Epic Games

### Hero Section Structure
```
[eyebrow label — orange, uppercase, 0.7rem]
[H1 — 3–3.5rem, weight 600, tight tracking]
[subtitle — 1rem, text.secondary, max-width 440px]
[CTA row — Primary button + Ghost button]
[background — bg.surface + mesh gradient overlays]
```

---

## Light Mode Design Principles

| Principle | Detail |
|-----------|--------|
| Warm neutrals | Off-whites are warm-tinted, not cold grey. #F7F7F6 vs a clinical #F5F5F5. |
| Orange stays orange | Brand accent preserved across modes — adjusted darker for contrast, never swapped out. |
| Surface contrast | Four-level system maintained. bg.surface sits ~2% off base to define structure without harsh dividers. |
| Text hierarchy | Primary near-black (#0A0A0A). Secondary 55% opacity. Tertiary 36%. Never pure #000000. |
| Code on tinted bg | Code blocks use #F3F3F1 — warmer than surface — to distinguish syntax zones without inverting to dark. |
| Hero gradients | Purple/blue mesh gradients carry across modes as semi-transparent overlays. No mode-specific swap needed. |

---

## Dark ↔ Light Mode Delta

| Token | Dark | Light | Notes |
|-------|------|-------|-------|
| `bg.base` | `#0A0A0A` | `#FFFFFF` | Full inversion |
| `bg.surface` | `#111111` | `#F7F7F6` | Warm off-white |
| `accent.orange` | `#FF6D3F` | `#E8470A` | Darkened for contrast |
| `accent.blue` | `#3B82F6` | `#2563EB` | ~15% darker |
| `accent.purple` | `#8B5CF6` | `#7C3AED` | ~15% darker |
| `accent.green` | `#22C55E` | `#16A34A` | ~15% darker |
| `border.*` | `rgba(255,255,255,…)` | `rgba(0,0,0,…)` | Same opacity values |
| `text.*` | `rgba(255,255,255,…)` | `rgba(0,0,0,…)` | Same opacity values |
| Nav backdrop | `rgba(10,10,10,0.85)` | `rgba(255,255,255,0.85)` | Same blur |
| Code bg | `#1A1A1A` | `#F3F3F1` | Warm inversion |
| Orange glow | `rgba(255,109,63,0.30)` | `rgba(232,71,10,0.18)` | Reduced intensity |

---

## Interactive Spec (React)

Full interactive design system explorer — paste into a `.jsx` file or Claude artifact:

```jsx
import { useState } from "react";

const colors = {
  bg: {
    base: "#FFFFFF",
    surface: "#F7F7F6",
    elevated: "#EFEFED",
    overlay: "#E5E5E2",
  },
  border: {
    subtle: "rgba(0,0,0,0.06)",
    default: "rgba(0,0,0,0.10)",
    strong: "rgba(0,0,0,0.18)",
  },
  text: {
    primary: "#0A0A0A",
    secondary: "rgba(0,0,0,0.55)",
    tertiary: "rgba(0,0,0,0.36)",
    disabled: "rgba(0,0,0,0.20)",
  },
  accent: {
    orange: "#E8470A",
    orangeMuted: "rgba(232,71,10,0.08)",
    orangeGlow: "rgba(232,71,10,0.18)",
    blue: "#2563EB",
    purple: "#7C3AED",
    green: "#16A34A",
  },
  gradient: {
    purpleBlue: "linear-gradient(135deg, #3730A3 0%, #1D4ED8 50%, #1E40AF 100%)",
    orangeFade: "linear-gradient(135deg, rgba(232,71,10,0.08) 0%, transparent 60%)",
    meshLeft: "radial-gradient(ellipse at 20% 50%, rgba(109,40,217,0.08) 0%, transparent 60%)",
    meshRight: "radial-gradient(ellipse at 80% 50%, rgba(37,99,235,0.07) 0%, transparent 60%)",
  }
};

// ... (full component code — see artifact)
```

> For the full interactive React component, refer to the Claude artifact generated in this session.
