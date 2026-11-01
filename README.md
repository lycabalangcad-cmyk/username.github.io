# AI-Smart Study (static website)

Open `index.html` in a browser to preview, or upload this whole folder to any static host.
No build step, database or server code is needed.

## Files
- `index.html, guide.html, prompt-builder.html, quiz.html, tools.html, checklist.html, about.html, 404.html`
- `css/style.css` - all styling
- `js/config.js` - the ONLY file to edit (GA4 Measurement ID, consent mode, optional contact email)
- `js/ga.js` - loads the GA4 tag once, respects the visitor's choice
- `js/main.js` - navigation, prompt builder, quiz, checklist, feedback, custom GA4 events
- `assets/` - favicon (SVG, created for this project) and the downloadable checklist PDF

## Before going live
1. Set `GA_MEASUREMENT_ID` in `js/config.js` only after you have created a real GA4 web data stream. While it is empty, nothing is sent to Google.
2. Choose `CONSENT_MODE`: "opt-in" (default) or "opt-out". If you use "opt-out", edit the privacy text in `about.html`.
3. Optionally set `CONTACT_EMAIL` to show the email feedback form.
4. Do not add a second GA tag to the pages; `ga.js` already loads it.

## Custom GA4 events
prompt_copied, quiz_started, quiz_completed, tool_link_click, checklist_download_click, feedback_submitted.
Enhanced measurement may also log its own file_download and click events; they are separate from these.

## Note
`about.html` says the site was created for a Social Media Analytics course; edit it to your own wording.
