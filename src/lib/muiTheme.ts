import { createTheme } from "@mui/material/styles";

/**
 * MUI is used only for the search / autocomplete widgets. This theme keeps those
 * widgets visually consistent with the hand-built design system (Inter, the
 * blue accent, 8px radius, slate borders).
 */
export const muiTheme = createTheme({
  palette: {
    primary: { main: "#2563eb" },
    text: { primary: "#1e293b", secondary: "#64748b" },
    background: { paper: "#ffffff" },
    divider: "#e2e8f0",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: 13.5,
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#dbe2ea" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#94a3b8" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600 },
      },
    },
  },
});
