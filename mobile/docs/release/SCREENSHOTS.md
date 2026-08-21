# Screenshots — required sizes and capture procedure

`app.json` sets `ios.supportsTablet: true`, so **iPad screenshots are
mandatory**. Turning tablet support off would remove that requirement, but it
would also drop iPad from the store listing — decide before you capture.

---

## 1. Required sizes

Apple accepts one iPhone set and one iPad set; larger displays are
down-scaled to the smaller ones automatically. Upload these:

| Display class | Portrait pixels | Simulator to use | Required |
|---|---|---|---|
| **6.9" iPhone** | 1290 × 2796 | iPhone 17 Pro Max | **Yes** |
| **6.5" iPhone** | 1242 × 2688 or 1284 × 2778 | *(see note)* | Only if ASC still asks |
| **13" iPad** | 2064 × 2752 | iPad Pro 13-inch (M5) | **Yes** — `supportsTablet: true` |

Minimum 3 screenshots per size, maximum 10. Ship 5.

> **Note on 6.5":** current App Store Connect derives 6.5" from the 6.9"
> upload for new submissions. If your ASC version still shows a separate
> 6.5" slot, no installed simulator matches it exactly — install
> "iPhone 11 Pro Max" (1242 × 2688) via Xcode → Settings → Components, or
> resize the 6.9" captures with:
> `magick in.png -resize 1242x2688! out.png`

Available simulators on this machine, confirmed:

```
iPhone 17 Pro       E6774A1F-B2A9-49C8-B1ED-6049E47AFADD   (1206 × 2622 — NOT a store size)
iPhone 17 Pro Max   B222C62B-52BC-49C2-BE31-A74A8C5FAE42   (1290 × 2796 — 6.9")
iPad Pro 13-inch    F6F57F92-A257-4318-BB75-2323EBAB2D22   (2064 × 2752 — 13")
```

Capture on **17 Pro Max** and **iPad Pro 13-inch**. Do not use iPhone 17 Pro
— its 1206 × 2622 output matches no store slot.

---

## 2. What to capture, in order

The same five screens for both device classes. Order matters — slot 1 is the
one most people see.

| # | Screen | How to get there | Why this one |
|---|---|---|---|
| 1 | **Quiz, Vietnamese** | Onboard → route `2025`, language `Tiếng Việt`, state Skip → Start Practice | The differentiator. Shows bilingual rendering: Vietnamese large, English underneath, on both the prompt and all four options. |
| 2 | **Onboard, language grid scrolled to the pills** | Launch, scroll down | Proves "14 languages" instead of claiming it. |
| 3 | **Quiz answered, correct** | From #1, tap the correct option | Shows the green correct state, "Correct.", the Next button, and the "Hear the answer" control. |
| 4 | **Study Card** | Play until a yellow card appears, or pick route `2025` and continue — one lands within the first few cards | Explains the officeholder policy visually and preempts "why is there no answer". |
| 5 | **About** | Tap the About tab | Both legal notices, the read-aloud explanation, the reminder toggle. Reviewer-friendly. |

For the iPad set, capture the same five. The onboard state grid and About
screen reflow noticeably at tablet width — check both look deliberate.

**Do not capture:** the Expo Go dev-menu gear overlay. It appears in
development builds and must not reach the store. Capture from a **release
build**, or dismiss the gear first.

---

## 3. Capture commands

### Boot and run

```bash
cd /Volumes/Crucial1TB/N400/mobile

# 6.9" iPhone
xcrun simctl boot B222C62B-52BC-49C2-BE31-A74A8C5FAE42
open -a Simulator
npx expo start --ios
```

If the app opens on the wrong simulator, force it:

```bash
xcrun simctl openurl B222C62B-52BC-49C2-BE31-A74A8C5FAE42 "exp://127.0.0.1:8081"
```

### Capture one screenshot

```bash
mkdir -p /Volumes/Crucial1TB/N400/mobile/docs/release/screenshots/6.9
xcrun simctl io B222C62B-52BC-49C2-BE31-A74A8C5FAE42 screenshot \
  /Volumes/Crucial1TB/N400/mobile/docs/release/screenshots/6.9/01-quiz-vi.png
```

Repeat per screen, naming them `01-…` through `05-…` so upload order is
obvious.

### iPad

```bash
xcrun simctl boot F6F57F92-A257-4318-BB75-2323EBAB2D22
xcrun simctl openurl F6F57F92-A257-4318-BB75-2323EBAB2D22 "exp://127.0.0.1:8081"
mkdir -p /Volumes/Crucial1TB/N400/mobile/docs/release/screenshots/ipad13
xcrun simctl io F6F57F92-A257-4318-BB75-2323EBAB2D22 screenshot \
  /Volumes/Crucial1TB/N400/mobile/docs/release/screenshots/ipad13/01-quiz-vi.png
```

### Verify every capture is the exact required size

```bash
for f in /Volumes/Crucial1TB/N400/mobile/docs/release/screenshots/*/*.png; do
  printf "%-70s " "$f"
  sips -g pixelWidth -g pixelHeight "$f" | tail -2 | tr -d '\n' | tr -s ' '
  echo
done
```

Expect `1290 × 2796` for the 6.9 folder and `2064 × 2752` for ipad13. **Any
other value will be rejected at upload.** If a capture is off, the simulator
booted at a scaled window size — reset with Device → Restore, or use
`magick in.png -resize 1290x2796! out.png` as a last resort (it will look
slightly soft).

### Tidy up

```bash
xcrun simctl shutdown all
```

---

## 4. Rules Apple enforces

- **No device frames, no drop shadows, no marketing text overlays** unless
  you commit to that treatment across the whole set. Plain captures are
  safest for a first submission.
- **No status-bar oddities.** The simulator's default status bar is fine.
  If you want a clean one:
  `xcrun simctl status_bar <UDID> override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`
- **The screenshots must show the actual app.** No mockups, no concept art.
- **No placeholder or lorem content.** Every capture must be a real question
  from the real bank.
- **Alpha channel must be absent.** `xcrun simctl io … screenshot` already
  produces opaque PNGs; confirm with `sips -g hasAlpha`.

---

## 5. Checklist

- [ ] 5 captures at 1290 × 2796 (6.9")
- [ ] 5 captures at 2064 × 2752 (13" iPad)
- [ ] 6.5" set, only if your ASC version still asks for it
- [ ] No dev-menu gear visible in any capture
- [ ] Every file verified with `sips` at the exact pixel size
- [ ] Screenshot 1 is the Vietnamese quiz screen for both device classes
- [ ] Uploaded in order 01 → 05
