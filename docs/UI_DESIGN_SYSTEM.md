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
- Palette: background #0d100e, content #1d211c, foreground #f3f5ef,
  secondary text #b7c0b2, action #7cff67, action label #162810.
- Corners: 24px content panels, 32px lesson cards, capsule controls, 12–16px fields
  and menu items. Inner and outer shapes follow their padding.
- Aurora rises from the bottom at reduced intensity, using forest green, the brand green and moss (#284432 / #7cff67 / #557847). The header has a stable dark
  backdrop and remains readable across motion and page scroll.

## Materials and navigation

The course capsule and lesson carousel retain the requested Liquid Glass effect.
Lesson glass uses an 88% dark tint and a restrained graphite wash so descriptions
and progress remain readable. Catalog, Profile and forms use quieter solid surfaces.
Courses and Profile remain in the header, with an active-page state; narrow screens
use the same entries in a menu. Home shows course context, then Unit, title,
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

Reviewed 2026-11-10:
- [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

The HIG distinguishes the glass navigation/control layer from content. The web implementation adapts that hierarchy with standard CSS surfaces and
existing React Bits components. The user explicitly retains glass on the main
lesson card as a brand choice; it is not a literal copy of the native HIG material rules.
