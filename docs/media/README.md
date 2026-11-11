# Product media

These are captures of the running web app, not UI mockups. The screenshots use
public course content and a guest session; they contain no email addresses,
private memories, API keys or learner transcripts.

| Asset | View |
| --- | --- |
| [Home](home.jpg) | Course capsule, lesson carousel, mint action and bottom Aurora |
| [Courses](courses.jpg) | Course categories and navigation |
| [Syllabus](syllabus.jpg) | A course series and its units |
| [User menu](user-menu.jpg) | Shared avatar menu in guest state; signed-in users see Sign out |
| [Practice cards](practice.jpg) | Real vocabulary and quiz components in `/playground`, using bundled sample data |
| [Mobile](mobile.jpg) | Home and navigation at the phone breakpoint |
| [Social card](social-card.png) | The App's generated 1200×630 sharing card |

Captured from the production build of the 2026-11-11 theme update, before deployment.
The practice capture is cropped to the two components; all other images show
the complete page or viewport. Course availability and a student's progress may differ from the captures.
The guest menu is shown deliberately; screenshots do not imply a real person's identity.

## Refreshing screenshots

1. Build and run the web app against a configured course database.
2. Use a guest or disposable demo account. Never publish a real learner's Profile,
   account details, keys, transcripts or memories.
3. Capture the real UI with the browser screenshot tool. Wait for fonts, data and
   entrance motion; use a production build so development overlays stay out.
4. Verify desktop and phone layouts. Save JPEGs under the filenames above and
   update both README galleries. Do not paint over controls or invent progress.
5. Save `/opengraph-image` as `social-card.png`; confirm 1200×630 output.

Reusable logos and app icons are indexed in the [brand guide](../BRAND.md).
The vector master is [`assets/brand/symbol.svg`](../../assets/brand/symbol.svg).
Keep the original brand artwork separate from product screenshots, and retain
third-party attribution when reusing teaching cards or animated stickers.
