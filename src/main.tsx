import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

document.title = "Korte.ph - Philippines' No. 1 Court Booking App";
document.documentElement.style.minWidth = "360px";

createRoot(document.getElementById("root")!).render(<App />);
