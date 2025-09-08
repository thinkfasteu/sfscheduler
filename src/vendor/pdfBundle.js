// Bundled PDF utilities (jsPDF + autotable) for lazy import.
// This module installs jsPDF + autotable into window.jspdf (UMD style) for existing code.
// We import from installed npm packages so esbuild can produce a separate chunk.
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function installPDFGlobals(){
  // Emulate previous global exposure from CDN UMD build
  if (!window.jspdf){ window.jspdf = {}; }
  if (!window.jspdf.jsPDF){ window.jspdf.jsPDF = jsPDF; }
}

// Auto-install by default (so simply importing the module is enough)
installPDFGlobals();
