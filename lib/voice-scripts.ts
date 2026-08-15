export type VoiceScript = {
  id: string
  label: string
  language: "hi" | "en"
  tip: string
  lines: string[]
}

/** Guided singing scripts — sung slowly ≈ 2–3 minutes. */
export const VOICE_SCRIPTS: VoiceScript[] = [
  {
    id: "hi-ballad",
    label: "Hindi ballad",
    language: "hi",
    tip: "Sing softly, one line at a time. Keep a steady pitch — no whisper.",
    lines: [
      "कुछ पल तेरे साथ के, आज भी दिल में ठहरे हैं",
      "कुछ बातें जो कह ना सके, वो आँखों ने कहे हैं",
      "तेरी ख़ामोशी में भी, एक आवाज़ सी मिलती है",
      "तू सामने हो या ना हो, तेरी कमी सी रहती है",
      "तेरी हँसी की वो हल्की सी धुन, दिल में कहीं बजती रहती है",
      "कभी यूँ ही तेरा ख्याल आए, तो वक़्त सा रुक जाता है",
      "हलू… तू एक एहसास सा है, जो छू जाए दिल को",
      "हलू… तू एक ख़्वाब सा है, आँखों में रहे हर पल",
      "तेरे साथ गुज़रे लम्हे, कभी कम नहीं लगते",
      "तेरा नाम कहीं सुन लूँ, तो मुस्कुरा देता हूँ",
      "शायद इसे ही कहते हैं, जब कोई दिल में उतर जाता है",
      "मैं कुछ वादा नहीं करता, बस इतना जानता हूँ",
      "तू जहाँ भी हो हलू, मैं तुझे वहीं चाहता हूँ",
      "तू पास नहीं… फिर भी पास है",
      "हलू… बस तू है, और यही मेरा एहसास है",
    ],
  },
  {
    id: "en-ballad",
    label: "English ballad",
    language: "en",
    tip: "Sing clearly at a comfortable pitch. Pause briefly between lines.",
    lines: [
      "In the quiet of the evening, I still hear your name",
      "Every memory soft and golden, burning like a flame",
      "If the night should take me under, I will find you there",
      "In the space between the heartbeats, in the open air",
      "Hold me close like borrowed summer, never let me go",
      "All the words I never told you, now begin to show",
      "La la… stay a little longer, stay beside my heart",
      "La la… even when we’re distant, we are not apart",
      "Through the cities and the silence, through the rising tide",
      "Every road still leads me to you, every time I try",
      "I don’t need a perfect promise, only what is true",
      "If I close my eyes and listen, I still walk with you",
      "Morning light across the window, soft against my face",
      "In that glow I feel you with me, filling every space",
      "La la… this is how I keep you, gentle, near, and warm",
    ],
  },
]

export const MIN_VOICE_SECONDS = 90
export const TARGET_VOICE_SECONDS = 150
