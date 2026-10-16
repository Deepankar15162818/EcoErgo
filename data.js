/* ========================================================= EcoErgo - editable content & settings (data.js) Change text, exercises, tips and factors HERE. You do not need to touch script.js for content changes. ========================================================= */

window.ECOERGO_DATA = {
  /* ---------- Emission factors (ILLUSTRATIVE - replace with cited values) ---------- */
  factors: {
    kgCO2ePerPage: 0.005, // per printed A4 page (illustrative)
    kgCO2ePerKm: {
      car: 0.17, // petrol car, per km (illustrative)
      twoWheeler: 0.07, // motorbike / scooter, per km (illustrative)
      bus: 0.09, // bus passenger, per km (illustrative)
    },
    note: "Illustrative values for a student prototype. Replace with cited, locally appropriate factors (for example from a national emission-factor database) before reporting results.",
  },

  /* ---------- Green Score settings (weekly, 0-100) ---------- */
  score: {
    // Each part earns points up to its maximum when the weekly target is reached.
    breaks: { target: 20, max: 40, label: "Movement breaks", short: "Breaks" },
    paper: {
      target: 50,
      max: 20,
      label: "Paper avoided (pages)",
      short: "Paper",
    },
    travel: { target: 5, max: 20, label: "Trips avoided", short: "Travel" },
    posture: {
      target: 5,
      max: 20,
      label: "Posture-check days",
      short: "Posture",
    },
  },

  dailyBreakGoal: 4,

  /* ---------- Exercises (to be reviewed by the BPT team) ---------- */
  exercises: [
    {
      id: "shoulder-rolls",
      title: "Shoulder Rolls",
      icon: "🙆",
      area: "Shoulders",
      seconds: 45,
      anim: "roll",
      steps: [
        "Sit tall with your feet flat and arms relaxed.",
        "Lift both shoulders up towards your ears.",
        "Roll them back and down in a slow circle.",
        "Repeat smoothly, then reverse the direction. Breathe normally.",
      ],
      caution: "Keep the movement small and pain-free.",
    },
    {
      id: "neck-turns",
      title: "Gentle Neck Turns",
      icon: "🙂",
      area: "Neck",
      seconds: 45,
      anim: "turn",
      steps: [
        "Sit tall and look straight ahead.",
        "Slowly turn your head to the right, only as far as comfortable.",
        "Pause, return to the centre, then turn to the left.",
        "Keep your shoulders relaxed and do not force the movement.",
      ],
      caution: "Stop if you feel dizziness, tingling or sharp pain.",
    },
    {
      id: "chin-tuck",
      title: "Chin Tucks",
      icon: "🧍",
      area: "Neck",
      seconds: 45,
      anim: "nod",
      steps: [
        "Sit tall and look forward.",
        "Gently glide your chin straight back, as if making a small double chin.",
        "Hold for 2-3 seconds, then relax.",
        "Repeat slowly, keeping your eyes level.",
      ],
      caution:
        "This should feel like a mild stretch at the back of the neck, not pain.",
    },
    {
      id: "side-neck",
      title: "Side Neck Stretch",
      icon: "🙇",
      area: "Neck",
      seconds: 45,
      anim: "tilt",
      steps: [
        "Sit tall and keep both shoulders down and relaxed.",
        "Tilt your right ear gently towards your right shoulder.",
        "Hold for 15 seconds, breathing slowly. Do not pull on your head.",
        "Return to the centre and repeat on the left side.",
      ],
      caution:
        "Use only a gentle stretch. Stop if you feel pain or arm tingling.",
    },
    {
      id: "shoulder-squeeze",
      title: "Shoulder Blade Squeeze",
      icon: "💪",
      area: "Upper back",
      seconds: 45,
      anim: "squeeze",
      steps: [
        "Sit tall with your arms by your sides.",
        "Gently squeeze your shoulder blades together and slightly down.",
        "Hold for 3-5 seconds without shrugging.",
        "Relax and repeat.",
      ],
      caution: "Do not arch your lower back.",
    },
    {
      id: "upper-back",
      title: "Upper-Back Stretch",
      icon: "🧘",
      area: "Upper back",
      seconds: 45,
      anim: "stretch",
      steps: [
        "Clasp your hands in front of you at chest height.",
        "Gently push your hands forward and round your upper back.",
        "Hold for 10-15 seconds and breathe.",
        "Release and sit tall again.",
      ],
      caution: "Only stretch within a comfortable range.",
    },
    {
      id: "seated-twist",
      title: "Gentle Seated Twist",
      icon: "🔄",
      area: "Back",
      seconds: 45,
      anim: "twist",
      steps: [
        "Sit tall near the front of your chair.",
        "Place one hand on the opposite knee or the chair arm.",
        "Gently turn your upper body to look over one shoulder.",
        "Hold for about 10 seconds, then switch sides.",
      ],
      caution: "Rotate from the upper back, not by forcing the lower back.",
    },
    {
      id: "wrist-stretch",
      title: "Wrist & Finger Stretch",
      icon: "🤲",
      area: "Wrists",
      seconds: 45,
      anim: "wave",
      steps: [
        "Extend one arm forward with the palm facing up.",
        "With the other hand, gently bend the fingers downward.",
        "Hold for 10 seconds, then turn the palm down and repeat.",
        "Switch arms and open and close your hands a few times.",
      ],
      caution: "Stop if you feel numbness or tingling.",
    },
    {
      id: "eye-rest",
      title: "Eye Rest (20-20-20)",
      icon: "👀",
      area: "Eyes",
      seconds: 45,
      anim: "blink",
      steps: [
        "Look away from your screen at something far away (about 6 metres / 20 feet).",
        "Keep looking at it for about 20 seconds.",
        "Blink slowly several times.",
        "Close your eyes for a few breaths before returning to work.",
      ],
      caution: "Repeat regularly during long screen sessions.",
    },
    {
      id: "stand-march",
      title: "Stand and Move",
      icon: "🚶",
      area: "Whole body",
      seconds: 45,
      anim: "march",
      steps: [
        "Stand up carefully, holding your desk if needed.",
        "Walk a few steps or march gently on the spot.",
        "Roll your shoulders and take a few deep breaths.",
        "Sit back down with your back supported.",
      ],
      caution: "Make sure the space around you is safe.",
    },
  ],

  /* ---------- 3-minute routines (4 exercises x 45 s = 180 s) ---------- */
  routines: [
    {
      id: "quick",
      title: "Quick 3-Min Reset",
      blurb: "Neck, shoulders, upper back and a stand-up break.",
      items: ["shoulder-rolls", "neck-turns", "upper-back", "stand-march"],
    },
    {
      id: "neck",
      title: "Neck & Shoulder Relief",
      blurb: "For a stiff neck and tight shoulders.",
      items: ["chin-tuck", "side-neck", "shoulder-squeeze", "shoulder-rolls"],
    },
    {
      id: "desk",
      title: "Desk Recharge",
      blurb: "Wrists, eyes, gentle twist and a walk.",
      items: ["wrist-stretch", "eye-rest", "seated-twist", "stand-march"],
    },
  ],

  /* ---------- Posture guide hotspots ---------- */
  postureSpots: {
    monitor: {
      title: "Screen",
      text: "Place the screen about an arm's length away. The top of the screen should be at or just below eye level so your neck stays neutral.",
    },
    keyboard: {
      title: "Keyboard & mouse",
      text: "Keep the keyboard and mouse close and at the same level, with wrists in a neutral, straight position.",
    },
    elbows: {
      title: "Arms & elbows",
      text: "Let your shoulders relax and keep your elbows close to your body, bent at roughly a right angle.",
    },
    back: {
      title: "Back support",
      text: "Sit back so your lower back is supported by the chair. Adjust the backrest or use a small cushion if needed.",
    },
    knees: {
      title: "Hips & knees",
      text: "Keep your thighs roughly parallel to the floor with a little space between the seat edge and the back of your knees.",
    },
    feet: {
      title: "Feet",
      text: "Rest both feet flat on the floor or on a footrest. Avoid crossing your legs for long periods.",
    },
  },

  postureChecklist: [
    "My screen is about an arm's length away.",
    "The top of my screen is near eye level.",
    "My shoulders are relaxed, not hunched.",
    "My elbows are bent at about a right angle.",
    "My wrists are straight when I type.",
    "My lower back is supported by the chair.",
    "My feet are flat on the floor or a footrest.",
    "I have changed position or stood up in the last hour.",
  ],

  /* ---------- Tips ---------- */
  postureTips: [
    "Change position at least once every 30-60 minutes.",
    "Bring the screen to your eyes instead of leaning your head towards it.",
    "Keep frequently used items within easy reach to avoid twisting and stretching.",
    "Use a phone stand or hands-free option instead of cradling the phone on your shoulder.",
    "Take a short walk while reading a long document or thinking.",
    "Relax your jaw and drop your shoulders every time you notice tension.",
    "Stand up when you take calls, if your workplace allows it.",
    "Drinking water often gives you a natural reason to stand and move.",
    "Sit with your back supported rather than perched on the edge of the chair.",
    "Adjust screen brightness and text size so you do not need to lean forward.",
  ],
  ecoTips: [
    "Share documents digitally instead of printing them.",
    "If you must print, use double-sided printing.",
    "Combine errands into one trip to reduce travel.",
    "Join online meetings when a trip adds little value.",
    "Switch off your monitor and computer when you finish for the day.",
    "Use shared folders and PDFs instead of printed handouts.",
    "Walk, cycle or use public transport for short trips when practical.",
  ],

  /* ---------- Badges (checked in script.js) ---------- */
  badges: [
    {
      id: "first",
      icon: "🌱",
      title: "First Break",
      desc: "Log your first movement break.",
    },
    {
      id: "goal",
      icon: "🎯",
      title: "Daily Goal",
      desc: "Reach your daily break goal.",
    },
    {
      id: "streak",
      icon: "🔥",
      title: "3-Day Streak",
      desc: "Log a break on 3 days in a row.",
    },
    {
      id: "week",
      icon: "🏅",
      title: "Week Warrior",
      desc: "20 breaks in 7 days.",
    },
    {
      id: "paper",
      icon: "📄",
      title: "Paper Saver",
      desc: "Track 50 pages avoided.",
    },
    {
      id: "travel",
      icon: "🚲",
      title: "Green Commuter",
      desc: "Track 3 trips avoided.",
    },
    {
      id: "posture",
      icon: "🪑",
      title: "Posture Pro",
      desc: "Score 80% or more on a posture check.",
    },
  ],

  /* ---------- "Read more" panels in the Method section ---------- */
  methodDetails: {
    bpt: {
      icon: "🩺",
      title: "Physiotherapy (BPT) role",
      points: [
        "Select safe, simple desk exercises for neck, shoulders, upper back, wrists and eyes.",
        "Write the step-by-step instructions and caution notes (see data.js).",
        "Prepare the posture guide and the safety instructions.",
        "Review every routine before the site is shown to staff.",
      ],
    },
    tech: {
      icon: "💻",
      title: "Technology (B.Tech) role",
      points: [
        "Build the website with HTML, CSS and JavaScript and host it free on GitHub Pages.",
        "Implement the timer, break reminders, carbon calculator and dashboard.",
        "Store progress in the browser (localStorage) so no server or cost is needed.",
        "Test the site on laptop and mobile.",
      ],
    },
    eval: {
      icon: "📋",
      title: "Joint evaluation",
      points: [
        "Survey university staff before and after using the site.",
        "Use the optional discomfort sliders and the CSV export as self-reported data.",
        "Run usability testing and collect feedback.",
        "Report limits honestly: self-reported inputs, illustrative emission factors, simulated demo data.",
      ],
    },
  },
};
