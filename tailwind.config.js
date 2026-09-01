/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ios: {
          // System Accent Colors
          blue: {
            DEFAULT: "#007AFF",
            dark: "#0A84FF",
          },
          green: {
            DEFAULT: "#34C759",
            dark: "#30D158",
          },
          indigo: {
            DEFAULT: "#5856D6",
            dark: "#5E5CE6",
          },
          orange: {
            DEFAULT: "#FF9500",
            dark: "#FF9F0A",
          },
          pink: {
            DEFAULT: "#FF2D55",
            dark: "#FF375F",
          },
          purple: {
            DEFAULT: "#AF52DE",
            dark: "#BF5AF2",
          },
          red: {
            DEFAULT: "#FF3B30",
            dark: "#FF453A",
          },
          teal: {
            DEFAULT: "#5AC8FA",
            dark: "#64D2FF",
          },
          yellow: {
            DEFAULT: "#FFCC00",
            dark: "#FFD60A",
          },

          // System Grays
          gray: {
            1: "#8E8E93",
            2: "#AEAEB2",
            3: "#C7C7CC",
            4: "#D1D1D6",
            5: "#E5E5EA",
            6: "#F2F2F7",
            dark1: "#8E8E93",
            dark2: "#636366",
            dark3: "#48484A",
            dark4: "#3A3A3C",
            dark5: "#2C2C2E",
            dark6: "#1C1C1E",
          },

          // Backgrounds
          bg: {
            primary: "#FFFFFF",
            secondary: "#F2F2F7",
            tertiary: "#FFFFFF",
            grouped: "#F2F2F7",
            groupedSecondary: "#FFFFFF",
            groupedTertiary: "#F2F2F7",
            darkPrimary: "#000000",
            darkSecondary: "#1C1C1E",
            darkTertiary: "#2C2C2E",
            darkGrouped: "#000000",
            darkGroupedSecondary: "#1C1C1E",
            darkGroupedTertiary: "#2C2C2E",
          },

          // Separator & Border
          separator: {
            DEFAULT: "rgba(60, 60, 67, 0.29)",
            opaque: "#C6C6C8",
            dark: "rgba(84, 84, 88, 0.65)",
            darkOpaque: "#38383A",
          },
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"PingFang SC"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      borderRadius: {
        "ios-sm": "8px",
        "ios-md": "12px",
        "ios-lg": "16px",
        "ios-xl": "20px",
        "ios-2xl": "24px",
        "ios-3xl": "32px",
      },
      boxShadow: {
        "ios-card": "0 2px 8px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        "ios-card-hover": "0 8px 24px 0 rgba(0, 0, 0, 0.08), 0 2px 6px 0 rgba(0, 0, 0, 0.04)",
        "ios-modal": "0 12px 32px 0 rgba(0, 0, 0, 0.16), 0 2px 6px 0 rgba(0, 0, 0, 0.08)",
        "ios-tabbar": "0 -0.5px 0 0 rgba(0, 0, 0, 0.15)",
        "ios-navbar": "0 0.5px 0 0 rgba(0, 0, 0, 0.15)",
      },
      backdropBlur: {
        ios: "20px",
      },
    },
  },
  plugins: [],
};
