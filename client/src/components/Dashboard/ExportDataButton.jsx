"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "../ui/button"
import { toast } from "react-toastify"

const ExportDataButton = ({ activities, stats }) => {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    try {
      setExporting(true)

      // Prepare data for export
      const exportData = {
        userStats: stats,
        activities: activities,
        exportDate: new Date().toISOString(),
      }

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2)

      // Create a blob and download link
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      // Create download link and trigger download
      const link = document.createElement("a")
      link.href = url
      link.download = `clearcause-data-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()

      // Clean up
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Data exported successfully")
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Failed to export data")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
      onClick={handleExport}
      disabled={exporting || !activities || !stats}
    >
      <Download className="h-4 w-4" />
      {exporting ? "Exporting..." : "Export Data"}
    </Button>
  )
}

export default ExportDataButton

