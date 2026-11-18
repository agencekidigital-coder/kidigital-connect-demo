const path = require("node:path");
const BASE_URL = process.env.BASE_URL || "http://localhost:4177";
const artifacts = process.env.ARTIFACT_DIR || path.resolve("work/verification");
require("node:fs").mkdirSync(artifacts, { recursive: true });
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Europe/Paris",
    }),
    p = await c.newPage();
  p.setDefaultTimeout(20000);
  p.setDefaultNavigationTimeout(30000);
  let errors = [],
    googleCalls = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (/fonts\.googleapis|fonts\.gstatic/.test(r.url()))
      googleCalls.push(r.url());
  });
  await p.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const nav = (id) => p.locator(`#sidebar .navbtn[data-nav="${id}"]`).click();
  await nav("familles");
  await p.locator('[data-v9="edit-family"][data-id="f1"]').click();
  await p.locator('#v9FamilyForm [name="name"]').fill("Emma Test Modifiée");
  await p.locator('#v9FamilyForm [name="phone"]').fill("0612345678");
  await p.locator('#v9FamilyForm button[type="submit"]').click();
  assert(
    await p
      .locator(".v9-family-grid")
      .innerText()
      .then((t) => t.includes("Emma Test Modifiée")),
  );
  await p.reload();
  assert(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kidigital-connect-v1")).family[0]
          .name === "Emma Test Modifiée",
    ),
  );
  await nav("rendezvous");
  await p.locator('[data-v9="weekdays"]').click();
  assert.equal(
    await p.locator('#v8Availability [name="days"]:checked').count(),
    5,
  );
  await p.locator('#v8Availability button[type="submit"]').click();
  assert.equal(await p.locator(".v8-rule-list>div").count(), 5);
  await nav("personnaliser");
  await p.locator('[data-v8="profile-tab"][data-value="reseaux"]').click();
  await p.locator('#v8Social [name="instagram"]').fill("https://www.instagram.com/example");
  await p.locator('#v8Social [name="facebook"]').fill("https://www.facebook.com/example");
  await p.locator('#v8Social [name="whatsapp"]').fill("+33612345678");
  await p.locator('#v8Social button').click();
  await p.locator('[data-mode="parent"]:visible').first().click();
  assert.equal(await p.locator(".v9-event-photo .tag").count(), 3);
  assert(await p.locator(".v9-profile-location").isVisible());
  assert.equal(
    await p.locator(".v9-social-icons>span,.v9-social-icons>a").count(),
    3,
  );
  assert(
    await p
      .locator(".v8-parent")
      .innerText()
      .then((t) => t.includes("Voir les accompagnements individuels")),
  );
  await p.locator('[data-v8="book-appointment"]').first().click();
  assert(await p.locator(".v9-booking-calendar").isVisible());
  assert(
    (await p
      .locator('.v9-month button[aria-pressed="true"]:enabled')
      .count()) === 1,
  );
  await p.locator('[data-v8="choose-slot"]').first().click();
  await p
    .locator('#v8BookAppointment [name="name"]')
    .fill("Parent Démonstration");
  await p
    .locator('#v8BookAppointment [name="email"]')
    .fill("parent@example.test");
  await p.locator('#v8BookAppointment [name="consent"]').check();
  await p.locator(".modalbody").evaluate((n) => (n.scrollTop = n.scrollHeight));
  let bounds = await p
    .locator(".modal")
    .evaluate((n) => ({
      rect: n.getBoundingClientRect().bottom,
      height: innerHeight,
    }));
  assert(bounds.rect <= bounds.height);
  await p.screenshot({ path: path.join(artifacts, "v9-booking-desktop.png") });
  await p.locator('#v8BookAppointment button[type="submit"]').click();
  assert(
    await p
      .locator(".modal")
      .innerText()
      .then((t) => t.includes("réservé")),
  );
  await p.locator('[data-action="close-modal"]').click();
  await p.locator('[data-mode="pro"]:visible').first().click();
  await nav("communication");
  const draft = await p.locator("#marketingEditor").inputValue();
  assert(
    draft.indexOf("Les bienfaits de cet atelier") >
      draft.indexOf("Au programme"),
  );
  assert(
    draft.indexOf("Les bienfaits de cet atelier") <
      draft.indexOf("Envie de nous rejoindre"),
  );
  assert.equal(draft.match(/Au programme/g).length, 1);
  await p.locator('[data-v9="prepare-email"]').click();
  let recipients = await p.locator('#v9EmailForm [name="recipients"]').count();
  assert.equal(recipients, 5);
  await p.locator('#v9EmailForm button[value="eml"]').click();
  await p.locator('[data-action="close-modal"]').click();
  await p.locator('[data-v8="comm-tab"][data-value="studio"]').click();
  assert.equal(
    await p.locator('.v8-photo-picker img[src^="data:image/svg"]').count(),
    0,
  );
  assert(
    await p
      .locator("#v8DesignStage")
      .innerText()
      .then((t) => !t.includes("GRANDIR, BIEN ENTOURÉS")),
  );
  // Select a text using its keyboard-accessible object, then edit it in place.
  let text = p
    .locator("[data-design-layer]")
    .filter({ has: p.locator(".v9-inline-text") })
    .first();
  await text.focus();
  await p.keyboard.press("Enter");
  const inline = p.locator('.v9-inline-text[contenteditable="plaintext-only"]');
  await inline.fill("Mon texte direct sur le visuel");
  await p.keyboard.press("Escape");
  assert(
    await p
      .locator("#v8DesignStage")
      .innerText()
      .then((t) => t.includes("Mon texte direct sur le visuel")),
  );
  await p.locator('[data-v9="add-photo"]').nth(1).click();
  let image = p
    .locator("[data-design-layer].selected")
    .filter({ has: p.locator("img") });
  await image.waitFor({ state: "visible" });
  assert(await image.isVisible());
  let old = await image.getAttribute("style");
  let handle = image.locator("[data-v9-resize]");
  await handle.scrollIntoViewIfNeeded();
  let r = await handle.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  await p.mouse.move(r.x + r.width / 2 + 40, r.y + r.height / 2 + 50, {
    steps: 5,
  });
  await p.mouse.up();
  image = p.locator("[data-design-layer].selected");
  assert.notEqual(await image.getAttribute("style"), old);
  let count = await p.locator("[data-design-layer]").count();
  await image.focus();
  await p.keyboard.press(" ");
  assert.equal(await p.locator("[data-design-layer]").count(), count - 1);
  await p.locator('[data-v10="undo"]').click();
  assert.equal(await p.locator("[data-design-layer]").count(), count);
  await p
    .locator("#v9ImageUpload")
    .setInputFiles([
      path.resolve(__dirname, "../assets/photos/family-5.jpg"),
      path.resolve(__dirname, "../assets/photos/family-7.jpg"),
    ]);
  await p.waitForFunction(
    () => document.querySelectorAll("[data-design-layer] img").length >= 4,
  );
  // Choose a catalog font and confirm same-origin font delivery.
  await p.locator('[data-v8="design-add-text"]').click();
  await p.locator('[data-v10="font-picker"][data-target="layer"]').click();
  await p.locator("#v10FontQuery").fill("Montserrat");
  await p.locator('[data-v10="font-select"][data-family="Montserrat"]').click();
  await p.locator(".v10-font-modal").waitFor({ state: "detached" });
  await p.waitForFunction(
    () =>
      [...document.fonts].some(
        (f) => f.family === "Montserrat" && f.status === "loaded",
      ) &&
      document
        .querySelector("[data-design-layer].selected")
        ?.style.fontFamily.includes("Montserrat"),
  );
  assert(
    await p
      .locator("[data-design-layer].selected")
      .getAttribute("style")
      .then((s) => s.includes("Montserrat")),
  );
  assert.equal(googleCalls.length, 0);
  const dl = p.waitForEvent("download");
  await p.locator('[data-v8="design-export"]').click();
  await (await dl).saveAs(path.join(artifacts, "v9-export.png"));
  await p.locator('[data-v9="publication-preview"]').click();
  await p.locator(".v9-publication-preview>img").waitFor({ state: "visible" });
  assert(await p.locator(".v9-publication-preview>img").isVisible());
  assert(
    await p
      .locator("#v9PublicationText")
      .inputValue()
      .then((t) => t.includes("bienfaits")),
  );
  await p.locator('[data-v9="save-publication"]').click();
  assert(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kidigital-connect-v1")).v9
          .publicationDrafts.length === 1,
    ),
  );
  await p.screenshot({ path: path.join(artifacts, "v9-publication.png") });
  console.log({
    familyEdit: true,
    multipleWeekdays: true,
    monthlyFirstAvailable: true,
    readableBooking: true,
    benefitsOrder: true,
    consentingEmailRecipients: recipients,
    inlineEditing: true,
    imageResize: true,
    spaceDeleteUndo: true,
    multiplePhotos: true,
    fontCatalog: true,
    noDirectGoogleCalls: googleCalls.length,
    publicationPreview: true,
    errors,
  });
  assert.equal(errors.length, 0);
  await b.close();
})();
