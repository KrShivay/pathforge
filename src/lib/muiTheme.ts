import { createTheme } from "@mui/material/styles";

const pathForge = {
  brand: "var(--pf-theme-brand)",
  brandHover: "var(--pf-theme-brand-hover)",
  onBrand: "var(--pf-theme-on-brand)",
  surface: "var(--pf-theme-surface)",
  surfaceRaised: "var(--pf-theme-surface-raised)",
  surfaceMuted: "var(--pf-theme-surface-muted)",
  surfaceHover: "var(--pf-theme-surface-hover)",
  text: "var(--pf-theme-text)",
  textMuted: "var(--pf-theme-text-muted)",
  border: "var(--pf-theme-border)",
  borderStrong: "var(--pf-theme-border-strong)",
  danger: "var(--pf-theme-danger)",
};

// MUI parses palette colors while creating the theme, so CSS variables cannot
// be used for these entries. Component style overrides below still use the
// live PathForge tokens, including any future runtime branding changes.
const muiPaletteFallback = {
  brand: "#1769e0",
  brandHover: "#0f58c4",
  onBrand: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f5f8fc",
  text: "#142033",
  textMuted: "#52647a",
  border: "#dbe3ec",
};

/**
 * MUI is used for the wizard's search / autocomplete widgets and the editor's
 * specimen control. Keep those widgets on the same CSS-token contract as the
 * hand-built PathForge controls.
 */
export const muiTheme = createTheme({
  palette: {
    primary: {
      main: muiPaletteFallback.brand,
      dark: muiPaletteFallback.brandHover,
      contrastText: muiPaletteFallback.onBrand,
    },
    text: { primary: muiPaletteFallback.text, secondary: muiPaletteFallback.textMuted },
    background: { default: muiPaletteFallback.surfaceMuted, paper: muiPaletteFallback.surface },
    divider: muiPaletteFallback.border,
  },
  shape: { borderRadius: 9 },
  typography: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
    fontSize: 13,
  },
  components: {
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          width: "100%",
          color: pathForge.text,
          fontSize: 13,
        },
        inputRoot: {
          minHeight: "var(--pf-control-height)",
          padding: "3px 40px 3px 9px !important",
          alignItems: "center",
          gap: 4,
        },
        input: {
          minWidth: 44,
          padding: "5px 4px !important",
        },
        tag: {
          height: 24,
          margin: "3px 4px 3px 0",
          border: `1px solid ${pathForge.border}`,
          backgroundColor: pathForge.surfaceHover,
          color: pathForge.text,
          fontSize: 12,
        },
        paper: {
          marginTop: 4,
          border: `1px solid ${pathForge.border}`,
          borderRadius: 9,
          backgroundColor: pathForge.surface,
          boxShadow: "0 16px 34px rgba(20, 32, 51, 0.14)",
        },
        listbox: {
          padding: 6,
          "& .MuiAutocomplete-option": {
            minHeight: 36,
            borderRadius: 7,
            color: pathForge.text,
            fontSize: 13,
          },
          "& .MuiAutocomplete-option[aria-selected=\"true\"]": {
            backgroundColor: pathForge.surfaceHover,
          },
          "& .MuiAutocomplete-option.Mui-focused": {
            backgroundColor: pathForge.surfaceHover,
          },
        },
        noOptions: {
          padding: "12px 14px",
          color: pathForge.textMuted,
          fontSize: 12,
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: { width: "100%" },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          margin: "5px 2px 0",
          color: pathForge.textMuted,
          fontSize: 11.5,
          lineHeight: 1.35,
          "&.Mui-error": { color: pathForge.danger },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: pathForge.textMuted,
          "&:hover": { backgroundColor: pathForge.surfaceHover, color: pathForge.brand },
          "&.Mui-focusVisible": { outline: `3px solid color-mix(in srgb, ${pathForge.brand} 22%, transparent)` },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: pathForge.text,
          fontFamily: "inherit",
          fontSize: 13,
          lineHeight: 1.4,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: "var(--pf-control-height)",
          borderRadius: 9,
          backgroundColor: pathForge.surfaceRaised,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: pathForge.borderStrong,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: pathForge.brand,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: pathForge.brand,
            borderWidth: 1,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: pathForge.danger,
          },
          "&.Mui-disabled": {
            backgroundColor: pathForge.surfaceMuted,
          },
        },
        input: {
          padding: "9px 12px",
          color: pathForge.text,
          "&::placeholder": {
            color: "#7b8ca2",
            opacity: 1,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 650 },
      },
    },
  },
});
