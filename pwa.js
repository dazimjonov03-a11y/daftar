/* Chuchvara daftari: Firebase qatlami (kirish, xodimlar ruxsati, baza, fayl yuklash) */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const gate = $("gate"), msg = $("gateMsg"), form = $("gateForm"), btn = $("g-btn");
  const never = new Promise(() => {});
  const cfg = window.FIREBASE_CONFIG;
  const TYPES = { sales: ["d", "p", "r"], prod: ["m"], stock: ["b", "u"], exp: ["x"], wages: ["w", "v"] };
  const REFS = { shops: "sales", materials: "stock", workers: "wages" };
  const PWA = window.DAFTAR_PWA = { email: "", name: "", owner: false, perms: [], users: [],
    logout() { firebase.auth().signOut().then(() => { try { history.replaceState(null, "", location.pathname); } catch (e) {} location.reload(); }); } };
  const block = text => { gate.hidden = false; gate.classList.add("nofields"); msg.textContent = text; };
  const kick = text => { try { sessionStorage.setItem("gateMsg", text); } catch (e) {} PWA.logout(); };
  const denied = () => kick("Bu hisobga daftarga kirish ruxsati berilmagan. Rahbardan ruxsat so'rang.");
  const rerender = () => { if (typeof window.render === "function") window.render(); };
  let ready = never, fs = null, started = false;

  if (typeof firebase === "undefined") block("Internet yo'q yoki kutubxona yuklanmadi. Internetga ulanib, dasturni qayta oching.");
  else if (!cfg || !cfg.apiKey || /SIZNING/i.test(cfg.apiKey)) block("config.js fayli to'ldirilmagan.");
  else {
    firebase.initializeApp(cfg);
    fs = firebase.firestore();
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    const staffMail = login => login + "@" + cfg.authDomain;
    let note = ""; try { note = sessionStorage.getItem("gateMsg") || ""; sessionStorage.removeItem("gateMsg"); } catch (e) {}

    ready = new Promise(res => firebase.auth().onAuthStateChanged(async u => {
      if (!u) { gate.hidden = false; msg.textContent = note || "Login va PIN-kodni kiriting."; return; }
      if (started) return; started = true;
      PWA.email = u.email || "";
      PWA.owner = !PWA.email.endsWith("@" + cfg.authDomain);
      if (PWA.owner) {
        PWA.perms = null; PWA.name = PWA.email;
        fs.collection("users").onSnapshot(s => { PWA.users = s.docs.map(d => Object.assign({ uid: d.id }, d.data())); rerender(); }, () => {});
      } else {
        let first = true, sig = "";
        const ok = await new Promise(done => fs.collection("users").doc(u.uid).onSnapshot(d => {
          if (!d.exists) { if (first) { first = false; done(false); } else denied(); return; }
          const x = d.data(), s = JSON.stringify(x.perms || []);
          if (first) { first = false; sig = s; PWA.perms = x.perms || []; PWA.name = x.name || x.login || ""; done(true); }
          else if (s !== sig) location.reload();
        }, () => { if (first) { first = false; done(false); } }));
        if (!ok) return denied();
      }
      gate.hidden = true; res(fs);
    }));

    form.addEventListener("submit", ev => {
      ev.preventDefault(); btn.disabled = true; msg.textContent = "Tekshirilmoqda…";
      const id = $("g-email").value.trim().toLowerCase();
      firebase.auth().signInWithEmailAndPassword(id.includes("@") ? id : staffMail(id), $("g-pass").value)
        .catch(e => { msg.textContent = e && e.code === "auth/network-request-failed" ? "Internet yo'q. Ulanib, qayta urinib ko'ring."
          : e && e.code === "auth/too-many-requests" ? "Juda ko'p urinish bo'ldi. Bir necha daqiqadan keyin qayta urinib ko'ring." : "Login yoki PIN noto'g'ri."; })
        .then(() => { btn.disabled = false; });
    });

    /* Rahbar xodim qo'shadi: hisob alohida ulanish orqali ochiladi, rahbarning o'zi hisobdan chiqmaydi. */
    PWA.saveUser = async o => {
      let uid = o.uid;
      if (!uid) {
        const sec = firebase.apps.find(a => a.name === "xodim") || firebase.initializeApp(cfg, "xodim");
        try { uid = (await sec.auth().createUserWithEmailAndPassword(staffMail(o.login), o.pin)).user.uid; }
        catch (e) {
          if (e && e.code === "auth/email-already-in-use") throw "Bu login band. Boshqa login tanlang.";
          if (e && e.code === "auth/weak-password") throw "PIN juda oddiy. Kamida 6 ta raqam kiriting.";
          if (e && e.code === "auth/network-request-failed") throw "Xodim qo'shish uchun internet kerak.";
          throw "Xodimni qo'shib bo'lmadi. Qayta urinib ko'ring.";
        }
        sec.auth().signOut().catch(() => {});
      }
      const data = { name: o.name, perms: o.perms };
      if (o.login) data.login = o.login;
      await fs.collection("users").doc(uid).set(data, { merge: true });
    };
    PWA.removeUser = uid => fs.collection("users").doc(uid).delete();
  }

  const code = e => e && e.code === "permission-denied" ? "invalid_argument" : e && e.code === "resource-exhausted" ? "quota_exceeded" : "unavailable";
  const late = e => { if (e && e.code === "permission-denied") { if (window.toast) window.toast("Bu yozuvga ruxsat yo'q, saqlanmadi"); } else if (window.toast) window.toast("Yozuv serverga yetmadi, internet bo'lganda qayta yuboriladi"); };
  const stamp = (p, d) => p.startsWith("j/") ? Object.assign({ t: p.split("/")[1].split("_")[1] }, d) : d;
  const fixed = new Set();

  /* Xodim faqat ruxsat berilgan qismlarni o'qiydi: har bir qism alohida so'rov bilan olinadi. */
  function partial(sources, next) {
    const got = sources.map(() => null);
    sources.forEach((src, i) => {
      const put = (docs, cache) => { got[i] = { docs, cache }; if (got.every(Boolean)) next({ docs: [].concat(...got.map(g => g.docs)), metadata: { fromCache: got.some(g => g.cache) } }); };
      src.onSnapshot({ includeMetadataChanges: true },
        s => put(s.docs ? s.docs : s.exists ? [s] : [], s.metadata.fromCache),
        e => { console.error("daftar:", e && e.code, e && e.message); put([], false); });
    });
  }
  const has = p => PWA.perms && PWA.perms.includes(p);
  const wrap = () => ({
    doc: p => { const r = fs.doc(p); return {
      get: () => r.get(),
      set: d => { r.set(stamp(p, d), { merge: true }).catch(late); return Promise.resolve(); },
      update: d => { r.set(stamp(p, d), { merge: true }).catch(late); return Promise.resolve(); },
      delete: () => { r.delete().catch(late); return Promise.resolve(); } }; },
    collection: c => ({ onSnapshot: (next, err) => {
      if (PWA.owner) return fs.collection(c).onSnapshot({ includeMetadataChanges: true }, s => {
        if (c === "j") for (const d of s.docs) if (!d.data().t && !fixed.has(d.id)) { fixed.add(d.id); fs.doc("j/" + d.id).set({ t: d.id.split("_")[1] }, { merge: true }).catch(() => {}); }
        next(s);
      }, e => { if (e && e.code === "permission-denied") denied(); else if (err) err({ code: code(e), message: String(e && e.message) }); });
      if (c === "ref") return partial([fs.doc("ref/products")].concat(Object.keys(REFS).filter(k => has(REFS[k])).map(k => fs.doc("ref/" + k))), next);
      const types = [].concat(...Object.keys(TYPES).filter(has).map(k => TYPES[k]));
      return partial(types.map(t => fs.collection("j").where("t", "==", t)), next);
    } })
  });
  const downloads = { save: async ({ filename, data }) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" })); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return { status: "saved" }; } };
  window.claude = { use: async name => { if (name === "db") { await ready; return wrap(); } return name === "user" ? { can: async () => true } : name === "downloads" ? (PWA.owner || !fs ? downloads : (await ready, PWA.owner ? downloads : null)) : null; } };
})();
