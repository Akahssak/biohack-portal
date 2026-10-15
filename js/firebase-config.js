/* ==========================================================================
   Firebase connection settings
   --------------------------------------------------------------------------
   Paste the config object from:
     Firebase Console -> Project settings -> General -> Your apps -> Web app

   These values are NOT secrets. Firebase web keys are public identifiers and
   are meant to ship in client code. Actual protection comes from Firebase
   Authentication plus the Firestore security rules in `firestore.rules`.

   The SAME config must be used in both deployments (participant portal and
   organiser console) so they share one live database.
   ========================================================================== */

window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDfnHUSr_o7ToX0CMnOrJobWcxX03XFRSk",
    authDomain: "bio-hack-1afd4.firebaseapp.com",
    projectId: "bio-hack-1afd4",
    storageBucket: "bio-hack-1afd4.firebasestorage.app",
    messagingSenderId: "961557486892",
    appId: "1:961557486892:web:30428d3c5e69e3d8a06089"
  },

  /* Where this portal's organiser console is deployed. Used for the
     staff link in the footer. Leave empty to hide the link. */
  consoleUrl: "https://akahssak.github.io/biohack-console/",

  /* Registration deadline, ISO-8601. Drives the countdown. */
  registrationClosesAt: "2027-03-20T23:59:59+05:30",

  /* Public contact shown across the site. */
  supportEmail: "support@biohack2026.org",

  /* Partner recruitment spotlight shown on the landing page.
     Replace every value with your real hiring partner before going live. */
  career: {
    company: "Helix BioSciences Pvt. Ltd.",
    role: "Research Intern — Computational Biology",
    blurb:
      "Our headline industry partner reserves a direct interview pipeline for BioHack finalists. Shortlisted teams skip the aptitude round and go straight to the technical panel.",
    location: "Bengaluru, India (Hybrid)",
    duration: "6 months, with PPO conversion",
    stipend: "₹45,000 / month",
    openings: "12 positions",
    eligibility: "Pre-final & final year, any life-science or CS branch",
    applyUrl: ""
  }
};
