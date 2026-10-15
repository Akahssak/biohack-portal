/* ==========================================================================
   core.js — shared Firebase bootstrap + UI helpers
   Loaded as an ES module by every page in this app.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------- config -- */

const APP_CONFIG = window.APP_CONFIG || {};
const firebaseConfig = APP_CONFIG.firebase || {};

export const config = APP_CONFIG;

/** True once firebase-config.js has been filled in. */
export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Optional: point the app at a local Firebase Emulator Suite for testing.
  // Enable by adding `emulators: { host: "localhost", authPort: 9099, firestorePort: 8080 }`
  // to APP_CONFIG in firebase-config.js. Never enable this in production.
  const emu = APP_CONFIG.emulators;
  if (emu) {
    const host = emu.host || "localhost";
    connectAuthEmulator(auth, `http://${host}:${emu.authPort || 9099}`, {
      disableWarnings: true
    });
    connectFirestoreEmulator(db, host, emu.firestorePort || 8080);
    console.info("[BioHack] Connected to the local Firebase emulators.");
  }
} else {
  console.warn(
    "[BioHack] Firebase is not configured. Open js/firebase-config.js and paste " +
      "your project credentials. Registration, sign-in and messaging stay disabled until then."
  );
}

export { app, auth, db };

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
};

/* ------------------------------------------------------------ constants -- */

export const COLLECTIONS = {
  teams: "teams",
  staff: "staff",
  ideas: "ideas",
  messages: "messages"
};

export const ROOMS = {
  announcements: "announcements",
  lounge: "lounge"
};

/** Private room id shared by one team and the organising committee. */
export function deskRoomId(uid) {
  return `desk_${uid}`;
}

/* -------------------------------------------------------------- helpers -- */

/** Escape a string for safe insertion into innerHTML. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** First letter of a display name, for avatars. */
export function initial(value) {
  const text = String(value ?? "").trim();
  return text ? text.charAt(0).toUpperCase() : "?";
}

/** Readable label from an email address. */
export function nameFromEmail(email) {
  return String(email ?? "").split("@")[0] || "member";
}

/** Convert a Firestore timestamp (or Date) to a local HH:MM string. */
export function formatTime(stamp) {
  const date = toDate(stamp);
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Convert a Firestore timestamp (or Date) to a short local date string. */
export function formatDate(stamp) {
  const date = toDate(stamp);
  if (!date) return "—";
  return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(stamp) {
  const date = toDate(stamp);
  if (!date) return "—";
  return `${formatDate(date)}, ${formatTime(date)}`;
}

function toDate(stamp) {
  if (!stamp) return null;
  if (typeof stamp.toDate === "function") return stamp.toDate();
  if (stamp instanceof Date) return stamp;
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Translate Firebase auth error codes into plain language. */
export function authErrorMessage(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "That email is already registered. Sign in instead.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/weak-password": "Password is too weak. Use at least 8 characters.",
    "auth/missing-password": "Please enter your password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/user-disabled": "This account has been disabled by the organisers.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "Network problem. Check your connection and retry.",
    "auth/operation-not-allowed":
      "Email/password sign-in is not enabled in the Firebase project yet.",
    "permission-denied": "You do not have access to that resource."
  };
  return map[code] || error?.message || "Something went wrong. Please try again.";
}

/* ---------------------------------------------------------------- toast -- */

let toastStack = null;

export function toast(message, type = "info") {
  if (!toastStack) {
    toastStack = document.getElementById("toast-stack");
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.id = "toast-stack";
      toastStack.className = "toast-stack";
      document.body.appendChild(toastStack);
    }
  }

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };

  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");
  node.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(
    message
  )}</span>`;

  toastStack.appendChild(node);

  setTimeout(() => {
    node.classList.add("leaving");
    setTimeout(() => node.remove(), 240);
  }, 4200);
}

/* ------------------------------------------------------------ setup aid -- */

/** Show a dismissable banner when Firebase has not been wired up yet. */
export function warnIfUnconfigured() {
  if (isConfigured) return false;

  const banner = document.createElement("div");
  banner.className = "setup-banner";
  banner.innerHTML = `
    <div class="shell">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span><b>Setup needed.</b> Add your Firebase project keys to
      <code class="mono">js/firebase-config.js</code> to enable registration,
      sign-in and live messaging. See <code class="mono">README.md</code>.</span>
    </div>`;

  const header = document.querySelector(".site-header");
  if (header && header.parentNode) {
    header.parentNode.insertBefore(banner, header.nextSibling);
  } else {
    document.body.prepend(banner);
  }
  return true;
}

/** Disable a form and explain why. */
export function disableForm(form, reason) {
  if (!form) return;
  form.querySelectorAll("input, select, textarea, button").forEach((el) => {
    el.disabled = true;
  });
  if (reason) form.setAttribute("title", reason);
}

/** Put a submit button into a loading state; returns a reset function. */
export function busy(button, label = "Working…") {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>${escapeHtml(label)}`;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
  };
}

