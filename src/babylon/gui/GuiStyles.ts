export const GuiStyles = {
  colors: {
    text: "white",
    accent: "#4a90e2",
    accentDark: "#0066ff",
    danger: "#e74c3c",
    panelBg: "rgba(0, 0, 0, 0.85)",
    overlayBg: "rgba(0, 0, 0, 0.85)",
    cardBg: "rgba(20, 30, 50, 0.95)",
    sliderBg: "#333333",
    sliderThumb: "#4a90e2",
  },
  fontSize: {
    title: 28,
    label: 18,
    value: 16,
    score: 24,
    message: 48,
    help: 20,
  },
  padding: {
    screen: "20px",
    panel: "24px",
  },
  button: {
    settingsWidth: "140px",
    settingsHeight: "50px",
    helpWidth: "150px",
    helpHeight: "50px",
    cornerRadius: 5,
  },
  settingsPanel: {
    width: "500px",
    height: "450px",
  },
  helpPanel: {
    width: "460px",
    height: "420px",
  },
} as const;
