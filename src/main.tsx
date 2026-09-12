import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";

import "./index.css";
import "./lib/nativeMenu";

import App from "./App";
import { muiTheme } from "./lib/muiTheme";

import { PatientProvider } from "./store/PatientContext";
import { TestProvider } from "./store/TestContext";
import { BrandingProvider } from "./store/BrandingContext";
import { ReportProvider } from "./store/ReportContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme}>
      <BrandingProvider>
        <PatientProvider>
          <TestProvider>
            <ReportProvider><App /></ReportProvider>
          </TestProvider>
        </PatientProvider>
      </BrandingProvider>
    </ThemeProvider>
  </StrictMode>
);
