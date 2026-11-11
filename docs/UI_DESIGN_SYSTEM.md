# Speakwow UI foundations

The learning task is the visual centre: choose a course, resume a lesson and talk
with a familiar teacher. The redesign adapts Apple HIG principles to a responsive
web app; it is not a native Apple implementation or an accessibility certification.

## Foundation

- Typeface: system sans-serif, using the platform face on Apple devices; Chinese
  system fallbacks. Monospace is reserved for code, not navigation or lesson text.
- Type: body 17px, controls 15–16px, supporting labels 13–14px, section titles 22px,
  lesson titles 28–36px and page titles 32–44px. Sizes use rem or responsive clamps.
- Grid: 1120px maximum page width, 720px reading/form column, 560px lesson column.
  24px grid gutters, 20px phone page margins, 24–36px panel padding.
- Palette: deep forest canvas, jade-tinted surfaces, mint actions and cool white text.
  See the semantic color table below. Decorative teal is reserved for ambient light.
- Corners: 24px content panels, 32px lesson cards, capsule controls, 12–16px fields
  and menu items. Inner and outer shapes follow their padding.
- Aurora rises from the bottom at reduced intensity, using forest, logo green and teal (#0b6653 / #00d79a / #168e9f). The header has a stable dark
  backdrop and remains readable across motion and page scroll.

## Color roles

The live App currently uses dark appearance. `apps/web/styles/globals.css` owns
semantic CSS tokens. `app-config.ts` supplies the configurable primary color;
keep its dark default aligned with `--primary`. GPU effects need explicit sRGB
values in `app-backdrop.tsx` and `session-view.tsx`; install metadata and the social
card use the same canvas. Provider/teacher artwork retains its own identity.

| Role | Dark value | Use |
| --- | --- | --- |
| Canvas | `#0c1715` | Page, browser/install chrome |
| Card | `#172824` | Reading panels and course tiles |
| Popover | `#203630` | Menus above content |
| Secondary / hover | `#263e36` / `#304d42` | Quiet controls and focused menu rows |
| Foreground | `#f0f7f4` | Primary text |
| Muted foreground | `#adc2b9` | Descriptions, labels, metadata |
| Primary / on primary | `#52e0b0` / `#08251c` | Main action, selected filter, progress |
| Success | `#8bd5ac` | Correct answer with a checkmark or message |
| Warning | `#edc583` | Hint or retry with a text label |
| Destructive / on destructive | `#ffaaa3` / `#30120f` | Error feedback and destructive buttons |
| Info | `#79cfc9` | Supporting course illustration |

Glass uses the canvas hue, a white specular rim and existing edge refraction.
Interactive learning cards use 88% tint so their text remains legible over motion.
The Aurora stays below the content and is quieter on reading pages (16% versus
38% opacity). Avoid adding saturated fills to every control.

Use semantic classes (`text-success`, `bg-primary`, `text-muted-foreground`) instead
of isolated green/blue/rose utilities. Status always includes text or an icon;
primary green alone never indicates that an answer is correct. Increased contrast
raises muted text and borders; reduced transparency replaces glass with solid cards.

Computed sRGB contrast on opaque surfaces: body/card **14.15:1**, muted/card
**8.20:1**, muted/popover **6.86:1**, muted/focused menu **4.94:1**, primary button
label **9.79:1**, destructive button label **9.46:1**. These are token calculations,
not a blanket accessibility certification; inspect composited glass and animation
in the browser as well.

## Materials and navigation

The course capsule and lesson carousel retain the requested Liquid Glass effect.
Lesson glass uses an 88% forest tint and a restrained jade wash so descriptions
and progress remain readable. Catalog, Profile and forms use quieter solid surfaces.
Courses stays visible in the header. A single avatar menu holds Profile, Settings
and Sign out on both desktop and mobile. Guests see Sign in. Settings starts with
account identity and an editable display name; provider avatars fall back to initials. Home shows course context, then Unit, title,
introduction, session progress and the primary action. With Frank stays beneath
the moving card. Teacher descriptions appear only in the chooser.

Course browsing progresses from audience/category to CEFR or grade, then series
and syllabus. Filters remain URL-addressable. Profile groups learning and memory;
settings and authentication share the same form and panel styles.

## Interaction and accessibility

- Manual depth carousel, no looping or autoplay. Arrows, drag and keyboard access
  remain available; motion settles immediately with reduced motion.
- Unit cards measure natural content height instead of clipping descriptions.
- Shared buttons/toggles/selects and primary links have at least 44px targets;
  text inputs are at least 48px high with 16px text.
- Visible focus, a skip-to-content link, selected navigation, semantic progress,
  labels on controls and inert inactive slides preserve non-pointer access.
- Reduced transparency and increased contrast provide opaque glass backdrops.
- Error and status messages in authentication are announced.
- Classroom controls share typography and larger targets; live audio/video
  acceptance still requires configured LiveKit and model services.

## References

Reviewed 2026-11-11:
- [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

The HIG distinguishes the glass navigation/control layer from content. The web implementation adapts that hierarchy with standard CSS surfaces and
existing React Bits components. The user explicitly retains glass on the main
lesson card as a brand choice; it is not a literal copy of the native HIG material rules.
