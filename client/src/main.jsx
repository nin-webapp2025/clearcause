import React from "react"
import ReactDOM from "react-dom/client"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import App from "./App.jsx"
import "./index.css"
import { ClearCauseProvider } from "./context/ClearCauseContext"



ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClearCauseProvider>
      <App />
      <ToastContainer position="bottom-right" />
    </ClearCauseProvider>
  </React.StrictMode>
)