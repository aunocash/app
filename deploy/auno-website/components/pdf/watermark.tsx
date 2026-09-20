import React from "react";

export type PdfWatermarkProps = {
  text: string; opacity?: number; fontSize?: number; color?: string; angle?: number;
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"; fixed?: boolean;
};
const placements: Record<NonNullable<PdfWatermarkProps["position"]>, string> = { center:"inset-0 flex items-center justify-center", "top-left":"top-10 left-10", "top-right":"top-10 right-10", "bottom-left":"bottom-10 left-10", "bottom-right":"bottom-10 right-10" };
export function PdfWatermark({ text, opacity=0.12, fontSize=56, color="#334155", angle=-28, position="center", fixed=true }: PdfWatermarkProps) {
  const Tag = "div" as unknown as React.ElementType;
  return React.createElement(Tag, { tw:"absolute " + placements[position] + " pointer-events-none", style:{ position:fixed ? "fixed":"absolute", opacity, color, fontSize:fontSize + "px", transform:"rotate(" + angle + "deg)", fontWeight:800, letterSpacing:"0.12em", whiteSpace:"nowrap" }, "aria-hidden":true }, text);
}
