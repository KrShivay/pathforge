import { createTheme } from "@mui/material/styles";

/**
 * MUI is used only for the search / autocomplete widgets. This theme keeps those
 * widgets visually consistent with the hand-built design system (Helvetica, the
 * blue accent, 8px radius, slate borders).
 */
export const muiTheme = createTheme({
  palette: {
    primary: { main: "#1769e0", dark: "#0f58c4", contrastText: "#ffffff" },
    text: { primary: "#142033", secondary: "#52647a" },
    background: { default: "#f3f7fc", paper: "#ffffff" },
    divider: "#dbe3ec",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
    fontSize: 13.5,
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#fbfdff",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#c7d2df" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#8da4bd" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1769e0" },
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
