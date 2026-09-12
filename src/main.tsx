import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";

import "./index.css";
import "./lib/nativeMenu";

import App from "./App";
import { muiTheme } from "./lib/muiTheme";

import { PatientProvider } from "./store/PatientContext";
import { TestProvider } from "./store/TestContext";
import { ReportProvider } from "./store/ReportContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme}>
      <PatientProvider>
        <TestProvider>
          <ReportProvider>
            <App />
          </ReportProvider>
        </TestProvider>
      </PatientProvider>
    </ThemeProvider>
  </StrictMode>
);
