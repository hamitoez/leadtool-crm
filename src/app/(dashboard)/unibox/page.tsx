import { Metadata } from "next";
import { UniboxClient } from "./unibox-client";

export const metadata: Metadata = {
  title: "Unibox | LeadTool",
  description: "Unified Inbox - Alle E-Mail-Antworten an einem Ort",
};

export default function UniboxPage() {
  return <UniboxClient />;
}
