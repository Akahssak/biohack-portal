/* ==========================================================================
   portal.js — landing page: countdown, registration, sign-in
   ========================================================================== */

import {
  auth,
  db,
  config,
  isConfigured,
  warnIfUnconfigured,
  disableForm,
  busy,
  toast,
  startCountdown,
  authErrorMessage,
  escapeHtml,
  COLLECTIONS,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  doc,
  setDoc,
  serverTimestamp
} from "./core.js";

const WORKSPACE_URL = "workspace.html";

/* ---------------------------------------------------------- static copy -- */

function paintStaticConfig() {
  const career = config.career || {};
  const map = {
    "career-role": career.role,
    "career-company": career.company,
    "career-blurb": career.blurb,
    "career-location": career.location,
    "career-duration": career.duration,
    "career-stipend": career.stipend,
    "career-openings": career.openings,
    "career-eligibility": career.eligibility
  };

  Object.entries(map).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node && value) node.textContent = value;
  });

  const email = config.supportEmail;
  if (email) {
    ["support-link", "support-link-foot"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = node.id === "support-link" ? email : "Contact";
        node.href = `mailto:${email}`;
      }
    });
  }

  if (config.consoleUrl) {
    const link = document.getElementById("console-link");
    if (link) {
      link.href = config.consoleUrl;
      link.classList.remove("hidden");
    }
  }

  startCountdown(config.registrationClosesAt, {
    days: "cd-days",
    hours: "cd-hours",
    minutes: "cd-mins",
    seconds: "cd-secs"
  });
}

/* -------------------------------------------------------------- helpers -- */

function value(id) {
  const node = document.getElementById(id);
  return node ? node.value.trim() : "";
}

function validateRegistration() {
  const password = document.getElementById("reg-password").value;
  const confirm = document.getElementById("reg-password2").value;

  if (!document.getElementById("register-form").checkValidity()) {
    document.getElementById("register-form").reportValidity();
    return null;
  }

  if (password.length < 8) {
    toast("Password must be at least 8 characters.", "error");
    return null;
  }

  if (password !== confirm) {
    toast("The two passwords do not match.", "error");
    return null;
  }

  if (!document.getElementById("reg-consent").checked) {
    toast("Please accept the code of conduct to continue.", "error");
    return null;
  }

  return {
    teamName: value("reg-team"),
    college: value("reg-college"),
    leaderName: value("reg-lead"),
    phone: value("reg-phone"),
    email: value("reg-email").toLowerCase(),
    track: value("reg-track"),
    teamSize: Number(value("reg-size")) || 3,
    password
  };
}

/* --------------------------------------------------------- registration -- */

async function handleRegistration(event) {
  event.preventDefault();

  const data = validateRegistration();
  if (!data) return;

  const button = document.getElementById("register-submit");
  const done = busy(button, "Creating your account…");

  try {
    const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = credential.user;

    await updateProfile(user, { displayName: data.teamName });

    await setDoc(doc(db, COLLECTIONS.teams, user.uid), {
      uid: user.uid,
      teamName: data.teamName,
      college: data.college,
      leaderName: data.leaderName,
      phone: data.phone,
      email: data.email,
      track: data.track,
      teamSize: data.teamSize,
      status: "registered",
      createdAt: serverTimestamp()
    });

    // Registration is complete; require a deliberate sign-in to open the workspace.
    await signOut(auth);

    showRegistrationSuccess(data);
    document.getElementById("register-form").reset();
    toast("Registration confirmed.", "success");
  } catch (error) {
    console.error("[BioHack] registration failed:", error);
    toast(authErrorMessage(error), "error");
  } finally {
    done();
  }
}

function showRegistrationSuccess(data) {
  const box = document.getElementById("register-result");
  const text = document.getElementById("register-result-text");

  text.innerHTML = `
    <b>Registration recorded.</b><br>
    <b>${escapeHtml(data.teamName)}</b> from ${escapeHtml(data.college)} is confirmed on the
    <em>${escapeHtml(data.track)}</em> track, and
    <b class="mono">${escapeHtml(data.email)}</b> is now your sign-in ID.
    Sign in on the right to file your idea brief and reach the committee.`;

  box.classList.remove("hidden");

  const loginEmail = document.getElementById("login-email");
  loginEmail.value = data.email;
  loginEmail.focus({ preventScroll: true });
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* -------------------------------------------------------------- sign in -- */

async function handleSignIn(event) {
  event.preventDefault();

  const form = document.getElementById("signin-form");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const email = value("login-email").toLowerCase();
  const password = document.getElementById("login-password").value;
  const remember = document.getElementById("login-remember").checked;

  const button = document.getElementById("signin-submit");
  const done = busy(button, "Verifying…");

  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
    toast("Signed in. Opening your workspace…", "success");
    window.location.href = WORKSPACE_URL;
  } catch (error) {
    console.error("[BioHack] sign-in failed:", error);
    toast(authErrorMessage(error), "error");
    done();
  }
}

/* ------------------------------------------------------- password reset -- */

async function handleReset() {
  const email = value("login-email").toLowerCase();

  if (!email) {
    toast("Enter your registered email first, then tap “Forgot password?”.", "info");
    document.getElementById("login-email").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    toast(`Reset link sent to ${email} if that account exists.`, "success");
  } catch (error) {
    // Do not reveal whether the address is registered.
    console.error("[BioHack] reset failed:", error);
    toast(`Reset link sent to ${email} if that account exists.`, "success");
  }
}

/* ----------------------------------------------------------------- boot -- */

function init() {
  paintStaticConfig();

  const registerForm = document.getElementById("register-form");
  const signinForm = document.getElementById("signin-form");

  if (!isConfigured) {
    warnIfUnconfigured();
    const reason = "Firebase is not configured yet — see README.md.";
    disableForm(registerForm, reason);
    disableForm(signinForm, reason);
    return;
  }

  registerForm.addEventListener("submit", handleRegistration);
  signinForm.addEventListener("submit", handleSignIn);
  document.getElementById("reset-password").addEventListener("click", handleReset);
}

init();
