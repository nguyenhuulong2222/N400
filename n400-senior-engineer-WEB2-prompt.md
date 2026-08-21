# TASK: Implement Phase WEB-2 — N-400 Case Status Helper in index.html

Working dir: /Volumes/Crucial1TB/N400/
File to edit: index.html ONLY. Do not touch data.json, mobile/, support.html, privacy.html.

Đọc skill `n400-senior-engineer` trước. Tôn trọng 7 invariants. STOP trước commit, KHÔNG push.

---

## QUYẾT ĐỊNH ĐÃ CHỐT (không hỏi lại)

1. **Endpoint chính:** `egov.uscis.gov/` — giữ nguyên `my.uscis.gov` ở 3 chỗ cũ (dòng ~2134, 2700, 2852), KHÔNG đổi.
2. **i18n:** English-first. Key mới chỉ có field `{ en: "..." }`. Các ngôn ngữ khác fallback `en` tự động (`updateUILanguage` skip khi `entry[useLang]==null` → giữ text English trong HTML). KHÔNG dịch 14 ngôn ngữ lúc này.
3. **Deep-link:** thêm `?screen=case-status` — allowlist ĐÚNG 1 giá trị bên trong IIFE `applyInitialLang` hiện có. KHÔNG viết router tổng quát.

---

## ĐIỂM CHÈN (đã audit, dùng đúng các anchor này)

**A. SCREEN MỚI:** chèn ngay TRƯỚC comment `<!-- SEO: Vietnamese-language search keywords` (sau khi đóng `</div>` của `#screen-policy-notice`). Tạo `<div id="screen-case-status" class="screen">` copy khuôn About/Privacy, dùng lại `.page-section` / `.page-section-emphasis` / `.page-section-summary` / `.page-back-btn` / `.page-title` / `.page-list` / `.btn-primary`. KHÔNG tạo class card mới ngoài input.

**B. FOOTER:** trong `<footer class="site-footer">` chèn ĐÚNG 1 link "Case Status" giữa Support và USCIS Policy Update:
```html
<a href="#" onclick="goCaseStatus(); return false;" data-i18n="footer.casestatus">Case Status</a>
```
(kèm 1 `<span class="footer-dot" aria-hidden="true">·</span>`)

**C. CSS:** chèn sau block `.page-list li { margin: 6px 0; }` — thêm `.cs-input` / `.cs-hint` / `.cs-msg` / `.cs-btn-full` + các biến thể `.cs-valid` / `.cs-invalid` / `.cs-warn`. Dùng `var(--navy)` / `var(--border)` / `var(--navy-light)`.

**D. JS NAV + LOGIC:** ngay sau hàm `goBack()` (dòng ~3830) thêm:
- `function goCaseStatus(){ showScreen('case-status'); scroll top; }`
- `const CS_RECEIPT_RE = /^[A-Z]{3}[0-9]{10}$/;`
- `const CS_KNOWN_PREFIXES = new Set(['EAC','WAC','LIN','SRC','NBC','MSC','IOE']);`
- PURE helper `csClassifyReceipt(raw)` → trả `{state:'empty'|'invalid'|'warn'|'valid'}`, KHÔNG echo lại số, KHÔNG side-effect (để mobile tái dùng).
- `csValidateReceipt(el)`: normalize uppercase + strip `[\s-]`, cập nhật class + message qua `t()`, KHÔNG lưu.
- `csOpenOfficial()`: `window.open('https://egov.uscis.gov/','_blank','noopener,noreferrer');` KHÔNG kèm receipt.

**E. TAB-BAR:** trong `showScreen()`, thêm `'case-status'` vào điều kiện ẩn tab-bar (cùng nhóm about/privacy/policy-notice).

**F. DEEP-LINK:** trong IIFE `applyInitialLang` (sau `updateUILanguage(initial)`), đọc `searchParams.get('screen')`; nếu `=== 'case-status'` thì `showScreen('case-status')`. Bọc try/catch. KHÔNG xử lý giá trị khác.

**G. i18n KEYS:** chèn ngay TRƯỚC comment `// ─── Footer: USCIS Policy Update link`. Thêm `footer.casestatus` + toàn bộ key `cs.*` (English-first).

---

## NỘI DUNG SCREEN (dùng đúng nguyên văn)

- **Title:** "N-400 Case Status Helper"
- **Intro:** "Use this helper to check whether your USCIS receipt number looks valid, then open the official USCIS Case Status Online page."
- **Input** label "USCIS Receipt Number", placeholder `IOE1234567890`, `autocapitalize=characters`, `maxlength=20`, `oninput="csValidateReceipt(this)"`.
- **Hint:** "A USCIS receipt number usually has 3 letters followed by 10 numbers, such as IOE1234567890."
- **Messages:**
  - invalid → "This does not look like a valid receipt number yet. It should be 3 letters followed by 10 numbers."
  - warn → "This format looks valid, but the prefix is not one of the common USCIS examples. Check your notice carefully."
  - valid → "This receipt number format looks valid. Open USCIS Case Status Online to check the official status."
- **Button:** "Open USCIS Case Status Online" + link "Learn how to check your case status" → `https://www.uscis.gov/tools/checking-your-case-status-online`
- **Card "Where to find your receipt number":** "Look for the receipt number on your USCIS receipt notice, such as Form I-797C, Notice of Action."
- **Card "What this helper does":** Checks the format only. / Helps you open the official USCIS case status page. / Does not retrieve, store, or submit your case information.
- **Card "What this helper does NOT do":** Does not check your case status inside this site. / Does not replace your USCIS online account. / Does not provide legal advice. / Does not store your receipt number.
- **Privacy note** (`.page-section-summary`): "Your receipt number is processed only in your browser for format checking. It is not saved, logged, or sent to FormN400.org."
- **Official resources** (page-list): `egov.uscis.gov/` · `uscis.gov/tools/checking-your-case-status-online` · `my.uscis.gov/` · `egov.uscis.gov/processing-times/`
- **Disclaimer** (`.page-section-emphasis`): "This is an independent study and navigation tool. It is not affiliated with USCIS or any government agency and does not provide legal advice."

---

## HARD RULES

Không scraper, không backend, không API USCIS, không analytics/ads.
Receipt CHỈ trong DOM memory: KHÔNG localStorage/sessionStorage, KHÔNG URL param, KHÔNG fetch/XHR, KHÔNG log.
Không USCIS logo/seal/DHS shield. Không claim legal advice. Không đổi câu hỏi/scoring. Không đụng mobile.

---

## TESTS phải chạy & báo cáo

```bash
grep -n "Case Status" index.html
grep -n "egov.uscis.gov" index.html
grep -nc "checking-your-case-status-online" index.html
grep -ni "storage.*receipt\|receipt.*storage" index.html   # phải rỗng
grep -ni "fetch(.*receipt\|XMLHttpRequest" index.html       # phải rỗng
grep -c 'goCaseStatus()' index.html                         # =2: 1 def + 1 link
```
- node lint: tách `<script>` block, `new vm.Script()` → syntax OK
- Xác nhận: 9 screens tồn tại, `QUESTIONS_2025` nguyên vẹn, footer link đúng 1, privacy/support screens không đổi.

---

## STOP

Sau khi báo cáo: files changed / feature behavior / privacy behavior / official links / regex / deep-link / tests.
KHÔNG commit, KHÔNG push tới khi Long duyệt diff.

---

## WEB-3 (chỉ chạy sau khi Long duyệt)

```bash
cd /Volumes/Crucial1TB/N400
git add index.html
git commit -m "feat(site): add N-400 case status helper"
# KHÔNG push tới khi Long bảo deploy
```
