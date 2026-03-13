import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'Toss Product Sans'",
          "'Tossface'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Bazier Square'",
          "'Noto Sans KR'",
          "'Segoe UI'",
          "'Apple SD Gothic Neo'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          DEFAULT: "#3182f6",
          light: "#e8f3ff",
          dark: "#1b64da",
          50: "#e8f3ff",
          100: "#c9e2ff",
          200: "#90c2ff",
          300: "#64a8ff",
          400: "#4593fc",
          500: "#3182f6",
          600: "#2272eb",
          700: "#1b64da",
          800: "#1957c2",
          900: "#194aa6",
        },
        positive: {
          DEFAULT: "#03b26c",
          bg: "#f0faf6",
        },
        negative: {
          DEFAULT: "#f04452",
          bg: "#ffeeee",
        },
        warning: {
          DEFAULT: "#fe9800",
          bg: "#fff3e0",
        },
        surface: {
          primary: "#f6f7f9",
          elevated: "#ffffff",
          secondary: "#f2f4f6",
          tertiary: "#e5e8eb",
        },
        text: {
          primary: "#191f28",
          secondary: "#4e5968",
          tertiary: "#8b95a1",
          disabled: "#b0b8c1",
          "on-color": "#ffffff",
        },
        border: {
          primary: "#e5e8eb",
          secondary: "#f2f4f6",
          strong: "#d1d6db",
        },
        sidebar: {
          bg: "#17171c",
          hover: "#2c2c35",
          active: "#3182f6",
          text: "#8b8b99",
          "text-active": "#ffffff",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(2,32,71,0.04)",
        md: "0 2px 8px rgba(2,32,71,0.08)",
        lg: "0 4px 16px rgba(2,32,71,0.12)",
        xl: "0 8px 32px rgba(2,32,71,0.16)",
      },
      fontSize: {
        display: ["32px", { lineHeight: "1.3", fontWeight: "700" }],
        "title-1": ["24px", { lineHeight: "1.3", fontWeight: "700" }],
        "title-2": ["20px", { lineHeight: "1.4", fontWeight: "600" }],
        "title-3": ["17px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-1": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-2": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "caption-1": ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        "caption-2": ["12px", { lineHeight: "1.3", fontWeight: "500" }],
        overline: ["11px", { lineHeight: "1.3", fontWeight: "600" }],
      },
      spacing: {
        "4.5": "18px",
        "5.5": "22px",
      },
      transitionTimingFunction: {
        toss: "cubic-bezier(0.33, 0, 0.67, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
