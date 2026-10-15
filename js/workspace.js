/* ==========================================================================
   workspace.js — authenticated team workspace: messaging + idea brief
   ========================================================================== */

import {
  auth,
  db,
  config,
  isConfigured,
  toast,
  busy,
  escapeHtml,
  initial,
  formatTime,
  formatDate,
  authErrorMessage,
  resolveProfile,
  watchRoom,
  sendMessage,
  deskRoomId,
  COLLECTIONS,
  ROOMS,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  serverTimestamp
} from "./core.js";

const el = (id) => document.getElementById(id);

let profile = null;
let rooms = [];
let activeRoom = null;
let unsubscribe = null;
let existingIdeaId = null;

/* ----------------------------------------------------------------- gate -- */

function showGate(which) {
  el("gate").classList.toggle("hidden", which !== "loading");
  el("gate-denied").classList.toggle("hidden", which !== "denied");
  el("workspace").classList.toggle("hidden", which !== "ready");
}

if (!isConfigured) {
  showGate("denied");
  el("gate-denied").querySelector("h2").textContent = "Setup needed";
  el("gate-denied").querySelector("p").textContent =
    "Add your Firebase project keys to js/firebase-config.js to enable this workspace.";
} else {
  onAuthStateChanged(auth, handleAuthChange);
}

async function handleAuthChange(user) {
  if (!user) {
    showGate("denied");
    return;
  }

  try {
    profile = await resolveProfile(user);
  } catch (error) {
    console.error("[BioHack] profile lookup failed:", error);
    profile = { uid: user.uid, email: user.email, displayName: user.email, role: "participant" };
  }

  paintIdentity();
  buildRooms();
  wireEvents();
  showGate("ready");
  selectRoom(rooms[0].id);
  loadExistingIdea();
}

/* ------------------------------------------------------------- identity -- */

function paintIdentity() {
  const name = profile.team?.teamName || profile.displayName;
  el("me-avatar").textContent = initial(name);
  el("me-name").textContent = name;
  el("me-name").title = profile.email;
  el("me-role").textContent = profile.team
    ? `${profile.team.track || "Participant"}`
    : profile.role === "organiser"
    ? "Organising committee"
    : "Participant";
}

/* ---------------------------------------------------------------- rooms -- */

function buildRooms() {
  rooms = [
    {
      id: ROOMS.announcements,
      name: "Announcements",
      desc: "Official updates from the committee",
      icon: "fa-bullhorn",
      tone: "amber",
      readOnly: true,
      note: "Broadcast channel. Only the organising committee can post here."
    },
    {
      id: ROOMS.lounge,
      name: "Participant Lounge",
      desc: "Open floor for every registered team",
      icon: "fa-users",
      tone: "cyan",
      readOnly: false,
      note: "Shared with all registered teams. Be respectful — the code of conduct applies."
    },
    {
      id: deskRoomId(profile.uid),
      name: "Committee Desk",
      desc: "Private line to your reviewers",
      icon: "fa-user-shield",
      tone: "",
      readOnly: false,
      note: "Private thread between your team and the organising committee."
    }
  ];

  const list = el("room-list");
  list.innerHTML = "";

  rooms.forEach((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room";
    button.dataset.room = room.id;
    button.innerHTML = `
      <span class="room-icon ${room.tone}"><i class="fa-solid ${room.icon}"></i></span>
      <span class="room-body">
        <span class="room-name">${escapeHtml(room.name)}</span>
        <span class="room-desc">${escapeHtml(room.desc)}</span>
      </span>`;
    button.addEventListener("click", () => selectRoom(room.id));
    list.appendChild(button);
  });
}

function selectRoom(roomId) {
  const room = rooms.find((entry) => entry.id === roomId);
  if (!room) return;

  activeRoom = room;

  document.querySelectorAll(".room").forEach((node) => {
    node.classList.toggle("active", node.dataset.room === roomId);
  });

  el("room-title").textContent = room.name;
  el("room-desc").textContent = room.desc;
  el("room-avatar").className = `room-icon ${room.tone}`;
  el("room-avatar").innerHTML = `<i class="fa-solid ${room.icon}"></i>`;
  el("workspace").classList.add("room-open");

  const canPost = !room.readOnly;
  el("composer").classList.toggle("hidden", !canPost);
  el("composer-locked").classList.toggle("hidden", canPost);

  renderThread([], "loading");

  if (unsubscribe) unsubscribe();
  unsubscribe = watchRoom(
    room.id,
    (messages) => renderThread(messages, "ready"),
    (error) => {
      renderThread([], "error");
      toast(authErrorMessage(error), "error");
    }
  );
}

/* --------------------------------------------------------------- thread -- */

function renderThread(messages, state) {
  const thread = el("thread");
  thread.innerHTML = "";

  const note = document.createElement("div");
  note.className = "thread-note";
  note.innerHTML = `<i class="fa-solid fa-lock"></i>${escapeHtml(activeRoom.note)}`;
  thread.appendChild(note);

  if (state === "loading") {
    thread.insertAdjacentHTML(
      "beforeend",
      '<div class="thread-empty"><div class="spinner"></div><span>Loading messages…</span></div>'
    );
    return;
  }

  if (state === "error") {
    thread.insertAdjacentHTML(
      "beforeend",
      '<div class="thread-empty"><i class="fa-solid fa-triangle-exclamation"></i>' +
        "<span>Could not load this conversation.</span></div>"
    );
    return;
  }

  if (!messages.length) {
    thread.insertAdjacentHTML(
      "beforeend",
      '<div class="thread-empty"><i class="fa-regular fa-comments"></i>' +
        "<span>No messages yet.</span></div>"
    );
    return;
  }

  let lastDay = "";

  messages.forEach((message) => {
    const day = formatDate(message.createdAt);
    if (day !== lastDay && day !== "—") {
      lastDay = day;
      const divider = document.createElement("div");
      divider.className = "thread-note";
      divider.textContent = day;
      thread.appendChild(divider);
    }
    thread.appendChild(bubble(message));
  });

  thread.scrollTop = thread.scrollHeight;
}