/* ------------------------------------------------------------- identity -- */

/**
 * Resolve the signed-in user's profile.
 * Returns { uid, email, displayName, role, team } where role is
 * "organiser" for anyone holding a document in the `staff` collection.
 */
export async function resolveProfile(user) {
  const profile = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || nameFromEmail(user.email),
    role: "participant",
    team: null,
    staff: null
  };

  try {
    const staffSnap = await getDoc(doc(db, COLLECTIONS.staff, user.uid));
    if (staffSnap.exists()) {
      profile.role = "organiser";
      profile.staff = staffSnap.data();
      profile.displayName = profile.staff.name || profile.displayName;
      return profile;
    }
  } catch (error) {
    console.debug("[BioHack] staff lookup skipped:", error.code || error.message);
  }

  try {
    const teamSnap = await getDoc(doc(db, COLLECTIONS.teams, user.uid));
    if (teamSnap.exists()) {
      profile.team = teamSnap.data();
      profile.displayName = profile.team.teamName || profile.displayName;
    }
  } catch (error) {
    console.debug("[BioHack] team lookup skipped:", error.code || error.message);
  }

  return profile;
}

/* ------------------------------------------------------------ messaging -- */

/**
 * Subscribe to a room's messages in ascending time order.
 * Returns the unsubscribe function.
 */
export function watchRoom(roomId, onChange, onError) {
  const roomQuery = query(
    collection(db, COLLECTIONS.messages),
    where("room", "==", roomId),
    orderBy("createdAt", "asc"),
    limit(500)
  );

  return onSnapshot(
    roomQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      onChange(messages);
    },
    (error) => {
      console.error("[BioHack] room subscription failed:", error);
      if (onError) onError(error);
    }
  );
}

/** Persist a message to Firestore. */
export async function sendMessage({ room, text, profile }) {
  const body = String(text || "").trim();
  if (!body) return;

  await addDoc(collection(db, COLLECTIONS.messages), {
    room,
    text: body.slice(0, 4000),
    senderUid: profile.uid,
    senderName: profile.displayName,
    senderEmail: profile.email,
    senderRole: profile.role,
    createdAt: serverTimestamp()
  });
}

/* ------------------------------------------------------------ countdown -- */

/** Drive a four-cell countdown. Elements are looked up once by id. */
export function startCountdown(targetIso, ids) {
  const cells = {
    days: document.getElementById(ids.days),
    hours: document.getElementById(ids.hours),
    minutes: document.getElementById(ids.minutes),
    seconds: document.getElementById(ids.seconds)
  };

  if (!cells.days) return;

  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return;

  const pad = (value) => String(Math.max(0, value)).padStart(2, "0");

  let timer = null;

  const tick = () => {
    const remaining = target - Date.now();

    if (remaining <= 0) {
      Object.values(cells).forEach((cell) => cell && (cell.textContent = "00"));
      if (timer) clearInterval(timer);
      return;
    }

    const seconds = Math.floor(remaining / 1000);
    cells.days.textContent = pad(Math.floor(seconds / 86400));
    cells.hours.textContent = pad(Math.floor((seconds % 86400) / 3600));
    cells.minutes.textContent = pad(Math.floor((seconds % 3600) / 60));
    cells.seconds.textContent = pad(seconds % 60);
  };

  tick();
  timer = setInterval(tick, 1000);
}
