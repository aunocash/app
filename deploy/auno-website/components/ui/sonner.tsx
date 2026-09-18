"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useAunoTheme } from "@/app/theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useAunoTheme()

  return (
    <Sonner
      theme={theme}
      position="top-right"
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": theme === "dark" ? "#151515" : "#ffffff",
          "--normal-text": theme === "dark" ? "#f7f5f2" : "#171717",
          "--normal-border": theme === "dark" ? "#2d2c2a" : "#dedad4",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
