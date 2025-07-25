"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  Share2, 
  Copy, 
  Download, 
  ExternalLink, 
  Check
} from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

interface ExportButtonProps {
  exams: any[]
  filters: any
}

export function ExportButton({ exams, filters }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyUrl = async () => {
    try {
      const currentUrl = window.location.href
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      toast.success("URL copiada al portapapeles")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Error al copiar URL")
    }
  }

  const exportToGoogleCalendar = () => {
    if (exams.length === 0) {
      toast.error("No hay exámenes para exportar")
      return
    }

    const events = exams.map(exam => ({
      text: `${exam.subject} (${exam.code})`,
      dates: exam.date,
      details: `${exam.time} - ${exam.location}\n${exam.school} - ${exam.degree}\n${exam.year} - ${exam.semester}`
    }))

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(events[0].text)}&dates=${encodeURIComponent(events[0].dates)}&details=${encodeURIComponent(events[0].details)}`
    
    window.open(googleUrl, '_blank')
    toast.success("Abriendo Google Calendar")
  }

  const exportToAppleCalendar = () => {
    if (exams.length === 0) {
      toast.error("No hay exámenes para exportar")
      return
    }

    // Generate .ics content
    const icsContent = generateICSContent(exams)
    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = 'exams.ics'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success("Archivo .ics descargado para Apple Calendar")
  }

  const downloadICS = () => {
    if (exams.length === 0) {
      toast.error("No hay exámenes para exportar")
      return
    }

    const icsContent = generateICSContent(exams)
    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = 'exams.ics'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success("Archivo .ics descargado")
  }

  const shareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Resultados de Exámenes UPV',
        text: `Encontré ${exams.length} exámenes con los filtros aplicados`,
        url: window.location.href
      }).then(() => {
        toast.success("Resultados compartidos")
      }).catch(() => {
        toast.error("Error al compartir")
      })
    } else {
      copyUrl()
    }
  }

  const generateICSContent = (exams: any[]) => {
    const now = new Date()
    const icsHeader = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UPV Exam Calendar//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ]

    const events = exams.map(exam => {
      const examDate = new Date(exam.date)
      const startTime = exam.time.split('-')[0].trim()
      const endTime = exam.time.split('-')[1]?.trim() || '23:59'
      
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const [endHour, endMinute] = endTime.split(':').map(Number)
      
      const startDateTime = new Date(examDate)
      startDateTime.setHours(startHour, startMinute, 0, 0)
      
      const endDateTime = new Date(examDate)
      endDateTime.setHours(endHour, endMinute, 0, 0)
      
      const uid = `exam-${exam.id}-${Date.now()}@upv.es`
      
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${startDateTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTEND:${endDateTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `SUMMARY:${exam.subject} (${exam.code})`,
        `DESCRIPTION:${exam.time} - ${exam.location}\\n${exam.school} - ${exam.degree}\\n${exam.year} - ${exam.semester}`,
        `LOCATION:${exam.location}`,
        'END:VEVENT'
      ].join('\r\n')
    })

    return [...icsHeader, ...events, 'END:VCALENDAR'].join('\r\n')
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Share2 className="h-4 w-4" />
          Exportar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={copyUrl}
          >
            <Copy className="h-4 w-4 mr-2" />
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                URL Copiada
              </>
            ) : (
              "Copiar URL"
            )}
          </Button>
          
                     <Button
             variant="ghost"
             size="sm"
             className="w-full justify-start"
             onClick={exportToGoogleCalendar}
           >
             <Image 
               src="/google-cal.png" 
               alt="Google Calendar" 
               width={20} 
               height={20} 
               className="mr-2 -ml-1"
             />
             Google Calendar
           </Button>
          
                                 <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={exportToAppleCalendar}
            >
              <Image 
                src="/apple-cal.png" 
                alt="Apple Calendar" 
                width={16} 
                height={16} 
                className="mr-2"
              />
              Apple Calendar
            </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={downloadICS}
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar .ics
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
} 