function bubble(message) {
  const mine = message.senderUid === profile.uid;
  const staff = message.senderRole === "organiser";

  const row = document.createElement("div");
  row.className = `bubble-row ${mine ? "out" : "in"}`;

  const author = staff
    ? `${message.senderName || "Committee"} · Organising committee`
    : message.senderName || message.senderEmail || "Participant";

  row.innerHTML = `
    <div class="bubble">
      ${mine ? "" : `<div class="bubble-author ${staff ? "staff" : ""}">${escapeHtml(author)}</div>`}
      <p class="bubble-text">${escapeHtml(message.text)}</p>
      <div class="bubble-meta">
        <span>${escapeHtml(formatTime(message.createdAt) || "sending…")}</span>
        ${mine ? '<i class="fa-solid fa-check-double"></i>' : ""}
      </div>
    </div>`;

  return row;
}

/* ------------------------------------------------------------- composer -- */

async function handleSend(event) {
  event.preventDefault();

  const input = el("composer-input");
  const text = input.value.trim();
  if (!text || activeRoom.readOnly) return;

  input.value = "";
  resizeComposer();

  try {
    await sendMessage({ room: activeRoom.id, text, profile });
  } catch (error) {
    console.error("[BioHack] send failed:", error);
    toast(authErrorMessage(error), "error");
    input.value = text;
    resizeComposer();
  }
}

function resizeComposer() {
  const input = el("composer-input");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

/* ----------------------------------------------------------- idea brief -- */

async function loadExistingIdea() {
  try {
    const snapshot = await getDocs(
      query(collection(db, COLLECTIONS.ideas), where("uid", "==", profile.uid), limit(1))
    );

    if (snapshot.empty) return;

    const entry = snapshot.docs[0];
    existingIdeaId = entry.id;
    const data = entry.data();

    el("idea-title").value = data.title || "";
    el("idea-track").value = data.track || el("idea-track").value;
    el("idea-problem").value = data.problem || "";
    el("idea-approach").value = data.approach || "";
    el("idea-data").value = data.dataTooling || "";
    el("idea-impact").value = data.impact || "";
    el("idea-repo").value = data.repoUrl || "";

    el("idea-btn-label").textContent = "Edit idea brief";
    el("idea-submit").innerHTML = '<i class="fa-solid fa-rotate"></i>Update brief';
    el("idea-modal-title").textContent = "Your idea brief";
  } catch (error) {
    console.debug("[BioHack] idea lookup skipped:", error.code || error.message);
  }
}

function toggleIdeaModal(open) {
  el("idea-modal").classList.toggle("hidden", !open);
  if (open) {
    if (profile.team?.track) {
      const select = el("idea-track");
      if (!existingIdeaId) select.value = profile.team.track;
    }
    el("idea-title").focus();
  }
}

async function handleIdeaSubmit(event) {
  event.preventDefault();

  const form = el("idea-form");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const button = el("idea-submit");
  const done = busy(button, "Submitting…");

  const ideaId = existingIdeaId || profile.uid;

  const payload = {
    uid: profile.uid,
    teamName: profile.team?.teamName || profile.displayName,
    college: profile.team?.college || "",
    email: profile.email,
    title: el("idea-title").value.trim(),
    track: el("idea-track").value,
    problem: el("idea-problem").value.trim(),
    approach: el("idea-approach").value.trim(),
    dataTooling: el("idea-data").value.trim(),
    impact: el("idea-impact").value.trim(),
    repoUrl: el("idea-repo").value.trim(),
    status: "under review",
    updatedAt: serverTimestamp()
  };

  if (!existingIdeaId) payload.createdAt = serverTimestamp();

  try {
    await setDoc(doc(db, COLLECTIONS.ideas, ideaId), payload, { merge: true });
    existingIdeaId = ideaId;

    el("idea-btn-label").textContent = "Edit idea brief";
    el("idea-submit").innerHTML = '<i class="fa-solid fa-rotate"></i>Update brief';
    toggleIdeaModal(false);
    toast("Idea brief submitted. The committee has been notified.", "success");
  } catch (error) {
    console.error("[BioHack] idea submit failed:", error);
    toast(authErrorMessage(error), "error");
  } finally {
    done();
  }
}

/* ---------------------------------------------------------------- wiring -- */

function wireEvents() {
  el("composer").addEventListener("submit", handleSend);

  const input = el("composer-input");
  input.addEventListener("input", resizeComposer);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el("composer").requestSubmit();
    }
  });

  el("back-to-rooms").addEventListener("click", () => {
    el("workspace").classList.remove("room-open");
  });

  el("open-idea").addEventListener("click", () => toggleIdeaModal(true));
  el("idea-close").addEventListener("click", () => toggleIdeaModal(false));
  el("idea-form").addEventListener("submit", handleIdeaSubmit);

  el("idea-modal").addEventListener("click", (event) => {
    if (event.target === el("idea-modal")) toggleIdeaModal(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleIdeaModal(false);
  });

  el("sign-out").addEventListener("click", async () => {
    if (unsubscribe) unsubscribe();
    await signOut(auth);
    window.location.href = "index.html";
  });
}
