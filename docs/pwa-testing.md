# PWA and phone testing

Use the current hosted preview or the local HTTPS instructions below. The first
phone tests used a temporary Cloudflare tunnel; current hosted previews use Vercel.

## Testing the latest hosted preview

A Vercel deployment URL with a random identifier points to that particular build.
A Home Screen app installed from it stays on that hostname: opening a different
preview URL in Safari does not update the existing installation. For repeated
phone testing, install from the stable branch preview URL, which follows the latest
successful deployment of that branch. See [Vercel's generated URLs](https://vercel.com/docs/deployments/generated-urls).

Open the current preview link in Safari first and verify the change. If the
installation uses an older deployment URL, add the current preview to the Home
Screen. You do not need to delete the old installation just to test the new URL.
Keep an old installation with an unresolved transaction until its receipt is
reconciled: pending receipts are stored per origin and do not follow a new hostname.

On the same hostname, close every app window and browser tab, then reopen to let
a waiting service-worker update activate. Reinstallation is not normally needed.
Protected previews may also require a refreshed Vercel share link when access
expires; that is separate from updating the app.

## What the build includes

- A stable `/` manifest ID/start URL, standalone display, black theme/background,
  192/512px icons, a padded maskable icon, and an Apple touch icon/title.
- A production-only service worker. It precaches versioned public build assets;
  it never runtime-caches RPC, Phoenix, Privy, balances, quotes or transactions.
- Online navigation always requests the current HTML. Failed navigations to app
  routes show a separate offline landing page, never cached account values.
  An already-open app labels loss of connectivity and blocks reviews/signing.
- Updates wait until **all old app tabs/windows close**. There is no forced
  activation or automatic reload during signing, confirmation or reconciliation.
  An update notice explains when to close/reopen. Transaction recovery remains in
  the existing per-origin journal.

This implementation does not prove physical iPhone/Android installation, wallet
recovery, or funded execution on those devices. A PWA is still a web app; live
trading requires connectivity.

## Review layout follow-up, 2 November

The creator chose to restore the original viewport-based handoff after trying
portrait guidance. The manifest has no orientation preference: viewports wider
than 767px show the desktop/QR handoff, including a phone turned sideways.

Transaction reviews now use the shared sheet's separate action footer. Details
scroll above the approval/refresh button, which has bottom clearance in addition
to the sheet's safe-area allowance. The Market/Limit option cards share equal
grid row heights without truncating their descriptions.

A local display fixture with sample review data checked
the complete 49px button at 320 × 568, 390 × 667, 390 × 844 and 430 × 932, including
a simulated 34px bottom safe area. Both option cards measured equal heights at
320, 390 and 430px widths. These are browser checks, not physical iPhone
keyboard or wallet-signing proof. Recheck after closing and reopening the updated
home-screen app; no transaction is needed to test the order-type cards.

## iPhone layout follow-up, 30 October

The creator's installed-app screenshots showed a bottom navigation gap and page
zoom when opening Home search. The search-specific CSS reduced the input to 13px;
it now uses 16px without restricting pinch zoom. The app shell uses `100vh` only
in standalone display mode, following the workaround in
[WebKit issue 254868](https://bugs.webkit.org/show_bug.cgi?id=254868), and retains
`100dvh` in an ordinary browser. Existing safe-area padding is retained inside the
shell, so controls stay above the home indicator.

A local browser fixture simulated a 47px standalone viewport discrepancy with
47px/34px safe areas. The previous build left a 47px gap; the updated build placed
the navigation edge at the viewport bottom. Search was checked at 390px and 320px
wide, including a 390px-high viewport, with 16px input text and no horizontal
overflow. This is a layout rehearsal, not proof of physical iOS keyboard behavior.
Recheck both on the phone after closing all app windows and reopening the update.

The next visual pass uses `max(12px, safe-area-inset-bottom)` for the navbar,
instead of adding 21px to the device inset, and tightens the icon/label row. In the
same standalone fixture, the bottom allowance is 34px and the outer edge remains
at the viewport bottom at 390px and 320px widths, with no horizontal overflow.
The Home wave floor now fades at both horizontal edges while the logo continues
to float independently.

Sheets now support downward pointer drags from a 44px grip area. A downward drag
of at least 72px dismisses through the existing close callback; short, upward,
mostly horizontal, interrupted gestures and list scrolling do not dismiss.
Transaction reviews retain their existing busy-state dismissal guard. Browser
checks verified the market picker opens, snaps back, closes by dragging, scrolls
its list independently, and still closes through the X control. Eight focused
gesture tests, the full 277-test suite and the production build pass. Physical
iPhone touch behavior and the creator's preferred navbar spacing still need the
next on-device check.

Privy login received a separate scroll-containment fix. In SDK 3.51, the panel
is sticky inside a fixed `overflow-y: auto` viewport; both that viewport and the
document previously used the default overscroll behavior. The app now applies
`overscroll-behavior: none` to that viewport and to the document while a Privy
dialog is present on mobile. It retains Privy's overflow and positioning so
focused fields can still move into view when the keyboard opens. The selector
uses the observed `#privy-dialog-backdrop` sibling, not generated class names;
recheck that structure when upgrading Privy.

The real login modal was checked in a local browser at 390px wide with 667px and
390px available heights. The email field stayed visible, the overlay retained
`overflow-y: auto`, and the close control returned to Home. The build and six
focused provider/PWA tests passed. No credentials were submitted. This does not
reproduce native iPhone rubber-banding or its keyboard; recheck those on-device.
See [CSS overscroll behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior-y)
for the difference between suppressing boundary bounce and disabling scrolling.

## Navigation motion follow-up, 1 November

The creator reported icon jitter while the floating dock contracted and expanded.
The previous animation resized the grid that centered the icons on every frame.
The dock now keeps its layout and button dimensions fixed, translates the buttons,
and resizes the glass separately. The selection capsule also has a fixed movement
anchor, so a tab change can interrupt expansion without changing its coordinate
basis. Scroll thresholds and immediate navigation are unchanged.

A local browser fixture using the actual navigation component and scroll hook
checked collapse, expansion, direction reversal and a tab change during motion.
Frame samples kept all icons at 27px and buttons at 44px high. At 320, 390, 430 and
480px viewport widths, touch targets remained at least 44px, did not overlap, and
the selected capsule stayed centered. The four navigation tests and production
build passed. Recheck perceived smoothness in the installed iPhone app; these
browser measurements do not reproduce the physical device's rendering load.

Swipes starting on the floating dock are now contained to the dock, including
its glass background and buttons in either size. `touch-action: pinch-zoom`
disables panning there, with a scoped non-passive `touchmove` listener to cancel
single-finger document dragging. Page scrolling, taps and pinch zoom remain
available. Seven navigation tests and the production build pass. On the phone,
drag downward starting on both a dock icon and the glass between icons: the
screen should stay in place without revealing empty space below it.

## Startup appearance follow-up, 30 October

The initial React fallback showed plain loading text before the lazy app CSS
arrived. The HTML had no background styles, so cold starts could briefly use the
browser's light canvas despite the black PWA manifest. Critical dark colors and
the centered startup layout now live directly in `index.html`. Static startup
markup covers the time before JavaScript, and `StartupScreen` provides the same
view while React waits for the app. The startup view uses the existing transparent
bracket mark and system font without an app stylesheet dependency. The two halves
gently settle together while a masked highlight passes across the original art;
there is no surrounding icon tile. A small spinner sits below the wordmark in
place of the visible loading caption, as requested in the next visual pass.
The 2.8-second logo loop animates only transforms and opacity. Reduced motion
leaves a static mark and indicator, with an accessible loading status. There is
no minimum display time or artificial delay before Home appears.

An isolated browser check held back the real production scripts and then the
main app chunk/CSS. The previous app-loading frame had no background or dark
color scheme. Both updated stages filled a 390-by-667 viewport with black,
centered branding and no overflow; releasing the requests removed the loading
view and displayed Home. Five PWA tests, formatting and the production build
passed. The same tunnel serves the updated build. Recheck the installed iPhone
launch after closing all old app windows; the browser check does not reproduce
iOS's own launch snapshot.

The animation pass was checked at 320, 375, 768 and 1280px widths without overflow.
Observed transforms changed between samples, including in the pre-JavaScript
phase. A local fixture exercised the reduced-motion CSS branch (without changing
the host OS preference): both halves and highlights reported no running animation.
Releasing the held assets removed the startup view and displayed Home. The updated
production build and formatting checks passed; physical iPhone motion remains a
device check.

## Start the temporary HTTPS URL

In one terminal at the project root:

```sh
npm run build
npm run preview
```

In a second terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:4173 --http-host-header localhost:4173
```

The forwarded Host header lets Vite accept its usual localhost host without
disabling its host checks. The browser's origin remains the HTTPS tunnel URL.
Add the generated HTTPS origin to `RPC_ALLOWED_ORIGINS` in `.env.local` (alongside
local origins you still use), then restart the preview. Do this for each new tunnel
URL. The browser must authenticate to the relay from an explicitly allowed origin.

Use the **production preview**, not the development server, for installation.
Keep the Mac awake and both processes running. If port 4173 is already serving
this checkout, use that process instead of starting another preview.
Finish any transaction and close test tabs before rebuilding. Replacing `dist`
while an older page is still loading can invalidate its lazy-loaded asset URLs;
the wallet recovery screen offers a reload in that case. A fresh navigation uses
the completed build.

The generated `trycloudflare.com` URL is temporary and accessible to anyone who
has it. Restarting the tunnel usually creates a new URL. Existing home-screen
installs and browser sessions stay tied to the old origin; install the new URL
again. This is appropriate for a short test, not a permanent app address.

## Domain configuration

These controls restrict sites that can use a provider; they do not make the app
private. Privy's public app configuration exposes `allowed_domains`. If empty,
there is no configured domain allowlist; verify the login UI at the new origin.
If restricted, add the exact HTTPS origin before using it. The app relay has its
own exact `RPC_ALLOWED_ORIGINS` list and always needs the tunnel origin. Helius
now receives server requests, so verify its key policy permits that transport;
do not disable existing restrictions just to get a test working. OAuth redirect settings
may require additional setup when enabling a new login method.

On 29 October, read-only checks found the configured Privy app's domain list empty.
The actual tunnel-origin RPC/config results are recorded in verification notes.
No provider dashboard configuration was changed.

## Phone acceptance

1. Open the HTTPS URL directly, without `?preview=mobile`. The desktop page offers
   a QR code containing the same public URL. On the phone, verify layout and login.
2. iPhone: Safari → Share → Add to Home Screen → enable **Open as Web App** if
   offered → Add. Android: Chrome menu → **Install app** / **Add to Home screen**.
3. Launch the home-screen icon. Check its name/icon, standalone appearance, safe
   areas, scrolling, keyboard behavior and funding/review sheet widths.
4. Sign in with the **same login method and account** as the desktop test. Check
   the full app-wallet address in Account against the desktop before moving funds.
   A new browser origin/device may require logging in again.
5. Reload and reopen. Verify wallet continuity and fresh balances. Then perform
   a deliberately small, user-controlled trade/cancel or funding round trip.
6. While no transaction is being signed, try airplane mode: the open app must
   say it is offline; reopening should show the reconnect page. Restore network,
   retry and check fresh data before proceeding.
7. If a transaction was interrupted, let the saved receipt reconcile before
   retrying. Do not clear storage or change the tunnel URL with unresolved actions.
8. Rebuild with a visible change, return to the installed app, and verify the
   update notice. Finish pending actions, close all app windows/tabs, and reopen.

References: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/),
[installable PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
[Helius access controls](https://www.helius.dev/docs/api-reference/authentication).
