/* Chuchvara daftari: Firebase bilan ishlash qatlami (kirish oynasi, baza, fayl yuklash) */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const gate = $("gate"), msg = $("gateMsg"), form = $("gateForm"), btn = $("g-btn");
  const never = new Promise(() => {});
  const PWA = window.DAFTAR_PWA = { email: "", logout() { firebase.auth().signOut().then(() => location.reload()); } };
  const block = text => { gate.hidden = false; gate.classList.add("nofields"); msg.textContent = text; };
  const cfg = window.FIREBASE_CONFIG;
  let ready = never, signedIn = false;

  if (typeof firebase === "undefined") block("Internet yo'q yoki kutubxona yuklanmadi. Internetga ulanib, dasturni qayta oching.");
  else if (!cfg || !cfg.apiKey || /SIZNING/i.test(cfg.apiKey)) block("config.js fayli to'ldirilmagan. ORNATISH.txt faylidagi 1-bo'limni bajaring.");
  else {
    firebase.initializeApp(cfg);
    const fs = firebase.firestore();
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    let note = ""; try { note = sessionStorage.getItem("gateMsg") || ""; sessionStorage.removeItem("gateMsg"); } catch (e) {}
    ready = new Promise(res => firebase.auth().onAuthStateChanged(u => {
      if (u) { PWA.email = u.email || ""; gate.hidden = true; if (signedIn) return; signedIn = true; res(fs); }
      else { gate.hidden = false; msg.textContent = note || "Daftarga kirish uchun email va parolni kiriting."; }
    }));
    form.addEventListener("submit", ev => {
      ev.preventDefault(); btn.disabled = true; msg.textContent = "Tekshirilmoqda…";
      firebase.auth().signInWithEmailAndPassword($("g-email").value.trim(), $("g-pass").value)
        .catch(e => { msg.textContent = e && e.code === "auth/network-request-failed" ? "Internet yo'q. Ulanib, qayta urinib ko'ring." : "Email yoki parol noto'g'ri."; })
        .then(() => { btn.disabled = false; });
    });
  }

  const denied = () => { try { sessionStorage.setItem("gateMsg", "Bu hisobga daftarga kirish ruxsati berilmagan. Boshqa hisob bilan kiring."); } catch (e) {} PWA.logout(); };
  const code = e => e && e.code === "permission-denied" ? "invalid_argument" : e && e.code === "resource-exhausted" ? "quota_exceeded" : "unavailable";
  const late = e => { if (e && e.code === "permission-denied") denied(); else if (window.toast) window.toast("Yozuv serverga yetmadi, internet bo'lganda qayta yuboriladi"); };
  /* Yozuvlar telefon xotirasiga darhol tushadi; serverga internet bo'lganda o'zi yuboriladi. */
  const wrap = fs => ({
    doc: p => { const r = fs.doc(p); return {
      get: () => r.get(),
      set: d => { r.set(d).catch(late); return Promise.resolve(); },
      update: d => { r.set(d, { merge: true }).catch(late); return Promise.resolve(); },
      delete: () => { r.delete().catch(late); return Promise.resolve(); } }; },
    collection: c => ({ onSnapshot: (next, err) => fs.collection(c).onSnapshot({ includeMetadataChanges: true }, next,
      e => { if (e && e.code === "permission-denied") denied(); else if (err) err({ code: code(e), message: String(e && e.message) }); }) })
  });
  const downloads = { save: async ({ filename, data }) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" })); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return { status: "saved" }; } };
  window.claude = { use: async name => name === "db" ? wrap(await ready) : name === "user" ? { can: async () => true } : name === "downloads" ? downloads : null };
})();
